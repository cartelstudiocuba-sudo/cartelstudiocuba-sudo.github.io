-- Individual equipment is separate from consumable stock, but assignments remain in hr_employee_assets.
create table public.studio_asset_categories(id uuid primary key default gen_random_uuid(),name text not null unique,active boolean not null default true);
insert into public.studio_asset_categories(name) values('Audiovisuales'),('Diseño'),('Producciones Gráficas'),('Informática y redes'),('Mobiliario'),('Administración'),('Transporte'),('Otros medios');
create table public.studio_assets(id uuid primary key default gen_random_uuid(),code text not null,name text not null,category_id uuid not null references public.studio_asset_categories(id),description text not null default '',serial_number text,operational_status text not null default 'available' check(operational_status in ('available','maintenance','out_of_service')),physical_condition text not null,location text not null default '',revision integer not null default 1,created_at timestamptz not null default now(),created_by uuid not null,updated_at timestamptz not null default now(),updated_by uuid not null);
create unique index studio_asset_code_unique on public.studio_assets(lower(btrim(code)));
create unique index studio_asset_serial_unique on public.studio_assets(lower(btrim(serial_number))) where nullif(btrim(serial_number),'') is not null;
alter table public.studio_asset_categories enable row level security;
alter table public.studio_assets enable row level security;
revoke all on public.studio_asset_categories,public.studio_assets from public,anon,authenticated;
grant select on public.studio_asset_categories,public.studio_assets to authenticated;
create policy asset_catalog_owner_read on public.studio_assets for select to authenticated using((select studio_access_private.is_owner()));
create policy asset_category_owner_read on public.studio_asset_categories for select to authenticated using((select studio_access_private.is_owner()));
alter table public.hr_employee_assets add column catalog_id uuid references public.studio_assets(id),add column assigned_condition text,add column returned_condition text;
create index employee_assets_catalog on public.hr_employee_assets(catalog_id);
create function studio_access_private.asset_catalog(p_action text,p_id uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.studio_assets%rowtype;old_row jsonb;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo personal autorizado' using errcode='42501';end if;
 if p_action='category' then
  if length(btrim(coalesce(p_payload->>'name','')))<2 then raise exception 'Indica el nombre de la categoría';end if;
  if p_id is null then insert into public.studio_asset_categories(name) values(left(btrim(p_payload->>'name'),100)) returning id into p_id;
  else update public.studio_asset_categories set name=left(btrim(p_payload->>'name'),100),active=coalesce((p_payload->>'active')::boolean,true) where id=p_id;if not found then raise exception 'Categoría no disponible';end if;end if;
 elsif p_action in ('create','update') then
  if length(btrim(coalesce(p_payload->>'code','')))<2 or length(btrim(coalesce(p_payload->>'name','')))<3 or nullif(btrim(p_payload->>'physical_condition'),'') is null then raise exception 'Código, nombre y estado de conservación son obligatorios';end if;
  if not exists(select 1 from public.studio_asset_categories where id=(p_payload->>'category_id')::uuid and active) then raise exception 'Categoría no disponible';end if;
  if p_action='create' then
   insert into public.studio_assets(code,name,category_id,description,serial_number,operational_status,physical_condition,location,created_by,updated_by) values(upper(btrim(p_payload->>'code')),left(btrim(p_payload->>'name'),200),(p_payload->>'category_id')::uuid,left(coalesce(p_payload->>'description',''),5000),nullif(btrim(p_payload->>'serial_number'),''),coalesce(p_payload->>'operational_status','available'),left(p_payload->>'physical_condition',500),left(coalesce(p_payload->>'location',''),500),auth.uid(),auth.uid()) returning * into a;p_id:=a.id;
  else
   select * into a from public.studio_assets where id=p_id for update;if not found then raise exception 'Medio no encontrado';end if;old_row:=to_jsonb(a);
   if (p_payload->>'revision')::integer is distinct from a.revision then raise exception 'El medio cambió. Actualiza el catálogo';end if;
   if exists(select 1 from public.hr_employee_assets where catalog_id=a.id or lower(btrim(asset_code))=lower(btrim(a.code))) and upper(btrim(p_payload->>'code'))<>a.code then raise exception 'El código de un medio con historial es inmutable';end if;
   if exists(select 1 from public.hr_employee_assets where (catalog_id=a.id or lower(btrim(asset_code))=lower(btrim(a.code))) and returned_at is null) and p_payload->>'operational_status'<>'available' then raise exception 'Devuelve el medio antes de enviarlo a mantenimiento o retirarlo';end if;
   update public.studio_assets set name=left(btrim(p_payload->>'name'),200),code=upper(btrim(p_payload->>'code')),category_id=(p_payload->>'category_id')::uuid,description=left(coalesce(p_payload->>'description',''),5000),serial_number=nullif(btrim(p_payload->>'serial_number'),''),operational_status=p_payload->>'operational_status',physical_condition=left(p_payload->>'physical_condition',500),location=left(coalesce(p_payload->>'location',''),500),revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=p_id returning * into a;
  end if;
 elsif p_action<>'list' then raise exception 'Acción no admitida';end if;
 if p_action<>'list' then insert into studio_access_private.permission_audit(actor_id,kind,target,before_data,after_data) values(auth.uid(),'asset_catalog_'||p_action,p_id::text,old_row,case when p_action='category' then p_payload else to_jsonb(a) end);end if;
 return jsonb_build_object('categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.name) from public.studio_asset_categories c),'[]'),'assets',coalesce((select jsonb_agg(to_jsonb(v)||jsonb_build_object('category',c.name,'assignment_id',x.id,'employee_id',x.employee_id,'responsible',e.full_name,'availability',case when x.id is not null then 'assigned' else v.operational_status end) order by v.code) from public.studio_assets v join public.studio_asset_categories c on c.id=v.category_id left join public.hr_employee_assets x on (x.catalog_id=v.id or lower(btrim(x.asset_code))=lower(btrim(v.code))) and x.returned_at is null left join public.hr_employees e on e.id=x.employee_id),'[]'),'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc) from studio_access_private.permission_audit h where h.kind like 'asset_catalog_%' or h.kind like 'employee_asset_%'),'[]'));
