-- Approved customer-facing Bar menus. Drafts and image objects stay private.
select pg_advisory_xact_lock(hashtextextended('cartel.fridge.menu',0));
create table studio_access_private.fridge_menu_settings (
 code text primary key check(code='bar'), revision bigint not null default 1,
 selected_ids jsonb not null default '[]' check(jsonb_typeof(selected_ids)='array'),
 finish text not null default 'mate' check(finish in ('mate','brillo')),
 active_version uuid, updated_by uuid, updated_at timestamptz not null default now()
);
create table studio_access_private.fridge_menu_versions (
 id uuid primary key default gen_random_uuid(), number bigint generated always as identity unique,
 snapshot jsonb not null, image_path text not null unique, image_sha256 text not null check(image_sha256 ~ '^[0-9a-f]{64}$'),
 created_by uuid not null, actor_name text not null, created_at timestamptz not null default now()
);
alter table studio_access_private.fridge_menu_settings add foreign key(active_version) references studio_access_private.fridge_menu_versions(id);
create table studio_access_private.fridge_menu_events (
 id uuid primary key, actor_id uuid not null, kind text not null, payload jsonb not null, result jsonb,
 created_at timestamptz not null default now()
);
insert into studio_access_private.fridge_menu_settings(code,selected_ids)
select 'bar',coalesce(jsonb_agg(id::text order by category,name,id),'[]') from studio_access_private.fridge_products where active;
alter table studio_access_private.fridge_menu_settings enable row level security;
alter table studio_access_private.fridge_menu_versions enable row level security;
alter table studio_access_private.fridge_menu_events enable row level security;
-- No direct client grants. Security-definer helpers explicitly authorize their callers.
create function studio_access_private.fridge_menu_allowed() returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and (studio_access_private.fridge_allowed() or studio_access_private.fridge_manager())$$;
create function studio_access_private.fridge_menu_catalog() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'category',category,'price',price) order by id),'[]') from studio_access_private.fridge_products where active
$$;
create function studio_access_private.fridge_menu_state() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c jsonb;begin
 if not studio_access_private.fridge_menu_allowed() then raise exception 'No tienes acceso a la carta del Bar' using errcode='42501';end if;
 c:=studio_access_private.fridge_menu_catalog();
 return jsonb_build_object('catalog',c,'catalog_fingerprint',md5(c::text),'settings',(select to_jsonb(s) from studio_access_private.fridge_menu_settings s where code='bar'),'versions',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'number',v.number,'snapshot',v.snapshot,'actor_name',v.actor_name,'created_at',v.created_at) order by v.number desc) from (select * from studio_access_private.fridge_menu_versions order by number desc limit 30) v),'[]'));
