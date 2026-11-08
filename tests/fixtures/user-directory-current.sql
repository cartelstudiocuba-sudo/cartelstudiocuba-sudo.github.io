CREATE OR REPLACE FUNCTION studio_access_private.user_directory()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(x order by x->>'full_name'),'[]'::jsonb) from (
 select jsonb_build_object('id',e.system_auth_user_id,'employee_id',e.id,'full_name',e.full_name,'username',e.system_username,
 'email',e.email,'position',e.role_title,'position_linked',e.role_id is not null,'enabled',e.system_access_enabled,
 'confirmed',u.email_confirmed_at is not null,'blocked',coalesce(u.banned_until>now(),false),'is_owner',false,
 'roles',(select coalesce(jsonb_agg(jsonb_build_object('code',r.code,'title',r.title,'active',true)),'[]'::jsonb)
 from public.system_employee_role_assignments a join public.system_access_roles r on r.id=a.access_role_id where a.employee_id=e.id and a.ended_at is null)) x
 from public.hr_employees e left join auth.users u on u.id=e.system_auth_user_id
 union all select jsonb_build_object('id',u.id,'email',u.email,'full_name','Propietario','is_owner',true,'confirmed',true,'roles','[]'::jsonb)
 from auth.users u where u.id='6418ad20-d0e8-49c0-8d9a-e1da3daf71b6'::uuid
 ) rows);
end $function$