end $$;
revoke all on function studio_access_private.asset_catalog(text,uuid,jsonb) from public,anon;
grant execute on function studio_access_private.asset_catalog(text,uuid,jsonb) to authenticated;
create function public.system_asset_catalog(p_action text default 'list',p_id uuid default null,p_payload jsonb default '{}') returns jsonb language sql set search_path='' as $$select studio_access_private.asset_catalog(p_action,p_id,p_payload)$$;
revoke all on function public.system_asset_catalog(text,uuid,jsonb) from public,anon;
grant execute on function public.system_asset_catalog(text,uuid,jsonb) to authenticated;

create or replace function studio_access_private.employee_asset(p_employee uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.hr_employees%rowtype;a public.hr_employee_assets%rowtype;c studio_offboarding_private.cases%rowtype;before_row jsonb;code text;catalog public.studio_assets%rowtype;category text;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501';end if;
 select * into e from public.hr_employees where id=p_employee for update;
 if not found then raise exception 'No existe el trabajador';end if;
 if e.status='terminated' then raise exception 'Expediente dado de baja: asignaciones inmutables';end if;
 select * into c from studio_offboarding_private.cases where employee_id=e.id for update;
 if c.finalized_at is not null then raise exception 'Baja archivada';end if;
 if p_action='assign' then
  if c.id is not null then raise exception 'Cierre en trámite: no se permiten nuevas entregas';end if;
  select * into catalog from public.studio_assets where id=(p_payload->>'catalog_id')::uuid for update;
  if not found or catalog.operational_status<>'available' then raise exception 'Selecciona un medio disponible del catálogo';end if;
  select name into category from public.studio_asset_categories where id=catalog.category_id and active;
  if category is null then raise exception 'Categoría no disponible';end if;
  code:=catalog.code;p_payload:=p_payload||jsonb_build_object('asset_code',code,'description',catalog.name,'asset_type',category);
  if length(code)<2 or length(code)>100 or length(btrim(coalesce(p_payload->>'description','')))<3 or length(btrim(coalesce(p_payload->>'asset_type','')))<2 then raise exception 'Identifica el medio, su categoría y su código único';end if;
  perform pg_advisory_xact_lock(hashtextextended(code,0));
  if exists(select 1 from public.hr_employee_assets where lower(btrim(asset_code))=lower(code) and returned_at is null) then raise exception 'El medio ya tiene una asignación activa';end if;
  if (p_payload->>'assigned_on')::date is null or (p_payload->>'assigned_on')::date>current_date or (p_payload->>'assigned_on')::date<e.hired_at::date then raise exception 'Fecha de entrega no válida';end if;
  insert into public.hr_employee_assets(employee_id,asset_code,asset_type,description,assigned_at,assigned_by,notes,catalog_id,assigned_condition) values(e.id,code,left(btrim(p_payload->>'asset_type'),100),left(btrim(p_payload->>'description'),500),(p_payload->>'assigned_on')::date,auth.uid(),left(coalesce(p_payload->>'notes',''),10000),catalog.id,catalog.physical_condition) returning * into a;
 elsif p_action='return' then
  select * into a from public.hr_employee_assets where id=(p_payload->>'asset_id')::uuid and employee_id=e.id for update;
  if not found then raise exception 'Medio ajeno a este trabajador';end if;
  if a.returned_at is not null then raise exception 'El medio ya fue devuelto';end if;
  if length(btrim(coalesce(p_payload->>'notes','')))<3 then raise exception 'Documenta la devolución';end if;
  if nullif(btrim(p_payload->>'physical_condition'),'') is null then raise exception 'Registra el estado de conservación recibido';end if;
  before_row:=to_jsonb(a);
  if c.id is not null then
   if (p_payload->>'revision')::integer is distinct from c.revision then raise exception 'La baja cambió. Actualiza la ficha';end if;
   perform studio_offboarding_private.manage(e.id,'receipt',jsonb_build_object('revision',c.revision,'asset_id',a.id,'state','received','notes',p_payload->>'notes'));
   update public.hr_employee_assets set returned_by=auth.uid(),returned_condition=left(p_payload->>'physical_condition',500) where id=a.id returning * into a;
  else update public.hr_employee_assets set returned_at=now(),returned_by=auth.uid(),returned_condition=left(p_payload->>'physical_condition',500) where id=a.id returning * into a;
  end if;
 else raise exception 'Acción no admitida';end if;
 if p_action='return' and a.catalog_id is not null then update public.studio_assets set physical_condition=a.returned_condition,revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=a.catalog_id;end if;
 insert into studio_access_private.permission_audit(actor_id,kind,target,before_data,after_data) values(auth.uid(),'employee_asset_'||p_action,e.id::text,before_row,to_jsonb(a)||jsonb_build_object('operation_notes',left(coalesce(p_payload->>'notes',''),10000)));
 return studio_access_private.extended_user_profile(e.id,null);
end $$;
