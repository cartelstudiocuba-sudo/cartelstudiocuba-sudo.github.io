-- Expediente único: additive upgrade. No candidate records are changed at installation.
alter table public.hr_hiring_cases add column if not exists confirmed_fields text[] not null default '{}';
create or replace function studio_hiring_private.consolidated(h public.hr_hiring_cases)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare seed jsonb; a record; k text; c public.hr_candidates;
begin
 select * into c from public.hr_candidates where id=h.candidate_id;
 seed:=jsonb_strip_nulls(jsonb_build_object('full_name',c.full_name,'mobile',c.whatsapp,'email',nullif(trim(c.email),''),'municipality',nullif(trim(c.municipality),'')));
 for a in select question_key,answer#>>'{}' value from public.hr_candidate_answers where candidate_id=c.id and jsonb_typeof(answer) in ('string','boolean','number') order by (question_key like 'interview_%'),created_at,id loop
  k:=case a.question_key when 'education' then 'education_level' when 'interview_education' then 'education_level' when 'interview_identity_card' then 'identity_number' when 'identity_card' then 'identity_number' when 'interview_identity_number' then 'identity_number' when 'interview_home_address' then 'address' when 'home_address' then 'address' when 'interview_address' then 'address' when 'interview_landline_phone' then 'fixed_phone' when 'landline_phone' then 'fixed_phone' when 'interview_landline' then 'fixed_phone' when 'interview_residence_municipality' then 'municipality' when 'interview_marital_status' then 'civil_status' when 'interview_civil_status' then 'civil_status' when 'interview_has_children' then 'has_children' when 'interview_care_responsibilities' then 'care_responsibilities' when 'interview_planned_absence' then 'planned_absence' when 'interview_email' then 'email' else a.question_key end;
  if k=any(array['full_name','identity_number','birth_date','nationality','province','municipality','address','mobile','fixed_phone','email','alternative_address','emergency_name','emergency_relation','emergency_phone','education_level','civil_status','has_children','care_responsibilities','planned_absence']) and length(trim(a.value))>0 then seed:=seed||jsonb_build_object(k,a.value);end if;
 end loop;
 for a in select x.key,x.value from public.hr_trial_closures cl cross join lateral jsonb_each(cl.data) x where cl.trial_id=h.trial_id loop
  if a.key=any(array['full_name','identity_number','birth_date','nationality','province','municipality','address','mobile','fixed_phone','email','alternative_address','emergency_name','emergency_relation','emergency_phone','education_level','civil_status','has_children','care_responsibilities','planned_absence']) and a.value not in ('null'::jsonb,'""'::jsonb) then seed:=seed||jsonb_build_object(a.key,a.value);end if;
 end loop;
 -- Previously submitted/confirmed fields always win, including an explicit optional deletion.
 for a in select key,value from jsonb_each(h.data) loop
  if a.key=any(array['full_name','identity_number','birth_date','nationality','province','municipality','address','mobile','fixed_phone','email','alternative_address','emergency_name','emergency_relation','emergency_phone','education_level','civil_status','has_children','care_responsibilities','planned_absence']) and (a.key=any(h.confirmed_fields) or h.submitted_at is not null or h.data->>'truth_confirmed'='true' or not seed?a.key) then seed:=seed||jsonb_build_object(a.key,a.value);end if;
 end loop;
 return seed;
