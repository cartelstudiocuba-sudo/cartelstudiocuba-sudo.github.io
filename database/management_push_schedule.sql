create extension if not exists pg_net;
create extension if not exists pg_cron;
create function studio_access_private.management_push_dispatch() returns bigint language sql security definer set search_path='' as $$
 select net.http_post(
  url:='https://jhumvctocphyiwhszeaz.supabase.co/functions/v1/management-push',
  headers:=jsonb_build_object('Content-Type','application/json','x-cartel-dispatch',dispatch_token),
  body:='{}'::jsonb,timeout_milliseconds:=30000
 ) from studio_access_private.management_push_config where id
$$;
revoke all on function studio_access_private.management_push_dispatch() from public,anon,authenticated;
select cron.schedule('cartel-management-push','* * * * *','select studio_access_private.management_push_dispatch()');
select studio_access_private.management_push_dispatch();
