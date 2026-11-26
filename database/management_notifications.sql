create table public.management_notifications (
 id uuid primary key default gen_random_uuid(), recipient uuid not null references auth.users(id) on delete cascade,
 title text not null, body text not null, route text not null, created_at timestamptz not null default now(), read_at timestamptz
);
alter table public.management_notifications enable row level security;
revoke all on public.management_notifications from public,anon,authenticated;
grant select on public.management_notifications to authenticated;
create policy management_notification_read on public.management_notifications for select to authenticated using(recipient=(select auth.uid()));
create index management_notification_recipient on public.management_notifications(recipient,created_at desc);
create function public.management_notifications_read(p_id uuid) returns void language sql security definer set search_path='' as $$
 update public.management_notifications set read_at=coalesce(read_at,now()) where recipient=auth.uid() and (p_id is null or id=p_id)
$$;
revoke all on function public.management_notifications_read(uuid) from public,anon;
grant execute on function public.management_notifications_read(uuid) to authenticated;

create table studio_access_private.management_push_config (
 id boolean primary key default true check(id), dispatch_token text not null default (gen_random_uuid()::text||gen_random_uuid()::text),
 public_key text, private_key text
);
insert into studio_access_private.management_push_config default values;
create table studio_access_private.management_push_devices (
 endpoint text primary key, recipient uuid not null references auth.users(id) on delete cascade,
 p256dh text not null, auth_key text not null, updated_at timestamptz not null default now()
);
create table studio_access_private.management_push_queue (
 notification_id uuid not null references public.management_notifications(id) on delete cascade,
 endpoint text not null references studio_access_private.management_push_devices(endpoint) on delete cascade,
 attempts integer not null default 0, next_at timestamptz not null default now(), sent_at timestamptz,
 primary key(notification_id,endpoint)
);
alter table studio_access_private.management_push_config enable row level security;
alter table studio_access_private.management_push_devices enable row level security;
alter table studio_access_private.management_push_queue enable row level security;
revoke all on studio_access_private.management_push_config,studio_access_private.management_push_devices,studio_access_private.management_push_queue from public,anon,authenticated;
create function public.management_push_public_key() returns text language sql stable security definer set search_path='' as $$
 select public_key from studio_access_private.management_push_config where auth.uid() is not null
$$;
create function public.management_push_subscribe(p_endpoint text,p_p256dh text,p_auth text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Autenticación requerida';end if;
 if p_endpoint is null or length(p_endpoint)>2048 or p_endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com|[a-z0-9-]+\.notify\.live\.net)/' or length(coalesce(p_p256dh,'')) not between 80 and 100 or length(coalesce(p_auth,'')) not between 20 and 32 or p_p256dh !~ '^[A-Za-z0-9_-]+$' or p_auth !~ '^[A-Za-z0-9_-]+$' then raise exception 'Suscripción inválida';end if;
 delete from studio_access_private.management_push_queue where endpoint=p_endpoint and exists(select 1 from studio_access_private.management_push_devices d where d.endpoint=p_endpoint and d.recipient<>auth.uid());
 insert into studio_access_private.management_push_devices(endpoint,recipient,p256dh,auth_key) values(p_endpoint,auth.uid(),p_p256dh,p_auth)
 on conflict(endpoint) do update set recipient=excluded.recipient,p256dh=excluded.p256dh,auth_key=excluded.auth_key,updated_at=now();
end $$;
create function public.management_push_unsubscribe(p_endpoint text) returns void language sql security definer set search_path='' as $$
 delete from studio_access_private.management_push_devices where endpoint=p_endpoint and recipient=auth.uid()
$$;
revoke all on function public.management_push_public_key(),public.management_push_subscribe(text,text,text),public.management_push_unsubscribe(text) from public,anon;
grant execute on function public.management_push_public_key(),public.management_push_subscribe(text,text,text),public.management_push_unsubscribe(text) to authenticated;

create function studio_access_private.management_notification_enqueue() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into studio_access_private.management_push_queue(notification_id,endpoint)
 select new.id,d.endpoint from studio_access_private.management_push_devices d where d.recipient=new.recipient on conflict do nothing;
 return new;
