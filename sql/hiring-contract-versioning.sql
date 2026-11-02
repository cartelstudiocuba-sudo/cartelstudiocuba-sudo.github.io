-- No existing candidatures are updated by installation.
create or replace function studio_hiring_private.contract_snapshot(p_role uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.hr_roles; doc jsonb; snapshot jsonb;
begin
 select * into r from public.hr_roles where id=p_role;
 select d into doc from jsonb_array_elements(r.work_content#>'{contract_templates,employment,documents}') d where d->>'key'='employment_contract';
 if doc is null or jsonb_array_length(coalesce(doc->'blocks','[]'))=0 or r.work_content#>>'{contract_templates,employment,applies}'='false' then raise exception 'Configura la plantilla maestra del contrato de trabajo'; end if;
 snapshot:=jsonb_build_object('template',doc,'role',jsonb_build_object('title',r.title,'area',r.area,'direct_manager',r.direct_manager,'description',r.description,'modality',r.modality,'employment_type',r.employment_type,'work_days',r.work_days,'schedule',r.schedule,'location',r.location,'currency',r.currency,'payment_frequency',r.payment_frequency,'payment_method',r.payment_method,'compensation',r.compensation,'trial_period',r.trial_period,'trial_compensation_different',r.trial_compensation_different,'trial_compensation_amount',r.trial_compensation_amount,'recruitment_text',r.recruitment_text,'recruitment_responsibilities',r.recruitment_responsibilities,'recruitment_requirements',r.recruitment_requirements,'work_content',jsonb_build_object('standard',r.work_content->'standard','standard_titles',r.work_content->'standard_titles','hidden_standard_keys',r.work_content->'hidden_standard_keys','content_order',r.work_content->'content_order','custom',r.work_content->'custom','policy_ids',r.work_content->'policy_ids','discipline_ids',r.work_content->'discipline_ids')),
   'nomenclators',(select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'category',n.category,'key',n.key,'label',n.label,'value',n.value,'applies_to_all_roles',n.applies_to_all_roles) order by n.id),'[]') from public.hr_nomenclators n where n.category in ('normas_politicas','regimen_disciplinario','datos_contractuales_empresa','clausulas_contractuales') and (n.category='datos_contractuales_empresa' or n.applies_to_all_roles or coalesce(r.work_content->'policy_ids','[]') ? n.id::text or coalesce(r.work_content->'discipline_ids','[]') ? n.id::text or exists(select 1 from jsonb_array_elements(doc->'blocks') b where b->>'source' in ('policy:'||n.id,'clause:'||n.id)))));
 return snapshot||jsonb_build_object('renderer_version',2,'source_version',encode(sha256(convert_to(snapshot::text,'UTF8')),'hex'),'issued_at',clock_timestamp());
end $$;
revoke all on function studio_hiring_private.contract_snapshot(uuid) from public,anon,authenticated;

create or replace function studio_hiring_private.version_contract()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and (old.signed_at is not null or old.employee_id is not null) then
  if new.contract is distinct from old.contract or new.data is distinct from old.data or new.signed_at is null then raise exception 'Contrato firmado: conserva el original; requiere un nuevo expediente para modificaciones'; end if;
  return new;
 end if;
 if TG_OP='INSERT' then new.contract:=studio_hiring_private.contract_snapshot(new.role_id);
 elsif new.token_hash is distinct from old.token_hash and old.verified_at is null then
  new.contract:=studio_hiring_private.contract_snapshot(new.role_id);
 end if;
 if new.signed_at is not null then
  new.contract:=new.contract||jsonb_build_object('signed_data',studio_hiring_private.consolidated(new));
 end if;
 return new;
end $$;
revoke all on function studio_hiring_private.version_contract() from public,anon,authenticated;
create trigger hiring_contract_version before insert or update on public.hr_hiring_cases for each row execute function studio_hiring_private.version_contract();

-- Read only the logos referenced by this token's frozen snapshot.
create or replace function studio_hiring_private.presentation_allowed(p_path text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from studio_hiring_private.current_case(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-hiring-token','')) h
 where h.trial_id is not null and p_path like 'contract-presentation/%'
 and p_path in (h.contract#>>'{template,presentation,logo_path}',h.contract#>>'{template,presentation,watermark_path}'))
$$;
revoke all on function studio_hiring_private.presentation_allowed(text) from public;
grant execute on function studio_hiring_private.presentation_allowed(text) to anon,authenticated;
create policy hiring_presentation_read on storage.objects for select to anon,authenticated using(bucket_id='hr-role-documents' and studio_hiring_private.presentation_allowed(name));

create or replace function studio_hiring_private.read_case(p_token text,p_document boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h public.hr_hiring_cases;
begin
 h:=studio_hiring_private.current_case(p_token);
 if h.trial_id is null then raise exception 'Enlace no válido, caducado o revocado'; end if;
 if p_document then return jsonb_build_object('contract',case when h.signed_at is null then h.contract||jsonb_build_object('renderer_version',2) else h.contract end,'data',case when h.signed_at is not null then coalesce(h.contract->'signed_data',h.data) else studio_hiring_private.consolidated(h) end,'revision',h.revision); end if;
 return jsonb_build_object('trial_id',h.trial_id,'data',studio_hiring_private.consolidated(h),'revision',h.revision,'locked',h.verified_at is not null or h.employee_id is not null,'submitted',h.submitted_at is not null,'role_title',h.contract#>>'{role,title}',
 'front',exists(select 1 from storage.objects where (bucket_id='hr-hiring-private' and name=h.trial_id||'/front') or (bucket_id='hr-identity-private' and name=h.inherited_documents->>'front')),
 'back',exists(select 1 from storage.objects where (bucket_id='hr-hiring-private' and name=h.trial_id||'/back') or (bucket_id='hr-identity-private' and name=h.inherited_documents->>'back')),
 'portrait',exists(select 1 from storage.objects where bucket_id='hr-hiring-private' and name=h.trial_id||'/portrait'));
end $$;
