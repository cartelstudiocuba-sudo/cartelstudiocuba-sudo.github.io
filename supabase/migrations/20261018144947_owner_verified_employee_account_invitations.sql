create function studio_access_private.prepare_invitation(employee uuid,account_email text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.hr_employees;
begin
 if not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501'; end if;
 account_email=lower(trim(account_email));
 if account_email is null or account_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Correo individual válido requerido'; end if;
 select * into strict e from public.hr_employees where id=employee for update;
 if nullif(e.system_username,'') is null then raise exception 'Asigne un nombre de usuario al expediente'; end if;
 if e.status='terminated' then raise exception 'Expediente dado de baja'; end if;
 if e.email is not null and lower(e.email)<>account_email then raise exception 'El expediente ya tiene otro correo; revise la identidad antes de cambiarlo'; end if;
 if account_email='cartelstudiocuba@gmail.com' then raise exception 'Use un correo individual, no la cuenta propietaria'; end if;
 update public.hr_employees set email=account_email where id=employee;
 return jsonb_build_object('employee_id',e.id,'username',e.system_username,'email',account_email,'auth_id',e.system_auth_user_id);
end $$;
create function studio_access_private.bind_account(employee uuid,target_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare e public.hr_employees; u auth.users;
begin
 if not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501'; end if;
 if target_user='6418ad20-d0e8-49c0-8d9a-e1da3daf71b6'::uuid then raise exception 'Cuenta propietaria protegida'; end if;
 select * into strict e from public.hr_employees where id=employee for update;
 select * into strict u from auth.users where id=target_user and deleted_at is null;
 if e.email is null or lower(e.email)<>lower(u.email) or (e.system_auth_user_id is not null and e.system_auth_user_id<>target_user) then raise exception 'La identidad Auth no coincide con el expediente'; end if;
 update public.hr_employees set system_auth_user_id=target_user,system_access_enabled=true where id=employee;
 insert into studio_access_private.permission_audit(actor_id,kind,target,after_data)
 values(auth.uid(),'bind_account',employee::text,jsonb_build_object('user_id',target_user));
end $$;
create function public.system_prepare_invitation(employee uuid,account_email text) returns jsonb language sql set search_path='' as $$ select studio_access_private.prepare_invitation(employee,account_email) $$;
create function public.system_bind_account(employee uuid,target_user uuid) returns void language sql set search_path='' as $$ select studio_access_private.bind_account(employee,target_user) $$;
revoke all on function studio_access_private.prepare_invitation(uuid,text),studio_access_private.bind_account(uuid,uuid),public.system_prepare_invitation(uuid,text),public.system_bind_account(uuid,uuid) from public,anon;
grant execute on function studio_access_private.prepare_invitation(uuid,text),studio_access_private.bind_account(uuid,uuid),public.system_prepare_invitation(uuid,text),public.system_bind_account(uuid,uuid) to authenticated;
