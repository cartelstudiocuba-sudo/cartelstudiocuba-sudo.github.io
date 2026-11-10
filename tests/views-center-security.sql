-- Run after sql/view-center-access.sql against an installation with the current access schema.
-- This test changes only transaction-local roles and claims.
begin;
do $test$
declare
 owner_id uuid := '6418ad20-d0e8-49c0-8d9a-e1da3daf71b6';
 subject record;
 report jsonb;
 listed boolean;
 actual boolean;
 tested integer := 0;
begin
 if has_function_privilege('anon', 'public.system_view_center_access()', 'execute')
    or has_function_privilege('anon', 'studio_access_private.view_center_access()', 'execute') then
  raise exception 'Anonymous role can execute the access report';
 end if;
 perform set_config('request.jwt.claim.sub', owner_id::text, true);
 set local role authenticated;
 report := public.system_view_center_access();
 reset role;
 if not exists (select 1 from jsonb_array_elements(report->'effective'->'owner') x where (x->>'id')::uuid = owner_id) then
  raise exception 'Owner missing from the owner access report';
 end if;

 for subject in
  select u.id from auth.users u
  where u.deleted_at is null and u.email_confirmed_at is not null
    and (u.banned_until is null or u.banned_until <= now())
    and (u.id = owner_id or exists (select 1 from public.hr_employees e where e.system_auth_user_id = u.id))
 loop
  perform set_config('request.jwt.claim.sub', subject.id::text, true);
  set local role authenticated;
  if subject.id <> owner_id then
   begin
    perform public.system_view_center_access();
    raise exception 'Delegated user can read the report';
   exception when insufficient_privilege then null;
   end;
   begin
    perform studio_access_private.view_center_access();
    raise exception 'Delegated user can read the private report';
   exception when insufficient_privilege then null;
   end;
  end if;

  select exists (select 1 from jsonb_array_elements(report->'effective'->'inventory_admin') x
     where (x->>'id')::uuid = subject.id) into listed;
  if listed is distinct from public.inventory_has_access('read') then
   raise exception 'Inventory administrator access report differs from the route guard';
  end if;

  select exists (select 1 from jsonb_array_elements(report->'effective'->'inventory_graphics_read') x
     where (x->>'id')::uuid = subject.id) into listed;
  begin
   perform public.inventory_graphics_catalog('', 0, 1, null);
   actual := true;
  exception when insufficient_privilege then actual := false;
  end;
  if listed is distinct from actual then
   raise exception 'Graphics consultation access report differs from the route guard';
  end if;
  reset role;
  tested := tested + 1;
 end loop;
 if tested < 2 then raise exception 'A delegated account is required for parity coverage'; end if;
 perform set_config('view_center.tested', tested::text, true);
end
$test$;
select 'PASS' as status, current_setting('view_center.tested')::int as checked_accounts;
rollback;
