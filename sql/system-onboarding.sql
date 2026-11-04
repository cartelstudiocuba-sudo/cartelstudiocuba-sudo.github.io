-- Additive onboarding. No employee, role assignment or current view is backfilled.
create table studio_access_private.role_templates (
 role_id uuid primary key references public.system_access_roles(id),
 revision integer not null default 1,
 can_read boolean not null default false,
 can_write boolean not null default false,
 views jsonb not null default '[]',
 updated_at timestamptz not null default now(),
 check(not can_write or can_read), check(jsonb_typeof(views)='array')
);
create table studio_access_private.employee_access_snapshots (
 employee_id uuid primary key references public.hr_employees(id),
 role_id uuid not null references public.system_access_roles(id),
 template_revision integer not null,
 can_read boolean not null, can_write boolean not null,
 views jsonb not null, applied_at timestamptz not null default now()
);
create table studio_access_private.onboarding (
 candidate_id uuid primary key references public.hr_candidates(id),
 employee_id uuid not null unique references public.hr_employees(id),
 role_id uuid not null references public.system_access_roles(id),
 configured_at timestamptz not null default now(),
 created_at timestamptz, whatsapp_opened_at timestamptz,
 activated_at timestamptz,
 token_hash text, token_cipher text, expires_at timestamptz,
 lease uuid, lease_until timestamptz,
 email_requested_at timestamptz,
 message text, check(length(message)<=12000)
);
alter table studio_access_private.role_templates enable row level security;
alter table studio_access_private.employee_access_snapshots enable row level security;
alter table studio_access_private.onboarding enable row level security;
revoke all on studio_access_private.role_templates,studio_access_private.employee_access_snapshots,studio_access_private.onboarding from public,anon,authenticated;
-- Initial defaults use only the currently authorized role ceiling.
insert into studio_access_private.role_templates(role_id,can_read,can_write,views)
select r.id,coalesce(p.can_read,false),coalesce(p.can_write,false),
 case when p.can_read then '[{"code":"inventory_admin","is_default":true}]'::jsonb else '[]'::jsonb end
from public.system_access_roles r left join public.system_role_module_permissions p on p.access_role_id=r.id and p.module_code='inventario_insumos' where r.is_active;

create function studio_access_private.template_valid(p_role uuid,p_read boolean,p_write boolean,p_views jsonb) returns boolean
language sql stable security definer set search_path='' as $$
 select p_read is not null and p_write is not null and p_views is not null
 and jsonb_typeof(p_views)='array' and not(p_write and not p_read)
 and exists(select 1 from public.system_access_roles r left join public.system_role_module_permissions p on p.access_role_id=r.id and p.module_code='inventario_insumos'
 where r.id=p_role and r.is_active and (not p_read or coalesce(p.can_read,false)) and (not p_write or coalesce(p.can_write,false)))
 and not exists(select 1 from jsonb_array_elements(p_views) v where v->>'code' is distinct from 'inventory_admin' or not p_read or jsonb_typeof(v->'is_default') is distinct from 'boolean')
 and jsonb_array_length(p_views)<=1
$$;

