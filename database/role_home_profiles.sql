-- Presentation metadata only. No role, permission or view assignments change.
create or replace function public.system_my_navigation()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('is_owner',coalesce(studio_access_private.is_owner(),false),'views',public.system_my_views(),
 'fridge_audiovisual',coalesce(studio_access_private.fridge_allowed(),false),
 'fridge_limited',studio_access_private.fridge_operational_access() and not studio_access_private.fridge_full_access(),
 'fridge_manager',coalesce(studio_access_private.fridge_manager(),false),
 'finance_cost_sheets',coalesce(studio_access_private.fridge_manager(),false),
 'home_role',case
 when studio_access_private.is_owner() then null
 when studio_access_private.inventory_order_role('manager_general') then 'manager_general'
 when studio_access_private.inventory_order_role('jefe_audiovisuales') then 'jefe_audiovisuales'
 when studio_access_private.inventory_order_role('jefe_grafica') then 'jefe_grafica'
 when studio_access_private.inventory_order_role('gestor_comercial_grafica') or studio_access_private.inventory_order_role('insumos_melanie_medina') then 'gestor_comercial_grafica'
 when studio_access_private.fridge_operational_access() then 'gestor_operativo_audiovisual'
 else null end);
$$;
