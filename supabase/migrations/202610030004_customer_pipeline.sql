-- A private acquisition record survives enquiry intake, customer creation and booking.
create table public.acquisition_leads (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid unique references public.customers(id),
 name text not null check(length(btrim(name)) between 2 and 100),
 email text not null default '', phone text not null default '', postcode text not null default '',
 source text not null check(source in ('website','manual','existing')),
 stage text not null default 'opportunity' check(stage in ('opportunity','contacted','quoted','first_clean_booked','recurring_follow_up','onboarded','closed')),
 stage_before_booking text check(stage_before_booking in ('opportunity','contacted','quoted')),
 first_visit_id uuid references public.visits(id) on delete set null,
 first_clean_on date, follow_up_due_on date, next_contact_on date,
 notes text not null default '' check(length(notes)<=10000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.acquisition_history (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null references public.acquisition_leads(id) on delete cascade,
 from_stage text, to_stage text not null,
 reason text not null check(reason in ('intake','manual','booking','date','cancelled','linked','import')),
 note text not null default '', actor_id uuid references public.profiles(id),
 created_at timestamptz not null default now()
);
create index acquisition_stage on public.acquisition_leads(stage,follow_up_due_on);
create index acquisition_history_lead on public.acquisition_history(lead_id,created_at);
create index visits_customer_first on public.visits(customer_id,starts_at,id) where status<>'cancelled';
alter table public.enquiries add column pipeline_id uuid references public.acquisition_leads(id);
create index enquiries_pipeline on public.enquiries(pipeline_id);
alter table public.acquisition_leads enable row level security;
alter table public.acquisition_history enable row level security;
create policy admin_all on public.acquisition_leads for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_all on public.acquisition_history for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select on public.acquisition_leads,public.acquisition_history to authenticated;
grant all on public.acquisition_leads,public.acquisition_history to service_role;
create trigger audit_change after insert or update or delete on public.acquisition_leads for each row execute function public.audit_mutation();
create trigger audit_change after insert or update or delete on public.acquisition_history for each row execute function public.audit_mutation();

-- Internal helpers have no application-role EXECUTE grants.
create function public.record_pipeline_change(lid uuid,previous text,current_stage text,why text,description text default '') returns void language plpgsql security definer set search_path=public as $$
begin
 insert into acquisition_history(lead_id,from_stage,to_stage,reason,note,actor_id) values(lid,previous,current_stage,why,description,auth.uid());
 update enquiries set status=case current_stage when 'opportunity' then 'new' when 'closed' then 'closed' when 'onboarded' then 'converted' else 'contacted' end
 where pipeline_id=lid and status is distinct from case current_stage when 'opportunity' then 'new' when 'closed' then 'closed' when 'onboarded' then 'converted' else 'contacted' end;
end $$;

create function public.pipeline_booking_stage(first_start timestamptz,as_of timestamptz) returns text language sql immutable set search_path=public as $$
 select case when (first_start at time zone 'Europe/London')::date < (as_of at time zone 'Europe/London')::date then 'recurring_follow_up' else 'first_clean_booked' end;
$$;
create function public.refresh_customer_pipeline(cid uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare lead acquisition_leads; first_job visits; target text; prior text; clean_date date; due_date date; why text;
begin
 select * into lead from acquisition_leads where customer_id=cid for update;
 if not found then return false; end if;
 select * into first_job from visits where customer_id=cid and status<>'cancelled' order by starts_at,id limit 1;
 clean_date:=(first_job.starts_at at time zone 'Europe/London')::date;
 due_date:=clean_date+1;
 target:=lead.stage; prior:=lead.stage_before_booking; why:='booking';
 if lead.stage not in ('onboarded','closed') then
  if first_job.id is not null then
   if lead.stage in ('opportunity','contacted','quoted') then prior:=lead.stage; end if;
   target:=pipeline_booking_stage(first_job.starts_at,now());
   if target='recurring_follow_up' then why:='date'; end if;
  elsif lead.stage in ('first_clean_booked','recurring_follow_up') then
   target:=coalesce(prior,'opportunity'); prior:=null; why:='cancelled';
  end if;
 end if;
 if lead.stage is distinct from target or lead.first_visit_id is distinct from first_job.id or lead.first_clean_on is distinct from clean_date or lead.follow_up_due_on is distinct from due_date or lead.stage_before_booking is distinct from prior then
  update acquisition_leads set stage=target,stage_before_booking=prior,first_visit_id=first_job.id,first_clean_on=clean_date,follow_up_due_on=due_date,updated_at=now() where id=lead.id;
  if lead.stage<>target then
   perform record_pipeline_change(lead.id,lead.stage,target,why,case why when 'date' then 'First cleaning date has passed. Contact the customer about a recurring agreement.' when 'cancelled' then 'No active first cleaning remains. Returned to the previous stage.' else 'First cleaning booking created or rescheduled.' end);
  end if;
  return true;
 end if;
 return false;
end $$;

create function public.sync_pipeline_internal() returns integer language plpgsql security definer set search_path=public as $$
declare customer_row record; changed integer:=0;
begin
 -- Also covers legacy/imported customers and the synthetic seed, without altering their records.
 with added as (
  insert into acquisition_leads(customer_id,name,email,phone,postcode,source)
  select id,name,coalesce(email,''),coalesce(phone,''),postcode,'existing' from customers
  on conflict(customer_id) do nothing returning id,stage
 ) insert into acquisition_history(lead_id,to_stage,reason,note) select id,stage,'import','Existing customer added to the acquisition pipeline.' from added;
 for customer_row in select customer_id from acquisition_leads where customer_id is not null order by id loop
  if refresh_customer_pipeline(customer_row.customer_id) then changed:=changed+1; end if;
 end loop;
 return changed;
end $$;
create function public.sync_customer_pipeline() returns integer language plpgsql security definer set search_path=public as $$
begin perform require_admin(); return sync_pipeline_internal(); end $$;
create function public.run_customer_pipeline_job() returns integer language plpgsql security definer set search_path=public as $$
begin return sync_pipeline_internal(); end $$;

create function public.capture_enquiry_pipeline() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into acquisition_leads(name,email,phone,postcode,source,notes,created_at) values(new.name,new.email,new.phone,new.postcode,'website',new.notes,new.created_at) returning id into new.pipeline_id;
 perform record_pipeline_change(new.pipeline_id,null,'opportunity','intake','Website contact form received.');
 return new;
end $$;
create trigger capture_pipeline before insert on public.enquiries for each row execute function public.capture_enquiry_pipeline();

create function public.visit_pipeline_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='DELETE' then perform refresh_customer_pipeline(old.customer_id); return old; end if;
 perform refresh_customer_pipeline(new.customer_id);
 if tg_op='UPDATE' and old.customer_id<>new.customer_id then perform refresh_customer_pipeline(old.customer_id); end if;
 return new;
end $$;
create trigger update_pipeline after insert or update or delete on public.visits for each row execute function public.visit_pipeline_change();

create function public.customer_pipeline_details() returns trigger language plpgsql security definer set search_path=public as $$
begin
 update acquisition_leads set name=new.name,email=coalesce(new.email,''),phone=coalesce(new.phone,''),postcode=new.postcode,updated_at=now()
 where customer_id=new.id and (name,email,phone,postcode) is distinct from (new.name,coalesce(new.email,''),coalesce(new.phone,''),new.postcode);
 return new;
end $$;
create trigger update_pipeline_details after update on public.customers for each row execute function public.customer_pipeline_details();

create function public.save_opportunity(p jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare lid uuid; linked_customer uuid;
begin
 perform require_admin();
 if length(btrim(coalesce(p->>'name','')))<2 or length(p->>'name')>100 or length(coalesce(p->>'email',''))>254 or length(coalesce(p->>'phone',''))>30 or length(coalesce(p->>'postcode',''))>10 or length(coalesce(p->>'notes',''))>10000 then raise exception 'Check the opportunity contact details'; end if;
 if coalesce(btrim(p->>'email'),'')='' and coalesce(btrim(p->>'phone'),'')='' then raise exception 'Add an email address or phone number'; end if;
 lid:=nullif(p->>'id','')::uuid;
 if lid is null then
  insert into acquisition_leads(name,email,phone,postcode,source,notes,next_contact_on) values(btrim(p->>'name'),coalesce(p->>'email',''),coalesce(p->>'phone',''),coalesce(p->>'postcode',''),'manual',coalesce(p->>'notes',''),nullif(p->>'next_contact_on','')::date) returning id into lid;
  perform record_pipeline_change(lid,null,'opportunity','intake','Opportunity entered by an admin.');
 else
  select customer_id into linked_customer from acquisition_leads where id=lid for update;
  if not found then raise exception 'Opportunity not found'; end if;
  update acquisition_leads set name=btrim(p->>'name'),email=coalesce(p->>'email',''),phone=coalesce(p->>'phone',''),postcode=coalesce(p->>'postcode',''),notes=coalesce(p->>'notes',''),next_contact_on=nullif(p->>'next_contact_on','')::date,updated_at=now() where id=lid;
  if linked_customer is not null then update customers set name=btrim(p->>'name'),email=coalesce(p->>'email',''),phone=coalesce(p->>'phone',''),postcode=coalesce(p->>'postcode','') where id=linked_customer; end if;
 end if;
 return lid;
end $$;

create function public.set_pipeline_stage(p jsonb) returns void language plpgsql security definer set search_path=public as $$
declare lead acquisition_leads; target text;
begin
 perform require_admin();
 select * into lead from acquisition_leads where id=(p->>'id')::uuid for update;
 if not found then raise exception 'Opportunity not found'; end if;
 if lead.customer_id is not null then perform refresh_customer_pipeline(lead.customer_id); end if;
 select * into lead from acquisition_leads where id=lead.id;
 if lead.stage is distinct from p->>'expected_stage' then raise exception 'The stage has changed. Refresh and try again.'; end if;
 target:=p->>'stage';
 if target not in ('opportunity','contacted','quoted','onboarded','closed') or target is null then raise exception 'Booking and recurring follow-up stages are set automatically'; end if;
 if length(coalesce(p->>'note',''))>2000 then raise exception 'Stage note is too long'; end if;
 if target='onboarded' and lead.customer_id is null then raise exception 'Create or link a customer profile before confirming onboarding'; end if;
 if target in ('opportunity','contacted','quoted') and lead.stage not in ('onboarded','closed') and exists(select 1 from visits where customer_id=lead.customer_id and status<>'cancelled') then raise exception 'The first cleaning controls this stage. Change or cancel that visit first.'; end if;
 if lead.stage<>target then
  update acquisition_leads set stage=target,updated_at=now() where id=lead.id;
  perform record_pipeline_change(lead.id,lead.stage,target,'manual',coalesce(p->>'note',''));
  if lead.customer_id is not null then perform refresh_customer_pipeline(lead.customer_id); end if;
 end if;
end $$;

-- Profile creation links the existing lead. An explicit existing-customer choice merges
-- enquiries/history into that customer's record instead of making a duplicate profile.
create or replace function public.save_customer(p jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid; lid uuid; other acquisition_leads; lead acquisition_leads; target text;
begin
 perform require_admin();
 cid:=nullif(p->>'id','')::uuid; lid:=nullif(p->>'pipeline_id','')::uuid;
 perform id from acquisition_leads where id=lid or customer_id=cid order by id for update;
 if lid is not null then
  select * into lead from acquisition_leads where id=lid;
  if not found then raise exception 'Opportunity not found'; end if;
  if lead.customer_id is not null and cid is not null and lead.customer_id<>cid then raise exception 'This opportunity already has a customer profile'; end if;
  cid:=coalesce(lead.customer_id,cid);
 end if;
 if length(btrim(coalesce(p->>'address','')))<2 or length(btrim(coalesce(p->>'postcode','')))<2 then raise exception 'Add the home address and postcode before creating a customer profile'; end if;
 cid:=coalesce(cid,gen_random_uuid());
 insert into customers(id,name,email,phone,address,postcode,preferences,internal_notes) values(cid,p->>'name',p->>'email',p->>'phone',p->>'address',p->>'postcode',coalesce(p->>'preferences',''),coalesce(p->>'internal_notes',''))
 on conflict(id) do update set name=excluded.name,email=excluded.email,phone=excluded.phone,address=excluded.address,postcode=excluded.postcode,preferences=excluded.preferences,internal_notes=excluded.internal_notes;
 if lid is null then
  insert into acquisition_leads(customer_id,name,email,phone,postcode,source) values(cid,p->>'name',coalesce(p->>'email',''),coalesce(p->>'phone',''),p->>'postcode','manual')
  on conflict(customer_id) do nothing returning id into lid;
  if lid is not null then perform record_pipeline_change(lid,null,'opportunity','intake','Customer entered by an admin.'); end if;
 else
  select * into other from acquisition_leads where customer_id=cid and id<>lid;
  if found then
   -- Keep the existing customer's stage and notes when explicitly linking a lead.
   update enquiries set pipeline_id=other.id,customer_id=cid where pipeline_id=lid;
   update acquisition_history set lead_id=other.id where lead_id=lid;
   update acquisition_leads set notes=concat_ws(E'\n\n',nullif(other.notes,''),nullif(lead.notes,'')),next_contact_on=least(other.next_contact_on,lead.next_contact_on),updated_at=now() where id=other.id;
   delete from acquisition_leads where id=lid;
   lid:=other.id;
   perform record_pipeline_change(lid,other.stage,other.stage,'linked','An enquiry was linked to this existing customer. Their stage was retained.');
  else
   update acquisition_leads set customer_id=cid,name=p->>'name',email=coalesce(p->>'email',''),phone=coalesce(p->>'phone',''),postcode=p->>'postcode',updated_at=now() where id=lid;
   update enquiries set customer_id=cid where pipeline_id=lid;
   if lead.customer_id is null then perform record_pipeline_change(lid,lead.stage,lead.stage,'linked','Customer profile created from this opportunity.'); end if;
  end if;
 end if;
 perform refresh_customer_pipeline(cid);
 return cid;
end $$;

-- Existing records retain their contact data and bookings; no regular agreement is inferred.
insert into acquisition_leads(customer_id,name,email,phone,postcode,source,created_at,stage)
select c.id,c.name,coalesce(c.email,''),coalesce(c.phone,''),c.postcode,'existing',c.created_at,
 case when exists(select 1 from enquiries e where e.customer_id=c.id and e.status in ('contacted','converted')) then 'contacted'
      when exists(select 1 from enquiries e where e.customer_id=c.id and e.status='new') then 'opportunity'
      when exists(select 1 from enquiries e where e.customer_id=c.id and e.status='closed') then 'closed'
      else 'opportunity' end from customers c;
do $$ declare enquiry_row enquiries; lid uuid; initial_stage text;
begin
 for enquiry_row in select * from enquiries order by created_at,id loop
  select id into lid from acquisition_leads where customer_id=enquiry_row.customer_id;
  if not found then
   initial_stage:=case enquiry_row.status when 'closed' then 'closed' when 'new' then 'opportunity' else 'contacted' end;
   insert into acquisition_leads(customer_id,name,email,phone,postcode,source,stage,notes,created_at) values(enquiry_row.customer_id,enquiry_row.name,enquiry_row.email,enquiry_row.phone,enquiry_row.postcode,'website',initial_stage,enquiry_row.notes,enquiry_row.created_at) returning id into lid;
  end if;
  update enquiries set pipeline_id=lid where id=enquiry_row.id;
 end loop;
end $$;
insert into acquisition_history(lead_id,to_stage,reason,note) select id,stage,'import','Existing record imported. Regular onboarding requires admin confirmation.' from acquisition_leads;
select public.sync_pipeline_internal();
alter table public.enquiries alter column pipeline_id set not null;

create or replace function public.update_enquiry(eid uuid,new_status text) returns void language plpgsql security definer set search_path=public as $$
begin
 perform require_admin();
 raise exception 'Manage acquisition stages in the customer pipeline';
end $$;

revoke all on function public.pipeline_booking_stage(timestamptz,timestamptz),public.record_pipeline_change(uuid,text,text,text,text),public.refresh_customer_pipeline(uuid),public.sync_pipeline_internal(),public.capture_enquiry_pipeline(),public.visit_pipeline_change(),public.customer_pipeline_details(),public.sync_customer_pipeline(),public.run_customer_pipeline_job(),public.save_opportunity(jsonb),public.set_pipeline_stage(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.sync_customer_pipeline(),public.save_opportunity(jsonb),public.set_pipeline_stage(jsonb) to authenticated;
grant execute on function public.run_customer_pipeline_job() to service_role;

-- If pg_cron is already enabled, date transitions run even with no browser open.
-- Otherwise the authenticated HTTP job supplies the scheduler; admin reads also catch up.
do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  perform cron.schedule('maidstone-customer-pipeline','5 * * * *','select public.sync_pipeline_internal();');
 end if;
end $$;
