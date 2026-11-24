begin;
create table studio_access_private.trial_account_grants(
 candidate_id uuid primary key references public.hr_candidates(id) on delete cascade,
 user_id uuid unique not null references auth.users(id) on delete cascade,
 role_id uuid not null references public.system_access_roles(id),
 created_at timestamptz not null default now(),
 active boolean not null default true
);
alter table studio_access_private.trial_account_grants enable row level security;
revoke all on studio_access_private.trial_account_grants from public,anon,authenticated;
create function studio_access_private.trial_account_role() returns uuid language sql stable security definer set search_path='' as $$
 select g.role_id from studio_access_private.trial_account_grants g
 join public.hr_candidates c on c.id=g.candidate_id
 join auth.users u on u.id=g.user_id
 join public.system_access_roles r on r.id=g.role_id
 where g.user_id=auth.uid() and g.active and c.status='trial' and r.is_active
 and lower(c.email)=lower(u.email) and u.email_confirmed_at is not null and u.deleted_at is null
 and (u.banned_until is null or u.banned_until<=now())
 and not exists(select 1 from public.hr_employees e where e.system_auth_user_id=g.user_id)
$$;
revoke all on function studio_access_private.trial_account_role() from public,anon;
grant execute on function studio_access_private.trial_account_role() to authenticated;
create or replace function studio_access_private.has_permission(module text, operation text) returns boolean language sql stable security definer set search_path='' as $$
 select studio_access_private.role_permission_before_individual(module,operation)
 or (module='inventario_insumos' and (studio_access_private.extra_view_permission('inventory_admin',operation) or (operation='read' and studio_access_private.extra_view_permission('inventory_graphics_read','read'))))
 or (module='inventario_insumos' and operation in ('read','write') and exists(
  select 1 from public.system_role_module_permissions p
  where p.access_role_id=studio_access_private.trial_account_role() and p.module_code=module
  and case operation when 'read' then p.can_read when 'write' then p.can_write else false end
 ))
$$;
create function studio_access_private.trial_account_views() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select views from studio_access_private.role_templates where role_id=studio_access_private.trial_account_role()),'[]'::jsonb)
$$;
revoke all on function studio_access_private.trial_account_views() from public,anon;
grant execute on function studio_access_private.trial_account_views() to authenticated;
create or replace function public.system_my_views() returns jsonb language sql stable set search_path='' as $$
 select case when studio_access_private.trial_account_role() is not null then studio_access_private.trial_account_views() else studio_access_private.views_with_individual() end
$$;
create or replace function studio_access_private.inventory_actor_name() returns text language sql stable security definer set search_path='' as $$
 select coalesce(
 (select nullif(btrim(full_name),'') from public.hr_employees where system_auth_user_id=auth.uid() limit 1),
 (select c.full_name from public.hr_candidates c join studio_access_private.trial_account_grants g on g.candidate_id=c.id where g.user_id=auth.uid() and g.role_id=studio_access_private.trial_account_role()),
 (select left(nullif(btrim(raw_user_meta_data->>'username'),''),80) from auth.users where id=auth.uid()),
 auth.uid()::text)
$$;
commit;