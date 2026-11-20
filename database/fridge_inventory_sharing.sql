create or replace function public.fridge_inventory_report_snapshot()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not studio_access_private.fridge_allowed() then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 return jsonb_build_object('as_of',now(),'requested_by',case when studio_access_private.is_owner() then 'Julio Martínez · CEO' else studio_access_private.inventory_actor_name() end,'products',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'stock',stock,'minimum',minimum,'active',active) order by name) from studio_access_private.fridge_products),'[]'));
end $$;
revoke all on function public.fridge_inventory_report_snapshot() from public,anon;
grant execute on function public.fridge_inventory_report_snapshot() to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('fridge-inventory-reports','fridge-inventory-reports',false,2097152,array['application/pdf']) on conflict(id) do nothing;
