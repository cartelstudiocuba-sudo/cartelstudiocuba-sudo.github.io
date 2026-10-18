create or replace function studio_access_private.prepare_invitation(employee uuid,account_email text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.hr_employees;
begin
 if not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501'; end if;
 account_email=lower(trim(account_email));
 if account_email is null or account_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Correo individual válido requerido'; end if;
 select * into strict e from public.hr_employees where id=employee for update;
 if nullif(e.system_username,'') is null then raise exception 'Asigne un nombre de usuario al expediente'; end if;
 if e.role_id is null then raise exception 'Vincule primero el expediente a una ficha de plaza'; end if;
 if e.status='terminated' then raise exception 'Expediente dado de baja'; end if;
 if e.email is not null and lower(e.email)<>account_email then raise exception 'El expediente ya tiene otro correo; revise la identidad antes de cambiarlo'; end if;
 if account_email='cartelstudiocuba@gmail.com' then raise exception 'Use un correo individual, no la cuenta propietaria'; end if;
 update public.hr_employees set email=account_email where id=employee;
 return jsonb_build_object('employee_id',e.id,'username',e.system_username,'email',account_email,'auth_id',e.system_auth_user_id);
end $$;

alter table studio_access_private.permission_audit enable row level security;
