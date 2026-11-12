-- Preserve employee names; use the account username when no employee is linked.
-- Display names do not grant permissions. Authorship continues to use auth.uid().
CREATE OR REPLACE FUNCTION studio_access_private.inventory_actor_name()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $function$
 SELECT coalesce(
  (SELECT nullif(btrim(full_name),'') FROM public.hr_employees WHERE system_auth_user_id=auth.uid() LIMIT 1),
  (SELECT left(nullif(btrim(raw_user_meta_data->>'username'),''),80) FROM auth.users WHERE id=auth.uid()),
  auth.uid()::text)
$function$;
