-- Editable print specifications. Existing approved snapshots remain immutable.
alter table studio_access_private.fridge_menu_settings add column print_options jsonb not null default '{"format":"letter","paper":"bristol","paper_other":"","weight":"180–220","sides":1,"color":"color","corners":"rounded"}'::jsonb check(jsonb_typeof(print_options)='object');
create function studio_access_private.fridge_menu_print_options(raw jsonb) returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare p jsonb;other text;
begin
 if raw is not null and jsonb_typeof(raw) is distinct from 'object' then raise exception 'Opciones de impresión no válidas';end if;
 p:='{"format":"letter","paper":"bristol","paper_other":"","weight":"180–220","sides":1,"color":"color","corners":"rounded"}'::jsonb||coalesce(raw,'{}'::jsonb);
 if coalesce(p->>'format','') not in ('letter','a4','a5','legal') or coalesce(p->>'paper','') not in ('bristol','couche','bond','other') or coalesce(p->>'weight','') not in ('180–220','80','90','120','150','180','200','220','250','300') or coalesce(p->>'sides','') not in ('1','2') or coalesce(p->>'color','') not in ('color','bw') or coalesce(p->>'corners','') not in ('rounded','square') then raise exception 'Revisa las opciones de impresión';end if;
 if jsonb_typeof(p->'paper_other') is distinct from 'string' then raise exception 'Material de impresión no válido';end if;
 other:=btrim(coalesce(p->>'paper_other',''));if length(other)>80 or (p->>'paper'='other' and other='') then raise exception 'Declara el material de impresión (máximo 80 caracteres)';end if;
 return jsonb_build_object('format',p->>'format','paper',p->>'paper','paper_other',case when p->>'paper'='other' then other else '' end,'weight',p->>'weight','sides',(p->>'sides')::integer,'color',p->>'color','corners',p->>'corners');
end $$;
revoke all on function studio_access_private.fridge_menu_print_options(jsonb) from public,anon,authenticated;
create or replace function studio_access_private.fridge_menu_command(p_id uuid,p_kind text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare prior studio_access_private.fridge_menu_events%rowtype;s studio_access_private.fridge_menu_settings%rowtype;c jsonb;selected jsonb;items jsonb;r jsonb;path text;v studio_access_private.fridge_menu_versions%rowtype;opts jsonb;w numeric;h numeric;
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
  opts:=studio_access_private.fridge_menu_print_options(case when p_payload?'print_options' then p_payload->'print_options' else s.print_options end);
  update studio_access_private.fridge_menu_settings set print_options=opts,selected_ids=selected,finish=p_payload->>'finish',revision=revision+1,updated_by=auth.uid(),updated_at=now() where code='bar' returning * into s;
  r:=jsonb_build_object('revision',s.revision);
 else
  if coalesce(p_payload->>'design','original-v1') not in ('original-v1','urban-v2','elegant-v3','elegant-cup-v4','elegant-compact-v5','elegant-print-v6') then raise exception 'Diseño de carta no válido';end if;
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
  opts:=studio_access_private.fridge_menu_print_options(case when p_payload->>'design'='elegant-print-v6' then s.print_options else '{}'::jsonb end);
  if p_payload->>'design'='elegant-print-v6' and studio_access_private.fridge_menu_print_options(p_payload->'print_options') is distinct from opts then raise exception 'Cambiaron las opciones de impresión. Revisa de nuevo';end if;
  w:=case opts->>'format' when 'a4' then 21 when 'a5' then 14.8 else 21.59 end;
  h:=case opts->>'format' when 'a4' then 29.7 when 'a5' then 21 when 'legal' then 35.56 else 27.94 end;
  insert into studio_access_private.fridge_menu_versions(snapshot,image_path,image_sha256,created_by,actor_name)
  values(jsonb_build_object('title','Menú','design',coalesce(p_payload->>'design','original-v1'),'payment_note',case when p_payload->>'design' in ('elegant-cup-v4','elegant-compact-v5','elegant-print-v6') then 'Puedes pagar los productos en CUP según la tasa de cambio del día.' else null end,'currency','USD','print_options',opts,'width_cm',w,'height_cm',h,'width_px',round(w/2.54*300)::integer,'height_px',round(h/2.54*300)::integer,'dpi',300,'finish',s.finish,'paper',(case opts->>'paper' when 'bristol' then 'Cartulina Bristol' when 'couche' then 'Papel couché' when 'bond' then 'Papel bond' else opts->>'paper_other' end)||' · '||(opts->>'weight')||' g/m²','sides',(opts->>'sides')::integer,'color_mode',opts->>'color','rounded_corners',opts->>'corners'='rounded','products',items),path,p_payload->>'image_sha256',auth.uid(),studio_access_private.inventory_actor_name()) returning * into v;
  update studio_access_private.fridge_menu_settings set active_version=v.id,revision=revision+1,updated_by=auth.uid(),updated_at=now() where code='bar' returning * into s;
  r:=jsonb_build_object('id',v.id,'number',v.number,'revision',s.revision);
 end if;
 insert into studio_access_private.fridge_menu_events(id,actor_id,kind,payload,result) values(p_id,auth.uid(),p_kind,p_payload,r);
 return r;
end $$;

create or replace function studio_access_private.fridge_menu_image_ref(p_version uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',v.id,'number',v.number,'path',v.image_path,'sha256',v.image_sha256,'width',coalesce((v.snapshot->>'width_px')::integer,2550),'height',coalesce((v.snapshot->>'height_px')::integer,3300))
 from studio_access_private.fridge_menu_versions v where v.id=coalesce(p_version,(select active_version from studio_access_private.fridge_menu_settings where code='bar'))
$$;
