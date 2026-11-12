alter table public.inventory_products add column if not exists photo_background_cleaned boolean not null default false;
comment on column public.inventory_products.photo_background_cleaned is 'True only when a cleaned catalogue image is saved by the UI. False also includes legacy images without confirmed cleanup; not a permission claim.';
grant select(photo_background_cleaned),insert(photo_background_cleaned) on public.inventory_products to authenticated;
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
  insert into public.inventory_products(name,category,department,unit,description,currency,photo_path,minimum_stock,photo_background_cleaned)
  values(trim(payload->>'name'),payload->>'category',case when payload->>'department' in ('Gráfica','Audiovisual','Generales') then payload->>'department' else 'Generales' end,payload->>'unit',coalesce(payload->>'description',''),payload->>'currency',image_path,coalesce((payload->>'minimum_stock')::numeric,0),coalesce((payload->>'photo_background_cleaned')::boolean,false)) returning id into pid;
 end if;
 select * into strict p from public.inventory_products where id=pid;
 if payload->>'kind'='entry' and p.currency is distinct from payload->>'currency' then raise exception 'La moneda debe coincidir con la del producto'; end if;
 insert into public.inventory_movements(id,product_id,kind,quantity,unit_cost,occurred_on,allocation_type,project_reference,receiving_area,received_by,notes,supplier,currency,request_payload)
 values(request_id,pid,payload->>'kind',(payload->>'quantity')::numeric,case when payload->>'kind'='entry' then (payload->>'unit_cost')::numeric else 0 end,(payload->>'occurred_on')::date,payload->>'allocation_type',payload->>'project_reference',payload->>'receiving_area',payload->>'received_by',payload->>'notes',payload->'supplier',p.currency,payload);
 return request_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.inventory_update_product_photo(p_product_id uuid, p_photo_path text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not public.inventory_has_access('write') then raise exception 'Acceso no autorizado' using errcode='42501'; end if;
 if p_photo_path is null or p_photo_path !~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}\.jpg$') then raise exception 'Ruta de fotografía no válida'; end if;
 if not exists(select 1 from storage.objects where bucket_id='inventory-images' and name=p_photo_path and owner_id=auth.uid()::text) then raise exception 'La fotografía no pertenece a esta sesión'; end if;
 update public.inventory_products set photo_path=p_photo_path, photo_background_cleaned=false where id=p_product_id;
 if not found then raise exception 'Insumo no encontrado'; end if;
end $function$
;
create or replace function studio_access_private.inventory_update_product_photo_with_status(p_product_id uuid,p_photo_path text,p_background_cleaned boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.inventory_has_access('write') then raise exception 'Acceso no autorizado' using errcode='42501'; end if;
 perform public.inventory_update_product_photo(p_product_id,p_photo_path);
 update public.inventory_products set photo_background_cleaned=coalesce(p_background_cleaned,false) where id=p_product_id and photo_path=p_photo_path;
 if not found then raise exception 'No se pudo confirmar la fotografía'; end if;
end $$;
revoke all on function studio_access_private.inventory_update_product_photo_with_status(uuid,text,boolean) from public,anon;
grant execute on function studio_access_private.inventory_update_product_photo_with_status(uuid,text,boolean) to authenticated;
create or replace function public.inventory_update_product_photo_with_status(p_product_id uuid,p_photo_path text,p_background_cleaned boolean)
returns void language sql security invoker set search_path='' as $$
 select studio_access_private.inventory_update_product_photo_with_status(p_product_id,p_photo_path,p_background_cleaned);
$$;
revoke all on function public.inventory_update_product_photo_with_status(uuid,text,boolean) from public,anon;
grant execute on function public.inventory_update_product_photo_with_status(uuid,text,boolean) to authenticated;
