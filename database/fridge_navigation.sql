-- Return the fridge capability with the primary navigation response.
-- Existing saved views/defaults and all permission checks remain intact.
create or replace function public.system_my_navigation()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('is_owner',coalesce(studio_access_private.is_owner(),false),
 'views',public.system_my_views(),'fridge_audiovisual',coalesce(studio_access_private.fridge_allowed(),false))
$$;
