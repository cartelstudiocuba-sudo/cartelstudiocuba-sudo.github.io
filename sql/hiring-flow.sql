-- Approved hiring flow. No existing candidate rows are changed by installation.
create schema if not exists studio_hiring_private;
revoke all on schema studio_hiring_private from public;
grant usage on schema studio_hiring_private to anon, authenticated;
create table public.hr_hiring_cases (
 trial_id uuid primary key references public.hr_trial_periods(id) on delete cascade,
 candidate_id uuid not null references public.hr_candidates(id) on delete cascade,
 role_id uuid not null references public.hr_roles(id),
 token_hash text not null unique, expires_at timestamptz not null, revoked_at timestamptz,
 data jsonb not null default '{}', inherited_documents jsonb not null default '{}', contract jsonb not null,
 revision integer not null default 0, submitted_at timestamptz,
 notified_at timestamptz, verified_at timestamptz, signed_at timestamptz,
 employee_id uuid references public.hr_employees(id), created_at timestamptz not null default now()
);
create index hiring_candidate_idx on public.hr_hiring_cases(candidate_id);
create index hiring_role_idx on public.hr_hiring_cases(role_id);
create unique index hiring_employee_idx on public.hr_hiring_cases(employee_id) where employee_id is not null;
alter table public.hr_hiring_cases enable row level security;
revoke all on public.hr_hiring_cases from anon,authenticated;
grant select on public.hr_hiring_cases to authenticated;
create policy hiring_owner_read on public.hr_hiring_cases for select to authenticated
 using ((select studio_access_private.is_owner()));
grant select on public.hr_employee_personal_details to authenticated;
create policy hiring_personal_owner_read on public.hr_employee_personal_details for select to authenticated
 using ((select studio_access_private.is_owner()));
create function studio_hiring_private.invalidate_on_training_back()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.action in ('message_opened','training_step_back','training_notification_back') then
  update public.hr_hiring_cases set notified_at=null,revoked_at=clock_timestamp() where trial_id=new.trial_id and employee_id is null;
 end if;
 return new;
end $$;
create trigger hiring_training_back after insert on public.hr_trial_closure_events for each row execute function studio_hiring_private.invalidate_on_training_back();

create function studio_hiring_private.current_case(p_token text)
returns public.hr_hiring_cases language sql stable security definer set search_path='' as $$
 select h from public.hr_hiring_cases h join public.hr_trial_periods t on t.id=h.trial_id
 join public.hr_candidates c on c.id=h.candidate_id
 where length(p_token)=64 and h.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')
 and h.expires_at>now() and h.revoked_at is null and t.superseded_at is null
 and (c.status='trial' or (c.status='hired' and h.employee_id is not null))
$$;
revoke all on function studio_hiring_private.current_case(text) from public,anon,authenticated;

