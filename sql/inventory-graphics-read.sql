-- Reviewed upgrade from 6182052. No product, employment or Auth data changes.
create or replace function studio_access_private.inventory_graphics_identity()
returns boolean language sql stable security definer set search_path=''
as $f$ select exists(select 1 from public.hr_employees e where e.system_auth_user_id=auth.uid() and e.system_username='melanie.medina') $f$;
revoke all on function studio_access_private.inventory_graphics_identity() from public,anon;
grant execute on function studio_access_private.inventory_graphics_identity() to authenticated;
create or replace function public.inventory_has_access(operation text)
returns boolean language sql stable set search_path=''
as $f$ select studio_access_private.has_permission('inventario_insumos',operation) and not studio_access_private.inventory_graphics_identity() $f$;

create or replace function studio_access_private.inventory_graphics_catalog(p_search text,p_offset integer,p_limit integer,p_product uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $f$
declare result jsonb;
begin
 if auth.uid() is null or not studio_access_private.inventory_graphics_identity()
 or not studio_access_private.has_permission('inventario_insumos','read')
 or not exists(select 1 from public.hr_employees e
 join public.system_employee_role_assignments a on a.employee_id=e.id and a.ended_at is null
 join public.system_access_roles r on r.id=a.access_role_id and r.is_active and r.code='insumos_melanie_medina'
 join public.system_user_view_assignments v on v.employee_id=e.id and v.view_code='inventory_graphics_read' and v.enabled
 where e.system_auth_user_id=auth.uid())
 then raise exception 'Consulta no autorizada' using errcode='42501'; end if;
 if p_search is null or length(p_search)>200 or p_offset is null or p_offset<0 or p_limit is null or p_limit<1 or p_limit>100
 then raise exception 'Consulta no válida' using errcode='22023'; end if;
 -- Exact approved category only. Historical categories never imply a department.
 with eligible as (
 select id,name,category,unit,stock,minimum_stock,location,updated_at,
 case when stock<=0 then 'Agotado' when minimum_stock>0 and stock<=minimum_stock then 'Bajo mínimo' else 'Disponible' end as stock_status
 from public.inventory_products
 where category='Departamento Gráfica'
 and (p_product is null or id=p_product)
 and (p_search='' or position(lower(p_search) in lower(name||' '||id::text))>0)
 ), page as (select * from eligible order by name,id offset p_offset limit p_limit)
 select jsonb_build_object('total',(select count(*) from eligible),'rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.name,p.id) from page p),'[]'::jsonb)) into result;
 return result;
end $f$;
revoke all on function studio_access_private.inventory_graphics_catalog(text,integer,integer,uuid) from public,anon;
grant execute on function studio_access_private.inventory_graphics_catalog(text,integer,integer,uuid) to authenticated;
create or replace function public.inventory_graphics_catalog(p_search text default '',p_offset integer default 0,p_limit integer default 50,p_product uuid default null)
returns jsonb language sql stable set search_path=''
as $f$ select studio_access_private.inventory_graphics_catalog(p_search,p_offset,p_limit,p_product) $f$;
revoke all on function public.inventory_graphics_catalog(text,integer,integer,uuid) from public,anon;
grant execute on function public.inventory_graphics_catalog(text,integer,integer,uuid) to authenticated;

alter table public.system_user_view_assignments drop constraint system_user_view_assignments_view_code_check;
alter table public.system_user_view_assignments add constraint system_user_view_assignments_view_code_check check(view_code in ('inventory_admin','audiovisual_lead','inventory_graphics_read'));
CREATE OR REPLACE FUNCTION public.system_manage_user_view(p_employee uuid, p_code text, p_enabled boolean, p_default boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501'; end if;
 if exists(select 1 from studio_access_private.employee_access_snapshots where employee_id=p_employee and view_mode='legacy_template') then raise exception 'Acceso por plantilla: modifica el rol y aplica explícitamente su plantilla a este trabajador'; end if;
 if p_code not in ('inventory_admin','audiovisual_lead','inventory_graphics_read') then raise exception 'Vista no admitida'; end if;
 if not exists(select 1 from public.hr_employees where id=p_employee) then raise exception 'Expediente inexistente'; end if;
 if p_default and p_enabled then update public.system_user_view_assignments set is_default=false where employee_id=p_employee; end if;
 insert into public.system_user_view_assignments(employee_id,view_code,enabled,is_default)
 values(p_employee,p_code,p_enabled,p_default and p_enabled)
 on conflict(employee_id,view_code) do update set enabled=excluded.enabled,is_default=excluded.is_default;
 insert into studio_access_private.permission_audit(actor_id,kind,target,after_data) values(auth.uid(),'user_view',p_employee::text,jsonb_build_object('code',p_code,'enabled',p_enabled,'is_default',p_default and p_enabled));
end $function$;


do $f$
declare e public.hr_employees; r public.system_access_roles; prior jsonb;
begin
 select * into strict e from public.hr_employees where system_username='melanie.medina';
 select * into strict r from public.system_access_roles where code='insumos_melanie_medina';
 if e.system_auth_user_id is null or not e.system_access_enabled then raise exception 'Identidad de Melanie requiere revisión'; end if;
 if exists(select 1 from public.system_employee_role_assignments where access_role_id=r.id and employee_id<>e.id and ended_at is null) then raise exception 'El rol ya no es individual'; end if;
 prior:=jsonb_build_object('views',(select jsonb_agg(to_jsonb(v)) from public.system_user_view_assignments v where employee_id=e.id),'snapshot',(select to_jsonb(s) from studio_access_private.employee_access_snapshots s where employee_id=e.id),'permissions',(select jsonb_agg(to_jsonb(p)) from public.system_role_module_permissions p where access_role_id=r.id));
 update public.system_role_module_permissions set can_read=(module_code='inventario_insumos'),can_write=false,updated_at=now() where access_role_id=r.id;
 update studio_access_private.employee_access_snapshots set can_read=true,can_write=false,views='[{"code":"inventory_graphics_read","is_default":true}]',view_mode='individual',applied_at=now() where employee_id=e.id and role_id=r.id;
 if not found then raise exception 'Copia individual no coincide'; end if;
 update public.system_user_view_assignments set enabled=false,is_default=false where employee_id=e.id;
 insert into public.system_user_view_assignments(employee_id,view_code,enabled,is_default) values(e.id,'inventory_graphics_read',true,true)
 on conflict(employee_id,view_code) do update set enabled=true,is_default=true;
 update public.system_access_roles set title='Consulta de Insumos — Gráfica · Melanie Medina',description='Solo consulta de productos categorizados Departamento Gráfica. Sin operaciones ni datos económicos.',updated_at=now() where id=r.id;
 insert into studio_access_private.permission_audit(actor_id,kind,target,before_data,after_data) values(null,'graphics_read_only',e.id::text,prior,jsonb_build_object('view','inventory_graphics_read','category','Departamento Gráfica','can_write',false));
end $f$;
