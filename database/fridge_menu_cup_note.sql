-- CUP payment note for future approvals only. Preserve existing menu versions and pricing.
create or replace function studio_access_private.fridge_menu_command(p_id uuid,p_kind text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare prior studio_access_private.fridge_menu_events%rowtype;s studio_access_private.fridge_menu_settings%rowtype;c jsonb;selected jsonb;items jsonb;r jsonb;path text;v studio_access_private.fridge_menu_versions%rowtype;
begin
 if not studio_access_private.fridge_menu_allowed() then raise exception 'No tienes acceso a la carta del Bar' using errcode='42501';end if;
 if p_id is null or p_kind not in ('draft','publish') or p_kind is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Operación de carta no válida';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
 perform pg_advisory_xact_lock(hashtextextended('cartel.fridge.menu',0));
 select * into prior from studio_access_private.fridge_menu_events where id=p_id;
 if found then if prior.actor_id<>auth.uid() or prior.kind<>p_kind or prior.payload<>p_payload then raise exception 'El identificador pertenece a otro envío';end if;return prior.result;end if;
 select * into strict s from studio_access_private.fridge_menu_settings where code='bar' for update;
 if p_payload->>'revision' is null or (p_payload->>'revision')::bigint<>s.revision then raise exception 'La carta cambió. Actualiza antes de guardar o aprobar';end if;
 if p_kind='draft' then
  selected:=p_payload->'selected_ids';
  if jsonb_typeof(selected) is distinct from 'array' then raise exception 'Selecciona los productos de la carta';end if;
  if jsonb_array_length(selected)>100 or (select count(*) from jsonb_array_elements_text(selected))<>(select count(distinct value) from jsonb_array_elements_text(selected)) then raise exception 'Selección de productos no válida';end if;
  if exists(select 1 from jsonb_array_elements_text(selected) x where not exists(select 1 from studio_access_private.fridge_products p where p.id::text=x.value and p.active)) then raise exception 'Hay productos que ya no están disponibles. Actualiza la carta';end if;
  if coalesce(p_payload->>'finish','') not in ('mate','brillo') then raise exception 'Selecciona acabado mate o brillo';end if;
  update studio_access_private.fridge_menu_settings set selected_ids=selected,finish=p_payload->>'finish',revision=revision+1,updated_by=auth.uid(),updated_at=now() where code='bar' returning * into s;
  r:=jsonb_build_object('revision',s.revision);
 else
  if coalesce(p_payload->>'design','original-v1') not in ('original-v1','urban-v2','elegant-v3','elegant-cup-v4') then raise exception 'Diseño de carta no válido';end if;
  if not coalesce((p_payload->>'confirmed')::boolean,false) then raise exception 'Confirma que revisaste y apruebas la carta';end if;
  if jsonb_array_length(s.selected_ids)=0 then raise exception 'Incluye al menos un producto';end if;
  c:=studio_access_private.fridge_menu_catalog();
  if p_payload->>'catalog_fingerprint' is distinct from md5(c::text) then raise exception 'Cambiaron productos o precios. Actualiza y revisa la vista previa antes de aprobar';end if;
  if exists(select 1 from jsonb_array_elements_text(s.selected_ids) x where not exists(select 1 from jsonb_array_elements(c) p where p->>'id'=x.value)) then raise exception 'Hay productos inactivos. Actualiza la selección';end if;
  select jsonb_agg(p.value order by x.ordinality) into items from jsonb_array_elements_text(s.selected_ids) with ordinality x join jsonb_array_elements(c) p on p.value->>'id'=x.value;
  path:=p_payload->>'image_path';
  if path is null or path !~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}[.]jpg$') then raise exception 'Archivo de impresión no válido';end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='fridge-menu' and o.name=path and coalesce(o.owner_id,o.owner::text)=auth.uid()::text and o.metadata->>'mimetype'='image/jpeg' and (o.metadata->>'size')::bigint between 1 and 4194304) then raise exception 'Espera a que termine la subida del JPG antes de aprobar';end if;
  if coalesce(p_payload->>'image_sha256','') !~ '^[0-9a-f]{64}$' then raise exception 'Falta la verificación de la imagen';end if;
  insert into studio_access_private.fridge_menu_versions(snapshot,image_path,image_sha256,created_by,actor_name)
  values(jsonb_build_object('title','Menú','design',coalesce(p_payload->>'design','original-v1'),'payment_note',case when p_payload->>'design'='elegant-cup-v4' then 'Puedes pagar los productos en CUP según la tasa de cambio del día.' else null end,'currency','USD','width_cm',21.59,'height_cm',27.94,'width_px',2550,'height_px',3300,'dpi',300,'finish',s.finish,'paper','Cartulina Bristol o similar de 180–220 g/m²','sides',1,'rounded_corners',true,'products',items),path,p_payload->>'image_sha256',auth.uid(),studio_access_private.inventory_actor_name()) returning * into v;
  update studio_access_private.fridge_menu_settings set active_version=v.id,revision=revision+1,updated_by=auth.uid(),updated_at=now() where code='bar' returning * into s;
  r:=jsonb_build_object('id',v.id,'number',v.number,'revision',s.revision);
 end if;
 insert into studio_access_private.fridge_menu_events(id,actor_id,kind,payload,result) values(p_id,auth.uid(),p_kind,p_payload,r);
 return r;
end $$;
