-- Reopen only the route checkpoint; never undo hiring or Auth.
alter table studio_access_private.onboarding add column if not exists route_reopened_at timestamptz;
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
 elsif p_action in ('step_back','complete_review') then
  if c.status<>'hired' or e.id is null or e.status='terminated' then raise exception 'La candidatura ya no admite este retroceso'; end if;
  if exists(select 1 from studio_offboarding_private.cases where employee_id=e.id and (revoked_at is null or finalized_at is not null)) then raise exception 'Hay una baja en curso o finalizada; utiliza su procedimiento'; end if;
  if o.candidate_id is null or o.configured_at is null or o.created_at is null or o.whatsapp_opened_at is null then raise exception 'La inserción todavía no está completada'; end if;
  if p_action='step_back' then
   if o.route_reopened_at is not null then raise exception 'La ficha cambió: el paso 12 ya está abierto'; end if;
   update studio_access_private.onboarding set route_reopened_at=clock_timestamp() where candidate_id=c.id;
  else
   if o.route_reopened_at is null or nullif(p_payload->>'expected_reopened_at','')::timestamptz is distinct from o.route_reopened_at then raise exception 'La ficha cambió. Actualiza antes de confirmar la revisión'; end if;
   update studio_access_private.onboarding set route_reopened_at=null where candidate_id=c.id;
  end if;
  insert into public.hr_candidate_history(candidate_id,event_type,from_status,to_status,note)
   values(c.id,case when p_action='step_back' then 'onboarding_step_back' else 'onboarding_review_completed' end,'hired','hired',
    case when p_action='step_back' then 'Regreso del paso 13 al paso 12 para revisar la inserción en sistema. Se conservan contratación, expediente, cuenta y permisos.' else 'Revisión del paso 12 confirmada. Se conserva el acceso existente.' end);
  insert into studio_access_private.permission_audit(actor_id,kind,target,before_data,after_data)
   values(auth.uid(),case when p_action='step_back' then 'onboarding_step_back' else 'onboarding_review_completed' end,c.id::text,
    jsonb_build_object('route_reopened_at',o.route_reopened_at),
    jsonb_build_object('route_step',case when p_action='step_back' then 12 else 13 end,'access_unchanged',true));
 elsif p_action<>'read' then raise exception 'Acción no permitida'; end if;
 select * into o from studio_access_private.onboarding where candidate_id=c.id;
 select * into e from public.hr_employees where candidate_id=c.id;
 base=left(trim(both '.' from regexp_replace(lower(translate(c.full_name,'áéíóúüñÁÉÍÓÚÜÑ','aeiouunAEIOUUN')),'[^a-z0-9]+','.','g')),65);
 if length(base)<3 then base='trabajador'; end if;
 uname=base;
 while exists(select 1 from public.hr_employees where lower(system_username)=uname and id is distinct from e.id) loop suffix=suffix+1;uname=base||'.'||suffix;end loop;
 return jsonb_build_object('candidate_id',c.id,'labor_status',c.status,'employee_id',e.id,'username',coalesce(e.system_username,uname),'email',coalesce(e.email,h.data->>'email',c.email),'role_id',o.role_id,'route_reopened_at',o.route_reopened_at,'configured_at',o.configured_at,'created_at',o.created_at,'whatsapp_opened_at',o.whatsapp_opened_at,'activated_at',o.activated_at,'expires_at',o.expires_at,'message',o.message,'protected',o.candidate_id is null and (e.system_auth_user_id is not null or e.system_username is not null),'enabled',e.system_access_enabled,'document_verified',h.verified_at,'contract_signed',h.signed_at,'formalized',h.employee_id is not null);
end $function$

