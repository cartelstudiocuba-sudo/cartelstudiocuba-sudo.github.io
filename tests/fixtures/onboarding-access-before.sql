CREATE OR REPLACE FUNCTION studio_access_private.is_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select auth.uid()='6418ad20-d0e8-49c0-8d9a-e1da3daf71b6'::uuid
$function$
;
CREATE OR REPLACE FUNCTION studio_access_private.has_permission(module text, operation text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select auth.uid() is not null and operation in ('read','write') and module in ('inventario_insumos','rrhh','usuarios_roles') and
 (studio_access_private.is_owner() or (module='inventario_insumos' and exists (
 select 1 from public.hr_employees e
 join auth.users u on u.id=e.system_auth_user_id
 join public.system_employee_role_assignments a on a.employee_id=e.id and a.ended_at is null
 join public.system_access_roles r on r.id=a.access_role_id and r.is_active
 join public.system_role_module_permissions p on p.access_role_id=r.id and p.module_code=module
 where e.system_auth_user_id=auth.uid() and e.system_access_enabled and e.status<>'terminated'
 and u.deleted_at is null and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now())
 and case when operation='read' then p.can_read else p.can_write end)))
$function$
;
CREATE OR REPLACE FUNCTION studio_access_private.set_employee_role(employee uuid, requested_role text, enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare rid uuid;
begin
 if not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501'; end if;
 if enabled is null then raise exception 'Datos incompletos'; end if;
 perform 1 from public.hr_employees where id=employee for update;
 if not found then raise exception 'Expediente inexistente'; end if;
 select id into rid from public.system_access_roles where code=requested_role and is_active;
 if rid is null then raise exception 'Rol no disponible'; end if;
 if enabled then
 insert into public.system_employee_role_assignments(employee_id,access_role_id,notes)
 values(employee,rid,'Asignado desde Usuarios y Roles') on conflict(employee_id,access_role_id) where ended_at is null do nothing;
 else update public.system_employee_role_assignments set ended_at=now() where employee_id=employee and access_role_id=rid and ended_at is null;
 end if;
 update public.hr_employees e set system_roles=coalesce((select jsonb_agg(r.code order by r.code)
 from public.system_employee_role_assignments a join public.system_access_roles r on r.id=a.access_role_id
 where a.employee_id=e.id and a.ended_at is null),'[]'::jsonb) where e.id=employee;
 insert into studio_access_private.permission_audit(actor_id,kind,target,after_data)
 values(auth.uid(),'employee_role',employee::text,jsonb_build_object('role',requested_role,'enabled',enabled));
end $function$
;
CREATE OR REPLACE FUNCTION public.system_my_views()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
select coalesce(jsonb_agg(jsonb_build_object('code',v.view_code,'is_default',v.is_default) order by v.is_default desc,v.view_code),'[]'::jsonb)
from public.system_user_view_assignments v join public.hr_employees e on e.id=v.employee_id
where e.system_auth_user_id=(select auth.uid()) and e.system_access_enabled and v.enabled
$function$
;
CREATE OR REPLACE FUNCTION public.system_my_navigation()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_owner boolean;
begin
 v_owner:=coalesce(studio_access_private.is_owner(),false);
 return jsonb_build_object('is_owner',v_owner,'views',coalesce((select jsonb_agg(jsonb_build_object('code',v.view_code,'is_default',v.is_default) order by v.is_default desc,v.view_code) from public.system_user_view_assignments v join public.hr_employees e on e.id=v.employee_id where e.system_auth_user_id=(select auth.uid()) and e.system_access_enabled and v.enabled),'[]'::jsonb));
end $function$
;
