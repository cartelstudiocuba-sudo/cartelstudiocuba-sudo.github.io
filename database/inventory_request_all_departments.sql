-- Requesting departments can choose products from every source department.
-- The order's responsible area, stock guards and approval lifecycle stay enforced.
CREATE OR REPLACE FUNCTION studio_access_private.inventory_request_catalog()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caps jsonb:=studio_access_private.inventory_order_capabilities();
begin
 if auth.uid() is null or not coalesce((caps->>'create')::boolean,false) then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'unit',p.unit,'department',p.department,'category',p.category,'photo_path',p.photo_path,'stock',p.stock,'reserved',studio_access_private.inventory_order_reserved(p.id),'available',greatest(0,p.stock-studio_access_private.inventory_order_reserved(p.id)),'unit_cost',p.unit_cost) order by p.name) from public.inventory_products p where p.deleted_at is null and p.currency='USD'),'[]');
end $function$;

CREATE OR REPLACE FUNCTION studio_access_private.inventory_order_create(request_id uuid, payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  q=(line->>'quantity')::numeric;
  if q is null or q<=0 or q>='Infinity'::numeric or q>p.stock-studio_access_private.inventory_order_reserved(p.id) or p.currency<>'USD' then raise exception 'La cantidad de % sobrepasa la existencia disponible',p.name;end if;
  insert into public.inventory_order_items(order_id,product_id,product_name,unit,requested_quantity,unit_cost_reference) values(request_id,p.id,p.name,p.unit,q,p.unit_cost);
 end loop;
 insert into public.inventory_order_events(order_id,actor_id,actor_name,event) values(request_id,auth.uid(),studio_access_private.inventory_actor_name(),'submitted');return request_id;
end $function$;

CREATE OR REPLACE FUNCTION studio_access_private.inventory_order_resubmit(order_id uuid, expected_revision integer, request_id uuid, payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c jsonb:=studio_access_private.inventory_order_capabilities();o public.inventory_orders;line jsonb;p public.inventory_products;q numeric;recipient text;pid uuid;prior jsonb;retry record;
begin
 if auth.uid() is null or not coalesce((c->>'create')::boolean,false) then raise exception 'No tienes permiso para solicitar insumos' using errcode='42501';end if;
 if request_id is null or jsonb_typeof(payload) is distinct from 'object' then raise exception 'Corrección no válida';end if;
 perform pg_advisory_xact_lock(761820261018::bigint);
 select * into strict o from public.inventory_orders where id=$1 for update;
 if o.created_by<>auth.uid() then raise exception 'Solo el solicitante puede corregir su pedido' using errcode='42501';end if;
 select e.actor_id,e.details into retry from public.inventory_order_events e where e.order_id=o.id and e.event='resubmitted' and e.details->>'request_id'=request_id::text limit 1;
 if found then
  if retry.actor_id<>auth.uid() or retry.details->'submission'<>payload or (retry.details->>'from_revision')::integer is distinct from expected_revision then raise exception 'El reintento no coincide con la corrección enviada';end if;
  return o.id;
 end if;
 if o.status<>'returned' or o.revision is distinct from expected_revision then raise exception 'La solicitud cambió o no admite correcciones. Actualiza su ficha';end if;
 if exists(select 1 from public.inventory_deliveries d where d.order_id=o.id) or exists(select 1 from public.inventory_order_items i where i.order_id=o.id and (i.approved_quantity<>0 or i.delivered_quantity<>0 or i.prepared_quantity<>0)) then raise exception 'La solicitud ya tiene cantidades comprometidas';end if;
 if payload->>'area' is null or payload->>'purpose' is null or payload->>'area' not in ('Audiovisual','Gráfica','Generales') or payload->>'purpose' not in ('area','project','breakage') then raise exception 'Selecciona área y tipo de consumo';end if;
 if c->>'area' is not null and (payload->>'area'<>c->>'area' or payload->>'purpose'='breakage') then raise exception 'El pedido debe corresponder a tu área' using errcode='42501';end if;
 if payload->>'purpose'='project' and nullif(btrim(payload->>'project_reference'),'') is null then raise exception 'Indica el proyecto';end if;
 if length(coalesce(payload->>'notes',''))>2000 or (payload->>'purpose'='breakage' and nullif(btrim(payload->>'notes'),'') is null) then raise exception 'Indica el motivo de la rotura o merma';end if;
 if nullif(btrim(payload->>'delivery_location'),'') is null or length(payload->>'delivery_location')>200 then raise exception 'Indica el lugar de entrega';end if;
 pid:=nullif(payload->>'recipient_id','')::uuid;
 if pid is not null then select full_name into recipient from public.hr_employees where id=pid and system_access_enabled and system_auth_user_id is not null;else recipient:=btrim(payload->>'recipient_name');end if;
 if recipient is null or length(recipient) not between 1 and 160 then raise exception 'Indica quién recibe';end if;
 if jsonb_typeof(payload->'items') is distinct from 'array' then raise exception 'Agrega los insumos';end if;
 if jsonb_array_length(payload->'items') not between 1 and 100 or (select count(distinct x->>'product_id') from jsonb_array_elements(payload->'items') x)<>jsonb_array_length(payload->'items') then raise exception 'Agrega entre 1 y 100 insumos sin repetir';end if;
 prior:=jsonb_build_object('order',to_jsonb(o),'items',(select coalesce(jsonb_agg(to_jsonb(i)),'[]') from public.inventory_order_items i where i.order_id=o.id));
 delete from public.inventory_order_items i where i.order_id=o.id;
 for line in select * from jsonb_array_elements(payload->'items') order by value->>'product_id' loop
  select * into strict p from public.inventory_products where id=(line->>'product_id')::uuid and deleted_at is null for update;
  q:=(line->>'quantity')::numeric;
  if q is null or q<=0 or q>='Infinity'::numeric or q>p.stock-studio_access_private.inventory_order_reserved(p.id) or p.currency<>'USD' then raise exception 'La cantidad de % sobrepasa la existencia disponible',p.name;end if;
  insert into public.inventory_order_items(order_id,product_id,product_name,unit,requested_quantity,unit_cost_reference) values(o.id,p.id,p.name,p.unit,q,p.unit_cost);
 end loop;
 update public.inventory_orders set area=payload->>'area',purpose=payload->>'purpose',project_reference=nullif(btrim(payload->>'project_reference'),''),recipient_id=pid,recipient_name=recipient,delivery_location=btrim(payload->>'delivery_location'),needed_on=(now() at time zone 'America/Havana')::date,notes=coalesce(payload->>'notes',''),submission=payload,status='pending',revision=o.revision+1,decision_note=null,approved_by=null,approved_by_name=null,approved_at=null where id=o.id;
 delete from public.inventory_order_reads r where r.order_id=o.id;
 insert into public.inventory_order_events(order_id,actor_id,actor_name,event,details) values(o.id,auth.uid(),studio_access_private.inventory_actor_name(),'resubmitted',jsonb_build_object('request_id',request_id,'from_revision',o.revision,'revision',o.revision+1,'submission',payload,'previous',prior,'snapshot',jsonb_build_object('order',(select to_jsonb(x) from public.inventory_orders x where x.id=o.id),'items',(select coalesce(jsonb_agg(to_jsonb(i)),'[]') from public.inventory_order_items i where i.order_id=o.id))));
 return o.id;
end $function$;

revoke all on function studio_access_private.inventory_request_catalog() from public,anon;
grant execute on function studio_access_private.inventory_request_catalog() to authenticated;
create or replace function public.inventory_request_catalog() returns jsonb language sql stable security invoker set search_path='' as $$select studio_access_private.inventory_request_catalog()$$;
revoke all on function public.inventory_request_catalog() from public,anon;
grant execute on function public.inventory_request_catalog() to authenticated;

