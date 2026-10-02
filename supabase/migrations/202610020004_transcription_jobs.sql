-- One transcript stage per conversation: retries must not create duplicate results.
delete from public.transcripts t using public.transcripts earlier where t.conversation_id=earlier.conversation_id and (t.created_at,t.id)>(earlier.created_at,earlier.id);
alter table public.transcripts add constraint one_transcript_per_conversation unique(conversation_id);
create or replace function public.set_transcript(p jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
 insert into transcripts(conversation_id,status,text,error_code) values((p->>'conversation_id')::uuid,p->>'status',p->>'text',p->>'error_code')
 on conflict(conversation_id) do update set status=excluded.status,text=coalesce(excluded.text,transcripts.text),error_code=excluded.error_code where transcripts.status<>'completed';
 update conversations set transcript_status=(select status from transcripts where conversation_id=(p->>'conversation_id')::uuid) where id=(p->>'conversation_id')::uuid;
end $$;
create table public.transcription_jobs(id uuid primary key default gen_random_uuid(),recording_id uuid not null unique references recordings(id) on delete cascade,provider_job_id text unique,status text not null default 'pending' check(status in ('pending','dispatching','processing','completed','failed')),attempts int not null default 0,lease_at timestamptz,error_code text,created_at timestamptz not null default now());
alter table public.transcription_jobs enable row level security;
create policy admin_read_jobs on transcription_jobs for select to authenticated using(public.is_admin());
revoke all on transcription_jobs from anon,authenticated;
grant select on transcription_jobs to authenticated;
grant all on transcription_jobs to service_role;
create index transcription_job_queue on transcription_jobs(status,lease_at);
create function public.enqueue_transcription(rid uuid) returns void language plpgsql security definer set search_path=public as $$ begin insert into transcription_jobs(recording_id) values(rid) on conflict(recording_id) do nothing; update conversations set transcript_status='processing' where id=(select conversation_id from recordings where id=rid); end $$;
create function public.claim_transcription_jobs() returns table(id uuid,recording_id uuid,provider_sid text,private_path text,conversation_id uuid) language sql security definer set search_path=public as $$
 with jobs as (select j.id from transcription_jobs j join recordings r on r.id=j.recording_id where r.expires_at>now() and (j.status='pending' or (j.status in ('failed','dispatching') and j.lease_at<now()-interval '15 minutes')) and j.attempts<3 order by j.created_at for update of j skip locked limit 2), claimed as (update transcription_jobs j set status='dispatching',attempts=attempts+1,lease_at=now() where j.id in (select jobs.id from jobs) returning j.id,j.recording_id)
 select c.id,c.recording_id,r.provider_sid,r.private_path,r.conversation_id from claimed c join recordings r on r.id=c.recording_id;
$$;
create function public.update_transcription_job(p jsonb) returns void language plpgsql security definer set search_path=public as $$
declare cid uuid; begin
 update transcription_jobs set provider_job_id=coalesce(nullif(p->>'provider_job_id',''),provider_job_id),status=p->>'status',error_code=p->>'error_code' where id=(p->>'id')::uuid and status<>'completed' and (provider_job_id is null or provider_job_id=p->>'provider_job_id' or not p ? 'provider_job_id');
 if not found then return; end if;
 select r.conversation_id into cid from recordings r join transcription_jobs j on j.recording_id=r.id where j.id=(p->>'id')::uuid;
 if p->>'status' in ('completed','failed') then perform set_transcript(jsonb_build_object('conversation_id',cid,'status',p->>'status','text',p->>'text','error_code',p->>'error_code')); end if;
end $$;
revoke all on function public.enqueue_transcription(uuid),public.claim_transcription_jobs(),public.update_transcription_job(jsonb) from public,anon,authenticated;
grant execute on function public.enqueue_transcription(uuid),public.claim_transcription_jobs(),public.update_transcription_job(jsonb) to service_role;
create function public.purge_expired_recording(rid uuid) returns void language plpgsql security definer set search_path=public as $$ declare cid uuid; begin
 delete from recordings where id=rid and expires_at<=now() returning conversation_id into cid;
 if cid is not null then delete from transcripts where conversation_id=cid; update conversations set recording_status='deleted',transcript_status='deleted' where id=cid; end if;
end $$;
revoke all on function public.purge_expired_recording(uuid) from public,anon,authenticated;
grant execute on function public.purge_expired_recording(uuid) to service_role;
