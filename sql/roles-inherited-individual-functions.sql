CREATE OR REPLACE FUNCTION studio_access_private.role_permission_before_individual(module text, operation text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
revoke all on function studio_access_private.role_permission_before_individual(text,text) from public,anon;
grant execute on function studio_access_private.role_permission_before_individual(text,text) to authenticated;
create or replace function studio_access_private.has_permission(module text,operation text) returns boolean language sql stable security definer set search_path='' as $$select studio_access_private.role_permission_before_individual(module,operation) or (module='inventario_insumos' and (studio_access_private.extra_view_permission('inventory_admin',operation) or (operation='read' and studio_access_private.extra_view_permission('inventory_graphics_read','read'))))$$;
CREATE OR REPLACE FUNCTION studio_access_private.apply_role_permissions_only(p_employee uuid, p_role uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t studio_access_private.role_templates;before_row jsonb;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501';end if;
 perform 1 from public.hr_employees where id=p_employee and status<>'terminated' for update;if not found then raise exception 'Expediente no disponible';end if;
 if not exists(select 1 from public.system_employee_role_assignments where employee_id=p_employee and access_role_id=p_role and ended_at is null) then raise exception 'El trabajador no tiene este rol';end if;
 select * into t from studio_access_private.role_templates where role_id=p_role for share;
 if not coalesce(studio_access_private.template_valid(p_role,t.can_read,t.can_write,'[]'),false) then raise exception 'Revisa los límites del rol';end if;
 select to_jsonb(s) into before_row from studio_access_private.employee_access_snapshots s where employee_id=p_employee;
 insert into studio_access_private.employee_access_snapshots(employee_id,role_id,template_revision,can_read,can_write,views,view_mode)
 values(p_employee,p_role,t.revision,t.can_read,t.can_write,t.views,'legacy_template')
 on conflict(employee_id) do update set role_id=excluded.role_id,template_revision=excluded.template_revision,can_read=excluded.can_read,can_write=excluded.can_write,views=excluded.views,view_mode=excluded.view_mode,applied_at=now();
 insert into studio_access_private.permission_audit(actor_id,kind,target,before_data,after_data) values(auth.uid(),'apply_role_permissions',p_employee::text,before_row,jsonb_build_object('role_id',p_role,'revision',t.revision,'new_views_inherited',true));
end $function$
;
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
  if o.route_reopened_at is not null or e.system_auth_user_id is not null then raise exception 'Cuenta existente protegida; utiliza Gestionar acceso'; end if;
  select * into r from public.system_access_roles where id=(p_payload->>'role_id')::uuid and is_active and is_catalog_role;
  if r.id is null then raise exception 'Selecciona un rol real disponible'; end if;
  uname=lower(trim(p_payload->>'username'));
  if uname is null or uname !~ '^[a-z0-9._-]{3,80}$' then raise exception 'Usuario no válido (3 a 80 caracteres)'; end if;
  if nullif(trim(p_payload->>'email'),'') is null or trim(p_payload->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or lower(trim(p_payload->>'email'))='cartelstudiocuba@gmail.com' then raise exception 'Correo individual válido requerido'; end if;
  if e.system_auth_user_id is not null then raise exception 'La identidad ya está vinculada'; end if;
  if exists(select 1 from public.hr_employees other where other.id<>e.id and lower(other.email)=lower(trim(p_payload->>'email')) and (other.system_auth_user_id is not null or other.system_username is not null)) then raise exception 'Correo ya vinculado; revisa la identidad'; end if;
  if exists(select 1 from public.hr_employees other where other.id<>e.id and lower(other.system_username)=uname) or exists(select 1 from auth.users u where lower(u.email)=lower(trim(p_payload->>'email')) and u.deleted_at is null) then raise exception 'Usuario o correo ya utilizado por otra cuenta'; end if;
  result=studio_access_private.system_role_template(r.id,'read','{}');
  if (p_payload->>'template_revision')::integer is distinct from (result->>'revision')::integer then raise exception 'Los permisos del perfil cambiaron. Vuelve a seleccionarlo'; end if;
  update public.hr_employees set system_username=uname,email=lower(trim(p_payload->>'email')) where id=e.id;
  if o.candidate_id is not null and o.role_id<>r.id then perform studio_access_private.set_employee_role(e.id,(select code from public.system_access_roles where id=o.role_id),false); end if;
  perform studio_access_private.set_employee_role(e.id,r.code,true);
  perform studio_access_private.apply_role_permissions_only(e.id,r.id);
  insert into studio_access_private.onboarding(candidate_id,employee_id,role_id) values(c.id,e.id,r.id) on conflict(candidate_id) do update set role_id=excluded.role_id,configured_at=now();
 elsif p_action='acquire' then
  if o.route_reopened_at is not null and o.route_configured_at is null then raise exception 'Cuenta existente protegida; conserva la cuenta o utiliza Gestionar acceso'; end if;
  if o.candidate_id is null or o.configured_at is null or e.status='terminated' or e.system_access_enabled or o.activated_at is not null then raise exception 'Configura el acceso o gestiona la cuenta existente'; end if;
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
 elsif p_action in ('step_back','review_configure','review_existing','review_prepare','review_notified','sync_email') then
  if c.status<>'hired' or e.id is null or e.status='terminated' then raise exception 'La candidatura ya no admite este retroceso'; end if;
  if exists(select 1 from studio_offboarding_private.cases where employee_id=e.id and (revoked_at is null or finalized_at is not null)) then raise exception 'Hay una baja en curso o finalizada; utiliza su procedimiento'; end if;
  if o.candidate_id is null or o.configured_at is null or o.created_at is null or o.whatsapp_opened_at is null then raise exception 'La inserción todavía no está completada'; end if;
  if p_action='step_back' then
   if o.route_reopened_at is not null then raise exception 'La ficha cambió: el paso 12 ya está abierto'; end if;
   update studio_access_private.onboarding set route_reopened_at=clock_timestamp(),route_configured_at=null,route_prepared_at=null where candidate_id=c.id;
  else
   if o.route_reopened_at is null or nullif(p_payload->>'expected_reopened_at','')::timestamptz is distinct from o.route_reopened_at then raise exception 'La ficha cambió. Actualiza antes de continuar'; end if;
   if e.system_auth_user_id is null or not exists(select 1 from auth.users u where u.id=e.system_auth_user_id and (lower(u.email)=lower(e.email) or (p_action='sync_email' and lower(u.email)=o.pending_email)) and u.deleted_at is null) then raise exception 'Revisa la identidad de la cuenta existente'; end if;
   if p_action='review_configure' then
    raise exception 'Cuenta existente protegida; utiliza Gestionar acceso';
   elsif p_action='review_existing' then
    if o.route_configured_at is not null then raise exception 'La configuración ya fue confirmada'; end if;
    if p_payload->>'expected_config' is distinct from md5(jsonb_build_array(e.system_username,e.email,o.role_id,o.pending_email)::text) then raise exception 'La configuración cambió en otra ventana. Actualiza la ficha'; end if;
    update studio_access_private.onboarding set route_configured_at=clock_timestamp() where candidate_id=c.id;
   elsif p_action='sync_email' then
    if o.pending_email is null then raise exception 'No hay un correo pendiente'; end if;
    if not exists(select 1 from auth.users u where u.id=e.system_auth_user_id and lower(u.email)=o.pending_email and u.email_confirmed_at is not null and u.deleted_at is null) then raise exception 'El trabajador todavía no ha verificado el nuevo correo en Auth'; end if;
    if exists(select 1 from public.hr_employees other where other.id<>e.id and lower(other.email)=o.pending_email) then raise exception 'Correo ya utilizado por otro expediente'; end if;
    update public.hr_employees set email=o.pending_email where id=e.id;
    update studio_access_private.onboarding set pending_email=null,token_hash=null,token_cipher=null,expires_at=now(),route_configured_at=clock_timestamp() where candidate_id=c.id;
   elsif p_action='review_prepare' then
    if o.route_configured_at is null or o.route_prepared_at is not null then raise exception 'Completa primero la configuración o actualiza la ficha'; end if;
    update studio_access_private.onboarding set route_prepared_at=clock_timestamp() where candidate_id=c.id;
   else
    if o.route_configured_at is null or o.route_prepared_at is null then raise exception 'Completa los subpasos anteriores'; end if;
    update studio_access_private.onboarding set route_reopened_at=null where candidate_id=c.id;
   end if;
  end if;
  insert into public.hr_candidate_history(candidate_id,event_type,from_status,to_status,note)
   values(c.id,'onboarding_'||p_action,'hired','hired',case p_action when 'step_back' then 'Regreso al paso 12; los tres subpasos quedan pendientes. Cuenta, permisos y expediente conservados.' when 'review_existing' then 'Paso 12: cuenta existente conservada, sin modificar usuario, correo, perfiles ni permisos.' when 'review_prepare' then 'Paso 12: cuenta existente comprobada y notificación preparada, sin duplicar Auth.' when 'sync_email' then 'Paso 12: correo confirmado en Auth y sincronizado con el expediente.' else 'Paso 12: WhatsApp abierto de nuevo. No equivale a entrega confirmada.' end);
  insert into studio_access_private.permission_audit(actor_id,kind,target,after_data)
   values(auth.uid(),'onboarding_'||p_action,c.id::text,jsonb_build_object('access_unchanged',p_action<>'review_configure','delivery_confirmed',false));
 elsif p_action<>'read' then raise exception 'Acción no permitida'; end if;
 select * into o from studio_access_private.onboarding where candidate_id=c.id;
 select * into e from public.hr_employees where candidate_id=c.id;
 base=left(trim(both '.' from regexp_replace(lower(translate(regexp_replace(trim(c.full_name),'^CANDIDATO DE PRUEBA[[:space:]]*[—–-][[:space:]]*(?=[^[:space:]])','','i'),'áéíóúüñÁÉÍÓÚÜÑ','aeiouunAEIOUUN')),'[^a-z0-9]+','.','g')),65);
 if length(base)<3 then base='trabajador'; end if;
 uname=base;
 while exists(select 1 from public.hr_employees where lower(system_username)=uname and id is distinct from e.id) loop suffix=suffix+1;uname=base||'.'||suffix;end loop;
 return jsonb_build_object('candidate_id',c.id,'labor_status',c.status,'employee_id',e.id,'suggested_username',uname,'existing_account',e.system_auth_user_id is not null or o.created_at is not null or (o.candidate_id is null and (e.system_username is not null or exists(select 1 from public.system_employee_role_assignments where employee_id=e.id and ended_at is null) or exists(select 1 from public.system_user_view_assignments where employee_id=e.id))),'username',coalesce(e.system_username,uname),'email',coalesce(e.email,h.data->>'email',c.email),'role_id',o.role_id,'auth_user_id',e.system_auth_user_id,'pending_email',o.pending_email,'config_revision',md5(jsonb_build_array(e.system_username,e.email,o.role_id,o.pending_email)::text),'route_reopened_at',o.route_reopened_at,'configured_at',case when o.route_reopened_at is not null then o.route_configured_at else o.configured_at end,'created_at',case when o.route_reopened_at is not null then o.route_prepared_at else o.created_at end,'whatsapp_opened_at',case when o.route_reopened_at is null then o.whatsapp_opened_at end,'activated_at',o.activated_at,'expires_at',o.expires_at,'message',o.message,'protected',o.candidate_id is null and (e.system_auth_user_id is not null or e.system_username is not null),'enabled',e.system_access_enabled,'document_verified',h.verified_at,'contract_signed',h.signed_at,'formalized',h.employee_id is not null);
end $function$
;
CREATE OR REPLACE FUNCTION studio_access_private.views_before_individual()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select coalesce(
 (select s.views from studio_access_private.employee_access_snapshots s join public.hr_employees e on e.id=s.employee_id where s.view_mode='legacy_template' and e.system_auth_user_id=auth.uid() and public.system_has_permission('inventario_insumos','read')),
 (select jsonb_agg(jsonb_build_object('code',v.view_code,'is_default',v.is_default) order by v.is_default desc,v.view_code) from public.system_user_view_assignments v join public.hr_employees e on e.id=v.employee_id join studio_access_private.employee_access_snapshots s on s.employee_id=e.id and s.view_mode='individual' where e.system_auth_user_id=auth.uid() and e.system_access_enabled and v.enabled and (v.view_code<>'inventory_admin' or public.system_has_permission('inventario_insumos','read'))),
 (select coalesce(jsonb_agg(jsonb_build_object('code',v.view_code,'is_default',v.is_default) order by v.is_default desc,v.view_code),'[]') from public.system_user_view_assignments v join public.hr_employees e on e.id=v.employee_id where e.system_auth_user_id=auth.uid() and e.system_access_enabled and v.enabled and not exists(select 1 from studio_access_private.employee_access_snapshots s where s.employee_id=e.id)), '[]')
$function$
;
revoke all on function studio_access_private.views_before_individual() from public,anon;
grant execute on function studio_access_private.views_before_individual() to authenticated;
create function studio_access_private.views_with_individual() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_agg(v order by (v->>'is_default')::boolean desc,v->>'code') from (
 select distinct on (v->>'code') v from (
 select value as v from jsonb_array_elements(studio_access_private.views_before_individual())
 union all select jsonb_build_object('code',g.view_code,'is_default',false,'permission_level',g.permission_level)
 from studio_access_private.individual_view_grants g join public.hr_employees e on e.id=g.employee_id
 where e.system_auth_user_id=auth.uid() and studio_access_private.extra_view_permission(g.view_code,'read')
 ) all_views order by v->>'code',(v->>'is_default')::boolean desc
 ) unique_views),'[]'::jsonb)
$$;
revoke all on function studio_access_private.views_with_individual() from public,anon;
grant execute on function studio_access_private.views_with_individual() to authenticated;
create or replace function public.system_my_views() returns jsonb language sql stable security invoker set search_path='' as $$select studio_access_private.views_with_individual()$$;
CREATE OR REPLACE FUNCTION studio_access_private.inventory_graphics_identity()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select exists(select 1 from public.hr_employees e where e.system_auth_user_id=auth.uid() and e.system_username='melanie.medina') and not studio_access_private.extra_view_permission('inventory_admin','read') or (studio_access_private.extra_view_permission('inventory_graphics_read','read') and not studio_access_private.role_permission_before_individual('inventario_insumos','read') and not studio_access_private.extra_view_permission('inventory_admin','read')) $function$
;
CREATE OR REPLACE FUNCTION studio_access_private.inventory_graphics_catalog(p_search text, p_offset integer, p_limit integer, p_product uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if auth.uid() is null or not (studio_access_private.extra_view_permission('inventory_graphics_read','read') or (exists(select 1 from public.hr_employees identity_employee where identity_employee.system_auth_user_id=auth.uid() and identity_employee.system_username='melanie.medina') and studio_access_private.role_permission_before_individual('inventario_insumos','read') and exists(select 1 from public.hr_employees e join public.system_employee_role_assignments a on a.employee_id=e.id and a.ended_at is null join public.system_access_roles r on r.id=a.access_role_id and r.is_active and r.code='insumos_melanie_medina' join public.system_user_view_assignments v on v.employee_id=e.id and v.view_code='inventory_graphics_read' and v.enabled where e.system_auth_user_id=auth.uid()))) then raise exception 'Consulta no autorizada' using errcode='42501';end if;
 if p_search is null or length(p_search)>200 or p_offset is null or p_offset<0 or p_limit is null or p_limit<1 or p_limit>100
 then raise exception 'Consulta no válida' using errcode='22023'; end if;
 -- Exact approved category only. Historical categories never imply a department.
 with eligible as (
 select id,name,category,unit,stock,minimum_stock,location,updated_at,photo_path,
 case when stock<=0 then 'Agotado' when minimum_stock>0 and stock<=minimum_stock then 'Bajo mínimo' else 'Disponible' end as stock_status
 from public.inventory_products
 where category='Departamento Gráfica'
 and (p_product is null or id=p_product)
 and (p_search='' or position(lower(p_search) in lower(name||' '||id::text))>0)
 ), page as (select * from eligible order by name,id offset p_offset limit p_limit)
 select jsonb_build_object('total',(select count(*) from eligible),'rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.name,p.id) from page p),'[]'::jsonb)) into result;
 return result;
end $function$
;

CREATE OR REPLACE FUNCTION studio_access_private.view_center_access()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(), false) then
  raise exception 'Solo propietario' using errcode = '42501';
 end if;

 with directory as (
  select u.id, e.id as employee_id, coalesce(e.full_name, 'Propietario') as name,
         e.system_username as username, u.id = auth.uid() as owner,
         e.system_access_enabled and e.status <> 'terminated' as enabled,
         s.role_id as snapshot_role, s.can_read as snapshot_read
  from auth.users u
  left join public.hr_employees e on e.system_auth_user_id = u.id
  left join studio_access_private.employee_access_snapshots s on s.employee_id = e.id
  where (e.id is not null or u.id = auth.uid()) and u.deleted_at is null
    and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until <= now())
 ), grants as (
  -- Match studio_access_private.has_permission for inventario_insumos/read.
  select d.id, r.code, r.title
  from directory d
  join public.system_employee_role_assignments a on a.employee_id = d.employee_id and a.ended_at is null
  join public.system_access_roles r on r.id = a.access_role_id and r.is_active
  join public.system_role_module_permissions p on p.access_role_id = r.id
    and p.module_code = 'inventario_insumos' and p.can_read
  where d.enabled and (d.snapshot_role is null or (d.snapshot_role = r.id and d.snapshot_read))
 ), audiences as (
  select 'session' as scope, d.id, null::text as role from directory d
  union all
  select 'owner', d.id, null from directory d where d.owner
  union all
  select 'inventory_admin', d.id, null from directory d
    where d.owner and d.username is distinct from 'melanie.medina'
  union all
  select 'inventory_admin', d.id, g.title from directory d join grants g on g.id = d.id
    where d.username is distinct from 'melanie.medina' and not d.owner
  union all
  -- Match the identity, effective permission, role and assignment of the graphics RPC.
  select 'inventory_graphics_read', d.id, g.title
  from directory d join grants g on g.id = d.id
  where d.username = 'melanie.medina'
    and exists (select 1 from public.system_employee_role_assignments a
      join public.system_access_roles r on r.id = a.access_role_id and r.is_active
      where a.employee_id = d.employee_id and a.ended_at is null and r.code = 'insumos_melanie_medina')
    and exists (select 1 from public.system_user_view_assignments v
      where v.employee_id = d.employee_id and v.view_code = 'inventory_graphics_read' and v.enabled)
 union all
 select g.view_code,d.id,null::text from directory d join studio_access_private.individual_view_grants g on g.employee_id=d.employee_id where d.enabled and g.enabled
 ), effective as (
  select a.scope, d.id, d.name, d.username, d.owner,
         coalesce(jsonb_agg(distinct a.role order by a.role) filter (where a.role is not null), '[]') as roles
  from audiences a join directory d on d.id = a.id
  group by a.scope, d.id, d.name, d.username, d.owner
 ), assigned as (
  select v.view_code as code, v.employee_id
  from public.system_user_view_assignments v
  where v.enabled and not exists (
   select 1 from studio_access_private.employee_access_snapshots s
   where s.employee_id = v.employee_id and s.view_mode = 'legacy_template')
  union
  select v->>'code', s.employee_id
  from studio_access_private.employee_access_snapshots s
  cross join lateral jsonb_array_elements(s.views) v
  where s.view_mode = 'legacy_template'
 union
 select g.view_code,g.employee_id from studio_access_private.individual_view_grants g where g.enabled
 )
 select jsonb_build_object(
  'effective', coalesce((select jsonb_object_agg(scope, users) from (
    select scope, jsonb_agg(jsonb_build_object('id', id, 'name', name, 'username', username,
      'owner', owner, 'roles', roles) order by name, id) as users
    from effective group by scope
  ) scopes), '{}'),
  'assigned', coalesce((select jsonb_object_agg(code, total) from (
    select code, count(*) as total from assigned where code is not null group by code
  ) counts), '{}')
 ) into result;
 return result;
end
$function$
;
