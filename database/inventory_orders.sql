-- Requests and deliveries share the existing stock/economic posting triggers.
-- No existing movements or stock balances are rewritten.
create table studio_access_private.inventory_order_settings(id boolean primary key default true check(id),enforce_approval boolean not null default false);
insert into studio_access_private.inventory_order_settings values(true,false);
revoke all on studio_access_private.inventory_order_settings from public,anon,authenticated;

create function studio_access_private.inventory_order_role(code text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (exists(select 1 from public.hr_employees e join public.system_employee_role_assignments a on a.employee_id=e.id and a.ended_at is null join public.system_access_roles r on r.id=a.access_role_id and r.is_active where e.system_auth_user_id=auth.uid() and e.system_access_enabled and r.code=$1) or exists(select 1 from public.system_user_role_grants g join public.system_access_roles r on r.code=g.role_code and r.is_active where g.user_id=auth.uid() and g.active and g.role_code=$1));
$$;
create function studio_access_private.inventory_order_capabilities() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('create',public.inventory_has_access('write') or studio_access_private.inventory_order_role('jefe_audiovisuales') or studio_access_private.inventory_order_role('jefe_grafica'),'approve',studio_access_private.is_owner() or studio_access_private.inventory_order_role('manager_general'),'fulfil',public.inventory_has_access('write'),'area',case when public.inventory_has_access('write') then null when studio_access_private.inventory_order_role('jefe_audiovisuales') then 'Audiovisual' when studio_access_private.inventory_order_role('jefe_grafica') then 'Gráfica' end);
$$;
create table public.inventory_orders(
 id uuid primary key,number bigint generated always as identity unique,created_by uuid not null,created_by_name text not null,created_at timestamptz not null default now(),
 status text not null default 'pending' check(status in ('pending','approved','preparing','partial','delivered','rejected','cancelled')),
 area text not null check(area in ('Audiovisual','Gráfica','Generales')),purpose text not null check(purpose in ('area','project','breakage')),
 project_reference text,recipient_id uuid,recipient_name text not null check(length(btrim(recipient_name)) between 1 and 160),delivery_location text not null check(length(btrim(delivery_location)) between 1 and 200),
 needed_on date not null,notes text not null default '' check(length(notes)<=2000),submission jsonb not null,approved_by uuid,approved_by_name text,approved_at timestamptz,decision_note text
);
create table public.inventory_order_items(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.inventory_orders(id),product_id uuid not null references public.inventory_products(id),product_name text not null,unit text not null,requested_quantity numeric not null check(requested_quantity>0 and requested_quantity<'Infinity'::numeric),approved_quantity numeric not null default 0,delivered_quantity numeric not null default 0,unit_cost_reference numeric not null,unique(order_id,product_id),check(delivered_quantity>=0 and approved_quantity>=delivered_quantity and approved_quantity<=requested_quantity));
create index inventory_order_items_product on public.inventory_order_items(product_id,order_id);
create index inventory_orders_queue on public.inventory_orders(status,created_at desc);
create table public.inventory_deliveries(id uuid primary key,order_id uuid not null references public.inventory_orders(id),created_by uuid not null,created_by_name text not null,created_at timestamptz not null default now(),recipient_name text not null,proof_type text not null check(proof_type in ('photo','signature')),proof_path text not null unique,submission jsonb not null,status text not null check(status in ('posting','complete')));
create table public.inventory_delivery_items(delivery_id uuid not null references public.inventory_deliveries(id),order_item_id uuid not null references public.inventory_order_items(id),quantity numeric not null check(quantity>0 and quantity<'Infinity'::numeric),movement_id uuid not null unique references public.inventory_movements(id) deferrable initially deferred,primary key(delivery_id,order_item_id));
create table public.inventory_order_events(id bigint generated always as identity primary key,order_id uuid not null references public.inventory_orders(id),created_at timestamptz not null default now(),actor_id uuid not null,actor_name text not null,event text not null,details jsonb not null default '{}');
create function studio_access_private.inventory_order_read(order_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.inventory_orders o where o.id=$1 and (o.created_by=auth.uid() or (studio_access_private.inventory_order_capabilities()->>'approve')::boolean or ((studio_access_private.inventory_order_capabilities()->>'fulfil')::boolean and o.status in ('approved','preparing','partial','delivered'))));
$$;
alter table public.inventory_orders enable row level security;
alter table public.inventory_order_items enable row level security;
alter table public.inventory_deliveries enable row level security;
alter table public.inventory_delivery_items enable row level security;
alter table public.inventory_order_events enable row level security;
revoke all on public.inventory_orders,public.inventory_order_items,public.inventory_deliveries,public.inventory_delivery_items,public.inventory_order_events from anon,authenticated;
grant select on public.inventory_orders,public.inventory_order_items,public.inventory_deliveries,public.inventory_delivery_items,public.inventory_order_events to authenticated;
create policy orders_read on public.inventory_orders for select to authenticated using(studio_access_private.inventory_order_read(id));
create policy items_read on public.inventory_order_items for select to authenticated using(studio_access_private.inventory_order_read(order_id));
create policy deliveries_read on public.inventory_deliveries for select to authenticated using(studio_access_private.inventory_order_read(order_id));
create policy delivery_items_read on public.inventory_delivery_items for select to authenticated using(exists(select 1 from public.inventory_deliveries d where d.id=delivery_id));
create policy events_read on public.inventory_order_events for select to authenticated using(studio_access_private.inventory_order_read(order_id));

create function studio_access_private.inventory_order_reserved(product_id uuid) returns numeric language sql stable security definer set search_path='' as $$
 select coalesce(sum(i.approved_quantity-i.delivered_quantity),0) from public.inventory_order_items i join public.inventory_orders o on o.id=i.order_id where i.product_id=$1 and o.status in ('approved','preparing','partial');
$$;
create function studio_access_private.inventory_order_catalog() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare caps jsonb:=studio_access_private.inventory_order_capabilities();
begin
 if auth.uid() is null or not ((caps->>'create')::boolean or (caps->>'approve')::boolean or (caps->>'fulfil')::boolean) then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'unit',p.unit,'department',p.department,'category',p.category,'photo_path',p.photo_path,'stock',p.stock,'reserved',studio_access_private.inventory_order_reserved(p.id),'available',greatest(0,p.stock-studio_access_private.inventory_order_reserved(p.id)),'unit_cost',p.unit_cost) order by p.name) from public.inventory_products p where p.deleted_at is null and p.currency='USD' and (caps->>'area' is null or p.department in (caps->>'area','Generales'))),'[]');
