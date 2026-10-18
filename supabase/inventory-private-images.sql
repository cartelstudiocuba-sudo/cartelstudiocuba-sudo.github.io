begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('inventory-images','inventory-images',false,2097152,array['image/jpeg']) on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['image/jpeg'];
alter table public.inventory_products add column photo_path text;
alter table public.inventory_products add constraint inventory_photo_path_format check(photo_path is null or photo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$');
create unique index inventory_photo_path_unique on public.inventory_products(photo_path) where photo_path is not null;
create policy inventory_images_read on storage.objects for select to authenticated using(bucket_id='inventory-images' and (select public.inventory_has_access('read')));
create policy inventory_images_insert on storage.objects for insert to authenticated with check(bucket_id='inventory-images' and (select public.inventory_has_access('write')) and owner_id=(select auth.uid())::text and name ~ ('^'||(select auth.uid())::text||'/[0-9a-f-]{36}\.jpg$'));
create policy inventory_images_delete_unlinked on storage.objects for delete to authenticated using(bucket_id='inventory-images' and (select public.inventory_has_access('write')) and owner_id=(select auth.uid())::text and not exists(select 1 from public.inventory_products p where p.photo_path=name));
CREATE OR REPLACE FUNCTION public.inventory_record_movement(request_id uuid, payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare image_path text; pid uuid; mid uuid; p public.inventory_products;
begin
 if not public.inventory_has_access('write') then raise exception 'Acceso no autorizado' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
 select id into mid from public.inventory_movements where id=request_id;
 if mid is not null then return mid; end if;
 image_path=nullif(payload->>'photo_path','');
 if image_path is not null then
  if image_path <> auth.uid()::text||'/'||request_id::text||'.jpg' then raise exception 'Ruta de fotografía no válida'; end if;
  if not exists(select 1 from storage.objects where bucket_id='inventory-images' and name=image_path and owner_id=auth.uid()::text) then raise exception 'La fotografía no se ha subido o no pertenece a esta sesión'; end if;
  if nullif(payload->>'product_id','') is not null then raise exception 'La fotografía solo se admite en productos nuevos'; end if;
 end if;
 pid=nullif(payload->>'product_id','')::uuid;
 if pid is null then
 if payload->>'kind' <> 'entry' then raise exception 'Seleccione un producto'; end if;
 insert into public.inventory_products(name,category,unit,description,currency,photo_path)
 values(payload->>'name',payload->>'category',payload->>'unit',coalesce(payload->>'description',''),payload->>'currency',image_path) returning id into pid;
 end if;
 select * into strict p from public.inventory_products where id=pid;
 if payload->>'kind'='entry' and p.currency is distinct from payload->>'currency' then raise exception 'La moneda debe coincidir con la del producto'; end if;
 insert into public.inventory_movements(id,product_id,kind,quantity,unit_cost,occurred_on,allocation_type,project_reference,receiving_area,received_by,notes,supplier)
 values(request_id,pid,payload->>'kind',(payload->>'quantity')::numeric,coalesce((payload->>'unit_cost')::numeric,0),(payload->>'occurred_on')::date,payload->>'allocation_type',payload->>'project_reference',payload->>'receiving_area',payload->>'received_by',payload->>'notes',payload->'supplier');
 return request_id;
end $function$;

commit;
