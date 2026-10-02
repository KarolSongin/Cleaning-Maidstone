-- Run on Supabase Postgres. Local demo creates auth.uid()/roles before applying this file.
create extension if not exists btree_gist;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '', role text not null default 'cleaner' check(role in ('admin','cleaner')),
 created_at timestamptz not null default now()
);
create function public.is_admin() returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from profiles where id=auth.uid() and role='admin'); $$;
create function public.on_auth_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name','')); return new; end $$;
create trigger auth_user_created after insert on auth.users for each row execute function public.on_auth_user();

create table public.cleaners(id uuid primary key references profiles(id), name text not null, active boolean not null default true);
create table public.customers(id uuid primary key default gen_random_uuid(), name text not null, email text, phone text, address text not null default '', postcode text not null default '', preferences text not null default '', internal_notes text not null default '', created_at timestamptz not null default now());
create index customers_phone_idx on customers(phone);
create table public.enquiries(id uuid primary key default gen_random_uuid(), customer_id uuid references customers(id), name text not null, email text not null, phone text not null, postcode text not null, frequency text not null check(frequency in ('weekly','fortnightly','discuss')), home_size text not null, preferred_days text[] not null default '{}', notes text not null default '', status text not null default 'new' check(status in ('new','contacted','converted','closed')), created_at timestamptz not null default now());
create table public.availability(id uuid primary key default gen_random_uuid(), cleaner_id uuid not null references cleaners(id), weekday int not null check(weekday between 0 and 6), start_time time not null, end_time time not null, check(start_time<end_time), unique(cleaner_id,weekday,start_time));
create table public.leave_requests(id uuid primary key default gen_random_uuid(), cleaner_id uuid not null references cleaners(id), starts_on date not null, ends_on date not null, reason text not null default '', status text not null default 'pending' check(status in ('pending','approved','declined')), check(ends_on>=starts_on));
create table public.availability_requests(id uuid primary key default gen_random_uuid(), cleaner_id uuid not null references cleaners(id), weekday int not null check(weekday between 0 and 6), start_time time not null, end_time time not null, status text not null default 'pending' check(status in ('pending','approved','declined')), check(start_time<end_time));
create table public.booking_series(id uuid primary key default gen_random_uuid(), customer_id uuid not null references customers(id), cleaner_id uuid not null references cleaners(id), anchor_date date not null, local_time time not null, duration_minutes int not null check(duration_minutes between 30 and 480), interval_weeks int not null check(interval_weeks in (1,2)), timezone text not null default 'Europe/London' check(timezone='Europe/London'), active boolean not null default true);
create table public.visits(id uuid primary key default gen_random_uuid(), series_id uuid references booking_series(id), customer_id uuid not null references customers(id), cleaner_id uuid not null references cleaners(id), starts_at timestamptz not null, ends_at timestamptz not null, instructions text not null default '', status text not null default 'scheduled' check(status in ('scheduled','started','completed','cancelled')), is_exception boolean not null default false, check(ends_at>starts_at), constraint no_cleaner_overlap exclude using gist(cleaner_id with =, tstzrange(starts_at,ends_at,'[)') with &&) where (status <> 'cancelled'));
create index visits_start_idx on visits(starts_at);
create index visits_customer_idx on visits(customer_id);
create index visits_series_idx on visits(series_id);
create function public.validate_visit() returns trigger language plpgsql security definer set search_path=public as $$
declare local_start timestamp; local_end timestamp;
begin
 if new.status='cancelled' then return new; end if;
 -- Take the lock before reading availability, so concurrent approvals cannot invalidate the check.
 perform 1 from cleaners where id=new.cleaner_id for update;
 local_start:=new.starts_at at time zone 'Europe/London'; local_end:=new.ends_at at time zone 'Europe/London';
 if not exists(select 1 from cleaners where id=new.cleaner_id and active) then raise exception 'Cleaner is inactive'; end if;
 if local_start::date<>local_end::date or not exists(select 1 from availability where cleaner_id=new.cleaner_id and weekday=extract(dow from local_start) and start_time<=local_start::time and end_time>=local_end::time) then raise exception 'Visit is outside cleaner availability'; end if;
 if exists(select 1 from leave_requests where cleaner_id=new.cleaner_id and status='approved' and local_start::date between starts_on and ends_on) then raise exception 'Cleaner is on approved leave'; end if;
 return new;
end $$;
create trigger check_visit before insert or update on visits for each row execute function public.validate_visit();

