-- Drafts are not workers. Finalization inserts only into the existing labor register.
create table studio_access_private.employee_drafts(id uuid primary key default gen_random_uuid(),created_by uuid not null,data jsonb not null default '{}',revision integer not null default 1,employee_id uuid references public.hr_employees(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table studio_access_private.employee_drafts enable row level security;
revoke all on studio_access_private.employee_drafts from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('hr-employee-private','hr-employee-private',false,15728640,array['application/pdf','image/jpeg','image/png','image/webp']);
create policy direct_employee_documents_read on storage.objects for select to authenticated using(bucket_id='hr-employee-private' and (select studio_access_private.is_owner()));
-- Storage policy reads only a narrow owner-checked predicate, not a client table grant.
create function studio_access_private.employee_draft_open(p_path text) returns boolean language sql security definer set search_path='' as $$select auth.uid() is not null and coalesce(studio_access_private.is_owner(),false) and exists(select 1 from studio_access_private.employee_drafts where id::text=split_part(p_path,'/',1) and employee_id is null)$$;
revoke all on function studio_access_private.employee_draft_open(text) from public,anon;
grant execute on function studio_access_private.employee_draft_open(text) to authenticated;
create policy direct_employee_documents_insert on storage.objects for insert to authenticated with check(bucket_id='hr-employee-private' and studio_access_private.employee_draft_open(name));

create function studio_access_private.direct_employee(p_action text,p_draft uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare d studio_access_private.employee_drafts%rowtype;e public.hr_employees%rowtype;r public.hr_roles%rowtype;v jsonb;doc jsonb;asset jsonb;duplicates jsonb;email text;identity text;username text;auth_id uuid;full_name text;personal jsonb;prepare boolean;lock_key text;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'Solo propietario autorizado' using errcode='42501';end if;
 if p_action='list' then return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',data->>'full_name','updated_at',updated_at,'revision',revision) order by updated_at desc) from studio_access_private.employee_drafts where employee_id is null),'[]');end if;
 if p_action='new' then insert into studio_access_private.employee_drafts(created_by) values(auth.uid()) returning * into d;return to_jsonb(d);end if;
 select * into d from studio_access_private.employee_drafts where id=p_draft for update;if not found then raise exception 'Borrador no disponible';end if;
 if p_action='read' then return to_jsonb(d);end if;
 if d.employee_id is not null then return jsonb_build_object('employee_id',d.employee_id,'id',d.id,'created',true);end if;
 if (p_payload->>'revision')::integer is distinct from d.revision then raise exception 'El borrador cambió. Ábrelo de nuevo antes de guardar';end if;
 if p_action='save' then
  v:=p_payload->'data';if jsonb_typeof(v)<>'object' or pg_column_size(v)>150000 then raise exception 'Datos de expediente no válidos';end if;
  update studio_access_private.employee_drafts set data=v,revision=revision+1,updated_at=now() where id=d.id returning * into d;
  insert into studio_access_private.permission_audit(actor_id,kind,target,after_data) values(auth.uid(),'employee_draft_saved',d.id::text,jsonb_build_object('revision',d.revision));return to_jsonb(d);
 end if;
 if p_action not in ('check','create','create_access') then raise exception 'Acción no admitida';end if;
 v:=d.data;email:=nullif(lower(btrim(v->>'email')),'');identity:=nullif(regexp_replace(coalesce(v->'personal'->>'identity_number',''),'[^A-Za-z0-9]','','g'),'');username:=nullif(lower(btrim(v->'access'->>'username')),'');full_name:=btrim(coalesce(v->>'full_name',''));
 -- Serialize duplicate checks even when neither record exists yet.
 for lock_key in select k from unnest(array[case when identity is not null then 'identity:'||upper(identity) end,case when email is not null then 'email:'||email end,case when username is not null then 'username:'||username end]) k where k is not null order by k loop perform pg_advisory_xact_lock(hashtextextended(lock_key,0));end loop;
 duplicates:=coalesce((select jsonb_agg(jsonb_build_object('employee_id',x.id,'full_name',x.full_name,'email',x.email,'username',x.system_username)) from public.hr_employees x left join public.hr_employee_personal_details pd on pd.employee_id=x.id where (email is not null and lower(x.email)=email) or (username is not null and lower(x.system_username)=username) or (identity is not null and upper(regexp_replace(coalesce(pd.data->>'identity_number',''),'[^A-Za-z0-9]','','g'))=upper(identity))),'[]');
 select id into auth_id from auth.users where lower(auth.users.email)=email and deleted_at is null;
 if p_action='check' then return jsonb_build_object('employees',duplicates,'existing_auth_id',auth_id,'documents',jsonb_array_length(coalesce(v->'documents','[]')),'identity_missing',identity is null);end if;
 if jsonb_array_length(duplicates)>0 then raise exception 'Posible duplicado: revisa el expediente existente antes de crear otro';end if;
 if auth_id is not null then
  if auth_id='6418ad20-d0e8-49c0-8d9a-e1da3daf71b6'::uuid or exists(select 1 from public.hr_employees where system_auth_user_id=auth_id) then raise exception 'La cuenta Auth pertenece a otro expediente o está protegida';end if;
  if coalesce((v->'access'->>'link_existing')::boolean,false) is not true then raise exception 'Revisa y confirma la vinculación de la cuenta Auth existente, sin activarla';end if;
 end if;
 select * into r from public.hr_roles where id=(v->>'role_id')::uuid;if not found then raise exception 'Selecciona una plaza del Nomenclador';end if;
 if identity is null and email is null then raise exception 'Indica identificación personal o correo para comprobar duplicados. Puedes guardar el borrador parcial';end if;
 if length(full_name)<5 or length(full_name)>200 or nullif(v->>'hired_on','') is null or (v->>'hired_on')::date>current_date then raise exception 'Nombre completo y fecha real de incorporación válidos son obligatorios';end if;
 if v->>'status' not in ('active','inactive','on_leave') then raise exception 'Estado laboral no permitido. Las bajas conservan su procedimiento propio';end if;
 if email is not null and email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Correo no válido';end if;
 prepare:=p_action='create_access';
 if prepare and (email is null or username is null or username !~ '^[a-z0-9._-]{3,80}$' or nullif(v->'access'->>'role','') is null) then raise exception 'Para preparar acceso indica correo individual, usuario y rol';end if;
 personal:=coalesce(v->'personal','{}');if jsonb_typeof(personal)<>'object' then raise exception 'Datos personales no válidos';end if;
 for doc in select value from jsonb_array_elements(coalesce(v->'documents','[]')) loop
  if not exists(select 1 from storage.objects where bucket_id='hr-employee-private' and name=doc->>'path' and name like d.id::text||'/%') then raise exception 'Documento no encontrado en el borrador protegido';end if;
 end loop;
 if v->'employment'->>'contract_status'='signed' and (nullif(v->'employment'->>'signed_on','') is null or not exists(select 1 from jsonb_array_elements(coalesce(v->'documents','[]')) x where x->>'category'='Contrato firmado')) then raise exception 'Un contrato firmado requiere fecha y documento firmado adjunto';end if;
 insert into public.hr_employees(candidate_id,role_id,full_name,email,whatsapp,role_title,hired_at,status,system_username,system_auth_user_id,system_access_enabled)
 values(null,r.id,full_name,email,nullif(v->>'whatsapp',''),r.title,(v->>'hired_on')::date,v->>'status',case when prepare then username end,auth_id,false) returning * into e;
 insert into public.hr_employee_personal_details(employee_id,data,updated_by) values(e.id,personal||jsonb_build_object('employment',coalesce(v->'employment','{}')||jsonb_build_object('hired_on',v->>'hired_on'),'record_source','direct_existing_worker','record_state',case when identity is null then 'incomplete' else 'registered' end),auth.uid());
 insert into public.system_employee_position_history(employee_id,hr_role_id,position_title,started_at,notes) values(e.id,r.id,r.title,(v->>'hired_on')::date,'Alta directa de trabajador existente; condiciones históricas registradas en expediente');
 for doc in select value from jsonb_array_elements(coalesce(v->'documents','[]')) loop
  insert into public.hr_employee_documents(employee_id,category,title,file_url) values(e.id,doc->>'category',doc->>'title','hr-employee-private/'||(doc->>'path'));
  if doc->>'category'='Fotografía' then update public.hr_employee_personal_details set data=data||jsonb_build_object('portrait_path',doc->>'path') where employee_id=e.id;end if;
 end loop;
 for asset in select value from jsonb_array_elements(coalesce(v->'assets','[]')) order by value->>'catalog_id' loop perform studio_access_private.employee_asset(e.id,'assign',asset||jsonb_build_object('assigned_on',coalesce(nullif(asset->>'assigned_on',''),v->>'hired_on')));end loop;
 if prepare then perform public.system_set_employee_role(e.id,v->'access'->>'role',true);end if;
 -- No views, invitations, Auth creation or access activation are performed here.
 insert into studio_access_private.permission_audit(actor_id,kind,target,after_data) values(auth.uid(),'employee_direct_created',e.id::text,jsonb_build_object('draft',d.id,'prepared_access',prepare,'linked_existing_auth',auth_id,'source','existing_worker'));
 update studio_access_private.employee_drafts set employee_id=e.id,revision=revision+1,updated_at=now() where id=d.id;
 return jsonb_build_object('employee_id',e.id,'created',true,'access_enabled',false,'invitation_sent',false);
end $$;
revoke all on function studio_access_private.direct_employee(text,uuid,jsonb) from public,anon;
grant execute on function studio_access_private.direct_employee(text,uuid,jsonb) to authenticated;
create function public.hr_direct_employee(p_action text,p_draft uuid default null,p_payload jsonb default '{}') returns jsonb language sql set search_path='' as $$select studio_access_private.direct_employee(p_action,p_draft,p_payload)$$;
revoke all on function public.hr_direct_employee(text,uuid,jsonb) from public,anon;
grant execute on function public.hr_direct_employee(text,uuid,jsonb) to authenticated;

create function studio_access_private.extended_user_profile(p_employee uuid,p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;details jsonb;employment jsonb;auth_mail text;
begin
 result:=studio_access_private.user_profile(p_employee,p_user);
 select au.email into auth_mail from auth.users au where au.id=coalesce((result->'employee'->>'system_auth_user_id')::uuid,p_user);
 result:=jsonb_set(result,'{account}',(result->'account')||jsonb_build_object('email',auth_mail));
 select data into details from public.hr_employee_personal_details where employee_id=p_employee;employment:=details->'employment';
 if employment is not null and result->'contract'='null'::jsonb then result:=jsonb_set(result,'{contract}',jsonb_build_object('available',false,'historical',true,'signed_at',case when employment->>'contract_status'='signed' then employment->>'signed_on' end,'data',jsonb_build_object('contract_type',employment->>'contract_type','contract_end_date',employment->>'contract_end_on'),'status',employment->>'contract_status'));end if;
 return result||jsonb_build_object('employment',employment,'portrait_path',details->>'portrait_path');
end $$;
revoke all on function studio_access_private.extended_user_profile(uuid,uuid) from public,anon;
grant execute on function studio_access_private.extended_user_profile(uuid,uuid) to authenticated;
create or replace function public.system_user_profile(p_employee uuid default null,p_user uuid default null) returns jsonb language sql set search_path='' as $$select studio_access_private.extended_user_profile(p_employee,p_user)$$;
