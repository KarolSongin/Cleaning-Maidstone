-- Full hourly splits stay outside cleaner-readable and Realtime visit rows.
-- Existing visits remain explicitly unpriced; no historical rates are invented.
create table public.visit_finances (
  id uuid primary key references public.visits(id) on delete cascade,
  customer_rate_pence int not null check(customer_rate_pence between 1 and 100000),
  admin_rate_pence int not null check(admin_rate_pence between 0 and 100000),
  cleaner_rate_pence int not null check(cleaner_rate_pence between 0 and 100000),
  check(customer_rate_pence=admin_rate_pence+cleaner_rate_pence)
);
create table public.series_finances (
  id uuid primary key references public.booking_series(id) on delete cascade,
  customer_rate_pence int not null check(customer_rate_pence between 1 and 100000),
  admin_rate_pence int not null check(admin_rate_pence between 0 and 100000),
  cleaner_rate_pence int not null check(cleaner_rate_pence between 0 and 100000),
  check(customer_rate_pence=admin_rate_pence+cleaner_rate_pence)
);
alter table public.visit_finances enable row level security;
alter table public.series_finances enable row level security;
create policy admin_read on public.visit_finances for select to authenticated using(public.is_admin());
create policy admin_read on public.series_finances for select to authenticated using(public.is_admin());
revoke all on public.visit_finances,public.series_finances from public,anon,authenticated;
grant select on public.visit_finances,public.series_finances to authenticated;
grant all on public.visit_finances,public.series_finances to service_role;
create trigger audit_change after insert or update or delete on public.visit_finances for each row execute function public.audit_mutation();
create trigger audit_change after insert or update or delete on public.series_finances for each row execute function public.audit_mutation();

-- Publish only a refresh signal. Neither private finance table is added to
-- supabase_realtime, including its unfiltered DELETE payloads.
alter table public.cleaners add column pay_updated_at timestamptz not null default now();
create function public.notify_cleaner_pay() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  update cleaners set pay_updated_at=clock_timestamp()
    where id=(select cleaner_id from visits where id=coalesce(new.id,old.id));
  return coalesce(new,old);
end $$;
create trigger pay_changed after insert or update or delete on public.visit_finances
  for each row execute function public.notify_cleaner_pay();
revoke all on function public.notify_cleaner_pay() from public,anon,authenticated;

create function public.validate_booking_rates(p jsonb) returns void
language plpgsql set search_path=public as $$
declare k text; amount numeric;
begin
  foreach k in array array['customer_rate_pence','admin_rate_pence','cleaner_rate_pence'] loop
    if p->k is null or jsonb_typeof(p->k)<>'number' then
      raise exception 'Set all three hourly rates in whole pennies';
    end if;
    amount:=(p->>k)::numeric;
    if amount<>trunc(amount) or amount<0 or amount>100000 then
      raise exception 'Hourly rates must be between GBP 0 and GBP 1000, in whole pennies';
    end if;
  end loop;
  if (p->>'customer_rate_pence')::int<1 or
    (p->>'customer_rate_pence')::int<>(p->>'admin_rate_pence')::int+(p->>'cleaner_rate_pence')::int then
    raise exception 'Customer hourly rate must equal the admin share plus cleaner cash pay';
  end if;
end $$;
revoke all on function public.validate_booking_rates(jsonb) from public,anon,authenticated;

