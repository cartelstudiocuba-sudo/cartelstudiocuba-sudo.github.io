CREATE OR REPLACE FUNCTION studio_hiring_private.manage(p_trial uuid, p_action text, p_revision integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare h public.hr_hiring_cases; t public.hr_trial_periods; c public.hr_candidates; last_action text;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'No autorizado'; end if;
 select * into t from public.hr_trial_periods where id=p_trial for update;
 select * into c from public.hr_candidates where id=t.candidate_id for update;
 select * into h from public.hr_hiring_cases where trial_id=p_trial for update;
 if h.trial_id is null or t.superseded_at is not null or c.status not in ('trial','hired') or h.employee_id is not null then raise exception 'Candidatura no vigente'; end if;
 if p_action='notify' then
  select action into last_action from public.hr_trial_closure_events where trial_id=p_trial and action in ('message_opened','training_step_back','training_notification_confirmed','training_notification_back') order by created_at desc,id desc limit 1;
  if last_action is distinct from 'training_notification_confirmed' or h.revoked_at is not null or h.expires_at<=now() then raise exception 'Actualiza la etapa o renueva los enlaces'; end if;
  if h.notified_at is not null and c.status='hired' then return; end if;
  update public.hr_hiring_cases set notified_at=coalesce(notified_at,clock_timestamp()) where trial_id=p_trial;
  -- Labor status starts here; documentation stays independently pending.
  if exists(select 1 from public.hr_employees where candidate_id=c.id and status='terminated') then raise exception 'Expediente dado de baja; requiere revisión'; end if;
  insert into public.hr_employees(candidate_id,role_id,vacancy_id,full_name,email,whatsapp,role_title,status,hired_at)
  values(c.id,h.role_id,c.vacancy_id,c.full_name,c.email,c.whatsapp,t.role_title,'active',now()) on conflict(candidate_id) do nothing;
  update public.hr_candidates set status='hired',decision_status='hired',decision_updated_at=now() where id=c.id;
 elsif p_action='back' then
  if c.status='hired' then raise exception 'Contratado: utiliza el procedimiento laboral para retroceder'; end if;
  update public.hr_hiring_cases set notified_at=null,revoked_at=clock_timestamp() where trial_id=p_trial;
 elsif p_action='revoke' then
  update public.hr_hiring_cases set revoked_at=clock_timestamp() where trial_id=p_trial;
 elsif p_action='verify' then
  if h.submitted_at is null or h.revision is distinct from p_revision then raise exception 'Revisa la última versión del expediente'; end if;
  update public.hr_hiring_cases set verified_at=clock_timestamp() where trial_id=p_trial;
 elsif p_action='signed' then
  if h.verified_at is null or h.revision is distinct from p_revision then raise exception 'Valida primero la última versión del expediente'; end if;
  update public.hr_hiring_cases set signed_at=clock_timestamp() where trial_id=p_trial;
 elsif p_action='reopen' then
  update public.hr_hiring_cases set verified_at=null,signed_at=null where trial_id=p_trial;
 else raise exception 'Acción no válida'; end if;
 insert into public.hr_candidate_history(candidate_id,event_type,from_status,to_status,note) values(c.id,'hiring_'||p_action,c.status,case when p_action='notify' then 'hired' else c.status end,'Contratación: '||p_action||'. Versión '||h.revision);
end $function$
;

CREATE OR REPLACE FUNCTION studio_hiring_private.require_validated_hire()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if new.status='hired' and old.status is distinct from 'hired' and not exists(
  select 1 from public.hr_hiring_cases h join public.hr_trial_periods t on t.id=h.trial_id
  where h.candidate_id=new.id and t.superseded_at is null and h.notified_at is not null
  )
 then raise exception 'Abre WhatsApp con el contrato en el paso 11 antes de marcar Contratados'; end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION studio_hiring_private.current_case(p_token text)
 RETURNS hr_hiring_cases
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select h from public.hr_hiring_cases h join public.hr_trial_periods t on t.id=h.trial_id
 join public.hr_candidates c on c.id=h.candidate_id
 where length(p_token)=64 and h.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')
 and h.expires_at>now() and h.revoked_at is null and t.superseded_at is null
 and (c.status='trial' or (c.status='hired' and h.notified_at is not null))
$function$
;

CREATE OR REPLACE FUNCTION studio_hiring_private.prepare(p_trial uuid, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t public.hr_trial_periods; c public.hr_candidates; h public.hr_hiring_cases; r public.hr_roles; doc jsonb; seed jsonb; decision text; notified text; a record; target_key text;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'No autorizado'; end if;
 if p_token !~ '^[a-f0-9]{64}$' then raise exception 'Token inválido'; end if;
 select * into t from public.hr_trial_periods where id=p_trial for update;
 select * into c from public.hr_candidates where id=t.candidate_id for update;
 if t.id is null or t.superseded_at is not null or c.status not in ('trial','hired') then raise exception 'Candidatura no vigente'; end if;
 select payload->>'decision' into decision from public.hr_trial_closure_events where trial_id=t.id and action in ('message_opened','training_step_back') and payload ? 'decision' order by created_at desc,id desc limit 1;
 select action into notified from public.hr_trial_closure_events where trial_id=t.id and action in ('message_opened','training_step_back','training_notification_confirmed','training_notification_back') order by created_at desc,id desc limit 1;
 if decision is distinct from 'continue' or notified is distinct from 'training_notification_confirmed' then raise exception 'Primero completa el comienzo de adiestramiento'; end if;
 select r1.* into r from public.hr_roles r1 join public.hr_recruitment_cycles cy on cy.role_id=r1.id join public.hr_vacancies v on v.recruitment_cycle_id=cy.id where v.id=c.vacancy_id;
 if r.id is null then raise exception 'Plaza no identificada'; end if;
 select d into doc from jsonb_array_elements(r.work_content#>'{contract_templates,employment,documents}') d where d->>'key'='employment_contract';
 if doc is null or jsonb_array_length(coalesce(doc->'blocks','[]'))=0 then raise exception 'Configura la plantilla maestra del contrato de trabajo'; end if;
 select * into h from public.hr_hiring_cases where trial_id=t.id for update;
 if h.role_id is not null and h.role_id<>r.id then raise exception 'La plaza cambió. Revisa el expediente antes de emitir otro contrato'; end if;
 if h.employee_id is not null then raise exception 'Contratación formalizada'; end if;
 if h.trial_id is null then
  seed:=jsonb_strip_nulls(jsonb_build_object('full_name',c.full_name,'mobile',c.whatsapp,'email',c.email,'municipality',c.municipality));
  for a in select question_key,answer#>>'{}' as value from public.hr_candidate_answers where candidate_id=c.id and jsonb_typeof(answer)='string' order by created_at,id loop
   target_key:=case a.question_key when 'education' then 'education_level' when 'interview_identity_card' then 'identity_number' when 'interview_home_address' then 'address' when 'interview_landline_phone' then 'fixed_phone' when 'interview_residence_municipality' then 'municipality' when 'interview_email' then 'email' else a.question_key end;
   if target_key in ('full_name','identity_number','birth_date','nationality','province','municipality','address','mobile','fixed_phone','email','alternative_address','emergency_name','emergency_relation','emergency_phone','education_level') and length(trim(a.value))>0 then seed:=seed||jsonb_build_object(target_key,a.value); end if;
  end loop;
  for a in select key,value from public.hr_trial_closures cl cross join lateral jsonb_each(cl.data) x where cl.trial_id=t.id loop
   if a.key in ('full_name','identity_number','birth_date','nationality','province','municipality','address','mobile','fixed_phone','email','alternative_address','emergency_name','emergency_relation','emergency_phone','education_level','civil_status','has_children','care_responsibilities','planned_absence') and a.value not in ('null'::jsonb,'""'::jsonb) then seed:=seed||jsonb_build_object(a.key,a.value); end if;
  end loop;
  insert into public.hr_hiring_cases(trial_id,candidate_id,role_id,token_hash,expires_at,data,contract)
  values(t.id,c.id,r.id,encode(sha256(convert_to(p_token,'UTF8')),'hex'),now()+interval '7 days',seed,
   jsonb_build_object('template',doc,'role',jsonb_build_object('title',r.title,'area',r.area,'direct_manager',r.direct_manager,'description',r.description,'modality',r.modality,'employment_type',r.employment_type,'work_days',r.work_days,'schedule',r.schedule,'location',r.location,'currency',r.currency,'payment_frequency',r.payment_frequency,'payment_method',r.payment_method,'compensation',r.compensation,'work_content',jsonb_build_object('standard',r.work_content->'standard','standard_titles',r.work_content->'standard_titles','hidden_standard_keys',r.work_content->'hidden_standard_keys','content_order',r.work_content->'content_order','custom',r.work_content->'custom','policy_ids',r.work_content->'policy_ids','discipline_ids',r.work_content->'discipline_ids')),
   'nomenclators',(select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'category',n.category,'key',n.key,'label',n.label,'value',n.value,'applies_to_all_roles',n.applies_to_all_roles)),'[]') from public.hr_nomenclators n where n.category in ('normas_politicas','regimen_disciplinario','datos_contractuales_empresa','clausulas_contractuales') and (n.category='datos_contractuales_empresa' or n.applies_to_all_roles or coalesce(r.work_content->'policy_ids','[]') ? n.id::text or coalesce(r.work_content->'discipline_ids','[]') ? n.id::text or exists(select 1 from jsonb_array_elements(doc->'blocks') b where b->>'source' in ('policy:'||n.id,'clause:'||n.id)))))) returning * into h;
  update public.hr_hiring_cases set inherited_documents=(select coalesce(jsonb_object_agg(split_part(name,'/',2),name),'{}') from storage.objects where bucket_id='hr-identity-private' and name in(t.id||'/front',t.id||'/back')) where trial_id=t.id returning * into h;
 else
  -- Rotating the individual bearer capability invalidates earlier URLs; received data stays.
  update public.hr_hiring_cases set token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex'),expires_at=now()+interval '7 days',revoked_at=null where trial_id=t.id returning * into h;
 end if;
 insert into public.hr_candidate_history(candidate_id,event_type,from_status,to_status,note) values(c.id,'hiring_links_prepared',c.status,c.status,'Enlaces individuales de contratación preparados o renovados.');
 return jsonb_build_object('expires_at',h.expires_at,'trial_id',h.trial_id);
