-- New requests use the current server date; historical requests are unchanged.
create or replace function studio_access_private.inventory_order_create(request_id uuid,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
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
