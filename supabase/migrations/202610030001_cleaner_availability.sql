-- Preserve existing hours; new profiles receive the admin's chosen weekly rota.
alter table public.cleaners add column availability_updated_at timestamptz not null default now();

create function public.save_cleaner_availability(p jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare
  cid uuid := (p->>'cleaner_id')::uuid;
  slots jsonb := p->'availability';
  slot jsonb;
begin
  perform require_admin();
  -- Booking validation locks this same row, serialising schedule changes and bookings.
  perform 1 from cleaners where id=cid for update;
  if not found then raise exception 'Cleaner not found'; end if;
  if slots is null or jsonb_typeof(slots)<>'array' then
    raise exception 'Provide weekly availability';
  end if;
  if jsonb_array_length(slots)>28 then raise exception 'Too many availability periods'; end if;
  for slot in select value from jsonb_array_elements(slots) loop
    if jsonb_typeof(slot)<>'object'
       or coalesce(slot->>'weekday','') !~ '^[0-6]$'
       or coalesce(slot->>'start_time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or coalesce(slot->>'end_time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or (slot->>'start_time') >= (slot->>'end_time') then
      raise exception 'Each period needs a valid weekday and increasing hours on the same day';
    end if;
  end loop;
  if exists (
    select 1 from jsonb_array_elements(slots) with ordinality a(value,i)
    cross join jsonb_array_elements(slots) with ordinality b(value,i)
    where a.i<b.i and a.value->>'weekday'=b.value->>'weekday'
      and (a.value->>'start_time')<(b.value->>'end_time')
      and (b.value->>'start_time')<(a.value->>'end_time')
  ) then raise exception 'Availability periods on the same day must not overlap'; end if;

  delete from availability where cleaner_id=cid;
  -- Adjacent periods are a continuous working window and may contain one visit.
  with periods as (
    select * from jsonb_to_recordset(slots) as s(weekday int,start_time time,end_time time)
  ), marked as (
    select *,case when lag(end_time) over(partition by weekday order by start_time)=start_time
      then 0 else 1 end as gap from periods
  ), grouped as (
    select *,sum(gap) over(partition by weekday order by start_time) as block from marked
  )
  insert into availability(cleaner_id,weekday,start_time,end_time)
  select cid,weekday,min(start_time),max(end_time) from grouped group by weekday,block;

  if exists (
    select 1 from visits v where v.cleaner_id=cid
      and v.status in ('scheduled','started') and (v.ends_at>now() or v.status='started')
      and not exists (
        select 1 from availability a where a.cleaner_id=cid
          and a.weekday=extract(dow from v.starts_at at time zone 'Europe/London')
          and (v.starts_at at time zone 'Europe/London')::date=(v.ends_at at time zone 'Europe/London')::date
          and a.start_time<=(v.starts_at at time zone 'Europe/London')::time
          and a.end_time>=(v.ends_at at time zone 'Europe/London')::time
      )
  ) then raise exception 'Move conflicting upcoming visits before changing weekly availability'; end if;
end $$;
revoke all on function public.save_cleaner_availability(jsonb) from public,anon;
grant execute on function public.save_cleaner_availability(jsonb) to authenticated,service_role;

create or replace function public.register_cleaner(p jsonb) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform require_admin();
  if not exists(select 1 from profiles where id=(p->>'id')::uuid and role='cleaner') then
    raise exception 'A cleaner profile is required';
  end if;
  if length(trim(coalesce(p->>'name','')))<2 or length(p->>'name')>100 then
    raise exception 'Enter a cleaner name';
  end if;
  if p->'availability' is null or jsonb_typeof(p->'availability')<>'array' then
    raise exception 'Choose weekly availability';
  end if;
  if jsonb_array_length(p->'availability')=0 then
    raise exception 'Choose at least one working day and its hours';
  end if;
  insert into cleaners(id,name) values((p->>'id')::uuid,trim(p->>'name'));
  perform save_cleaner_availability(jsonb_build_object('cleaner_id',p->'id','availability',p->'availability'));
end $$;

-- A cleaner-row update safely refreshes their own hours even when all periods are removed.
-- Cleaners never subscribe to availability DELETE payloads, which lack RLS evaluation.
create function public.notify_cleaner_availability() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  update cleaners set availability_updated_at=clock_timestamp() where id=coalesce(new.cleaner_id,old.cleaner_id);
  return coalesce(new,old);
end $$;
revoke all on function public.notify_cleaner_availability() from public,anon,authenticated;
create trigger notify_hours after insert or update or delete on public.availability
for each row execute function public.notify_cleaner_availability();
create trigger audit_change after insert or update or delete on public.availability
for each row execute function public.audit_mutation();

do $$ declare t text; begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['cleaners','availability'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I',t);
      end if;
    end loop;
  end if;
end $$;
