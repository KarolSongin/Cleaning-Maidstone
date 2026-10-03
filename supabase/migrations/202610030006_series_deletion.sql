-- Retain the original agreement for historical visits, but remove it from the
-- operational series list. No existing booking is deleted by this migration.
alter table public.booking_series add column deleted_at timestamptz;

create function public.delete_booking_series(sid uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  series booking_series;
  cutoff timestamptz := statement_timestamp();
  affected_cleaners uuid[];
begin
  perform require_admin();
  select * into series from booking_series where id=sid for update;
  if not found or series.deleted_at is not null then
    raise exception 'Recurring booking not found. Refresh the list.';
  end if;
  -- A visit cannot be started or rescheduled between the decision and deletion.
  perform id from visits where series_id=sid order by id for update;
  select array_agg(distinct cleaner_id) into affected_cleaners from visits
    where series_id=sid and starts_at>cutoff and status in ('scheduled','cancelled');
  delete from visits where series_id=sid and starts_at>cutoff
    and status in ('scheduled','cancelled');
  -- Visit-finance rows for removed work cascade; retained snapshots and the
  -- original series rates stay intact. Acquisition and audit triggers still run.
  update booking_series set active=false,deleted_at=cutoff where id=sid;
  -- Cleaner Realtime subscriptions intentionally exclude DELETE payloads.
  -- Signal each affected cleaner through their own safe row instead.
  update cleaners set pay_updated_at=clock_timestamp() where id=any(affected_cleaners);
  return sid;
end $$;
revoke all on function public.delete_booking_series(uuid) from public,anon;
grant execute on function public.delete_booking_series(uuid) to authenticated;