end $$;
create function studio_access_private.inventory_order_people() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c jsonb:=studio_access_private.inventory_order_capabilities();
begin
 if auth.uid() is null or not ((c->>'create')::boolean or (c->>'approve')::boolean or (c->>'fulfil')::boolean) then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',full_name) order by full_name) from public.hr_employees where system_access_enabled and system_auth_user_id is not null),'[]');
end $$;
create function studio_access_private.inventory_order_create(request_id uuid,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare caps jsonb:=studio_access_private.inventory_order_capabilities();o public.inventory_orders;line jsonb;p public.inventory_products;q numeric;recipient text;pid uuid;
begin
 if auth.uid() is null or not (caps->>'create')::boolean then raise exception 'No tienes permiso para solicitar salidas' using errcode='42501';end if;
 if request_id is null or jsonb_typeof(payload)<>'object' then raise exception 'Solicitud no válida';end if;
 perform pg_advisory_xact_lock(761820261018::bigint);
 select * into o from public.inventory_orders where id=request_id;
 if found then if o.created_by<>auth.uid() or o.submission<>payload then raise exception 'El identificador ya pertenece a otra solicitud';end if;return o.id;end if;
 if payload->>'area' not in ('Audiovisual','Gráfica','Generales') or payload->>'purpose' not in ('area','project','breakage') or payload->>'area' is null or payload->>'purpose' is null then raise exception 'Selecciona área y tipo de consumo';end if;
 if caps->>'area' is not null and (payload->>'area'<>caps->>'area' or payload->>'purpose'='breakage') then raise exception 'El pedido debe corresponder a tu área' using errcode='42501';end if;
 if payload->>'purpose'='project' and nullif(btrim(payload->>'project_reference'),'') is null then raise exception 'Indica el proyecto';end if;
 if length(coalesce(payload->>'notes',''))>2000 or (payload->>'purpose'='breakage' and nullif(btrim(payload->>'notes'),'') is null) then raise exception 'Indica el motivo de la rotura o merma';end if;
 if nullif(btrim(payload->>'delivery_location'),'') is null or length(payload->>'delivery_location')>200 then raise exception 'Indica el lugar de entrega o incidencia';end if;
 pid=nullif(payload->>'recipient_id','')::uuid;
 if pid is not null then select full_name into recipient from public.hr_employees where id=pid and system_access_enabled and system_auth_user_id is not null;else recipient=btrim(payload->>'recipient_name');end if;
 if recipient is null or length(recipient) not between 1 and 160 then raise exception 'Indica quién recibe o el responsable de la incidencia';end if;
 if jsonb_typeof(payload->'items') is distinct from 'array' or jsonb_array_length(payload->'items') not between 1 and 100 then raise exception 'Agrega entre 1 y 100 insumos';end if;
 if (select count(distinct x->>'product_id') from jsonb_array_elements(payload->'items') x)<>jsonb_array_length(payload->'items') then raise exception 'Unifica los productos repetidos';end if;
 insert into public.inventory_orders(id,created_by,created_by_name,area,purpose,project_reference,recipient_id,recipient_name,delivery_location,needed_on,notes,submission) values(request_id,auth.uid(),studio_access_private.inventory_actor_name(),payload->>'area',payload->>'purpose',nullif(btrim(payload->>'project_reference'),''),pid,recipient,btrim(payload->>'delivery_location'),(now() at time zone 'America/Havana')::date,coalesce(payload->>'notes',''),payload);
 for line in select * from jsonb_array_elements(payload->'items') loop
  select * into strict p from public.inventory_products where id=(line->>'product_id')::uuid and deleted_at is null for update;
  if caps->>'area' is not null and p.department not in (caps->>'area','Generales') then raise exception 'Insumo de otra área' using errcode='42501';end if;
  q=(line->>'quantity')::numeric;
  if q is null or q<=0 or q>='Infinity'::numeric or q>p.stock-studio_access_private.inventory_order_reserved(p.id) or p.currency<>'USD' then raise exception 'La cantidad de % sobrepasa la existencia disponible',p.name;end if;
  insert into public.inventory_order_items(order_id,product_id,product_name,unit,requested_quantity,unit_cost_reference) values(request_id,p.id,p.name,p.unit,q,p.unit_cost);
 end loop;
 insert into public.inventory_order_events(order_id,actor_id,actor_name,event) values(request_id,auth.uid(),studio_access_private.inventory_actor_name(),'submitted');return request_id;
end $$;

create function studio_access_private.inventory_order_decide(order_id uuid,decision text,quantities jsonb,note text) returns void language plpgsql security definer set search_path='' as $$
declare o public.inventory_orders;i public.inventory_order_items;p public.inventory_products;q numeric;
begin
 if auth.uid() is null or not (studio_access_private.inventory_order_capabilities()->>'approve')::boolean then raise exception 'Solo el Manager General puede aprobar solicitudes' using errcode='42501';end if;
 perform pg_advisory_xact_lock(761820261018::bigint);select * into strict o from public.inventory_orders where id=$1 for update;
 if o.created_by=auth.uid() then raise exception 'No puedes aprobar tu propia solicitud' using errcode='42501';end if;
 if decision not in ('approve','reject') or o.status<>'pending' then raise exception 'La solicitud ya no está pendiente';end if;
 if decision='reject' then
  if nullif(btrim(note),'') is null then raise exception 'Indica el motivo';end if;
  update public.inventory_orders set status='rejected',decision_note=left(note,2000),approved_by=auth.uid(),approved_by_name=studio_access_private.inventory_actor_name(),approved_at=now() where id=o.id;
 else
  if jsonb_typeof(quantities)<>'object' then raise exception 'Cantidades no válidas';end if;
  for i in select * from public.inventory_order_items where inventory_order_items.order_id=o.id order by product_id for update loop
   select * into strict p from public.inventory_products where id=i.product_id and deleted_at is null for update;
   q=(quantities->>i.id::text)::numeric;
   if q is null or q<=0 or q>i.requested_quantity or q>p.stock-studio_access_private.inventory_order_reserved(p.id) then raise exception 'Cantidad no disponible o superior a lo solicitado: %',p.name;end if;
   update public.inventory_order_items set approved_quantity=q where id=i.id;
  end loop;
  update public.inventory_orders set status='approved',approved_by=auth.uid(),approved_by_name=studio_access_private.inventory_actor_name(),approved_at=now(),decision_note=left(coalesce(note,''),2000) where id=o.id;
 end if;
 insert into public.inventory_order_events(order_id,actor_id,actor_name,event,details) values(o.id,auth.uid(),studio_access_private.inventory_actor_name(),decision,jsonb_build_object('note',left(coalesce(note,''),2000),'quantities',quantities));
end $$;
create function studio_access_private.inventory_order_action(order_id uuid,action text) returns void language plpgsql security definer set search_path='' as $$
declare o public.inventory_orders;c jsonb:=studio_access_private.inventory_order_capabilities();
begin
 if auth.uid() is null then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 perform pg_advisory_xact_lock(761820261018::bigint);select * into strict o from public.inventory_orders where id=$1 for update;
 if action='prepare' and (c->>'fulfil')::boolean and o.status in ('approved','preparing','partial') then
  if o.status='approved' then update public.inventory_orders set status='preparing' where id=o.id;end if;
 elsif action='cancel' and (o.created_by=auth.uid() or (c->>'approve')::boolean) and o.status in ('pending','approved','preparing') and not exists(select 1 from public.inventory_deliveries where inventory_deliveries.order_id=o.id) then
  update public.inventory_orders set status='cancelled' where id=o.id;
 else raise exception 'Acción no permitida para este estado' using errcode='42501';end if;
 insert into public.inventory_order_events(order_id,actor_id,actor_name,event) values(o.id,auth.uid(),studio_access_private.inventory_actor_name(),action);
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('inventory-delivery-evidence','inventory-delivery-evidence',false,204800,array['image/jpeg']);
create function studio_access_private.inventory_evidence_read(path text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.inventory_deliveries d where d.proof_path=$1 and d.status='complete' and studio_access_private.inventory_order_read(d.order_id));
$$;
create policy inventory_evidence_insert on storage.objects for insert to authenticated with check(bucket_id='inventory-delivery-evidence' and (studio_access_private.inventory_order_capabilities()->>'fulfil')::boolean and name ~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}\.jpg$'));
create policy inventory_evidence_select on storage.objects for select to authenticated using(bucket_id='inventory-delivery-evidence' and ((owner_id=auth.uid()::text and (studio_access_private.inventory_order_capabilities()->>'fulfil')::boolean) or studio_access_private.inventory_evidence_read(name)));
create function studio_access_private.inventory_order_evidence_unlinked(path text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (studio_access_private.inventory_order_capabilities()->>'fulfil')::boolean and not exists(select 1 from public.inventory_deliveries d where d.proof_path=$1);
$$;
create policy inventory_evidence_remove_orphan on storage.objects for delete to authenticated using(bucket_id='inventory-delivery-evidence' and owner_id=auth.uid()::text and studio_access_private.inventory_order_evidence_unlinked(name));

create function studio_access_private.inventory_order_movement_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind<>'out' or not exists(select 1 from studio_access_private.inventory_order_settings where enforce_approval) then return new;end if;
 perform pg_advisory_xact_lock(761820261018::bigint);
 if not exists(select 1 from public.inventory_deliveries d join public.inventory_delivery_items l on l.delivery_id=d.id join public.inventory_order_items i on i.id=l.order_item_id join public.inventory_orders o on o.id=i.order_id where d.id=(new.request_payload->>'delivery_id')::uuid and d.status='posting' and d.created_by=auth.uid() and o.status in ('approved','preparing','partial') and i.order_id=d.order_id and l.movement_id=new.id and i.product_id=new.product_id and l.quantity=new.quantity and l.quantity<=i.approved_quantity-i.delivered_quantity) then raise exception 'La salida necesita una solicitud aprobada y una entrega confirmada';end if;
 return new;
end $$;
create trigger a_inventory_order_movement_guard before insert on public.inventory_movements for each row execute function studio_access_private.inventory_order_movement_guard();
create function studio_access_private.inventory_order_deliver(delivery_id uuid,order_id uuid,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.inventory_orders;d public.inventory_deliveries;i public.inventory_order_items;p public.inventory_products;line jsonb;q numeric;mid uuid;recipient text;
begin
 if auth.uid() is null or not public.inventory_has_access('write') then raise exception 'No tienes permiso para entregar' using errcode='42501';end if;
 if $1 is null then raise exception 'Identificador de entrega requerido';end if;
 perform pg_advisory_xact_lock(761820261018::bigint);select * into d from public.inventory_deliveries where id=$1;
 if found then if d.created_by<>auth.uid() or d.order_id<>$2 or d.submission<>payload then raise exception 'La entrega ya existe con otros datos';end if;return d.id;end if;
 select * into strict o from public.inventory_orders where id=$2 for update;
 if o.status not in ('approved','preparing','partial') then raise exception 'El pedido no está autorizado para entregar';end if;
 recipient=btrim(payload->>'recipient_name');if recipient is null or length(recipient) not between 1 and 160 then raise exception 'Indica quién recibió realmente';end if;
 if recipient<>o.recipient_name and nullif(btrim(payload->>'recipient_change_reason'),'') is null then raise exception 'Indica por qué cambia el receptor';end if;
 if payload->>'proof_type' not in ('photo','signature') or payload->>'proof_type' is null or (o.purpose='breakage' and payload->>'proof_type'<>'photo') then raise exception 'Adjunta foto o firma; las mermas requieren foto';end if;
 if payload->>'proof_path' is distinct from auth.uid()::text||'/'||$1::text||'.jpg' or not exists(select 1 from storage.objects where bucket_id='inventory-delivery-evidence' and name=payload->>'proof_path' and owner_id=auth.uid()::text and coalesce((metadata->>'size')::bigint,0) between 1 and 204800 and metadata->>'mimetype'='image/jpeg') then raise exception 'No se ha confirmado la evidencia de entrega';end if;
 if jsonb_typeof(payload->'items') is distinct from 'array' or jsonb_array_length(payload->'items') not between 1 and 100 or (select count(distinct x->>'item_id') from jsonb_array_elements(payload->'items') x)<>jsonb_array_length(payload->'items') then raise exception 'Detalle de entrega no válido';end if;
 insert into public.inventory_deliveries(id,order_id,created_by,created_by_name,recipient_name,proof_type,proof_path,submission,status) values($1,o.id,auth.uid(),studio_access_private.inventory_actor_name(),recipient,payload->>'proof_type',payload->>'proof_path',payload,'posting');
 for line in select * from jsonb_array_elements(payload->'items') order by value->>'item_id' loop
  select * into strict i from public.inventory_order_items where id=(line->>'item_id')::uuid and inventory_order_items.order_id=o.id for update;
  select * into strict p from public.inventory_products where id=i.product_id and deleted_at is null for update;q=(line->>'quantity')::numeric;
  if q is null or q<=0 or q>='Infinity'::numeric or q>i.approved_quantity-i.delivered_quantity or q>p.stock then raise exception 'Cantidad no disponible o superior a lo aprobado: %',i.product_name;end if;
  mid=gen_random_uuid();insert into public.inventory_delivery_items values($1,i.id,q,mid);
  insert into public.inventory_movements(id,product_id,kind,quantity,unit_cost,occurred_on,allocation_type,project_reference,receiving_area,received_by,notes,currency,request_payload)
  values(mid,i.product_id,'out',q,0,(now() at time zone 'America/Havana')::date,case when o.purpose='project' then 'project' else 'administrative' end,o.project_reference,o.area,recipient,'Pedido # '||o.number::text||' · Entrega '||$1::text||' · '||o.notes,'USD',jsonb_build_object('delivery_id',$1,'order_id',o.id,'delivery_location',o.delivery_location,'consumption_reason',case when o.purpose='breakage' then 'breakage' end));
  update public.inventory_order_items set delivered_quantity=delivered_quantity+q where id=i.id;
 end loop;
 update public.inventory_deliveries set status='complete' where id=$1;
 update public.inventory_orders set status=case when exists(select 1 from public.inventory_order_items where inventory_order_items.order_id=o.id and delivered_quantity<approved_quantity) then 'partial' else 'delivered' end where id=o.id;
 insert into public.inventory_order_events(order_id,actor_id,actor_name,event,details) values(o.id,auth.uid(),studio_access_private.inventory_actor_name(),'delivered',jsonb_build_object('delivery_id',$1,'recipient',recipient));return $1;
end $$;

-- Expose narrowly scoped invoker wrappers; all mutations enforce the authenticated role internally.
create function public.inventory_order_capabilities() returns jsonb language sql stable security invoker set search_path='' as $$select studio_access_private.inventory_order_capabilities()$$;
create function public.inventory_order_catalog() returns jsonb language sql stable security invoker set search_path='' as $$select studio_access_private.inventory_order_catalog()$$;
create function public.inventory_order_people() returns jsonb language sql stable security invoker set search_path='' as $$select studio_access_private.inventory_order_people()$$;
create function public.inventory_order_create(request_id uuid,payload jsonb) returns uuid language sql security invoker set search_path='' as $$select studio_access_private.inventory_order_create(request_id,payload)$$;
create function public.inventory_order_decide(order_id uuid,decision text,quantities jsonb,note text) returns void language sql security invoker set search_path='' as $$select studio_access_private.inventory_order_decide(order_id,decision,quantities,note)$$;
create function public.inventory_order_action(order_id uuid,action text) returns void language sql security invoker set search_path='' as $$select studio_access_private.inventory_order_action(order_id,action)$$;
create function public.inventory_order_deliver(delivery_id uuid,order_id uuid,payload jsonb) returns uuid language sql security invoker set search_path='' as $$select studio_access_private.inventory_order_deliver(delivery_id,order_id,payload)$$;
do $$declare fn record;begin for fn in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','studio_access_private') and (p.proname like 'inventory_order_%' or p.proname='inventory_evidence_read') loop
 execute format('revoke all on function %I.%I(%s) from public,anon',fn.nspname,fn.proname,fn.args);
 if fn.proname<>'inventory_order_movement_guard' then execute format('grant execute on function %I.%I(%s) to authenticated',fn.nspname,fn.proname,fn.args);end if;
end loop;end $$;
