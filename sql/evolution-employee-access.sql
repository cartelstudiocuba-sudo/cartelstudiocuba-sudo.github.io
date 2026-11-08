-- Explicit account suspension/resumption. Does not alter labor state, roles or views.
create function studio_access_private.employee_access(p_employee uuid,p_enabled boolean,p_expected boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.hr_employees%rowtype;u auth.users%rowtype;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501';end if;
 if p_enabled is null or p_expected is null then raise exception 'Confirma la operación y el estado actual';end if;
 select * into e from public.hr_employees where id=p_employee for update;
 if not found then raise exception 'No existe el expediente';end if;
 if e.system_auth_user_id is null then raise exception 'Sin cuenta vinculada: utiliza el proceso de activación';end if;
 if e.system_auth_user_id=auth.uid() then raise exception 'El acceso del propietario está protegido' using errcode='42501';end if;
 if e.status='terminated' then raise exception 'La baja laboral no se reactiva desde Acceso';end if;
 if e.system_access_enabled=p_enabled then return studio_access_private.extended_user_profile(e.id,null);end if;
 if e.system_access_enabled is distinct from p_expected then raise exception 'El acceso cambió. Actualiza la ficha' using errcode='40001';end if;
 if p_enabled then
  select * into u from auth.users where id=e.system_auth_user_id;
  if u.id is null or u.email_confirmed_at is null or coalesce(u.banned_until>now(),false) then raise exception 'La cuenta requiere activación o está bloqueada en Auth';end if;
  if not exists(select 1 from studio_access_private.permission_audit a where a.target=e.id::text and a.kind='employee_access_suspended' and a.after_data->>'auth_user'=e.system_auth_user_id::text) then raise exception 'Esta cuenta debe completar su activación original';end if;
 end if;
 update public.hr_employees set system_access_enabled=p_enabled,updated_at=now() where id=e.id;
 insert into studio_access_private.permission_audit(actor_id,kind,target,before_data,after_data)
 values(auth.uid(),case when p_enabled then 'employee_access_resumed' else 'employee_access_suspended' end,e.id::text,jsonb_build_object('enabled',e.system_access_enabled),jsonb_build_object('enabled',p_enabled,'auth_user',e.system_auth_user_id));
 return studio_access_private.extended_user_profile(e.id,null);
end $$;
revoke all on function studio_access_private.employee_access(uuid,boolean,boolean) from public,anon;
grant execute on function studio_access_private.employee_access(uuid,boolean,boolean) to authenticated;
create function public.system_employee_access(p_employee uuid,p_enabled boolean,p_expected boolean) returns jsonb
language sql security invoker set search_path='' as $$select studio_access_private.employee_access(p_employee,p_enabled,p_expected)$$;
revoke all on function public.system_employee_access(uuid,boolean,boolean) from public,anon;
grant execute on function public.system_employee_access(uuid,boolean,boolean) to authenticated;
