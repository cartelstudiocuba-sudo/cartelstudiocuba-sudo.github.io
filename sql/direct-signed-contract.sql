-- Historical signed files are a valid contract source; no hiring case or candidate is fabricated.
create function studio_offboarding_private.direct_signed_contract(p_employee uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo RRHH autorizado' using errcode='42501';end if;
 select jsonb_build_object('source','direct_existing_worker','signed_document',d.file_url,'employment',p.data->'employment','role',jsonb_build_object('title',e.role_title,'employment_type',p.data->'employment'->>'contract_type','schedule',p.data->'employment'->>'schedule','compensation',p.data->'employment'->>'salary','work_content','{}'::jsonb),'nomenclators',coalesce((select jsonb_agg(to_jsonb(n)) from public.hr_nomenclators n where n.category in ('datos_contractuales_empresa','clausulas_contractuales','normas_politicas','regimen_disciplinario')),'[]'::jsonb)) into result
 from public.hr_employees e join public.hr_employee_personal_details p on p.employee_id=e.id join public.hr_employee_documents d on d.employee_id=e.id and d.category='Contrato firmado'
 where e.id=p_employee and p.data->>'record_source'='direct_existing_worker' and p.data->'employment'->>'contract_status'='signed' and nullif(p.data->'employment'->>'signed_on','') is not null
 and d.file_url like 'hr-employee-private/%' and exists(select 1 from storage.objects o where o.bucket_id='hr-employee-private' and o.name=substring(d.file_url from length('hr-employee-private/')+1)) order by d.created_at desc limit 1;
 return result;
end $$;
revoke all on function studio_offboarding_private.direct_signed_contract(uuid) from public,anon,authenticated;
