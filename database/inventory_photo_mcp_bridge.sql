-- Provision the Site credential separately into Vault, never into source.
create or replace function studio_access_private.inventory_photo_bridge_token()
returns text language plpgsql security definer set search_path = '' as $$
begin
 if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service access required' using errcode='42501'; end if;
 return (select decrypted_secret from vault.decrypted_secrets where name='inventory_photo_mcp_site' limit 1);
end $$;
revoke all on function studio_access_private.inventory_photo_bridge_token() from public, anon, authenticated;
grant execute on function studio_access_private.inventory_photo_bridge_token() to service_role;
grant usage on schema studio_access_private to service_role;
create or replace function public.inventory_photo_bridge_config()
returns text language sql security invoker set search_path = '' as $$
 select studio_access_private.inventory_photo_bridge_token()
$$;
revoke all on function public.inventory_photo_bridge_config() from public, anon, authenticated;
grant execute on function public.inventory_photo_bridge_config() to service_role;
