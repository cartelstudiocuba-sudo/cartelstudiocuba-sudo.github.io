-- Departments and product categories are separate. This consultation stays read-only.
create or replace function studio_access_private.inventory_graphics_catalog(p_search text,p_offset integer,p_limit integer,p_product uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not (studio_access_private.is_owner() or studio_access_private.extra_view_permission('inventory_graphics_read','read') or (exists(select 1 from public.hr_employees identity_employee where identity_employee.system_auth_user_id=auth.uid() and identity_employee.system_username='melanie.medina') and studio_access_private.role_permission_before_individual('inventario_insumos','read') and exists(select 1 from public.hr_employees e join public.system_employee_role_assignments a on a.employee_id=e.id and a.ended_at is null join public.system_access_roles r on r.id=a.access_role_id and r.is_active and r.code='insumos_melanie_medina' join public.system_user_view_assignments v on v.employee_id=e.id and v.view_code='inventory_graphics_read' and v.enabled where e.system_auth_user_id=auth.uid()))) then raise exception 'Consulta no autorizada' using errcode='42501';end if;
 if p_search is null or length(p_search)>200 or p_offset is null or p_offset<0 or p_limit is null or p_limit<1 or p_limit>100 then raise exception 'Consulta no válida' using errcode='22023';end if;
 with eligible as (
 select id,name,department,category,unit,stock,minimum_stock,location,updated_at,photo_path,
 case when stock<=0 then 'Agotado' when minimum_stock>0 and stock<=minimum_stock then 'Bajo mínimo' else 'Disponible' end as stock_status
 from public.inventory_products
 where deleted_at is null and department='Gráfica'
 and (p_product is null or id=p_product)
 and (p_search='' or position(lower(p_search) in lower(name||' '||id::text))>0)
 ), page as (select * from eligible order by name,id offset p_offset limit p_limit)
 select jsonb_build_object('total',(select count(*) from eligible),'rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.name,p.id) from page p),'[]'::jsonb)) into result;
 return result;
end $$;
create or replace function studio_access_private.inventory_graphics_photo_allowed(p_path text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare product_id uuid;
begin
 if auth.uid() is null or not studio_access_private.inventory_graphics_identity() then return false;end if;
 for product_id in select id from public.inventory_products where deleted_at is null and department='Gráfica' and photo_path=p_path loop
  if jsonb_array_length(studio_access_private.inventory_graphics_catalog('',0,1,product_id)->'rows')>0 then return true;end if;
 end loop;
 return false;
exception when insufficient_privilege then return false;
end $$;