create or replace function public.create_booking(p jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  sid uuid; vid uuid; local_date date; local_time time; start_instant timestamptz;
  n int; weeks int; minutes int; term_weeks int;
begin
  perform require_admin();
  perform validate_booking_rates(p);
  local_date:=(p->>'date')::date; local_time:=(p->>'time')::time;
  weeks:=(p->>'interval_weeks')::int; minutes:=(p->>'duration_minutes')::int;
  n:=coalesce((p->>'occurrences')::int,1);
  if local_date is null or local_time is null or weeks is null or minutes is null
    or n<1 or n>52 or minutes<30 or minutes>480 or weeks not in (0,1,2) then
    raise exception 'Invalid booking recurrence';
  end if;
  if weeks=0 and n<>1 then raise exception 'One-off booking must have one occurrence'; end if;
  if p->>'duration_weeks' is not null and ((p->>'duration_weeks')::int<1 or (p->>'duration_weeks')::int>52) then
    raise exception 'Recurring bookings can cover at most 52 weeks';
  end if;
  if weeks>0 then
    term_weeks:=coalesce((p->>'duration_weeks')::int,n*weeks);
    if term_weeks<1 or term_weeks>52 or n<>ceil(term_weeks::numeric/weeks)::int then
      raise exception 'The booking period must be 1 to 52 weeks with matching visits';
    end if;
    insert into booking_series(customer_id,cleaner_id,anchor_date,local_time,duration_minutes,interval_weeks,duration_weeks,ends_on)
      values((p->>'customer_id')::uuid,(p->>'cleaner_id')::uuid,local_date,local_time,minutes,weeks,term_weeks,local_date+term_weeks*7-1)
      returning id into sid;
    insert into series_finances(id,customer_rate_pence,admin_rate_pence,cleaner_rate_pence)
      values(sid,(p->>'customer_rate_pence')::int,(p->>'admin_rate_pence')::int,(p->>'cleaner_rate_pence')::int);
  end if;
  for i in 0..n-1 loop
    start_instant:=((local_date+(i*weeks*7))+local_time) at time zone 'Europe/London';
    if (start_instant at time zone 'Europe/London')<>((local_date+(i*weeks*7))+local_time)
      or ((start_instant-interval '1 hour') at time zone 'Europe/London')=((local_date+(i*weeks*7))+local_time) then
      raise exception 'This local time is skipped or repeated by a clock change. Choose another time.';
    end if;
    insert into visits(series_id,customer_id,cleaner_id,starts_at,ends_at,instructions)
      values(sid,(p->>'customer_id')::uuid,(p->>'cleaner_id')::uuid,start_instant,start_instant+make_interval(mins=>minutes),coalesce(p->>'instructions',''))
      returning id into vid;
    insert into visit_finances(id,customer_rate_pence,admin_rate_pence,cleaner_rate_pence)
      values(vid,(p->>'customer_rate_pence')::int,(p->>'admin_rate_pence')::int,(p->>'cleaner_rate_pence')::int);
  end loop;
  return coalesce(sid,vid);
end $$;


create function public.save_visit_finances(p jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare vid uuid;
begin
  perform require_admin();
  perform validate_booking_rates(p);
  select id into vid from visits where id=(p->>'id')::uuid for update;
  if vid is null then raise exception 'Visit not found'; end if;
  insert into visit_finances(id,customer_rate_pence,admin_rate_pence,cleaner_rate_pence)
    values(vid,(p->>'customer_rate_pence')::int,(p->>'admin_rate_pence')::int,(p->>'cleaner_rate_pence')::int)
    on conflict(id) do update set customer_rate_pence=excluded.customer_rate_pence,
      admin_rate_pence=excluded.admin_rate_pence,cleaner_rate_pence=excluded.cleaner_rate_pence;
end $$;
revoke all on function public.save_visit_finances(jsonb) from public,anon;
grant execute on function public.save_visit_finances(jsonb) to authenticated,service_role;

-- Cleaners can see only their own cash rate and cash amount, never the customer
-- rate or admin share. Cash is rounded to pennies; admin receives the remainder
-- of the separately rounded customer total, keeping every visit balanced.
drop function public.cleaner_jobs();
create function public.cleaner_jobs() returns table(
  id uuid,starts_at timestamptz,ends_at timestamptz,status text,instructions text,
  customer_name text,address text,postcode text,cleaner_rate_pence int,cleaner_total_pence int
) language sql stable security definer set search_path=public as $$
  select v.id,v.starts_at,v.ends_at,v.status,v.instructions,c.name,c.address,c.postcode,
    f.cleaner_rate_pence,
    round(f.cleaner_rate_pence::numeric*extract(epoch from (v.ends_at-v.starts_at))/3600)::int
  from visits v join customers c on c.id=v.customer_id
    left join visit_finances f on f.id=v.id
  where v.cleaner_id=auth.uid() and v.status<>'cancelled' order by v.starts_at;
$$;
revoke all on function public.cleaner_jobs() from public,anon;
grant execute on function public.cleaner_jobs() to authenticated,service_role;
