-- Enrich the existing owner-only directory; no new worker register and no record updates.
create function studio_access_private.user_directory_status() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario' using errcode='42501';end if;
 select coalesce(jsonb_agg(item||jsonb_build_object(
  'area',case when jsonb_typeof(d.data->'employment')='object' then d.data->'employment'->>'area' else r.area end,
  'position_id',e.role_id,'labor_status',e.status,
  'activation_state',case when coalesce((item->>'is_owner')::boolean,false) then 'protected' when item->>'id' is null then 'uncreated' when (item->>'blocked')::boolean then 'blocked' when not coalesce((item->>'confirmed')::boolean,false) then 'pending' when not coalesce((item->>'enabled')::boolean,false) then 'disabled' else 'active' end,
  'record_missing',case when e.id is null then '[]'::jsonb else to_jsonb(array_remove(array[
   case when nullif(btrim(e.full_name),'') is null then 'Nombre' end,
   case when e.role_id is null then 'Plaza' end,
   case when e.hired_at is null then 'Fecha de incorporación' end,
   case when nullif(btrim(coalesce(d.data->>'identity_number',d.data->>'identity_card','')),'') is null then 'Identificación' end,
   case when not exists(select 1 from public.hr_employee_documents doc where doc.employee_id=e.id and doc.category ilike '%contrato%') and not exists(select 1 from public.hr_hiring_cases h where h.employee_id=e.id and h.signed_at is not null) then 'Contrato' end
  ],null)) end
 ) order by item->>'full_name'),'[]'::jsonb) into result
 from jsonb_array_elements(studio_access_private.user_directory()) item
 left join public.hr_employees e on e.id=(item->>'employee_id')::uuid
 left join public.hr_roles r on r.id=e.role_id
 left join public.hr_employee_personal_details d on d.employee_id=e.id;
 return result;
end $$;
revoke all on function studio_access_private.user_directory_status() from public,anon;
grant execute on function studio_access_private.user_directory_status() to authenticated;
create or replace function public.system_list_users() returns jsonb language sql set search_path='' as $$select studio_access_private.user_directory_status()$$;

revoke all on function public.system_list_users() from public,anon;
grant execute on function public.system_list_users() to authenticated;
