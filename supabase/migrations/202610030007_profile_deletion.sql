-- Deletion removes profiles from active operations, retaining all business history.
alter table public.customers add column deleted_at timestamptz;
alter table public.cleaners add column deleted_at timestamptz;

create function public.delete_customer(cid uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare lead acquisition_leads;
begin
  perform require_admin();
  perform id from customers where id=cid and deleted_at is null for update;
  if not found then raise exception 'Customer not found. Refresh the list.'; end if;
  if exists(select 1 from visits where customer_id=cid and
    (status='started' or (status='scheduled' and ends_at>statement_timestamp()))) then
    raise exception 'Cancel upcoming visits and finish in-progress visits before deleting this customer.';
  end if;
  select * into lead from acquisition_leads where customer_id=cid for update;
  if found then
    update acquisition_leads set stage='closed',next_contact_on=null,updated_at=now() where id=lead.id;
    perform record_pipeline_change(lead.id,lead.stage,'closed','manual','Customer deleted from active profiles. Booking and financial history retained.');
  end if;
  update booking_series set active=false,deleted_at=clock_timestamp() where customer_id=cid and deleted_at is null;
  update customers set deleted_at=clock_timestamp() where id=cid;
  return cid;
end $$;

create function public.delete_cleaner(cid uuid) returns uuid
language plpgsql security definer set search_path=public as $$
begin
  perform require_admin();
  perform id from cleaners where id=cid and deleted_at is null for update;
  if not found then raise exception 'Cleaner not found. Refresh the list.'; end if;
  if cid=auth.uid() then raise exception 'You cannot delete your own account.'; end if;
  if exists(select 1 from visits where cleaner_id=cid and
    (status='started' or (status='scheduled' and ends_at>statement_timestamp()))) then
    raise exception 'Arrange cover or cancel upcoming visits, and finish in-progress visits before deleting this cleaner.';
  end if;
  update leave_requests set status='declined' where cleaner_id=cid and status='pending';
  update availability_requests set status='declined' where cleaner_id=cid and status='pending';
  update cleaners set active=false,deleted_at=clock_timestamp(),pay_updated_at=clock_timestamp() where id=cid;
  return cid;
end $$;

-- The same parent locks serialise deletion with booking and reassignment.
create function public.guard_booking_profiles() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_table_name='visits' and tg_op='UPDATE' then
    -- Historical completion/cancellation is allowed without moving old work.
    if new.customer_id=old.customer_id and new.cleaner_id=old.cleaner_id
      and new.starts_at=old.starts_at and new.ends_at=old.ends_at
      and not (old.status='cancelled' and new.status<>'cancelled') then return new; end if;
  end if;
  perform id from customers where id=new.customer_id and deleted_at is null for update;
  if not found then raise exception 'This customer has been deleted. Choose an active customer.'; end if;
  perform id from cleaners where id=new.cleaner_id and active and deleted_at is null for update;
  if not found then raise exception 'This cleaner is inactive or deleted. Choose an active cleaner.'; end if;
  return new;
end $$;
create trigger a_guard_booking_profiles before insert or update on public.visits
for each row execute function public.guard_booking_profiles();
create trigger guard_series_profiles before insert on public.booking_series
for each row execute function public.guard_booking_profiles();

create function public.guard_deleted_customer() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if old.deleted_at is not null then raise exception 'This customer has been deleted. Their history is read-only.'; end if;
  return new;
end $$;
create trigger guard_deleted_customer before update on public.customers
for each row execute function public.guard_deleted_customer();

create function public.guard_deleted_customer_stage() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.stage<>'closed' and exists(select 1 from customers where id=new.customer_id and deleted_at is not null) then
    raise exception 'This customer has been deleted. Their pipeline history is closed.';
  end if;
  return new;
end $$;
create trigger guard_deleted_customer_stage before update on public.acquisition_leads
for each row execute function public.guard_deleted_customer_stage();

create function public.guard_deleted_cleaner_hours() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  perform id from cleaners where id=coalesce(new.cleaner_id,old.cleaner_id) and deleted_at is null for update;
  if not found then raise exception 'This cleaner has been deleted. Their history is read-only.'; end if;
  return coalesce(new,old);
end $$;
create trigger guard_deleted_cleaner_hours before insert or update or delete on public.availability
for each row execute function public.guard_deleted_cleaner_hours();
create trigger guard_deleted_cleaner_leave before update on public.leave_requests
for each row execute function public.guard_deleted_cleaner_hours();
create trigger guard_deleted_cleaner_requests before update on public.availability_requests
for each row execute function public.guard_deleted_cleaner_hours();

-- Keep confirmed historical associations, but never suggest a removed profile.
create function public.guard_conversation_profiles() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from customers where id=new.suggested_customer_id and deleted_at is not null) then
    new.suggested_customer_id:=null;
  end if;
  if tg_op='INSERT' or new.customer_id is distinct from old.customer_id then
    if exists(select 1 from customers where id=new.customer_id and deleted_at is not null) then
      raise exception 'This customer has been deleted. Choose an active customer.';
    end if;
  end if;
  return new;
