-- Approved-menu membership is required before resolving a private product image.
-- Existing products, snapshots, prices and Storage policies are unchanged.
create or replace function studio_access_private.fridge_menu_product_photo_ref(p_product uuid,p_version uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('path',p.photo_path)
 from studio_access_private.fridge_menu_versions v
 join studio_access_private.fridge_products p on p.id=p_product
 where v.id=coalesce(p_version,(select active_version from studio_access_private.fridge_menu_settings where code='bar'))
 and nullif(p.photo_path,'') is not null
 and exists(select 1 from jsonb_array_elements(v.snapshot->'products') item where item->>'id'=p_product::text)
$$;
create or replace function public.fridge_menu_product_photo_ref(p_product uuid,p_version uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$
 select studio_access_private.fridge_menu_product_photo_ref(p_product,p_version)
$$;
revoke all on function public.fridge_menu_product_photo_ref(uuid,uuid),studio_access_private.fridge_menu_product_photo_ref(uuid,uuid) from public,anon,authenticated;
grant execute on function public.fridge_menu_product_photo_ref(uuid,uuid),studio_access_private.fridge_menu_product_photo_ref(uuid,uuid) to service_role;
-- Rollback: revoke execute on both functions from service_role and restore previous Edge handler.
