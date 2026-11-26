create or replace function public.management_push_claim() returns jsonb language sql security definer set search_path='' as $$
 with picked as (
 select q.notification_id,q.endpoint from studio_access_private.management_push_queue q join studio_access_private.management_push_devices d on d.endpoint=q.endpoint join public.management_notifications n on n.id=q.notification_id and n.recipient=d.recipient
 where q.sent_at is null and q.attempts<5 and q.next_at<=now() order by q.next_at limit 30 for update of q skip locked
 ), claimed as (
 update studio_access_private.management_push_queue q set attempts=attempts+1,next_at=now()+interval '5 minutes' from picked p where q.notification_id=p.notification_id and q.endpoint=p.endpoint returning q.notification_id,q.endpoint
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',c.notification_id,'endpoint',c.endpoint,'p256dh',d.p256dh,'auth',d.auth_key,'title',n.title,'body',n.body)),'[]'::jsonb) from claimed c join studio_access_private.management_push_devices d on d.endpoint=c.endpoint join public.management_notifications n on n.id=c.notification_id and n.recipient=d.recipient
$$;