create table public.content(id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('page','blog')), slug text not null check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), title text not null, excerpt text not null default '', seo_title text not null default '', seo_description text not null default '', body jsonb not null default '{"type":"doc","content":[]}', sections jsonb not null default '[]', image_path text, image_alt text not null default '', author text not null default '', category text not null default '', status text not null default 'draft' check(status in ('draft','published')), published_at timestamptz, updated_at timestamptz not null default now(), unique(kind,slug), check(status<>'published' or published_at is not null));
create index content_public_idx on content(status,kind,slug);
create table public.conversations(id uuid primary key default gen_random_uuid(), provider text not null, root_call_id text not null, caller text not null, direction text not null default 'inbound', status text not null default 'initiated', status_rank int not null default 0, started_at timestamptz not null default now(), duration_seconds int not null default 0, suggested_customer_id uuid references customers(id), customer_id uuid references customers(id), recording_status text not null default 'disabled', transcript_status text not null default 'disabled', unique(provider,root_call_id));
create table public.call_events(id uuid primary key default gen_random_uuid(), conversation_id uuid not null references conversations(id) on delete cascade, provider text not null, event_key text not null, call_leg_id text not null, status text not null, occurred_at timestamptz not null, unique(provider,event_key));
create table public.recordings(id uuid primary key default gen_random_uuid(), conversation_id uuid not null references conversations(id) on delete cascade, provider_sid text not null unique, private_path text, expires_at timestamptz not null, created_at timestamptz not null default now());
create table public.transcripts(id uuid primary key default gen_random_uuid(), conversation_id uuid not null references conversations(id) on delete cascade, status text not null check(status in ('processing','completed','failed')), text text, error_code text, is_ai_summary boolean not null default false, human_reviewed boolean not null default false, created_at timestamptz not null default now());
create table public.conversation_notes(id uuid primary key default gen_random_uuid(), conversation_id uuid not null references conversations(id) on delete cascade, author_id uuid not null references profiles(id), body text not null, created_at timestamptz not null default now());
create table public.follow_up_tasks(id uuid primary key default gen_random_uuid(), customer_id uuid references customers(id), conversation_id uuid references conversations(id) on delete cascade, title text not null, due_on date not null, done boolean not null default false);
create table public.audit_records(id bigint generated always as identity primary key, actor_id uuid, entity text not null, entity_id text not null, operation text not null, created_at timestamptz not null default now());
create table public.enquiry_throttle(key text primary key, window_start timestamptz not null default now(), attempts int not null default 0);