end $$;
create trigger management_notification_enqueue after insert on public.management_notifications for each row execute function studio_access_private.management_notification_enqueue();

create function studio_access_private.management_notice_roles(p_roles text[]) returns table(user_id uuid) language sql stable security definer set search_path='' as $$
 select e.system_auth_user_id from public.hr_employees e join public.system_employee_role_assignments a on a.employee_id=e.id and a.ended_at is null join public.system_access_roles r on r.id=a.access_role_id and r.is_active
 where e.system_access_enabled and e.status<>'terminated' and e.system_auth_user_id is not null and r.code=any(p_roles)
 union select g.user_id from public.system_user_role_grants g join public.system_access_roles r on r.code=g.role_code and r.is_active where g.active and g.role_code=any(p_roles)
$$;
create function studio_access_private.management_notice(p_recipients uuid[],p_title text,p_body text,p_route text) returns void language sql security definer set search_path='' as $$
 insert into public.management_notifications(recipient,title,body,route)
 select distinct u.id,p_title,p_body,p_route from auth.users u where u.id=any(p_recipients) and u.id is distinct from auth.uid()
 and not exists(select 1 from public.hr_employees e where e.system_auth_user_id=u.id and (not e.system_access_enabled or e.status='terminated'))
$$;
create function studio_access_private.management_notice_workflow() returns trigger language plpgsql security definer set search_path='' as $$
declare recipients uuid[]; managers uuid[]; owner_id uuid:='6418ad20-d0e8-49c0-8d9a-e1da3daf71b6'; route text; label text; state text; sender uuid;
begin
 if tg_op='UPDATE' and new.status is not distinct from old.status then return new;end if;
 select coalesce(array_agg(user_id),'{}'::uuid[]) into managers from studio_access_private.management_notice_roles(array['manager_general']);
 state:=new.status;
 if tg_table_name='purchase_budget_requests' then
  sender:=new.requester;route:='/inventario-presupuesto.html?request='||new.id;label:='Solicitud de presupuesto';
  if state='chief_pending' then select coalesce(array_agg(user_id),'{}'::uuid[]) into recipients from studio_access_private.management_notice_roles(array[case when new.area='Gráfica' then 'jefe_grafica' else 'jefe_audiovisuales' end]);
  elsif state='manager_pending' then recipients:=array_remove(managers,new.chief_by);
  elsif state in ('approved','rejected') then recipients:=array[new.requester,new.chief_by];
  else return new;end if;
 elsif tg_table_name='inventory_orders' then
  sender:=new.created_by;label:='Solicitud de insumos';
  if state='pending' then recipients:=managers||owner_id;route:='/inventario-aprobaciones.html?request='||new.id;
  elsif state in ('approved','rejected','partial','delivered','cancelled') then recipients:=array[new.created_by];route:='/inventario-solicitud.html?request='||new.id;
  else return new;end if;
 elsif tg_table_name='fridge_reconciliations' then
  sender:=new.created_by;label:='Cuadre de nevera';
  if state='pending' then recipients:=managers||owner_id;route:='/cuadre-nevera.html?request='||new.id;
  elsif state in ('returned','confirmed') then recipients:=array[new.created_by];route:='/cuadre-nevera.html?request='||new.id;
  else return new;end if;
 elsif tg_table_name='treasury_ceo_dispatch' then
  sender:=new.created_by;label:='Cuadre de utilidad';
  if state='pending' then recipients:=array[owner_id];elsif state='confirmed' then recipients:=array[new.created_by];else return new;end if;
  route:='/tesoreria.html';
 else return new;end if;
 if state in ('chief_pending','manager_pending','pending') then recipients:=array_remove(recipients,sender);end if;
 perform studio_access_private.management_notice(recipients,label,case state when 'chief_pending' then 'Pendiente de aprobación del jefe de área' when 'manager_pending' then 'Pendiente de aprobación de la Manager General' when 'pending' then 'Pendiente de revisión' when 'approved' then 'Aprobado' when 'rejected' then 'Rechazado' when 'partial' then 'Entrega parcial registrada' when 'delivered' then 'Entrega confirmada' when 'cancelled' then 'Cancelado' when 'returned' then 'Devuelto para revisión' when 'confirmed' then 'Recibido confirmado' end,route);
 return new;
