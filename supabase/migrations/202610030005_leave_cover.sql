-- Keep the cover list and leave approval aligned: finished/cancelled cleans
-- do not need cover. Dates include both boundaries in Europe/London.
create function public.leave_cover_visits(request_id uuid)
returns table(id uuid) language plpgsql stable security definer set search_path=public as $$
begin
 perform require_admin();
 return query
 select v.id from visits v join leave_requests r on r.id=request_id
 where v.cleaner_id=r.cleaner_id and v.status in ('scheduled','started')
 and (v.starts_at at time zone 'Europe/London')::date between r.starts_on and r.ends_on
 order by v.starts_at,v.id;
end $$;
revoke all on function public.leave_cover_visits(uuid) from public,anon;
grant execute on function public.leave_cover_visits(uuid) to authenticated;

create or replace function public.review_request(p jsonb) returns void language plpgsql security definer set search_path=public as $$
declare r leave_requests; a availability_requests;
begin perform require_admin(); if p->>'kind'='leave' then
 select * into r from leave_requests where id=(p->>'id')::uuid for update; if not found then raise exception 'Request not found'; end if;
 -- Booking validation takes the same cleaner lock, so a concurrent assignment
 -- cannot slip between the cover check and approval.
 perform 1 from cleaners where id=r.cleaner_id for update;
 if p->>'status'='approved' and exists(select 1 from leave_cover_visits(r.id)) then raise exception 'Reschedule assigned visits before approving leave'; end if;
 update leave_requests set status=p->>'status' where id=r.id;
 else
 select * into a from availability_requests where id=(p->>'id')::uuid for update; if not found then raise exception 'Request not found'; end if;
 perform 1 from cleaners where id=a.cleaner_id for update;
 if p->>'status'='approved' then
 if exists(select 1 from visits where cleaner_id=a.cleaner_id and status<>'cancelled' and extract(dow from starts_at at time zone 'Europe/London')=a.weekday and ((starts_at at time zone 'Europe/London')::time<a.start_time or (ends_at at time zone 'Europe/London')::time>a.end_time)) then raise exception 'New availability conflicts with assigned visits'; end if;
 delete from availability where cleaner_id=a.cleaner_id and weekday=a.weekday;
 insert into availability(cleaner_id,weekday,start_time,end_time) values(a.cleaner_id,a.weekday,a.start_time,a.end_time);
 end if; update availability_requests set status=p->>'status' where id=a.id;
 end if; end $$;