end $$;
create function studio_access_private.fridge_menu_public(p_version uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',v.id,'number',v.number,'snapshot',v.snapshot,'approved_at',v.created_at)
 from studio_access_private.fridge_menu_versions v
 where v.id=coalesce(p_version,(select active_version from studio_access_private.fridge_menu_settings where code='bar'))
$$;
create function studio_access_private.fridge_menu_image_ref(p_version uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',v.id,'number',v.number,'path',v.image_path,'sha256',v.image_sha256)
 from studio_access_private.fridge_menu_versions v
 where v.id=coalesce(p_version,(select active_version from studio_access_private.fridge_menu_settings where code='bar'))
$$;
create function studio_access_private.fridge_menu_command(p_id uuid,p_kind text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
  if not coalesce((p_payload->>'confirmed')::boolean,false) then raise exception 'Confirma que revisaste y apruebas la carta';end if;
  if jsonb_array_length(s.selected_ids)=0 then raise exception 'Incluye al menos un producto';end if;
  c:=studio_access_private.fridge_menu_catalog();
  if p_payload->>'catalog_fingerprint' is distinct from md5(c::text) then raise exception 'Cambiaron productos o precios. Actualiza y revisa la vista previa antes de aprobar';end if;
  if exists(select 1 from jsonb_array_elements_text(s.selected_ids) x where not exists(select 1 from jsonb_array_elements(c) p where p->>'id'=x.value)) then raise exception 'Hay productos inactivos. Actualiza la selección';end if;
  select jsonb_agg(p.value order by x.ordinality) into items from jsonb_array_elements_text(s.selected_ids) with ordinality x join jsonb_array_elements(c) p on p.value->>'id'=x.value;
  path:=p_payload->>'image_path';
  if path is null or path !~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}\.jpg$') then raise exception 'Archivo de impresión no válido';end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='fridge-menu' and o.name=path and coalesce(o.owner_id,o.owner::text)=auth.uid()::text and o.metadata->>'mimetype'='image/jpeg' and (o.metadata->>'size')::bigint between 1 and 4194304) then raise exception 'Espera a que termine la subida del JPG antes de aprobar';end if;
  if coalesce(p_payload->>'image_sha256','') !~ '^[0-9a-f]{64}$' then raise exception 'Falta la verificación de la imagen';end if;
  insert into studio_access_private.fridge_menu_versions(snapshot,image_path,image_sha256,created_by,actor_name)
  values(jsonb_build_object('title','Menú','currency','USD','width_cm',21.59,'height_cm',27.94,'width_px',2550,'height_px',3300,'dpi',300,'finish',s.finish,'paper','Cartulina Bristol o similar de 180–220 g/m²','sides',1,'rounded_corners',true,'products',items),path,p_payload->>'image_sha256',auth.uid(),studio_access_private.inventory_actor_name()) returning * into v;
  update studio_access_private.fridge_menu_settings set active_version=v.id,revision=revision+1,updated_by=auth.uid(),updated_at=now() where code='bar' returning * into s;
  r:=jsonb_build_object('id',v.id,'number',v.number,'revision',s.revision);
 end if;
 insert into studio_access_private.fridge_menu_events(id,actor_id,kind,payload,result) values(p_id,auth.uid(),p_kind,p_payload,r);
 return r;
end $$;
create function public.fridge_menu_state() returns jsonb language sql stable security invoker set search_path='' as $$select studio_access_private.fridge_menu_state()$$;
create function public.fridge_menu_command(p_id uuid,p_kind text,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select studio_access_private.fridge_menu_command(p_id,p_kind,p_payload)$$;
create function public.fridge_menu_public(p_version uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$select studio_access_private.fridge_menu_public(p_version)$$;
create function public.fridge_menu_image_ref(p_version uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$select studio_access_private.fridge_menu_image_ref(p_version)$$;
revoke all on function studio_access_private.fridge_menu_allowed(),studio_access_private.fridge_menu_catalog(),studio_access_private.fridge_menu_state(),studio_access_private.fridge_menu_command(uuid,text,jsonb),studio_access_private.fridge_menu_public(uuid),studio_access_private.fridge_menu_image_ref(uuid),public.fridge_menu_state(),public.fridge_menu_command(uuid,text,jsonb),public.fridge_menu_public(uuid),public.fridge_menu_image_ref(uuid) from public,anon,authenticated;
grant execute on function studio_access_private.fridge_menu_allowed(),studio_access_private.fridge_menu_state(),studio_access_private.fridge_menu_command(uuid,text,jsonb),public.fridge_menu_state(),public.fridge_menu_command(uuid,text,jsonb) to authenticated;
grant execute on function studio_access_private.fridge_menu_public(uuid),public.fridge_menu_public(uuid) to authenticated,service_role;
grant execute on function studio_access_private.fridge_menu_image_ref(uuid),public.fridge_menu_image_ref(uuid) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('fridge-menu','fridge-menu',false,4194304,array['image/jpeg']);
create policy fridge_menu_upload on storage.objects for insert to authenticated with check(bucket_id='fridge-menu' and (select studio_access_private.fridge_menu_allowed()) and name ~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}\.jpg$'));
create policy fridge_menu_read on storage.objects for select to authenticated using(bucket_id='fridge-menu' and (select studio_access_private.fridge_menu_allowed()));
grant usage on schema studio_access_private to service_role;

create policy fridge_menu_settings_read on studio_access_private.fridge_menu_settings for select to authenticated using((select studio_access_private.fridge_menu_allowed()));
create policy fridge_menu_versions_read on studio_access_private.fridge_menu_versions for select to authenticated using((select studio_access_private.fridge_menu_allowed()));
create policy fridge_menu_events_read on studio_access_private.fridge_menu_events for select to authenticated using((select studio_access_private.fridge_menu_allowed()));
