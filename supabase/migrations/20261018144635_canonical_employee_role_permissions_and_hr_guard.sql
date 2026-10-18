-- Canonical employee roles; legacy grants retained as an inaccessible archive.
alter table public.hr_employees add column system_access_enabled boolean not null default false;
create unique index hr_employee_auth_unique on public.hr_employees(system_auth_user_id) where system_auth_user_id is not null;
create unique index hr_employee_username_unique on public.hr_employees(lower(system_username)) where system_username is not null;
create unique index hr_employee_account_email_unique on public.hr_employees(lower(email)) where system_username is not null and email is not null;
alter table public.hr_employees add constraint hr_employee_auth_fk foreign key(system_auth_user_id) references auth.users(id);

create table public.system_role_module_permissions (
 access_role_id uuid not null references public.system_access_roles(id) on delete restrict,
 module_code text not null check(module_code in ('inventario_insumos','rrhh','usuarios_roles')),
 can_read boolean not null default false,
 can_write boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(access_role_id,module_code),
 check(not can_write or can_read),
 check(module_code='inventario_insumos' or (not can_read and not can_write))
);
alter table public.system_role_module_permissions enable row level security;
revoke all on public.system_role_module_permissions from anon,authenticated;
grant select on public.system_role_module_permissions to authenticated;
create policy read_permission_catalog on public.system_role_module_permissions for select to authenticated using (auth.uid() is not null);
insert into public.system_role_module_permissions(access_role_id,module_code,can_read,can_write)
 select r.id,m, m='inventario_insumos' and r.code in ('administrador','manager_general','gestor_comercial_grafica'),
 m='inventario_insumos' and r.code='administrador'
 from public.system_access_roles r cross join unnest(array['inventario_insumos','rrhh','usuarios_roles']) m;

create function studio_access_private.is_owner() returns boolean language sql stable set search_path='' as $$
 select auth.uid()='6418ad20-d0e8-49c0-8d9a-e1da3daf71b6'::uuid
$$;
create function studio_access_private.has_permission(module text,operation text) returns boolean
language sql stable security definer set search_path='' as $$
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
$$;
create function public.system_has_permission(module text,operation text) returns boolean
language sql stable set search_path='' as $$ select studio_access_private.has_permission(module,operation) $$;
create or replace function public.inventory_has_access(operation text) returns boolean
language sql stable set search_path='' as $$ select studio_access_private.has_permission('inventario_insumos',operation) $$;

create table studio_access_private.permission_audit (
 id uuid primary key default gen_random_uuid(),actor_id uuid,kind text not null,target text,before_data jsonb,after_data jsonb,created_at timestamptz not null default now()
);
create function studio_access_private.set_permission(role_id uuid,module text,allow_read boolean,allow_write boolean) returns void
language plpgsql security definer set search_path='' as $$
declare old_row jsonb;
begin
 if not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501'; end if;
 if module<>'inventario_insumos' or allow_read is null or allow_write is null or (allow_write and not allow_read) then raise exception 'Permiso no permitido'; end if;
 perform 1 from public.system_access_roles where id=role_id and is_active for update;
 if not found then raise exception 'Rol no disponible'; end if;
 select to_jsonb(p) into old_row from public.system_role_module_permissions p where p.access_role_id=role_id and p.module_code=module;
 insert into public.system_role_module_permissions(access_role_id,module_code,can_read,can_write)
 values(role_id,module,allow_read,allow_write) on conflict(access_role_id,module_code)
 do update set can_read=excluded.can_read,can_write=excluded.can_write,updated_at=now();
 insert into studio_access_private.permission_audit(actor_id,kind,target,before_data,after_data)
 values(auth.uid(),'permission',role_id::text,old_row,jsonb_build_object('module',module,'read',allow_read,'write',allow_write));
end $$;
create function public.system_set_role_permission(role_id uuid,module text,allow_read boolean,allow_write boolean) returns void
language sql set search_path='' as $$ select studio_access_private.set_permission(role_id,module,allow_read,allow_write) $$;

