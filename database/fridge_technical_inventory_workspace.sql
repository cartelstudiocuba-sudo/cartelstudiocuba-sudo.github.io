begin;
CREATE OR REPLACE FUNCTION studio_access_private.fridge_full_access()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select auth.uid() is not null and (
  studio_access_private.is_owner() or studio_access_private.inventory_order_role('jefe_audiovisuales')
  or exists (
   select 1 from studio_access_private.fridge_workspace_grants grant_row
   join public.hr_employees e on e.id=grant_row.employee_id
   where e.system_auth_user_id=auth.uid() and e.system_access_enabled and e.status='active' and not studio_access_private.inventory_order_role('gestor_tecnico')
  )
 );
$function$;

create or replace function studio_access_private.fridge_technical_access() returns boolean language sql stable security definer set search_path='' as $$ select auth.uid() is not null and studio_access_private.inventory_order_role('gestor_tecnico') and not studio_access_private.fridge_full_access() and not studio_access_private.fridge_operational_access() $$;
revoke all on function studio_access_private.fridge_technical_access() from public,anon;
grant execute on function studio_access_private.fridge_technical_access() to authenticated;
CREATE OR REPLACE FUNCTION studio_access_private.fridge_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare balances jsonb; today_start timestamptz:=date_trunc('day',now() at time zone 'America/Havana') at time zone 'America/Havana';
begin
 if studio_access_private.fridge_technical_access() then
 return jsonb_build_object('technical_workspace',true,'workspace_sections','["summary","stock"]'::jsonb,'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'category',p.category,'stock',p.stock,'minimum',p.minimum,'active',p.active) order by p.name) from studio_access_private.fridge_products p where p.active),'[]'::jsonb),'customers','[]'::jsonb,'staff','[]'::jsonb,'stats','{}'::jsonb,'as_of',now());
 end if;
 if not studio_access_private.fridge_allowed() then raise exception 'No tienes acceso a Nevera audiovisual' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('pricing_basis',coalesce((select s.sale_context->>'pricing_basis' from studio_access_private.fridge_sales s where s.customer_id=c.id order by s.created_at desc,s.id desc limit 1),'standard'),'balance',
 coalesce((select sum(s.amount) from studio_access_private.fridge_sales s where s.customer_id=c.id),0)-coalesce((select sum(p.amount) from studio_access_private.fridge_payments p where p.customer_id=c.id),0)) order by c.name),'[]') into balances from studio_access_private.fridge_customers c;
 return jsonb_build_object('workspace_sections',case when studio_access_private.fridge_operational_access() and not studio_access_private.fridge_full_access() then '["sale","accounts","stock"]'::jsonb else null end,'operational_workspace',studio_access_private.fridge_operational_access() and not studio_access_private.fridge_full_access(),'currency','USD','products',coalesce((select jsonb_agg(to_jsonb(p) order by p.name) from studio_access_private.fridge_products p),'[]'),
 'customers',balances,'staff',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.full_name) order by e.full_name) from public.hr_employees e where e.status<>'terminated'),'[]'),
 'stats',jsonb_build_object('sales_today',coalesce((select sum(s.amount) from studio_access_private.fridge_sales s where s.created_at>=today_start),0),
 'collected_today',coalesce((select sum(p.amount) from studio_access_private.fridge_payments p where p.created_at>=today_start),0),
 'owed',coalesce((select sum((b->>'balance')::numeric) from jsonb_array_elements(balances) b),0),
 'open_accounts',(select count(*) from jsonb_array_elements(balances) b where (b->>'balance')::numeric>0),
 'stock',coalesce((select sum(stock) from studio_access_private.fridge_products),0)), 'as_of',now());
end $function$;

CREATE OR REPLACE FUNCTION public.system_my_navigation()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('is_owner',coalesce(studio_access_private.is_owner(),false),'views',public.system_my_views(),
 'fridge_audiovisual',coalesce(studio_access_private.fridge_allowed(),false) or studio_access_private.fridge_technical_access(),
 'fridge_technical',studio_access_private.fridge_technical_access(),'fridge_limited',studio_access_private.fridge_operational_access() and not studio_access_private.fridge_full_access(),
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
$function$;

commit;