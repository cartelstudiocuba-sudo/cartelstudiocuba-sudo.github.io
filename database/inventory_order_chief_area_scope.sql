-- Chiefs retain their assigned request/catalog area even with additional warehouse permissions.
CREATE OR REPLACE FUNCTION studio_access_private.inventory_order_capabilities()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('create',public.inventory_has_access('write') or studio_access_private.inventory_order_role('jefe_audiovisuales') or studio_access_private.inventory_order_role('jefe_grafica'),'approve',studio_access_private.is_owner() or studio_access_private.inventory_order_role('manager_general'),'fulfil',public.inventory_has_access('write'),'area',case when studio_access_private.is_owner() then null when studio_access_private.inventory_order_role('jefe_audiovisuales') then 'Audiovisual' when studio_access_private.inventory_order_role('jefe_grafica') then 'Gráfica' end);
$function$