create function studio_access_private.set_employee_role(employee uuid,requested_role text,enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
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
end $$;
create function public.system_set_employee_role(employee uuid,requested_role text,enabled boolean) returns void
language sql set search_path='' as $$ select studio_access_private.set_employee_role(employee,requested_role,enabled) $$;
create or replace function studio_access_private.set_role(target_user uuid,requested_role text,enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
declare eid uuid;
begin
 if not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501'; end if;
 select id into eid from public.hr_employees where system_auth_user_id=target_user;
 if eid is null then raise exception 'Vincule primero la cuenta al expediente'; end if;
 perform studio_access_private.set_employee_role(eid,requested_role,enabled);
end $$;

-- Never silently discard legacy assignments if this migration is replayed elsewhere.
do $$ begin
 if exists(select 1 from public.system_user_role_grants) then raise exception 'Legacy grants require explicit reconciliation before migration'; end if;
end $$;
revoke all on public.system_user_role_grants from anon,authenticated;
comment on table public.system_user_role_grants is 'Archived legacy model: never consulted for authorization. Use system_employee_role_assignments.';

create or replace function studio_access_private.user_directory() returns jsonb
language plpgsql security definer set search_path='' as $$
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
end $$;

-- Close existing broad HR policies and previously unprotected employee tables.
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'hr_%' loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy employee_access_hr_guard on public.%I as restrictive for all to authenticated using ((select studio_access_private.is_owner())) with check ((select studio_access_private.is_owner()))',t);
 if t in ('hr_employees','hr_employee_documents','hr_employee_assets','hr_employee_access') then
 execute format('create policy employee_access_owner on public.%I for all to authenticated using ((select studio_access_private.is_owner())) with check ((select studio_access_private.is_owner()))',t);
 end if;
 end loop;
end $$;

-- Assign roles to the existing expedientes, without changing employment status or creating Auth users.
insert into public.system_employee_role_assignments(employee_id,access_role_id,notes)
 select e.id,r.id,'Configuración de acceso acordada; cuenta pendiente de invitación'
 from public.hr_employees e join public.system_access_roles r on r.code=case e.system_username
 when 'alejandro.garces' then 'administrador' when 'melanie.medina' then 'gestor_comercial_grafica' end
 where e.system_username in ('alejandro.garces','melanie.medina')
 on conflict(employee_id,access_role_id) where ended_at is null do nothing;
update public.hr_employees e set system_roles=(select jsonb_agg(r.code order by r.code) from public.system_employee_role_assignments a join public.system_access_roles r on r.id=a.access_role_id where a.employee_id=e.id and a.ended_at is null)
 where system_username in ('alejandro.garces','melanie.medina');
update public.hr_employees e set role_id=r.id from public.hr_roles r
 where e.system_username='alejandro.garces' and e.role_id is null and r.title=e.role_title;
update public.system_access_roles set description='Consulta de Inventario Insumos sin escritura. Sin acceso a Recursos Humanos.' where code='gestor_comercial_grafica';

-- All privileged implementations are in a non-exposed schema and check caller identity.
revoke all on all functions in schema studio_access_private from public,anon;
grant usage on schema studio_access_private to authenticated;
grant execute on function studio_access_private.is_owner(),studio_access_private.has_permission(text,text),studio_access_private.user_directory(),studio_access_private.set_role(uuid,text,boolean),studio_access_private.set_employee_role(uuid,text,boolean),studio_access_private.set_permission(uuid,text,boolean,boolean) to authenticated;
revoke all on function public.system_has_permission(text,text),public.system_set_role_permission(uuid,text,boolean,boolean),public.system_set_employee_role(uuid,text,boolean) from public,anon;
grant execute on function public.system_has_permission(text,text),public.system_set_role_permission(uuid,text,boolean,boolean),public.system_set_employee_role(uuid,text,boolean) to authenticated;

