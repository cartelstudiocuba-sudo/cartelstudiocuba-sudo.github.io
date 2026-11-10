-- Read-only projection of current authorization and saved navigation assignments.
-- The private implementation can see Auth account state and legacy snapshots.
create or replace function studio_access_private.view_center_access()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $function$
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
$function$;

create or replace function public.system_view_center_access()
returns jsonb
language sql stable security invoker set search_path = ''
as $function$
 select studio_access_private.view_center_access()
$function$;

revoke all on function studio_access_private.view_center_access() from public, anon, authenticated;
revoke all on function public.system_view_center_access() from public, anon, authenticated;
grant execute on function studio_access_private.view_center_access() to authenticated;
grant execute on function public.system_view_center_access() to authenticated;
