begin;

create function studio_hiring_private.requires_emergency_address(p_contract jsonb)
returns boolean language sql immutable set search_path='' as $$
 select exists(
  select 1 from jsonb_array_elements(coalesce(p_contract#>'{template,annexes}','[]')) annex
  where annex->>'type'='worker_data' and (annex->>'included') is distinct from 'false'
   and (annex->'fields' is null or exists(
    select 1 from jsonb_array_elements(annex->'fields') field
    where field->>'id'='emergency_address' and field->>'type' is distinct from 'section'
   ))
 );
$$;
revoke all on function studio_hiring_private.requires_emergency_address(jsonb) from public,anon,authenticated;

create function studio_hiring_private.contract_identity_images(h public.hr_hiring_cases)
returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_object_agg(side,document),'{}'::jsonb)
 from unnest(array['front','back']) side
 cross join lateral (
  select jsonb_build_object('bucket',o.bucket_id,'path',o.name) as document
  from storage.objects o
  where (o.bucket_id='hr-hiring-private' and o.name=h.trial_id||'/'||side)
     or (o.bucket_id='hr-identity-private' and o.name=h.inherited_documents->>side)
  order by (o.bucket_id='hr-hiring-private') desc
  limit 1
 ) image
 where exists(select 1 from jsonb_array_elements(coalesce(h.contract#>'{template,annexes}','[]')) annex
  where annex->>'type'='identity_copy' and (annex->>'included') is distinct from 'false');
$$;
revoke all on function studio_hiring_private.contract_identity_images(public.hr_hiring_cases) from public,anon,authenticated;

create function studio_hiring_private.contract_identity_read(p_bucket text,p_path text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from studio_hiring_private.current_case(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-hiring-token','')) h
  where h.trial_id is not null
   and (h.signed_at is null or exists(
    select 1 from jsonb_each(coalesce(h.contract->'signed_identity_images','{}')) image
    where image.value->>'bucket'=p_bucket and image.value->>'path'=p_path
   ))
   and ((p_bucket='hr-hiring-private' and p_path in (h.trial_id||'/front',h.trial_id||'/back'))
    or (p_bucket='hr-identity-private' and p_path in(h.inherited_documents->>'front',h.inherited_documents->>'back')))
   and exists(select 1 from jsonb_array_elements(coalesce(h.contract#>'{template,annexes}','[]')) annex
    where annex->>'type'='identity_copy' and (annex->>'included') is distinct from 'false')
 );
$$;
revoke all on function studio_hiring_private.contract_identity_read(text,text) from public,anon,authenticated;
grant execute on function studio_hiring_private.contract_identity_read(text,text) to anon,authenticated;
create policy hiring_contract_identity_select on storage.objects for select to anon,authenticated
 using(bucket_id in ('hr-hiring-private','hr-identity-private') and studio_hiring_private.contract_identity_read(bucket_id,name));

CREATE OR REPLACE FUNCTION studio_hiring_private.consolidated(h hr_hiring_cases)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 return seed||jsonb_strip_nulls(jsonb_build_object('emergency_address',h.data->'emergency_address'));
end $function$;
CREATE OR REPLACE FUNCTION studio_hiring_private.form_view(h hr_hiring_cases)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select jsonb_build_object(
  'trial_id',h.trial_id,
  'data',studio_hiring_private.consolidated(h),
  'revision',h.revision,
  'locked',h.verified_at is not null or h.employee_id is not null,
  'submitted',h.submitted_at is not null,
  'requires_emergency_address',studio_hiring_private.requires_emergency_address(h.contract),
  'role_title',h.contract#>>'{role,title}',
  'front',exists(select 1 from storage.objects where (bucket_id='hr-hiring-private' and name=h.trial_id||'/front') or (bucket_id='hr-identity-private' and name=h.inherited_documents->>'front')),
  'back',exists(select 1 from storage.objects where (bucket_id='hr-hiring-private' and name=h.trial_id||'/back') or (bucket_id='hr-identity-private' and name=h.inherited_documents->>'back')),
  'portrait',exists(select 1 from storage.objects where bucket_id='hr-hiring-private' and name=h.trial_id||'/portrait')
 );
$function$;
CREATE OR REPLACE FUNCTION studio_hiring_private.read_case(p_token text, p_document boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare h public.hr_hiring_cases;
begin
 h:=studio_hiring_private.current_case(p_token);
 if h.trial_id is null then raise exception 'Enlace no válido, caducado o revocado'; end if;
 if p_document then
  return jsonb_build_object('contract',case when h.signed_at is null then h.contract||jsonb_build_object('renderer_version',2) else h.contract end,
   'data',case when h.signed_at is not null then coalesce(h.contract->'signed_data',h.data) else studio_hiring_private.consolidated(h) end,'revision',h.revision,
   'signed',h.signed_at is not null,'locked',h.verified_at is not null or h.employee_id is not null,
   'identity_images',case when h.signed_at is null then studio_hiring_private.contract_identity_images(h) else coalesce(h.contract->'signed_identity_images','{}'::jsonb) end);
 end if;
 return studio_hiring_private.form_view(h);
end $function$;
CREATE OR REPLACE FUNCTION studio_hiring_private.submit(p_token text, p_data jsonb, p_revision integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 if studio_hiring_private.requires_emergency_address(h.contract) then
  clean:=clean||jsonb_build_object('emergency_address',trim(coalesce(p_data->>'emergency_address',clean->>'emergency_address','')));
  if length(clean->>'emergency_address') not between 2 and 1000 then raise exception 'Completa la dirección del contacto de emergencia'; end if;
 end if;
 if p_data->>'truth_confirmed' is distinct from 'true' then raise exception 'Confirma la veracidad'; end if;
 foreach k in array array['front','back'] loop
  if not exists(select 1 from storage.objects where (bucket_id='hr-hiring-private' and name=h.trial_id||'/'||k) or (bucket_id='hr-identity-private' and name=h.inherited_documents->>k)) then raise exception 'Adjunta el anverso y el reverso del CI'; end if;
 end loop;
 clean:=clean||jsonb_build_object('truth_confirmed',true);
 if not exists(select 1 from storage.objects where bucket_id='hr-hiring-private' and name=h.trial_id||'/portrait') then raise exception 'Adjunta la fotografía del trabajador';end if;
 update public.hr_hiring_cases set data=clean,confirmed_fields=array['full_name','identity_number','birth_date','nationality','province','municipality','address','mobile','fixed_phone','email','alternative_address','emergency_name','emergency_relation','emergency_phone','education_level','civil_status','has_children','care_responsibilities','planned_absence'],revision=revision+1,submitted_at=clock_timestamp(),signed_at=null where trial_id=h.trial_id returning revision into p_revision;
 insert into public.hr_candidate_history(candidate_id,event_type,from_status,to_status,note) values(h.candidate_id,'hiring_file_submitted','trial','trial','Expediente recibido o corregido para revisión.');
 return p_revision;
end $function$;

CREATE OR REPLACE FUNCTION studio_hiring_private.version_contract()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  new.contract:=new.contract||jsonb_build_object(
   'signed_data',studio_hiring_private.consolidated(new),
   'signed_identity_images',studio_hiring_private.contract_identity_images(new),
   'renderer_version',3
  );
 end if;
 return new;
end $function$;

commit;
