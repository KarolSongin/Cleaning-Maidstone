-- Keep the booking period separate from individual visits and their exceptions.
alter table public.booking_series add column duration_weeks int;
alter table public.booking_series add column ends_on date;

-- Legacy series had a visit count, not an explicit term. Include cancelled visits
-- when reconstructing the original term so cancellations do not shorten it.
update public.booking_series s set duration_weeks=greatest(s.interval_weeks,
  (select count(*)::int*s.interval_weeks from public.visits v where v.series_id=s.id));
update public.booking_series set ends_on=anchor_date+duration_weeks*7-1;
alter table public.booking_series alter column duration_weeks set not null;
alter table public.booking_series alter column ends_on set not null;
alter table public.booking_series add constraint booking_period_weeks check(duration_weeks between 1 and 52);
alter table public.booking_series add constraint booking_period_end check(ends_on=anchor_date+duration_weeks*7-1);
create index booking_series_end_idx on public.booking_series(ends_on) where active;

create or replace function public.create_booking(p jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  sid uuid; vid uuid; local_date date; local_time time; start_instant timestamptz;
  n int; weeks int; minutes int; term_weeks int;
begin
  perform require_admin();
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
  end loop;
  return coalesce(sid,vid);
end $$;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='booking_series') then
    alter publication supabase_realtime add table public.booking_series;
  end if;
end $$;