create function public.system_role_template(p_role uuid,p_action text default 'read',p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare t studio_access_private.role_templates; before_row jsonb;
begin
 if not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501'; end if;
 select * into t from studio_access_private.role_templates where role_id=p_role for update;
 if t.role_id is null then raise exception 'Rol no disponible'; end if;
 if p_action='save' then
  if (p_payload->>'revision')::integer is distinct from t.revision then raise exception 'La plantilla cambió; vuelve a cargarla'; end if;
  if not coalesce(studio_access_private.template_valid(p_role,(p_payload->>'can_read')::boolean,(p_payload->>'can_write')::boolean,p_payload->'views'),false) then raise exception 'La plantilla supera los permisos autorizados del rol o contiene una vista no autorizada'; end if;
  before_row=to_jsonb(t);
  update studio_access_private.role_templates set can_read=(p_payload->>'can_read')::boolean,can_write=(p_payload->>'can_write')::boolean,views=p_payload->'views',revision=revision+1,updated_at=now() where role_id=p_role returning * into t;
  insert into studio_access_private.permission_audit(actor_id,kind,target,before_data,after_data) values(auth.uid(),'role_template',p_role::text,before_row,to_jsonb(t));
 elsif p_action<>'read' then raise exception 'Acción no permitida'; end if;
 return to_jsonb(t);
end $$;

create function public.system_apply_role_template(p_employee uuid,p_role uuid) returns void
language plpgsql security definer set search_path='' as $$
declare t studio_access_private.role_templates; before_row jsonb;
begin
 if not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501'; end if;
 perform 1 from public.hr_employees where id=p_employee and status<>'terminated' for update;
 if not found then raise exception 'Expediente no disponible'; end if;
 if not exists(select 1 from public.system_employee_role_assignments where employee_id=p_employee and access_role_id=p_role and ended_at is null) then raise exception 'El trabajador no tiene este rol'; end if;
 select * into t from studio_access_private.role_templates where role_id=p_role for share;
 if not coalesce(studio_access_private.template_valid(p_role,t.can_read,t.can_write,t.views),false) then raise exception 'Revisa los límites del rol'; end if;
 select to_jsonb(s) into before_row from studio_access_private.employee_access_snapshots s where employee_id=p_employee;
 insert into studio_access_private.employee_access_snapshots(employee_id,role_id,template_revision,can_read,can_write,views)
 values(p_employee,p_role,t.revision,t.can_read,t.can_write,t.views) on conflict(employee_id) do update set role_id=excluded.role_id,template_revision=excluded.template_revision,can_read=excluded.can_read,can_write=excluded.can_write,views=excluded.views,applied_at=now();
 insert into studio_access_private.permission_audit(actor_id,kind,target,before_data,after_data) values(auth.uid(),'apply_role_template',p_employee::text,before_row,jsonb_build_object('role_id',p_role,'revision',t.revision));
end $$;

create or replace function studio_access_private.has_permission(module text,operation text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and operation in ('read','write') and module in ('inventario_insumos','rrhh','usuarios_roles') and
 (studio_access_private.is_owner() or (module='inventario_insumos' and exists (
 select 1 from public.hr_employees e join auth.users u on u.id=e.system_auth_user_id
 join public.system_employee_role_assignments a on a.employee_id=e.id and a.ended_at is null
 join public.system_access_roles r on r.id=a.access_role_id and r.is_active
 join public.system_role_module_permissions p on p.access_role_id=r.id and p.module_code=module
 left join studio_access_private.employee_access_snapshots s on s.employee_id=e.id
 where e.system_auth_user_id=auth.uid() and e.system_access_enabled and e.status<>'terminated'
 and u.deleted_at is null and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now())
 and case when operation='read' then p.can_read else p.can_write end
 and (s.employee_id is null or (s.role_id=r.id and case when operation='read' then s.can_read else s.can_write end)))))
$$;

-- Legacy navigation is retained byte-for-byte in behavior for employees without a snapshot.
create or replace function public.system_my_views() returns jsonb
language sql stable security definer set search_path='' as $$
select coalesce((select s.views from studio_access_private.employee_access_snapshots s join public.hr_employees e on e.id=s.employee_id
 where e.system_auth_user_id=auth.uid() and public.system_has_permission('inventario_insumos','read')),
 (select coalesce(jsonb_agg(jsonb_build_object('code',v.view_code,'is_default',v.is_default) order by v.is_default desc,v.view_code),'[]'::jsonb)
 from public.system_user_view_assignments v join public.hr_employees e on e.id=v.employee_id where e.system_auth_user_id=auth.uid() and e.system_access_enabled and v.enabled
 and not exists(select 1 from studio_access_private.employee_access_snapshots s where s.employee_id=e.id)),'[]'::jsonb)
$$;
create or replace function public.system_my_navigation() returns jsonb
language sql stable security definer set search_path='' as $$
select jsonb_build_object('is_owner',coalesce(studio_access_private.is_owner(),false),'views',public.system_my_views())
$$;

create function public.system_onboarding(p_candidate uuid,p_action text default 'read',p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare o studio_access_private.onboarding; e public.hr_employees; h public.hr_hiring_cases; c public.hr_candidates; r public.system_access_roles; uname text; suffix integer:=1; base text; result jsonb;
begin
 if not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501'; end if;
 select * into c from public.hr_candidates where id=p_candidate for update;
 if c.id is null then raise exception 'Candidatura inexistente'; end if;
 select * into o from studio_access_private.onboarding where candidate_id=p_candidate for update;
 select * into e from public.hr_employees where candidate_id=p_candidate for update;
 select h1.* into h from public.hr_hiring_cases h1 join public.hr_trial_periods t on t.id=h1.trial_id where h1.candidate_id=p_candidate and t.superseded_at is null;
 if p_action='configure' then
  if c.status<>'hired' or h.notified_at is null then raise exception 'Primero abre WhatsApp en el paso 11'; end if;
  if o.created_at is not null or (o.lease_until>now()) then raise exception 'Cuenta creada o en preparación; utiliza Gestionar acceso'; end if;
  if e.id is null or e.status='terminated' then raise exception 'Expediente laboral no disponible'; end if;
  if o.candidate_id is null and (e.system_auth_user_id is not null or e.system_username is not null or exists(select 1 from public.system_employee_role_assignments where employee_id=e.id and ended_at is null) or exists(select 1 from public.system_user_view_assignments where employee_id=e.id)) then raise exception 'Acceso existente protegido; utiliza Usuarios y Accesos'; end if;
  select * into r from public.system_access_roles where id=(p_payload->>'role_id')::uuid and is_active;
  if r.id is null then raise exception 'Selecciona un rol real disponible'; end if;
  uname=lower(trim(p_payload->>'username'));
  if uname is null or uname !~ '^[a-z0-9._-]{3,80}$' then raise exception 'Usuario no válido (3 a 80 caracteres)'; end if;
  if nullif(trim(p_payload->>'email'),'') is null or trim(p_payload->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or lower(trim(p_payload->>'email'))='cartelstudiocuba@gmail.com' then raise exception 'Correo individual válido requerido'; end if;
  if e.system_auth_user_id is not null then raise exception 'La identidad ya está vinculada'; end if;
  if exists(select 1 from public.hr_employees other where other.id<>e.id and lower(other.email)=lower(trim(p_payload->>'email')) and (other.system_auth_user_id is not null or other.system_username is not null)) then raise exception 'Correo ya vinculado; revisa la identidad'; end if;
  update public.hr_employees set system_username=uname,email=lower(trim(p_payload->>'email')) where id=e.id;
  if o.candidate_id is not null and o.role_id<>r.id then perform studio_access_private.set_employee_role(e.id,(select code from public.system_access_roles where id=o.role_id),false); end if;
  perform studio_access_private.set_employee_role(e.id,r.code,true);
  perform public.system_apply_role_template(e.id,r.id);
  insert into studio_access_private.onboarding(candidate_id,employee_id,role_id) values(c.id,e.id,r.id) on conflict(candidate_id) do update set role_id=excluded.role_id,configured_at=now();
 elsif p_action='acquire' then
  if o.candidate_id is null or e.status='terminated' or e.system_access_enabled or o.activated_at is not null then raise exception 'Configura el acceso o gestiona la cuenta existente'; end if;
  if o.lease_until>now() then raise exception 'Operación en curso; espera antes de reintentar'; end if;
  update studio_access_private.onboarding set lease=gen_random_uuid(),lease_until=now()+interval '2 minutes' where candidate_id=c.id returning * into o;
  return jsonb_build_object('lease',o.lease,'employee_id',e.id,'email',e.email,'auth_id',e.system_auth_user_id,'created_at',o.created_at,'cipher',o.token_cipher,'expires_at',o.expires_at);
 elsif p_action='release' then
  update studio_access_private.onboarding set lease=null,lease_until=null where candidate_id=c.id and lease=(p_payload->>'lease')::uuid;
 elsif p_action='message' then
  if o.created_at is null then raise exception 'Crea primero la cuenta'; end if;
  if length(p_payload->>'message')>12000 then raise exception 'Mensaje demasiado largo'; end if;
  if p_payload->>'message' ~ '#activation=[a-f0-9]{64}' then raise exception 'Guarda el mensaje con el marcador del enlace'; end if;
  update studio_access_private.onboarding set message=p_payload->>'message' where candidate_id=c.id;
 elsif p_action='opened' then
  if o.created_at is null or o.expires_at<=now() or o.activated_at is not null then raise exception 'Renueva el enlace o gestiona el acceso'; end if;
  update studio_access_private.onboarding set whatsapp_opened_at=coalesce(whatsapp_opened_at,now()) where candidate_id=c.id;
  insert into studio_access_private.permission_audit(actor_id,kind,target,after_data) values(auth.uid(),'onboarding_whatsapp_opened',c.id::text,'{"delivery_confirmed":false}');
 elsif p_action<>'read' then raise exception 'Acción no permitida'; end if;
 select * into o from studio_access_private.onboarding where candidate_id=c.id;
 select * into e from public.hr_employees where candidate_id=c.id;
 base=left(trim(both '.' from regexp_replace(lower(translate(c.full_name,'áéíóúüñÁÉÍÓÚÜÑ','aeiouunAEIOUUN')),'[^a-z0-9]+','.','g')),65);
 if length(base)<3 then base='trabajador'; end if;
 uname=base;
 while exists(select 1 from public.hr_employees where lower(system_username)=uname and id is distinct from e.id) loop suffix=suffix+1;uname=base||'.'||suffix;end loop;
 return jsonb_build_object('candidate_id',c.id,'labor_status',c.status,'employee_id',e.id,'username',coalesce(e.system_username,uname),'email',coalesce(e.email,h.data->>'email',c.email),'role_id',o.role_id,'configured_at',o.configured_at,'created_at',o.created_at,'whatsapp_opened_at',o.whatsapp_opened_at,'activated_at',o.activated_at,'expires_at',o.expires_at,'message',o.message,'protected',o.candidate_id is null and (e.system_auth_user_id is not null or e.system_username is not null),'enabled',e.system_access_enabled,'document_verified',h.verified_at,'contract_signed',h.signed_at,'formalized',h.employee_id is not null);
end $$;

-- Only the trusted Edge Function may bind Auth or handle the bearer capability.
create function public.system_onboarding_service(p_candidate uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o studio_access_private.onboarding; e public.hr_employees; u auth.users;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Servicio requerido' using errcode='42501'; end if;
 if p_action='email' then
  select * into o from studio_access_private.onboarding where token_hash=p_payload->>'hash' and expires_at>now() and activated_at is null for update;
 else select * into o from studio_access_private.onboarding where candidate_id=p_candidate for update; end if;
 if o.candidate_id is null then raise exception 'Enlace no válido, vencido o ya utilizado'; end if;
 select * into e from public.hr_employees where id=o.employee_id for update;
 if e.status='terminated' then raise exception 'Acceso no disponible'; end if;
 if p_action='bind' then
  if o.lease is distinct from (p_payload->>'lease')::uuid or o.lease_until<=now() or o.activated_at is not null then raise exception 'Operación vencida; reintenta'; end if;
  select * into u from auth.users where id=(p_payload->>'auth_id')::uuid and deleted_at is null;
  if u.id is null or u.id='6418ad20-d0e8-49c0-8d9a-e1da3daf71b6' or lower(u.email) is distinct from lower(e.email) or (e.system_auth_user_id is not null and e.system_auth_user_id<>u.id) then raise exception 'Identidad Auth incompatible'; end if;
  if p_payload->>'hash' !~ '^[a-f0-9]{64}$' or nullif(p_payload->>'cipher','') is null then raise exception 'Activación inválida'; end if;
  update public.hr_employees set system_auth_user_id=u.id where id=e.id;
  update studio_access_private.onboarding set created_at=coalesce(created_at,now()),token_hash=p_payload->>'hash',token_cipher=p_payload->>'cipher',expires_at=now()+interval '24 hours',lease=null,lease_until=null where candidate_id=o.candidate_id returning * into o;
  insert into studio_access_private.permission_audit(actor_id,kind,target,after_data) values('6418ad20-d0e8-49c0-8d9a-e1da3daf71b6','onboarding_provisioned',e.id::text,jsonb_build_object('auth_id',u.id));
 elsif p_action='email' then
  if e.system_auth_user_id is null or e.system_access_enabled then raise exception 'Acceso no disponible'; end if;
  if o.email_requested_at>now()-interval '60 seconds' then raise exception 'Espera un minuto antes de solicitar otro correo'; end if;
  update studio_access_private.onboarding set email_requested_at=now() where candidate_id=o.candidate_id;
  return jsonb_build_object('email',e.email);
 else raise exception 'Acción no permitida'; end if;
 return jsonb_build_object('expires_at',o.expires_at);
end $$;

create function public.system_activate_onboarding(p_token text) returns void
language plpgsql security definer set search_path='' as $$
declare o studio_access_private.onboarding; e public.hr_employees; u auth.users;
begin
 if auth.uid() is null or p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Activación no válida' using errcode='42501'; end if;
 select * into o from studio_access_private.onboarding where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and expires_at>now() and activated_at is null for update;
 if o.candidate_id is null then raise exception 'Enlace vencido o ya utilizado'; end if;
 select * into e from public.hr_employees where id=o.employee_id for update;
 select * into u from auth.users where id=auth.uid() and email_confirmed_at is not null and deleted_at is null and (banned_until is null or banned_until<=now());
 if u.id is null or e.system_auth_user_id is distinct from u.id or e.status='terminated' or lower(e.email) is distinct from lower(u.email) then raise exception 'Verifica el correo de esta cuenta' using errcode='42501'; end if;
 if nullif(u.encrypted_password,'') is null then raise exception 'Establece tu contraseña antes de activar'; end if;
 update public.hr_employees set system_access_enabled=true where id=e.id;
 update studio_access_private.onboarding set activated_at=now(),token_hash=null,token_cipher=null where candidate_id=o.candidate_id;
 insert into studio_access_private.permission_audit(actor_id,kind,target) values(auth.uid(),'onboarding_activated',e.id::text);
end $$;

revoke all on function studio_access_private.template_valid(uuid,boolean,boolean,jsonb) from public,anon,authenticated;
revoke all on function public.system_role_template(uuid,text,jsonb),public.system_apply_role_template(uuid,uuid),public.system_onboarding(uuid,text,jsonb),public.system_activate_onboarding(text) from public,anon;
grant execute on function public.system_role_template(uuid,text,jsonb),public.system_apply_role_template(uuid,uuid),public.system_onboarding(uuid,text,jsonb),public.system_activate_onboarding(text) to authenticated;
revoke all on function public.system_onboarding_service(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.system_onboarding_service(uuid,text,jsonb) to service_role;

create function public.system_onboarding_activation_ready(p_token text) returns boolean
language sql stable security definer set search_path='' as $$
select auth.uid() is not null and p_token ~ '^[a-f0-9]{64}$' and exists(
 select 1 from studio_access_private.onboarding o join public.hr_employees e on e.id=o.employee_id join auth.users u on u.id=e.system_auth_user_id
 where o.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and o.expires_at>now() and o.activated_at is null
 and u.id=auth.uid() and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()) and e.status<>'terminated' and lower(u.email)=lower(e.email))
$$;
revoke all on function public.system_onboarding_activation_ready(text) from public,anon;
grant execute on function public.system_onboarding_activation_ready(text) to authenticated;

create function public.system_my_pending_onboarding() returns boolean
language sql stable security definer set search_path='' as $$
select auth.uid() is not null and exists(select 1 from studio_access_private.onboarding o join public.hr_employees e on e.id=o.employee_id where e.system_auth_user_id=auth.uid() and o.activated_at is null and o.created_at is not null)
$$;
revoke all on function public.system_my_pending_onboarding() from public,anon;
grant execute on function public.system_my_pending_onboarding() to authenticated;
