CREATE OR REPLACE FUNCTION public.system_manage_user_view(p_employee uuid, p_code text, p_enabled boolean, p_default boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501'; end if;
 if exists(select 1 from studio_access_private.employee_access_snapshots where employee_id=p_employee) then raise exception 'Acceso por plantilla: modifica el rol y aplica explícitamente su plantilla a este trabajador'; end if;
 if p_code not in ('inventory_admin','audiovisual_lead') then raise exception 'Vista no admitida'; end if;
 if not exists(select 1 from public.hr_employees where id=p_employee) then raise exception 'Expediente inexistente'; end if;
 if p_default and p_enabled then update public.system_user_view_assignments set is_default=false where employee_id=p_employee; end if;
 insert into public.system_user_view_assignments(employee_id,view_code,enabled,is_default)
 values(p_employee,p_code,p_enabled,p_default and p_enabled)
 on conflict(employee_id,view_code) do update set enabled=excluded.enabled,is_default=excluded.is_default;
end $function$

;
create or replace function public.system_owner_employee_views(p_employee uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s studio_access_private.employee_access_snapshots;
begin
 if not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501'; end if;
 select * into s from studio_access_private.employee_access_snapshots where employee_id=p_employee;
 if s.employee_id is not null then
  return jsonb_build_array(jsonb_build_object('code','__template__','template_revision',s.template_revision,'role_id',s.role_id,'can_read',s.can_read,'can_write',s.can_write))||
  coalesce((select jsonb_agg(v||jsonb_build_object('enabled',true)) from jsonb_array_elements(s.views) v),'[]');
 end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('code',view_code,'enabled',enabled,'is_default',is_default)),'[]'::jsonb) from public.system_user_view_assignments where employee_id=p_employee);
end $$;
revoke all on function public.system_manage_user_view(uuid,text,boolean,boolean),public.system_owner_employee_views(uuid) from public,anon;
grant execute on function public.system_manage_user_view(uuid,text,boolean,boolean),public.system_owner_employee_views(uuid) to authenticated;