end $$;
create trigger management_budget_notice after insert or update of status on public.purchase_budget_requests for each row execute function studio_access_private.management_notice_workflow();
create trigger management_inventory_notice after insert or update of status on public.inventory_orders for each row execute function studio_access_private.management_notice_workflow();
create trigger management_fridge_notice after insert or update of status on studio_access_private.fridge_reconciliations for each row execute function studio_access_private.management_notice_workflow();
create trigger management_dispatch_notice after insert or update of status on studio_access_private.treasury_ceo_dispatch for each row execute function studio_access_private.management_notice_workflow();
create function studio_access_private.management_closure_notice() returns trigger language plpgsql security definer set search_path='' as $$
declare recipients uuid[];
begin
 if new.action='draft' then recipients:=array['6418ad20-d0e8-49c0-8d9a-e1da3daf71b6'::uuid];
 else select array_agg(distinct actor_id) into recipients from public.inventory_closure_events where closure_id=new.closure_id and action='draft';end if;
 perform studio_access_private.management_notice(recipients,'Cierre de inventario',case new.action when 'draft' then 'Cierre pendiente de aprobación' when 'approve' then 'Cierre aprobado' when 'reopen' then 'Cierre reabierto' end,'/inventario-insumos.html');
 return new;
end $$;
create trigger management_inventory_closure_notice after insert on public.inventory_closure_events for each row execute function studio_access_private.management_closure_notice();
revoke all on function studio_access_private.management_notification_enqueue(),studio_access_private.management_notice_roles(text[]),studio_access_private.management_notice(uuid[],text,text,text),studio_access_private.management_notice_workflow(),studio_access_private.management_closure_notice() from public,anon,authenticated;

-- Dispatch RPCs are callable only by the Edge Function's service role.
create function public.management_push_config(p_token text,p_public text default null,p_private text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare c studio_access_private.management_push_config%rowtype;
begin
 select * into c from studio_access_private.management_push_config where id for update;
 if p_token is null or p_token<>c.dispatch_token then raise exception 'No autorizado' using errcode='42501';end if;
 if c.public_key is null and p_public is not null and p_private is not null then
  update studio_access_private.management_push_config set public_key=p_public,private_key=p_private where id returning * into c;
 end if;
 return jsonb_build_object('publicKey',c.public_key,'privateKey',c.private_key);
end $$;
create function public.management_push_claim() returns jsonb language sql security definer set search_path='' as $$
 with picked as (
 select q.notification_id,q.endpoint from studio_access_private.management_push_queue q join studio_access_private.management_push_devices d on d.endpoint=q.endpoint join public.management_notifications n on n.id=q.notification_id and n.recipient=d.recipient
 where q.sent_at is null and q.attempts<5 and q.next_at<=now() order by q.next_at limit 30 for update of q skip locked
 ), claimed as (
 update studio_access_private.management_push_queue q set attempts=attempts+1,next_at=now()+interval '5 minutes' from picked p where q.notification_id=p.notification_id and q.endpoint=p.endpoint returning q.notification_id,q.endpoint
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',c.notification_id,'endpoint',c.endpoint,'p256dh',d.p256dh,'auth',d.auth_key)),'[]'::jsonb) from claimed c join studio_access_private.management_push_devices d on d.endpoint=c.endpoint
$$;
create function public.management_push_finish(p_id uuid,p_endpoint text,p_result text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_result='expired' then delete from studio_access_private.management_push_devices where endpoint=p_endpoint;
 elsif p_result='sent' then update studio_access_private.management_push_queue set sent_at=now() where notification_id=p_id and endpoint=p_endpoint;end if;
end $$;
revoke all on function public.management_push_config(text,text,text),public.management_push_claim(),public.management_push_finish(uuid,text,text) from public,anon,authenticated;
grant execute on function public.management_push_config(text,text,text),public.management_push_claim(),public.management_push_finish(uuid,text,text) to service_role;
