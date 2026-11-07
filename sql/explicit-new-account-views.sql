-- Existing assignments and templates remain untouched. New onboarding copies permissions only.
alter table studio_access_private.employee_access_snapshots add column view_mode text not null default 'legacy_template' check(view_mode in ('legacy_template','individual'));
create function studio_access_private.apply_role_permissions_only(p_employee uuid,p_role uuid) returns void language plpgsql security definer set search_path='' as $$
declare t studio_access_private.role_templates;before_row jsonb;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501';end if;
 perform 1 from public.hr_employees where id=p_employee and status<>'terminated' for update;if not found then raise exception 'Expediente no disponible';end if;
 if not exists(select 1 from public.system_employee_role_assignments where employee_id=p_employee and access_role_id=p_role and ended_at is null) then raise exception 'El trabajador no tiene este rol';end if;
 select * into t from studio_access_private.role_templates where role_id=p_role for share;
 if not coalesce(studio_access_private.template_valid(p_role,t.can_read,t.can_write,'[]'),false) then raise exception 'Revisa los límites del rol';end if;
 select to_jsonb(s) into before_row from studio_access_private.employee_access_snapshots s where employee_id=p_employee;
 insert into studio_access_private.employee_access_snapshots(employee_id,role_id,template_revision,can_read,can_write,views,view_mode)
 values(p_employee,p_role,t.revision,t.can_read,t.can_write,'[]','individual')
 on conflict(employee_id) do update set role_id=excluded.role_id,template_revision=excluded.template_revision,can_read=excluded.can_read,can_write=excluded.can_write,applied_at=now();
 insert into studio_access_private.permission_audit(actor_id,kind,target,before_data,after_data) values(auth.uid(),'apply_role_permissions',p_employee::text,before_row,jsonb_build_object('role_id',p_role,'revision',t.revision,'new_views_inherited',false));
end $$;
revoke all on function studio_access_private.apply_role_permissions_only(uuid,uuid) from public,anon,authenticated;

create or replace function public.system_my_views() returns jsonb language sql stable security definer set search_path='' as $$
select coalesce(
 (select s.views from studio_access_private.employee_access_snapshots s join public.hr_employees e on e.id=s.employee_id where s.view_mode='legacy_template' and e.system_auth_user_id=auth.uid() and public.system_has_permission('inventario_insumos','read')),
 (select jsonb_agg(jsonb_build_object('code',v.view_code,'is_default',v.is_default) order by v.is_default desc,v.view_code) from public.system_user_view_assignments v join public.hr_employees e on e.id=v.employee_id join studio_access_private.employee_access_snapshots s on s.employee_id=e.id and s.view_mode='individual' where e.system_auth_user_id=auth.uid() and e.system_access_enabled and v.enabled and (v.view_code<>'inventory_admin' or public.system_has_permission('inventario_insumos','read'))),
 (select coalesce(jsonb_agg(jsonb_build_object('code',v.view_code,'is_default',v.is_default) order by v.is_default desc,v.view_code),'[]') from public.system_user_view_assignments v join public.hr_employees e on e.id=v.employee_id where e.system_auth_user_id=auth.uid() and e.system_access_enabled and v.enabled and not exists(select 1 from studio_access_private.employee_access_snapshots s where s.employee_id=e.id)), '[]')
$$;