create function studio_hiring_private.prepare(p_trial uuid,p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.hr_trial_periods; c public.hr_candidates; h public.hr_hiring_cases; r public.hr_roles; doc jsonb; seed jsonb; decision text; notified text; a record; target_key text;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'No autorizado'; end if;
 if p_token !~ '^[a-f0-9]{64}$' then raise exception 'Token inválido'; end if;
 select * into t from public.hr_trial_periods where id=p_trial for update;
 select * into c from public.hr_candidates where id=t.candidate_id for update;
 if t.id is null or t.superseded_at is not null or c.status<>'trial' then raise exception 'Candidatura no vigente'; end if;
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
   if a.key not in ('document_front_path','document_back_path') and a.value not in ('null'::jsonb,'""'::jsonb) then seed:=seed||jsonb_build_object(a.key,a.value); end if;
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
end $$;

create function studio_hiring_private.read_case(p_token text,p_document boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h public.hr_hiring_cases;
begin
 h:=studio_hiring_private.current_case(p_token);
 if h.trial_id is null then raise exception 'Enlace no válido, caducado o revocado'; end if;
 if p_document then return jsonb_build_object('contract',h.contract,'data',h.data,'revision',h.revision); end if;
 return jsonb_build_object('trial_id',h.trial_id,'data',h.data,'revision',h.revision,'locked',h.verified_at is not null or h.employee_id is not null,'submitted',h.submitted_at is not null,'role_title',h.contract#>>'{role,title}',
 'front',exists(select 1 from storage.objects where (bucket_id='hr-hiring-private' and name=h.trial_id||'/front') or (bucket_id='hr-identity-private' and name=h.inherited_documents->>'front')),
 'back',exists(select 1 from storage.objects where (bucket_id='hr-hiring-private' and name=h.trial_id||'/back') or (bucket_id='hr-identity-private' and name=h.inherited_documents->>'back')),
 'academic',exists(select 1 from storage.objects where bucket_id='hr-hiring-private' and name=h.trial_id||'/academic'));
end $$;

create function studio_hiring_private.submit(p_token text,p_data jsonb,p_revision integer)
returns integer language plpgsql security definer set search_path='' as $$
declare h public.hr_hiring_cases; k text; clean jsonb:='{}';
begin
 h:=studio_hiring_private.current_case(p_token);
 if h.trial_id is null then raise exception 'Enlace no válido, caducado o revocado'; end if;
 select * into h from public.hr_hiring_cases where trial_id=h.trial_id for update;
 if h.verified_at is not null or h.employee_id is not null then raise exception 'Expediente validado; solicita la corrección a RRHH'; end if;
 if p_revision is distinct from h.revision then raise exception 'El expediente cambió. Recarga antes de guardar'; end if;
 if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>24000 then raise exception 'Datos no válidos'; end if;
 foreach k in array array['full_name','identity_number','birth_date','nationality','province','municipality','address','mobile','fixed_phone','email','alternative_address','emergency_name','emergency_relation','emergency_phone','education_level'] loop
  clean:=clean||jsonb_build_object(k,trim(coalesce(p_data->>k,'')));
  if length(clean->>k)>1000 then raise exception 'Campo demasiado largo'; end if;
 end loop;
 foreach k in array array['full_name','nationality','province','municipality','address','mobile','emergency_name','emergency_relation','emergency_phone','education_level'] loop
  if length(clean->>k)<2 then raise exception 'Completa los datos obligatorios: %',k; end if;
 end loop;
 if clean->>'identity_number' !~ '^[0-9]{11}$' then raise exception 'El CI debe tener 11 dígitos'; end if;
 if coalesce(clean->>'birth_date','') !~ '^\d{4}-\d{2}-\d{2}$' or (clean->>'birth_date')::date>current_date or (clean->>'birth_date')::date<date '1900-01-01' then raise exception 'Fecha de nacimiento inválida'; end if;
 if clean->>'mobile' !~ '^\+?[0-9 ()-]{8,24}$' or clean->>'emergency_phone' !~ '^\+?[0-9 ()-]{8,24}$' then raise exception 'Teléfono inválido'; end if;
 if clean->>'email'<>'' and clean->>'email' !~ '^[^ @]+@[^ @]+\.[^ @]+$' then raise exception 'Correo inválido'; end if;
 if p_data->>'truth_confirmed' is distinct from 'true' then raise exception 'Confirma la veracidad'; end if;
 foreach k in array array['front','back'] loop
  if not exists(select 1 from storage.objects where (bucket_id='hr-hiring-private' and name=h.trial_id||'/'||k) or (bucket_id='hr-identity-private' and name=h.inherited_documents->>k)) then raise exception 'Adjunta el anverso y el reverso del CI'; end if;
 end loop;
 clean:=clean||jsonb_build_object('truth_confirmed',true,'academic_required',coalesce(p_data->>'academic_required','false')='true');
 if clean->>'academic_required'='true' and not exists(select 1 from storage.objects where bucket_id='hr-hiring-private' and name=h.trial_id||'/academic') then raise exception 'Adjunta la documentación académica pertinente'; end if;
 update public.hr_hiring_cases set data=clean,revision=revision+1,submitted_at=clock_timestamp(),signed_at=null where trial_id=h.trial_id returning revision into p_revision;
 insert into public.hr_candidate_history(candidate_id,event_type,from_status,to_status,note) values(h.candidate_id,'hiring_file_submitted','trial','trial','Expediente recibido o corregido para revisión.');
 return p_revision;
end $$;

create function studio_hiring_private.manage(p_trial uuid,p_action text,p_revision integer default null)
returns void language plpgsql security definer set search_path='' as $$
declare h public.hr_hiring_cases; t public.hr_trial_periods; c public.hr_candidates; last_action text;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'No autorizado'; end if;
 select * into t from public.hr_trial_periods where id=p_trial for update;
 select * into c from public.hr_candidates where id=t.candidate_id for update;
 select * into h from public.hr_hiring_cases where trial_id=p_trial for update;
 if h.trial_id is null or t.superseded_at is not null or c.status<>'trial' or h.employee_id is not null then raise exception 'Candidatura no vigente'; end if;
 if p_action='notify' then
  select action into last_action from public.hr_trial_closure_events where trial_id=p_trial and action in ('message_opened','training_step_back','training_notification_confirmed','training_notification_back') order by created_at desc,id desc limit 1;
  if last_action is distinct from 'training_notification_confirmed' or h.revoked_at is not null or h.expires_at<=now() then raise exception 'Actualiza la etapa o renueva los enlaces'; end if;
  if h.notified_at is not null then return; end if;
  update public.hr_hiring_cases set notified_at=clock_timestamp() where trial_id=p_trial;
 elsif p_action='back' then
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
 insert into public.hr_candidate_history(candidate_id,event_type,from_status,to_status,note) values(c.id,'hiring_'||p_action,c.status,c.status,'Contratación: '||p_action||'. Versión '||h.revision);
end $$;

-- Same guard covers the old hiring RPC and direct transitions to hired.
create function studio_hiring_private.require_validated_hire()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='hired' and old.status is distinct from 'hired' and not exists(
  select 1 from public.hr_hiring_cases h join public.hr_trial_periods t on t.id=h.trial_id
  where h.candidate_id=new.id and t.superseded_at is null and h.notified_at is not null
  and h.verified_at is not null and h.signed_at is not null and h.submitted_at is not null)
 then raise exception 'Valida el expediente y el contrato firmado antes de contratar'; end if;
 return new;
end $$;
create trigger hiring_validation_guard before update of status on public.hr_candidates for each row execute function studio_hiring_private.require_validated_hire();

-- Keep a single public hiring entry point. The previous implementation becomes
-- an internal helper, so legacy screens cannot skip copying the received file.
alter function public.hr_confirm_trial_hire(uuid) set schema studio_hiring_private;
revoke all on function studio_hiring_private.hr_confirm_trial_hire(uuid) from public,anon,authenticated;
create function studio_hiring_private.finalize(p_trial uuid)
returns uuid language plpgsql security definer set search_path='' as $$
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
 update public.hr_employees set full_name=h.data->>'full_name',email=h.data->>'email',whatsapp=h.data->>'mobile' where id=employee;
 update public.hr_candidates set full_name=h.data->>'full_name',email=h.data->>'email',whatsapp=h.data->>'mobile',municipality=h.data->>'municipality' where id=h.candidate_id;
 insert into public.hr_employee_personal_details(employee_id,data) values(employee,h.data)
 on conflict(employee_id) do update set data=public.hr_employee_personal_details.data||excluded.data,updated_at=now();
 insert into public.hr_employee_documents(employee_id,category,title,file_url)
 select employee,'hiring',case split_part(name,'/',2) when 'front' then 'CI · Anverso' when 'back' then 'CI · Reverso' else 'Documentación académica' end,'hr-hiring-private/'||name from storage.objects where bucket_id='hr-hiring-private' and name like p_trial||'/%';
 insert into public.hr_employee_documents(employee_id,category,title,file_url)
 select employee,'hiring',case x.key when 'front' then 'CI · Anverso' else 'CI · Reverso' end,'hr-identity-private/'||x.value
 from jsonb_each_text(h.inherited_documents) x where not exists(select 1 from storage.objects o where o.bucket_id='hr-hiring-private' and o.name=p_trial||'/'||x.key);
 update public.hr_hiring_cases set employee_id=employee,revoked_at=clock_timestamp() where trial_id=p_trial;
 insert into public.hr_candidate_history(candidate_id,event_type,from_status,to_status,note) values(h.candidate_id,'hiring_finalized','trial','hired','Expediente validado y contrato firmado. Contratación formalizada.');
 return employee;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('hr-hiring-private','hr-hiring-private',false,5242880,array['image/jpeg','image/png','application/pdf']);
create function studio_hiring_private.file_allowed(p_path text,p_write boolean)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare h public.hr_hiring_cases; tok text;
begin
 if auth.uid() is not null and coalesce(studio_access_private.is_owner(),false) then return not p_write; end if;
 tok:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-hiring-token','');
 h:=studio_hiring_private.current_case(tok);
 return h.trial_id is not null and h.employee_id is null and h.verified_at is null and p_path in(h.trial_id||'/front',h.trial_id||'/back',h.trial_id||'/academic');
end $$;
create policy hiring_files_select on storage.objects for select to anon,authenticated using(bucket_id='hr-hiring-private' and studio_hiring_private.file_allowed(name,false));
create policy hiring_files_insert on storage.objects for insert to anon,authenticated with check(bucket_id='hr-hiring-private' and studio_hiring_private.file_allowed(name,true));
create policy hiring_files_update on storage.objects for update to anon,authenticated using(bucket_id='hr-hiring-private' and studio_hiring_private.file_allowed(name,true)) with check(bucket_id='hr-hiring-private' and studio_hiring_private.file_allowed(name,true));
-- Serialize file replacements with validation. Every Storage change invalidates
-- the submitted version; a reviewed document cannot change underneath RRHH.
create function studio_hiring_private.file_changed()
returns trigger language plpgsql security definer set search_path='' as $$
declare h public.hr_hiring_cases;
begin
 if new.bucket_id<>'hr-hiring-private' then return new; end if;
 select * into h from public.hr_hiring_cases where trial_id::text=split_part(new.name,'/',1) for update;
 if h.trial_id is null or h.verified_at is not null or h.employee_id is not null then raise exception 'Expediente validado o inexistente'; end if;
 update public.hr_hiring_cases set revision=revision+1,submitted_at=null,signed_at=null where trial_id=h.trial_id;
 return new;
end $$;
create trigger hiring_file_revision before insert or update on storage.objects for each row execute function studio_hiring_private.file_changed();

create function public.hr_prepare_hiring(p_trial uuid,p_token text) returns jsonb language sql set search_path='' as $$select studio_hiring_private.prepare(p_trial,p_token)$$;
create function public.hr_read_hiring(p_token text,p_document boolean default false) returns jsonb language sql set search_path='' as $$select studio_hiring_private.read_case(p_token,p_document)$$;
create function public.hr_submit_hiring(p_token text,p_data jsonb,p_revision integer) returns integer language sql set search_path='' as $$select studio_hiring_private.submit(p_token,p_data,p_revision)$$;
create function public.hr_manage_hiring(p_trial uuid,p_action text,p_revision integer default null) returns void language sql set search_path='' as $$select studio_hiring_private.manage(p_trial,p_action,p_revision)$$;
create function public.hr_finalize_hiring(p_trial uuid) returns uuid language sql set search_path='' as $$select studio_hiring_private.finalize(p_trial)$$;
create function public.hr_confirm_trial_hire(p_trial_id uuid) returns uuid language sql set search_path='' as $$select studio_hiring_private.finalize(p_trial_id)$$;
revoke all on all functions in schema studio_hiring_private from public,anon,authenticated;
revoke all on function public.hr_prepare_hiring(uuid,text),public.hr_read_hiring(text,boolean),public.hr_submit_hiring(text,jsonb,integer),public.hr_manage_hiring(uuid,text,integer),public.hr_finalize_hiring(uuid),public.hr_confirm_trial_hire(uuid) from public,anon,authenticated;
grant execute on function studio_hiring_private.prepare(uuid,text),studio_hiring_private.manage(uuid,text,integer),studio_hiring_private.finalize(uuid),public.hr_prepare_hiring(uuid,text),public.hr_manage_hiring(uuid,text,integer),public.hr_finalize_hiring(uuid),public.hr_confirm_trial_hire(uuid) to authenticated;
grant execute on function studio_hiring_private.read_case(text,boolean),studio_hiring_private.submit(text,jsonb,integer),studio_hiring_private.file_allowed(text,boolean),public.hr_read_hiring(text,boolean),public.hr_submit_hiring(text,jsonb,integer) to anon,authenticated;
notify pgrst,'reload schema';


