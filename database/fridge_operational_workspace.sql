-- Gestor Operativo Audiovisual: Venta, Cuentas, Inventario.
-- Preserve the original Jefe/owner scope for reconciliation and menu management.
begin;
create or replace function studio_access_private.fridge_full_access()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (studio_access_private.is_owner() or studio_access_private.inventory_order_role('jefe_audiovisuales'));
$$;
create or replace function studio_access_private.fridge_operational_access()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.hr_employees e
  join public.system_employee_role_assignments a on a.employee_id=e.id and a.ended_at is null
  join public.system_access_roles r on r.id=a.access_role_id and r.is_active
  where e.system_auth_user_id=auth.uid() and e.system_access_enabled and e.status='active'
  and r.code='gestor_operativo_audiovisual');
$$;
revoke all on function studio_access_private.fridge_full_access() from public,anon;
revoke all on function studio_access_private.fridge_operational_access() from public,anon;
grant execute on function studio_access_private.fridge_full_access(),studio_access_private.fridge_operational_access() to authenticated;
-- Existing reconciliation helpers and their compatibility implementations retain
-- their original access, including direct calls and RLS table reads.
do $$ declare f record;p record;definition text;begin
 for f in select oid from pg_proc where pronamespace='studio_access_private'::regnamespace
 and (proname like 'fridge_reconciliation_%' or proname in ('fridge_menu_allowed','fridge_cost_settlement'))
 and prosrc like '%studio_access_private.fridge_allowed()%' loop
  definition:=replace(pg_get_functiondef(f.oid),'studio_access_private.fridge_allowed()','studio_access_private.fridge_full_access()');execute definition;
 end loop;
 for p in select * from pg_policies where schemaname='studio_access_private'
 and tablename in ('fridge_receipt_allocations','fridge_distribution','fridge_reconciliations','fridge_reconciliation_ops','fridge_reconciliation_events','fridge_disbursements')
 and qual like '%fridge_allowed()%' loop
  execute format('alter policy %I on %I.%I using (%s)',p.policyname,p.schemaname,p.tablename,replace(p.qual,'fridge_allowed()','fridge_full_access()'));
 end loop;
end $$;
create or replace function studio_access_private.fridge_allowed()
returns boolean language sql stable security definer set search_path='' as $$
 select studio_access_private.fridge_full_access() or studio_access_private.fridge_operational_access();
$$;
-- Extend existing JSON responses without altering their products, balances or stats.
do $$ declare definition text;begin
 select pg_get_functiondef('studio_access_private.fridge_state()'::regprocedure) into definition;
 if position('workspace_sections' in definition)=0 then
  if position('''currency'',''USD''' in definition)=0 then raise exception 'Unexpected fridge_state definition';end if;
  definition:=replace(definition,'''currency'',''USD''','''workspace_sections'',case when studio_access_private.fridge_operational_access() and not studio_access_private.fridge_full_access() then ''["sale","accounts","stock"]''::jsonb else null end,''currency'',''USD''');execute definition;
 end if;
end $$;
create or replace function public.system_my_navigation()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('is_owner',coalesce(studio_access_private.is_owner(),false),'views',public.system_my_views(),
 'fridge_audiovisual',coalesce(studio_access_private.fridge_allowed(),false),
 'fridge_limited',studio_access_private.fridge_operational_access() and not studio_access_private.fridge_full_access(),
 'fridge_manager',coalesce(studio_access_private.fridge_manager(),false),
 'finance_cost_sheets',coalesce(studio_access_private.fridge_manager(),false));
$$;
commit;