end $$;
create trigger guard_conversation_profiles before insert or update on public.conversations
for each row execute function public.guard_conversation_profiles();

create or replace function public.sync_pipeline_internal() returns integer
language plpgsql security definer set search_path=public as $$
declare customer_row record; changed integer:=0;
begin
  with added as (
    insert into acquisition_leads(customer_id,name,email,phone,postcode,source)
    select id,name,coalesce(email,''),coalesce(phone,''),postcode,'existing' from customers where deleted_at is null
    on conflict(customer_id) do nothing returning id,stage
  ) insert into acquisition_history(lead_id,to_stage,reason,note)
    select id,stage,'import','Existing customer added to the acquisition pipeline.' from added;
  for customer_row in select l.customer_id from acquisition_leads l join customers c on c.id=l.customer_id
    where c.deleted_at is null order by l.id loop
    if refresh_customer_pipeline(customer_row.customer_id) then changed:=changed+1; end if;
  end loop;
  return changed;
end $$;

-- Disabling a cleaner also cuts off existing sessions and direct Supabase reads.
create function public.is_current_cleaner() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from cleaners where id=auth.uid() and active and deleted_at is null);
$$;
do $$ declare t text; begin
  foreach t in array array['profiles','cleaners','visits','availability','leave_requests','availability_requests'] loop
    execute format('create policy current_cleaner_access on public.%I as restrictive for select to authenticated using (public.is_admin() or public.is_current_cleaner())',t);
  end loop;
end $$;
create or replace function public.cleaner_jobs() returns table(
  id uuid,starts_at timestamptz,ends_at timestamptz,status text,instructions text,
  customer_name text,address text,postcode text,cleaner_rate_pence int,cleaner_total_pence int
) language sql stable security definer set search_path=public as $$
  select v.id,v.starts_at,v.ends_at,v.status,v.instructions,c.name,c.address,c.postcode,
    f.cleaner_rate_pence,
    round(f.cleaner_rate_pence::numeric*extract(epoch from (v.ends_at-v.starts_at))/3600)::int
  from visits v join customers c on c.id=v.customer_id left join visit_finances f on f.id=v.id
  where v.cleaner_id=auth.uid() and is_current_cleaner() and v.status<>'cancelled' order by v.starts_at;
$$;
create or replace function public.transition_visit(vid uuid,new_status text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not is_current_cleaner() then raise exception 'Cleaner access required' using errcode='42501'; end if;
  update visits set status=new_status where id=vid and cleaner_id=auth.uid()
    and ((status='scheduled' and new_status='started') or (status='started' and new_status='completed'));
  if not found then raise exception 'Visit transition not allowed' using errcode='42501'; end if;
end $$;

revoke all on function public.delete_customer(uuid),public.delete_cleaner(uuid),public.is_current_cleaner(),
  public.guard_booking_profiles(),public.guard_deleted_customer(),public.guard_deleted_customer_stage(),
  public.guard_deleted_cleaner_hours(),public.guard_conversation_profiles() from public,anon,authenticated;
grant execute on function public.delete_customer(uuid),public.delete_cleaner(uuid),public.is_current_cleaner() to authenticated;
