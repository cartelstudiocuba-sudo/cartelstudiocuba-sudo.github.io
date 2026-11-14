-- Keep warehouse access complete when an administrator also has a department position.
CREATE OR REPLACE FUNCTION studio_access_private.inventory_order_catalog()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caps jsonb:=studio_access_private.inventory_order_capabilities();
begin
 if auth.uid() is null or not ((caps->>'create')::boolean or (caps->>'approve')::boolean or (caps->>'fulfil')::boolean) then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'unit',p.unit,'department',p.department,'category',p.category,'photo_path',p.photo_path,'stock',p.stock,'reserved',studio_access_private.inventory_order_reserved(p.id),'available',greatest(0,p.stock-studio_access_private.inventory_order_reserved(p.id)),'unit_cost',p.unit_cost) order by p.name) from public.inventory_products p where p.deleted_at is null and p.currency='USD' and ((caps->>'fulfil')::boolean or caps->>'area' is null or p.department in (caps->>'area','Generales'))),'[]');
end $function$
;