-- Remove implicit grants; every table gets explicit RLS and grants below.
revoke all on all tables in schema public from anon,authenticated;
revoke all on all sequences in schema public from anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['profiles','cleaners','customers','enquiries','availability','leave_requests','availability_requests','booking_series','visits','content','conversations','call_events','recordings','transcripts','conversation_notes','follow_up_tasks','audit_records','enquiry_throttle'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy admin_all on public.%I for all to authenticated using(public.is_admin()) with check(public.is_admin())',t);
 end loop;
end $$;
create policy own_profile on profiles for select to authenticated using(id=auth.uid());
create policy own_cleaner on cleaners for select to authenticated using(id=auth.uid());
create policy own_availability on availability for select to authenticated using(cleaner_id=auth.uid());
create policy own_leave on leave_requests for select to authenticated using(cleaner_id=auth.uid());
create policy own_availability_requests on availability_requests for select to authenticated using(cleaner_id=auth.uid());
create policy own_visits on visits for select to authenticated using(cleaner_id=auth.uid());
create policy published_content on content for select to anon,authenticated using(status='published');
grant select on profiles,cleaners,availability,leave_requests,availability_requests,visits,content to authenticated;
grant select on customers,enquiries,booking_series,conversations,call_events,recordings,transcripts,conversation_notes,follow_up_tasks,audit_records to authenticated;
grant select on content to anon;
grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;

create function public.audit_mutation() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into audit_records(actor_id,entity,entity_id,operation) values(auth.uid(),tg_table_name,coalesce(new.id,old.id)::text,tg_op); return coalesce(new,old); end $$;
do $$ declare t text; begin foreach t in array array['customers','enquiries','visits','booking_series','content','conversations','recordings','leave_requests','availability_requests','follow_up_tasks'] loop execute format('create trigger audit_change after insert or update or delete on %I for each row execute function audit_mutation()',t); end loop; end $$;

create function public.require_admin() returns void language plpgsql security definer set search_path=public as $$ begin if not is_admin() then raise exception 'Admin access required' using errcode='42501'; end if; end $$;
create function public.save_customer(p jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid; begin perform require_admin();
 cid:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
 insert into customers(id,name,email,phone,address,postcode,preferences,internal_notes) values(cid,p->>'name',p->>'email',p->>'phone',p->>'address',p->>'postcode',coalesce(p->>'preferences',''),coalesce(p->>'internal_notes',''))
 on conflict(id) do update set name=excluded.name,email=excluded.email,phone=excluded.phone,address=excluded.address,postcode=excluded.postcode,preferences=excluded.preferences,internal_notes=excluded.internal_notes; return cid; end $$;
create function public.submit_enquiry(p jsonb, throttle_key text) returns uuid language plpgsql security definer set search_path=public as $$
declare eid uuid; attempts_now int;
begin
 insert into enquiry_throttle(key,attempts) values(throttle_key,1) on conflict(key) do update set attempts=case when enquiry_throttle.window_start<now()-interval '15 minutes' then 1 else enquiry_throttle.attempts+1 end,window_start=case when enquiry_throttle.window_start<now()-interval '15 minutes' then now() else enquiry_throttle.window_start end returning attempts into attempts_now;
 if attempts_now>5 then raise exception 'Please wait before submitting another enquiry' using errcode='P0001'; end if;
 insert into enquiries(name,email,phone,postcode,frequency,home_size,preferred_days,notes) values(p->>'name',p->>'email',p->>'phone',p->>'postcode',p->>'frequency',p->>'home_size',array(select jsonb_array_elements_text(p->'preferred_days')),coalesce(p->>'notes','')) returning id into eid; return eid;
end $$;
create function public.update_enquiry(eid uuid,new_status text) returns void language plpgsql security definer set search_path=public as $$ begin perform require_admin(); update enquiries set status=new_status where id=eid; if not found then raise exception 'Enquiry not found'; end if; end $$;
create function public.create_booking(p jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare sid uuid; vid uuid; local_date date; local_time time; start_instant timestamptz; n int; weeks int; minutes int;
begin perform require_admin(); local_date:=(p->>'date')::date; local_time:=(p->>'time')::time; weeks:=(p->>'interval_weeks')::int; minutes:=(p->>'duration_minutes')::int; n:=coalesce((p->>'occurrences')::int,1);
 if n<1 or n>26 or minutes<30 or minutes>480 or weeks not in (0,1,2) then raise exception 'Invalid booking recurrence'; end if;
 if weeks=0 and n<>1 then raise exception 'One-off booking must have one occurrence'; end if;
 if weeks>0 then insert into booking_series(customer_id,cleaner_id,anchor_date,local_time,duration_minutes,interval_weeks) values((p->>'customer_id')::uuid,(p->>'cleaner_id')::uuid,local_date,local_time,minutes,weeks) returning id into sid; end if;
 for i in 0..n-1 loop
 start_instant:=((local_date+(i*weeks*7))+local_time) at time zone 'Europe/London';
 if (start_instant at time zone 'Europe/London')<>((local_date+(i*weeks*7))+local_time) or ((start_instant-interval '1 hour') at time zone 'Europe/London')=((local_date+(i*weeks*7))+local_time) then raise exception 'This local time is skipped or repeated by a clock change. Choose another time.'; end if;
 insert into visits(series_id,customer_id,cleaner_id,starts_at,ends_at,instructions) values(sid,(p->>'customer_id')::uuid,(p->>'cleaner_id')::uuid,start_instant,start_instant+make_interval(mins=>minutes),coalesce(p->>'instructions','')) returning id into vid;
 end loop; return coalesce(sid,vid);
end $$;
create function public.change_visit(p jsonb) returns void language plpgsql security definer set search_path=public as $$
declare v visits; s timestamptz; begin perform require_admin(); select * into v from visits where id=(p->>'id')::uuid for update; if not found then raise exception 'Visit not found'; end if;
 s:=coalesce(nullif(p->>'starts_at','')::timestamptz,v.starts_at);
 update visits set starts_at=s,ends_at=s+(v.ends_at-v.starts_at),cleaner_id=coalesce(nullif(p->>'cleaner_id','')::uuid,v.cleaner_id),status=coalesce(p->>'status',v.status),is_exception=true where id=v.id; end $$;
create function public.cleaner_jobs() returns table(id uuid,starts_at timestamptz,ends_at timestamptz,status text,instructions text,customer_name text,address text,postcode text) language sql stable security definer set search_path=public as $$
 select v.id,v.starts_at,v.ends_at,v.status,v.instructions,c.name,c.address,c.postcode from visits v join customers c on c.id=v.customer_id where v.cleaner_id=auth.uid() and v.status<>'cancelled' order by v.starts_at;
$$;
create function public.transition_visit(vid uuid,new_status text) returns void language plpgsql security definer set search_path=public as $$
begin update visits set status=new_status where id=vid and cleaner_id=auth.uid() and ((status='scheduled' and new_status='started') or (status='started' and new_status='completed')); if not found then raise exception 'Visit transition not allowed' using errcode='42501'; end if; end $$;
create function public.request_leave(p jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid; begin if not exists(select 1 from cleaners where id=auth.uid() and active) then raise exception 'Cleaner access required' using errcode='42501'; end if; insert into leave_requests(cleaner_id,starts_on,ends_on,reason) values(auth.uid(),(p->>'starts_on')::date,(p->>'ends_on')::date,coalesce(p->>'reason','')) returning id into rid; return rid; end $$;
create function public.request_availability(p jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid; begin if not exists(select 1 from cleaners where id=auth.uid() and active) then raise exception 'Cleaner access required' using errcode='42501'; end if; insert into availability_requests(cleaner_id,weekday,start_time,end_time) values(auth.uid(),(p->>'weekday')::int,(p->>'start_time')::time,(p->>'end_time')::time) returning id into rid; return rid; end $$;
create function public.review_request(p jsonb) returns void language plpgsql security definer set search_path=public as $$
declare r leave_requests; a availability_requests;
begin perform require_admin(); if p->>'kind'='leave' then
 select * into r from leave_requests where id=(p->>'id')::uuid for update; if not found then raise exception 'Request not found'; end if;
 perform 1 from cleaners where id=r.cleaner_id for update;
 if p->>'status'='approved' and exists(select 1 from visits where cleaner_id=r.cleaner_id and status<>'cancelled' and (starts_at at time zone 'Europe/London')::date between r.starts_on and r.ends_on) then raise exception 'Reschedule assigned visits before approving leave'; end if;
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
create function public.save_content(p jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid; begin perform require_admin(); cid:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
 if p->>'kind'='page' and p->>'slug' in ('admin','cleaner','login','api','blog','preview','privacy','demo') then raise exception 'Reserved page slug'; end if;
 insert into content(id,kind,slug,title,excerpt,seo_title,seo_description,body,sections,image_path,image_alt,author,category,status,published_at) values(cid,p->>'kind',p->>'slug',p->>'title',coalesce(p->>'excerpt',''),coalesce(p->>'seo_title',''),coalesce(p->>'seo_description',''),p->'body',coalesce(p->'sections','[]'),nullif(p->>'image_path',''),coalesce(p->>'image_alt',''),coalesce(p->>'author',''),coalesce(p->>'category',''),p->>'status',case when p->>'status'='published' then coalesce(nullif(p->>'published_at','')::timestamptz,now()) else null end)
 on conflict(id) do update set slug=excluded.slug,title=excluded.title,excerpt=excluded.excerpt,seo_title=excluded.seo_title,seo_description=excluded.seo_description,body=excluded.body,sections=excluded.sections,image_path=excluded.image_path,image_alt=excluded.image_alt,author=excluded.author,category=excluded.category,status=excluded.status,published_at=excluded.published_at,updated_at=now(); return cid; end $$;
create function public.save_task(p jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare tid uuid; begin perform require_admin(); tid:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid()); insert into follow_up_tasks(id,customer_id,conversation_id,title,due_on,done) values(tid,nullif(p->>'customer_id','')::uuid,nullif(p->>'conversation_id','')::uuid,p->>'title',(p->>'due_on')::date,coalesce((p->>'done')::boolean,false)) on conflict(id) do update set title=excluded.title,due_on=excluded.due_on,done=excluded.done; return tid; end $$;
create function public.annotate_conversation(p jsonb) returns void language plpgsql security definer set search_path=public as $$
begin perform require_admin(); if p ? 'customer_id' then update conversations set customer_id=nullif(p->>'customer_id','')::uuid where id=(p->>'id')::uuid; end if; if coalesce(p->>'note','')<>'' then insert into conversation_notes(conversation_id,author_id,body) values((p->>'id')::uuid,auth.uid(),p->>'note'); end if; end $$;
create function public.ingest_call_event(p jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid; rank_now int; inserted_id uuid; match_id uuid;
begin
 rank_now:=case p->>'status' when 'ringing' then 1 when 'in-progress' then 2 when 'completed' then 5 when 'failed' then 5 when 'busy' then 5 when 'no-answer' then 5 when 'canceled' then 5 else 0 end;
 select case when count(*)=1 then (array_agg(id))[1] else null end into match_id from customers where regexp_replace(phone,'[^0-9+]','','g')=p->>'caller';
 insert into conversations(provider,root_call_id,caller,direction,suggested_customer_id,started_at) values(p->>'provider',p->>'root_call_id',p->>'caller',coalesce(p->>'direction','inbound'),match_id,coalesce(nullif(p->>'occurred_at','')::timestamptz,now())) on conflict(provider,root_call_id) do nothing;
 select id into cid from conversations where provider=p->>'provider' and root_call_id=p->>'root_call_id' for update;
 if (p->>'authoritative_caller')::boolean is true then update conversations set caller=p->>'caller',suggested_customer_id=match_id,direction='inbound' where id=cid; end if;
 insert into call_events(conversation_id,provider,event_key,call_leg_id,status,occurred_at) values(cid,p->>'provider',p->>'event_key',p->>'call_leg_id',p->>'status',coalesce(nullif(p->>'occurred_at','')::timestamptz,now())) on conflict(provider,event_key) do nothing returning id into inserted_id;
 if inserted_id is null then return cid; end if;
 update conversations set status=case when rank_now>status_rank then p->>'status' else status end,status_rank=greatest(rank_now,status_rank),duration_seconds=greatest(duration_seconds,coalesce((p->>'duration_seconds')::int,0)) where id=cid;
 if p->>'recording_status' is not null then update conversations set recording_status=p->>'recording_status' where id=cid and recording_status not in ('available','deleted'); end if;
 if p->>'recording_sid' is not null then insert into recordings(conversation_id,provider_sid,expires_at) values(cid,p->>'recording_sid',now()+make_interval(days=>coalesce((p->>'retention_days')::int,30))) on conflict(provider_sid) do nothing; end if;
 return cid;
end $$;
create function public.set_transcript(p jsonb) returns void language plpgsql security definer set search_path=public as $$ begin insert into transcripts(conversation_id,status,text,error_code) values((p->>'conversation_id')::uuid,p->>'status',p->>'text',p->>'error_code'); update conversations set transcript_status=p->>'status' where id=(p->>'conversation_id')::uuid; end $$;
create function public.remove_recording(rid uuid) returns void language plpgsql security definer set search_path=public as $$ declare cid uuid; begin perform require_admin(); delete from recordings where id=rid returning conversation_id into cid; delete from transcripts where conversation_id=cid; update conversations set recording_status='deleted',transcript_status='deleted' where id=cid; end $$;

-- PostgreSQL functions default to PUBLIC execute: revoke first, then grant narrowly.
revoke all on all functions in schema public from public,anon,authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.save_customer(jsonb),public.update_enquiry(uuid,text),public.create_booking(jsonb),public.change_visit(jsonb),public.cleaner_jobs(),public.transition_visit(uuid,text),public.request_leave(jsonb),public.request_availability(jsonb),public.review_request(jsonb),public.save_content(jsonb),public.save_task(jsonb),public.annotate_conversation(jsonb),public.remove_recording(uuid) to authenticated;
grant execute on function public.submit_enquiry(jsonb,text),public.ingest_call_event(jsonb),public.set_transcript(jsonb) to service_role;
grant execute on all functions in schema public to service_role;

create function public.register_cleaner(p jsonb) returns void language plpgsql security definer set search_path=public as $$
begin perform require_admin();
 if not exists(select 1 from profiles where id=(p->>'id')::uuid and role='cleaner') then raise exception 'Invited cleaner profile not found'; end if;
 insert into cleaners(id,name) values((p->>'id')::uuid,p->>'name');
 insert into availability(cleaner_id,weekday,start_time,end_time) select (p->>'id')::uuid,d,'08:00','20:00' from generate_series(1,5) d;
end $$;
revoke all on function public.register_cleaner(jsonb) from public,anon;
grant execute on function public.register_cleaner(jsonb) to authenticated;
