CREATE OR REPLACE FUNCTION studio_access_private.system_onboarding(p_candidate uuid, p_action text DEFAULT 'read'::text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  perform studio_access_private.apply_role_permissions_only(e.id,r.id);
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
end $function$;

CREATE OR REPLACE FUNCTION studio_access_private.system_apply_role_template(p_employee uuid, p_role uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 values(p_employee,p_role,t.revision,t.can_read,t.can_write,t.views) on conflict(employee_id) do update set role_id=excluded.role_id,template_revision=excluded.template_revision,can_read=excluded.can_read,can_write=excluded.can_write,views=excluded.views,view_mode='legacy_template',applied_at=now();
 insert into studio_access_private.permission_audit(actor_id,kind,target,before_data,after_data) values(auth.uid(),'apply_role_template',p_employee::text,before_row,jsonb_build_object('role_id',p_role,'revision',t.revision));
end $function$;

CREATE OR REPLACE FUNCTION public.system_manage_user_view(p_employee uuid, p_code text, p_enabled boolean, p_default boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501'; end if;
 if exists(select 1 from studio_access_private.employee_access_snapshots where employee_id=p_employee and view_mode='legacy_template') then raise exception 'Acceso por plantilla: modifica el rol y aplica explícitamente su plantilla a este trabajador'; end if;
 if p_code not in ('inventory_admin','audiovisual_lead') then raise exception 'Vista no admitida'; end if;
 if not exists(select 1 from public.hr_employees where id=p_employee) then raise exception 'Expediente inexistente'; end if;
 if p_default and p_enabled then update public.system_user_view_assignments set is_default=false where employee_id=p_employee; end if;
 insert into public.system_user_view_assignments(employee_id,view_code,enabled,is_default)
 values(p_employee,p_code,p_enabled,p_default and p_enabled)
 on conflict(employee_id,view_code) do update set enabled=excluded.enabled,is_default=excluded.is_default;
 insert into studio_access_private.permission_audit(actor_id,kind,target,after_data) values(auth.uid(),'user_view',p_employee::text,jsonb_build_object('code',p_code,'enabled',p_enabled,'is_default',p_default and p_enabled));
end $function$;

CREATE OR REPLACE FUNCTION public.system_owner_employee_views(p_employee uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s studio_access_private.employee_access_snapshots;
begin
 if not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501'; end if;
 select * into s from studio_access_private.employee_access_snapshots where employee_id=p_employee;
 if s.employee_id is not null and s.view_mode='legacy_template' then
  return jsonb_build_array(jsonb_build_object('code','__template__','template_revision',s.template_revision,'role_id',s.role_id,'can_read',s.can_read,'can_write',s.can_write))||
  coalesce((select jsonb_agg(v||jsonb_build_object('enabled',true)) from jsonb_array_elements(s.views) v),'[]');
 end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('code',view_code,'enabled',enabled,'is_default',is_default)),'[]'::jsonb) from public.system_user_view_assignments where employee_id=p_employee);
end $function$;


