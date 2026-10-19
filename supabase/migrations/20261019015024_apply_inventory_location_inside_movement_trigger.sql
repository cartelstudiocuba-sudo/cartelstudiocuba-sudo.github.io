-- Preserve trigger-only writes while allowing movement locations to be applied atomically.
CREATE OR REPLACE FUNCTION public.inventory_record_movement(request_id uuid, payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare image_path text; pid uuid; existing public.inventory_movements; p public.inventory_products;
begin
 if auth.uid() is null or not public.inventory_has_access('write') then raise exception 'Acceso no autorizado' using errcode='42501'; end if;
 if request_id is null or payload is null then raise exception 'Solicitud no válida'; end if;
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
 select * into existing from public.inventory_movements where id=request_id;
 if found then
  if existing.created_by is distinct from auth.uid() or (existing.request_payload is not null and existing.request_payload is distinct from payload) then raise exception 'La solicitud ya existe con otros datos o responsable'; end if;
  return existing.id;
 end if;
 image_path=nullif(payload->>'photo_path','');
 if image_path is not null then
  if image_path<>auth.uid()::text||'/'||request_id::text||'.jpg' then raise exception 'Ruta de fotografía no válida'; end if;
  if not exists(select 1 from storage.objects where bucket_id='inventory-images' and name=image_path and owner_id=auth.uid()::text) then raise exception 'La fotografía no se ha subido o no pertenece a esta sesión'; end if;
  if nullif(payload->>'product_id','') is not null then raise exception 'La fotografía solo se admite en productos nuevos'; end if;
 end if;
 pid=nullif(payload->>'product_id','')::uuid;
 if pid is null then
  if payload->>'kind' is distinct from 'entry' then raise exception 'Seleccione un producto'; end if;
  if nullif(trim(payload->>'category'),'') is null or nullif(trim(payload->>'unit'),'') is null then raise exception 'Complete categoría y unidad'; end if;
  insert into public.inventory_products(name,category,unit,description,currency,photo_path,minimum_stock)
  values(trim(payload->>'name'),payload->>'category',payload->>'unit',coalesce(payload->>'description',''),payload->>'currency',image_path,coalesce((payload->>'minimum_stock')::numeric,0)) returning id into pid;
 end if;
 select * into strict p from public.inventory_products where id=pid;
 if payload->>'kind'='entry' and p.currency is distinct from payload->>'currency' then raise exception 'La moneda debe coincidir con la del producto'; end if;
 insert into public.inventory_movements(id,product_id,kind,quantity,unit_cost,occurred_on,allocation_type,project_reference,receiving_area,received_by,notes,supplier,currency,request_payload)
 values(request_id,pid,payload->>'kind',(payload->>'quantity')::numeric,case when payload->>'kind'='entry' then (payload->>'unit_cost')::numeric else 0 end,(payload->>'occurred_on')::date,payload->>'allocation_type',payload->>'project_reference',payload->>'receiving_area',payload->>'received_by',payload->>'notes',payload->'supplier',p.currency,payload);
 return request_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.inventory_apply_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare p public.inventory_products;
begin
 if auth.uid() is null or not public.inventory_has_access('write') then
  raise exception 'Acceso no autorizado' using errcode='42501';
 end if;
 if new.quantity is null or new.quantity<=0 or new.quantity>='Infinity'::numeric then raise exception 'Cantidad no válida'; end if;
 select * into strict p from public.inventory_products where id=new.product_id for update;
 if new.currency is not null and new.currency<>p.currency then raise exception 'La moneda debe coincidir con la del producto'; end if;
 new.currency=p.currency; new.product_name=p.name; new.product_unit=p.unit; new.created_by=auth.uid();
 new.recorded_by_name=studio_access_private.inventory_actor_name();
 if new.kind='entry' then
  if new.unit_cost is null or new.unit_cost<0 or new.unit_cost>='Infinity'::numeric then raise exception 'Costo no válido'; end if;
  if length(coalesce(new.request_payload->>'location',''))>200 then raise exception 'Ubicación demasiado larga'; end if;
  -- Apply location under the same trigger-only RLS boundary as stock and cost.
  update public.inventory_products set unit_cost=new.unit_cost,stock=stock+new.quantity,
   location=coalesce(nullif(btrim(new.request_payload->>'location'),''),location) where id=p.id;
 elsif new.kind='out' then
  if p.stock<new.quantity then raise exception 'Existencias insuficientes'; end if;
  if new.allocation_type is null or nullif(trim(new.receiving_area),'') is null or nullif(trim(new.received_by),'') is null or (new.allocation_type='project' and nullif(trim(new.project_reference),'') is null) then raise exception 'Complete la imputación económica y el receptor'; end if;
  new.unit_cost=p.unit_cost;
  update public.inventory_products set stock=stock-new.quantity where id=p.id;
  insert into public.inventory_economic_movements(occurred_on,product_id,product_name,quantity,unit_cost,currency,allocation_type,project_reference,receiving_area,received_by,source_movement_id,created_by)
  values(new.occurred_on,p.id,p.name,new.quantity,new.unit_cost,p.currency,new.allocation_type,case when new.allocation_type='project' then new.project_reference end,new.receiving_area,new.received_by,new.id,auth.uid());
 else raise exception 'Tipo de movimiento no válido'; end if;
 return new;
end $function$
;
grant update(location) on public.inventory_products to authenticated;