end $$;
revoke all on function studio_hiring_private.consolidated(public.hr_hiring_cases) from public,anon,authenticated;
create or replace function studio_hiring_private.read_case(p_token text,p_document boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h public.hr_hiring_cases;
begin
 h:=studio_hiring_private.current_case(p_token);
 if h.trial_id is null then raise exception 'Enlace no válido, caducado o revocado'; end if;
 if p_document then return jsonb_build_object('contract',h.contract,'data',studio_hiring_private.consolidated(h),'revision',h.revision); end if;
 return jsonb_build_object('trial_id',h.trial_id,'data',studio_hiring_private.consolidated(h),'revision',h.revision,'locked',h.verified_at is not null or h.employee_id is not null,'submitted',h.submitted_at is not null,'role_title',h.contract#>>'{role,title}',
 'front',exists(select 1 from storage.objects where (bucket_id='hr-hiring-private' and name=h.trial_id||'/front') or (bucket_id='hr-identity-private' and name=h.inherited_documents->>'front')),
 'back',exists(select 1 from storage.objects where (bucket_id='hr-hiring-private' and name=h.trial_id||'/back') or (bucket_id='hr-identity-private' and name=h.inherited_documents->>'back')),
 'portrait',exists(select 1 from storage.objects where bucket_id='hr-hiring-private' and name=h.trial_id||'/portrait'));
end $$;

create or replace function studio_hiring_private.submit(p_token text,p_data jsonb,p_revision integer)
returns integer language plpgsql security definer set search_path='' as $$
declare h public.hr_hiring_cases; k text; clean jsonb:='{}';
begin
 h:=studio_hiring_private.current_case(p_token);
 if h.trial_id is null then raise exception 'Enlace no válido, caducado o revocado'; end if;
 select * into h from public.hr_hiring_cases where trial_id=h.trial_id for update;
 if h.token_hash is distinct from encode(sha256(convert_to(p_token,'UTF8')),'hex') or h.revoked_at is not null or h.expires_at<=now() or (studio_hiring_private.current_case(p_token)).trial_id is null then raise exception 'Enlace no válido, caducado o revocado';end if;
 if h.verified_at is not null or h.employee_id is not null then raise exception 'Expediente validado; solicita la corrección a RRHH'; end if;
 if p_revision is distinct from h.revision then raise exception 'El expediente cambió. Recarga antes de guardar'; end if;
 if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>48000 then raise exception 'Datos no válidos'; end if;
 clean:=h.data;
 if p_data->'_baseline' is distinct from studio_hiring_private.consolidated(h) then raise exception 'Los datos de origen cambiaron. Recarga antes de guardar';end if;
 foreach k in array array['full_name','identity_number','birth_date','nationality','province','municipality','address','mobile','fixed_phone','email','alternative_address','emergency_name','emergency_relation','emergency_phone','education_level','civil_status','has_children','care_responsibilities','planned_absence'] loop
  clean:=clean||jsonb_build_object(k,trim(coalesce(p_data->>k,'')));
  if length(clean->>k)>1000 then raise exception 'Campo demasiado largo'; end if;
 end loop;
 foreach k in array array['email','full_name','nationality','province','municipality','address','mobile','emergency_name','emergency_relation','emergency_phone','education_level'] loop
  if length(clean->>k)<2 then raise exception 'Completa los datos obligatorios: %',k; end if;
 end loop;
 if clean->>'identity_number' !~ '^[0-9]{11}$' then raise exception 'El CI debe tener 11 dígitos'; end if;
 if coalesce(clean->>'birth_date','') !~ '^\d{4}-\d{2}-\d{2}$' or (clean->>'birth_date')::date>current_date or (clean->>'birth_date')::date<date '1900-01-01' then raise exception 'Fecha de nacimiento inválida'; end if;
 if clean->>'mobile' !~ '^\+?[0-9 ()-]{8,24}$' or clean->>'emergency_phone' !~ '^\+?[0-9 ()-]{8,24}$' then raise exception 'Teléfono inválido'; end if;
 if clean->>'email' !~ '^[^ @]+@[^ @]+\.[^ @]+$' then raise exception 'Correo inválido'; end if;
 if not coalesce(('{"Pinar del Río": ["Consolación del Sur", "Guane", "La Palma", "Los Palacios", "Mantua", "Minas de Matahambre", "Pinar del Río", "San Juan y Martínez", "San Luis", "Sandino", "Viñales"], "Artemisa": ["Alquízar", "Artemisa", "Bauta", "Caimito", "Guanajay", "Güira de Melena", "Mariel", "San Antonio de los Baños", "Bahía Honda", "San Cristóbal", "Candelaria"], "Mayabeque": ["Batabanó", "Bejucal", "Güines", "Jaruco", "Madruga", "Melena del Sur", "Nueva Paz", "Quivicán", "San José de las Lajas", "San Nicolás de Bari", "Santa Cruz del Norte"], "La Habana": ["Arroyo Naranjo", "Boyeros", "Centro Habana", "Cerro", "Cotorro", "Diez de Octubre", "Guanabacoa", "Habana del Este", "Habana Vieja", "La Lisa", "Marianao", "Playa", "Plaza de la Revolución", "Regla", "San Miguel del Padrón"], "Matanzas": ["Calimete", "Cárdenas", "Ciénaga de Zapata", "Colón", "Jagüey Grande", "Jovellanos", "Limonar", "Los Arabos", "Martí", "Matanzas", "Pedro Betancourt", "Perico", "Unión de Reyes"], "Cienfuegos": ["Abreus", "Aguada de Pasajeros", "Cienfuegos", "Cruces", "Cumanayagua", "Palmira", "Rodas", "Santa Isabel de las Lajas"], "Villa Clara": ["Caibarién", "Camajuaní", "Cifuentes", "Corralillo", "Encrucijada", "Manicaragua", "Placetas", "Quemado de Güines", "Ranchuelo", "Remedios", "Sagua la Grande", "Santa Clara", "Santo Domingo"], "Sancti Spíritus": ["Cabaigúan", "Fomento", "Jatibonico", "La Sierpe", "Sancti Spíritus", "Taguasco", "Trinidad", "Yaguajay"], "Ciego de Ávila": ["Ciro Redondo", "Baraguá", "Bolivia", "Chambas", "Ciego de Ávila", "Florencia", "Majagua", "Morón", "Primero de Enero", "Venezuela"], "Camagüey": ["Camagüey", "Carlos Manuel de Céspedes", "Esmeralda", "Florida", "Guáimaro", "Jimagüayú", "Minas", "Najasa", "Nuevitas", "Santa Cruz del Sur", "Sibanicú", "Sierra de Cubitas", "Vertientes"], "Las Tunas": ["Amancio Rodríguez", "Colombia", "Jesús Menéndez", "Jobabo", "Las Tunas", "Majibacoa", "Manatí", "Puerto Padre"], "Holguín": ["Antilla", "Báguanos", "Banes", "Cacocum", "Calixto García", "Cueto", "Frank País", "Gibara", "Holguín", "Mayarí", "Moa", "Rafael Freyre", "Sagua de Tánamo", "Urbano Noris"], "Santiago de Cuba": ["Contramaestre", "Guamá", "Julio Antonio Mella", "Palma Soriano", "San Luis", "Santiago de Cuba", "Segundo Frente", "Songo la Maya", "Tercer Frente"], "Guantánamo": ["Baracoa", "Caimanera", "El Salvador", "Guantánamo", "Imías", "Maisí", "Manuel Tames", "Niceto Pérez", "San Antonio del Sur", "Yateras"], "Isla de la Juventud": ["Isla de la Juventud"], "Granma": ["Bartolomé Masó", "Bayamo", "Buey Arriba", "Campechuela", "Cauto Cristo", "Guisa", "Jiguaní", "Manzanillo", "Media Luna", "Niquero", "Pilón", "Río Cauto", "Yara"]}'::jsonb->(clean->>'province')) ? (clean->>'municipality'),false) then raise exception 'Selecciona provincia y municipio válidos';end if;
 if clean->>'education_level' not in ('Primaria','Secundaria','Técnico medio','Bachiller','Bachiller técnico','Universitario','Máster','Doctor','Otro') then raise exception 'Selecciona el nivel de escolaridad';end if;
 if clean->>'emergency_relation' not in ('Madre','Padre','Hermana','Hermano','Hija','Hijo','Cónyuge','Pareja','Abuela','Abuelo','Tía','Tío','Prima','Primo','Amistad','Otro') then raise exception 'Selecciona el parentesco';end if;
 if p_data->>'truth_confirmed' is distinct from 'true' then raise exception 'Confirma la veracidad'; end if;
 foreach k in array array['front','back'] loop
  if not exists(select 1 from storage.objects where (bucket_id='hr-hiring-private' and name=h.trial_id||'/'||k) or (bucket_id='hr-identity-private' and name=h.inherited_documents->>k)) then raise exception 'Adjunta el anverso y el reverso del CI'; end if;
 end loop;
 clean:=clean||jsonb_build_object('truth_confirmed',true);
 if not exists(select 1 from storage.objects where bucket_id='hr-hiring-private' and name=h.trial_id||'/portrait') then raise exception 'Adjunta la fotografía del trabajador';end if;
 update public.hr_hiring_cases set data=clean,confirmed_fields=array['full_name','identity_number','birth_date','nationality','province','municipality','address','mobile','fixed_phone','email','alternative_address','emergency_name','emergency_relation','emergency_phone','education_level','civil_status','has_children','care_responsibilities','planned_absence'],revision=revision+1,submitted_at=clock_timestamp(),signed_at=null where trial_id=h.trial_id returning revision into p_revision;
 insert into public.hr_candidate_history(candidate_id,event_type,from_status,to_status,note) values(h.candidate_id,'hiring_file_submitted','trial','trial','Expediente recibido o corregido para revisión.');
 return p_revision;
end $$;

create or replace function studio_hiring_private.file_allowed(p_path text,p_write boolean)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare h public.hr_hiring_cases; tok text;
begin
 if auth.uid() is not null and coalesce(studio_access_private.is_owner(),false) then return not p_write; end if;
 tok:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-hiring-token','');
 h:=studio_hiring_private.current_case(tok);
 return h.trial_id is not null and h.employee_id is null and h.verified_at is null and p_path in(h.trial_id||'/front',h.trial_id||'/back',h.trial_id||'/portrait');
end $$;

create or replace function studio_hiring_private.file_changed()
returns trigger language plpgsql security definer set search_path='' as $$
declare h public.hr_hiring_cases;
begin
 if new.bucket_id<>'hr-hiring-private' then return new; end if;
 select * into h from public.hr_hiring_cases where trial_id::text=split_part(new.name,'/',1) for update;
 if h.trial_id is null or h.verified_at is not null or h.employee_id is not null then raise exception 'Expediente validado o inexistente'; end if;
 if coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-hiring-revision','') is distinct from h.revision::text then raise exception 'El expediente cambió. Recarga antes de guardar';end if;
 if h.revoked_at is not null or h.expires_at<=now() or h.token_hash is distinct from encode(sha256(convert_to(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-hiring-token',''),'UTF8')),'hex') then raise exception 'Enlace no válido, caducado o revocado';end if;
 if not studio_hiring_private.file_allowed(new.name,true) then raise exception 'No autorizado';end if;
 if coalesce(new.metadata->>'mimetype','') not in ('image/jpeg','image/png') then raise exception 'Adjunta una imagen JPG o PNG';end if;
 update public.hr_hiring_cases set revision=revision+1,submitted_at=null,signed_at=null where trial_id=h.trial_id;
 return new;
end $$;

create or replace function studio_hiring_private.finalize(p_trial uuid)
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
 select employee,'hiring',case split_part(name,'/',2) when 'front' then 'CI · Anverso' when 'back' then 'CI · Reverso' when 'portrait' then 'Fotografía del trabajador' else 'Documentación académica' end,'hr-hiring-private/'||name from storage.objects where bucket_id='hr-hiring-private' and name like p_trial||'/%';
 insert into public.hr_employee_documents(employee_id,category,title,file_url)
 select employee,'hiring',case x.key when 'front' then 'CI · Anverso' else 'CI · Reverso' end,'hr-identity-private/'||x.value
 from jsonb_each_text(h.inherited_documents) x where not exists(select 1 from storage.objects o where o.bucket_id='hr-hiring-private' and o.name=p_trial||'/'||x.key);
 update public.hr_hiring_cases set employee_id=employee,revoked_at=clock_timestamp() where trial_id=p_trial;
 insert into public.hr_candidate_history(candidate_id,event_type,from_status,to_status,note) values(h.candidate_id,'hiring_finalized','trial','hired','Expediente validado y contrato firmado. Contratación formalizada.');
 return employee;
end $$;
create or replace function studio_hiring_private.prepare(p_trial uuid,p_token text)
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
end $$;
-- AFTER runs once for the actual row mutation, including INSERT ... ON CONFLICT UPDATE.
-- A BEFORE INSERT trigger would also fire for the attempted insertion of an upsert.
drop trigger hiring_file_revision on storage.objects;
create trigger hiring_file_revision after insert or update on storage.objects for each row execute function studio_hiring_private.file_changed();
notify pgrst, 'reload schema';