end $function$
;

CREATE OR REPLACE FUNCTION studio_hiring_private.hr_confirm_trial_hire(p_trial_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 v_trial public.hr_trial_periods%rowtype;
 v_candidate public.hr_candidates%rowtype;
 v_employee_id uuid;
 v_role_id uuid;
 v_now timestamptz := now();
begin
 if auth.uid() is null or not studio_access_private.is_owner() then
  raise exception 'No autorizado para contratar';
 end if;
 select * into v_trial from public.hr_trial_periods where id=p_trial_id for update;
 if not found then raise exception 'Período de prueba inexistente'; end if;
 if v_trial.stage not in ('in_trial','evaluation_pending') then
  raise exception 'Etapa no válida para contratación';
 end if;
 select * into v_candidate from public.hr_candidates where id=v_trial.candidate_id for update;
 if not found then raise exception 'Candidato inexistente'; end if;
 if v_candidate.status='hired' then
  if not exists(select 1 from public.hr_hiring_cases where trial_id=p_trial_id and notified_at is not null and verified_at is not null and signed_at is not null) then raise exception 'Falta validar expediente o contrato firmado'; end if;
  select id into v_employee_id from public.hr_employees where candidate_id=v_candidate.id and status='active';
  if v_employee_id is null then raise exception 'Expediente activo inexistente'; end if;
  update public.hr_trial_periods set stage='completed',completed_at=v_now,updated_at=v_now where id=p_trial_id;
  return v_employee_id;
 end if;
 if exists(select 1 from public.hr_employees where candidate_id=v_candidate.id and status='active') then
  raise exception 'Ya existe un expediente activo para este candidato';
 end if;
 select cy.role_id into v_role_id
 from public.hr_vacancies v join public.hr_recruitment_cycles cy on cy.id=v.recruitment_cycle_id
 where v.id=coalesce(v_trial.vacancy_id,v_candidate.vacancy_id);
 insert into public.hr_employees(candidate_id,role_id,vacancy_id,full_name,email,whatsapp,role_title,status,hired_at,updated_at)
 values(v_candidate.id,v_role_id,coalesce(v_trial.vacancy_id,v_candidate.vacancy_id),v_candidate.full_name,v_candidate.email,v_candidate.whatsapp,coalesce(v_trial.role_title,v_candidate.profiled_target_role),'active',v_now,v_now)
 on conflict(candidate_id) do update set
 status='active',updated_at=excluded.updated_at,
 role_id=coalesce(excluded.role_id,public.hr_employees.role_id),
 vacancy_id=coalesce(excluded.vacancy_id,public.hr_employees.vacancy_id)
 returning id into v_employee_id;
 update public.hr_candidates set status='hired',decision_status='hired',decision_updated_at=v_now where id=v_candidate.id;
 update public.hr_trial_periods set stage='completed',completed_at=v_now,updated_at=v_now where id=p_trial_id;
 return v_employee_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION studio_hiring_private.finalize(p_trial uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare h public.hr_hiring_cases; t public.hr_trial_periods; employee uuid;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'No autorizado'; end if;
 select * into t from public.hr_trial_periods where id=p_trial for update;
 perform 1 from public.hr_candidates where id=t.candidate_id for update;
 select * into h from public.hr_hiring_cases where trial_id=p_trial for update;
 if h.employee_id is not null then return h.employee_id; end if;
 if h.trial_id is null or t.superseded_at is not null or h.notified_at is null or h.verified_at is null or h.signed_at is null then raise exception 'Falta validar expediente o contrato firmado'; end if;
 if t.stage in ('agreement_sent','agreement_accepted') then
  update public.hr_trial_periods set stage='evaluation_pending' where id=p_trial;
 end if;
 -- Existing RPC owns employee creation and existing history; its candidate trigger now checks the new requirements.
 employee:=studio_hiring_private.hr_confirm_trial_hire(p_trial);
 update public.hr_employees set full_name=h.data->>'full_name',email=case when system_auth_user_id is null and system_username is null then h.data->>'email' else email end,whatsapp=h.data->>'mobile' where id=employee;
 update public.hr_candidates set full_name=h.data->>'full_name',email=h.data->>'email',whatsapp=h.data->>'mobile',municipality=h.data->>'municipality' where id=h.candidate_id;
 insert into public.hr_employee_personal_details(employee_id,data) values(employee,h.data)
 on conflict(employee_id) do update set data=public.hr_employee_personal_details.data||excluded.data,updated_at=now();
 insert into public.hr_employee_documents(employee_id,category,title,file_url)
 select employee,'hiring',case split_part(name,'/',2) when 'front' then 'CI · Anverso' when 'back' then 'CI · Reverso' when 'portrait' then 'Fotografía del trabajador' else 'Documentación académica' end,'hr-hiring-private/'||name from storage.objects where bucket_id='hr-hiring-private' and name like p_trial||'/%';
 insert into public.hr_employee_documents(employee_id,category,title,file_url)
 select employee,'hiring',case x.key when 'front' then 'CI · Anverso' else 'CI · Reverso' end,'hr-identity-private/'||x.value
 from jsonb_each_text(h.inherited_documents) x where not exists(select 1 from storage.objects o where o.bucket_id='hr-hiring-private' and o.name=p_trial||'/'||x.key);
 update public.hr_hiring_cases set employee_id=employee,revoked_at=clock_timestamp() where trial_id=p_trial;
 insert into public.hr_candidate_history(candidate_id,event_type,from_status,to_status,note) values(h.candidate_id,'hiring_finalized','trial','hired','Expediente validado y contrato firmado. Contratación formalizada.');
 return employee;
end $function$
;

