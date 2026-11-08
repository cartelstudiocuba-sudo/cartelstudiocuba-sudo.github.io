-- Add existing position/contract records to the already owner-authorized profile.
-- The source table has RLS without client policies; do not loosen its policies.
create function studio_access_private.evolution_user_profile(p_employee uuid,p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;employee uuid;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501';end if;
 result:=studio_access_private.extended_user_profile(p_employee,p_user);
 employee:=(result->'employee'->>'id')::uuid;
 return result||jsonb_build_object('position_history',coalesce((select jsonb_agg(to_jsonb(h) order by h.started_at desc,h.id) from public.system_employee_position_history h where h.employee_id=employee),'[]'::jsonb));
end $$;
revoke all on function studio_access_private.evolution_user_profile(uuid,uuid) from public,anon;
grant execute on function studio_access_private.evolution_user_profile(uuid,uuid) to authenticated;
create or replace function public.system_user_profile(p_employee uuid default null,p_user uuid default null) returns jsonb
language sql security invoker set search_path='' as $$select studio_access_private.evolution_user_profile(p_employee,p_user)$$;
revoke all on function public.system_user_profile(uuid,uuid) from public,anon;
grant execute on function public.system_user_profile(uuid,uuid) to authenticated;
