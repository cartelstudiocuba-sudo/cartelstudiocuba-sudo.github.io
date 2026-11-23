alter table public.hr_hiring_cases add column if not exists submission_baseline jsonb;

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
 update public.hr_hiring_cases set data=clean,submission_baseline=p_data->'_baseline',confirmed_fields=array['full_name','identity_number','birth_date','nationality','province','municipality','address','mobile','fixed_phone','email','alternative_address','emergency_name','emergency_relation','emergency_phone','education_level','civil_status','has_children','care_responsibilities','planned_absence'],revision=revision+1,submitted_at=clock_timestamp(),signed_at=null where trial_id=h.trial_id returning revision into p_revision;
 insert into public.hr_candidate_history(candidate_id,event_type,from_status,to_status,note) values(h.candidate_id,'hiring_file_submitted','trial','trial','Expediente recibido o corregido para revisión.');
 return p_revision;
end $function$;

create or replace function public.hr_hiring_validation_changes(p_trial uuid, p_revision integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 dossier public.hr_hiring_cases;
 source_case public.hr_hiring_cases;
 baseline jsonb;
 changes jsonb;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then
  raise exception 'No autorizado' using errcode='42501';
 end if;
 select * into dossier from public.hr_hiring_cases where trial_id=p_trial;
 if dossier.submitted_at is null or dossier.revision is distinct from p_revision then
  raise exception 'Actualiza el expediente para revisar la última versión recibida';
 end if;
 baseline:=dossier.submission_baseline;
 if baseline is null then
  source_case:=dossier;
  source_case.data:='{}'::jsonb;
  baseline:=studio_hiring_private.consolidated(source_case);
 end if;
 select coalesce(jsonb_object_agg(field.key,field.value),'{}'::jsonb) into changes
 from jsonb_each(dossier.data) as field
 where field.key=any(array['full_name','identity_number','birth_date','nationality','province','municipality','address','mobile','fixed_phone','email','alternative_address','emergency_name','emergency_relation','emergency_phone','emergency_address','education_level','civil_status','has_children','care_responsibilities','planned_absence'])
 and coalesce(nullif(btrim(field.value#>>'{}'),''),'') is distinct from coalesce(nullif(btrim(baseline->>field.key),''),'');
 return changes;
end $$;
revoke all on function public.hr_hiring_validation_changes(uuid,integer) from public,anon;
grant execute on function public.hr_hiring_validation_changes(uuid,integer) to authenticated;
