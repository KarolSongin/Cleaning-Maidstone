insert into storage.buckets(id,name,public) values('website-media','website-media',true),('call-recordings','call-recordings',false) on conflict(id) do nothing;
create policy public_website_media on storage.objects for select to anon,authenticated using(bucket_id='website-media');
create policy admin_media_management on storage.objects for all to authenticated using(public.is_admin() and bucket_id in ('website-media','call-recordings')) with check(public.is_admin() and bucket_id in ('website-media','call-recordings'));
