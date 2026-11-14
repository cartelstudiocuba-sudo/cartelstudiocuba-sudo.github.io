-- Public customers read a curated projection through the delivery function, never private schemas.
create or replace function public.fridge_menu_public(p_version uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$select studio_access_private.fridge_menu_public(p_version)$$;
revoke all on function public.fridge_menu_public(uuid),studio_access_private.fridge_menu_public(uuid) from public,anon,authenticated;
grant execute on function public.fridge_menu_public(uuid),studio_access_private.fridge_menu_public(uuid) to authenticated,service_role;
do $$begin
if not exists(select 1 from pg_policies where schemaname='studio_access_private' and tablename='fridge_menu_settings' and policyname='fridge_menu_settings_read') then create policy fridge_menu_settings_read on studio_access_private.fridge_menu_settings for select to authenticated using((select studio_access_private.fridge_menu_allowed())); end if;
if not exists(select 1 from pg_policies where schemaname='studio_access_private' and tablename='fridge_menu_versions' and policyname='fridge_menu_versions_read') then create policy fridge_menu_versions_read on studio_access_private.fridge_menu_versions for select to authenticated using((select studio_access_private.fridge_menu_allowed())); end if;
if not exists(select 1 from pg_policies where schemaname='studio_access_private' and tablename='fridge_menu_events' and policyname='fridge_menu_events_read') then create policy fridge_menu_events_read on studio_access_private.fridge_menu_events for select to authenticated using((select studio_access_private.fridge_menu_allowed())); end if;
end $$;
