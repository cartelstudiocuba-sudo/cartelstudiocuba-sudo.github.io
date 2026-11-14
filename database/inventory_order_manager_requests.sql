-- Manager General can submit requests without warehouse fulfilment rights.
-- Request area follows the employment position before legacy access-role fallbacks.
-- Existing approval/fulfilment rights and responsible-area rules are preserved.
CREATE OR REPLACE FUNCTION studio_access_private.inventory_order_capabilities()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('create',public.inventory_has_access('write') or studio_access_private.inventory_order_role('manager_general') or studio_access_private.inventory_order_role('jefe_audiovisuales') or studio_access_private.inventory_order_role('jefe_grafica'),'approve',studio_access_private.is_owner() or studio_access_private.inventory_order_role('manager_general'),'fulfil',public.inventory_has_access('write'),'area',case when studio_access_private.is_owner() then null else coalesce(
  (select case
    when lower(btrim(d.name)) in ('gráfica','producciones gráficas','diseño y producciones gráficas') then 'Gráfica'
    when lower(btrim(d.name)) in ('audiovisual','audiovisuales') then 'Audiovisual'
   end
   from public.hr_employees e
   join public.hr_roles job on job.id=e.role_id
   join public.hr_departments d on d.id=job.department_id
   where e.system_auth_user_id=auth.uid() and e.system_access_enabled
     and e.status<>'terminated'
   order by e.id limit 1),
  case when studio_access_private.inventory_order_role('jefe_audiovisuales') then 'Audiovisual'
       when studio_access_private.inventory_order_role('jefe_grafica') then 'Gráfica' end
 ) end);
$function$
