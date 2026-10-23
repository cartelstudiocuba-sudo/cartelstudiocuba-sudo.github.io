-- No existing candidate is changed by this migration.
create table public.hr_trial_closures (
 trial_id uuid primary key references public.hr_trial_periods(id) on delete cascade,
 token_hash text not null unique, document_token_hash text not null unique,
 expires_at timestamptz not null default now()+interval '30 days', revoked_at timestamptz,
 document jsonb not null, data jsonb not null default '{}',
 submitted_at timestamptz, signed_received_at timestamptz, verified_at timestamptz,
 training_days integer check(training_days between 1 and 365), training_tutor text, training_start date,
 created_at timestamptz not null default now()
);
create table public.hr_trial_closure_events (
 id uuid primary key default gen_random_uuid(), trial_id uuid not null references public.hr_trial_closures(trial_id) on delete cascade,
 action text not null, payload jsonb not null default '{}', actor uuid default auth.uid(), created_at timestamptz not null default now()
);
alter table public.hr_trial_closures enable row level security;
alter table public.hr_trial_closure_events enable row level security;
revoke all on public.hr_trial_closures,public.hr_trial_closure_events from public,anon,authenticated;
grant select on public.hr_trial_closures,public.hr_trial_closure_events to authenticated;
create policy owner_read on public.hr_trial_closures for select to authenticated using ((select studio_access_private.is_owner()));
create policy owner_read on public.hr_trial_closure_events for select to authenticated using ((select studio_access_private.is_owner()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('hr-identity-private','hr-identity-private',false,5242880,array['image/jpeg','image/png']) on conflict(id) do nothing;

-- Intentional capability authorization: the secret is only in a URL fragment and a request header.
create function public.hr_closure_upload_allowed(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.hr_trial_closures c where c.token_hash=encode(sha256(convert_to(coalesce(current_setting('request.headers',true)::jsonb->>'x-closure-token',''),'UTF8')),'hex') and c.expires_at>now() and c.revoked_at is null and c.submitted_at is null and p_path in (c.trial_id::text||'/front',c.trial_id::text||'/back'));
$$;
revoke all on function public.hr_closure_upload_allowed(text) from public;
grant execute on function public.hr_closure_upload_allowed(text) to anon,authenticated;
create policy closure_upload on storage.objects for insert to anon,authenticated with check(bucket_id='hr-identity-private' and public.hr_closure_upload_allowed(name));
create policy closure_owner_read on storage.objects for select to authenticated using(bucket_id='hr-identity-private' and (select studio_access_private.is_owner()));

create function public.hr_prepare_trial_closure(p_trial uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.hr_trial_periods%rowtype; n text; tok text; doc text; d jsonb;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'No autorizado'; end if;
 select * into t from public.hr_trial_periods where id=p_trial for update;
 if not found or t.stage not in ('in_trial','evaluation_pending') then raise exception 'Prueba no disponible para cierre'; end if;
 if exists(select 1 from public.hr_trial_closures where trial_id=p_trial) then raise exception 'El cierre ya existe. Revisa el cierre guardado; no se sobrescribe.'; end if;
 select full_name into n from public.hr_candidates where id=t.candidate_id;
 tok:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''); doc:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 d:=jsonb_build_object('full_name',n,'role_title',t.role_title,'start_date',t.start_date,'duration_days',t.duration_days,'closed_on',current_date);
 insert into public.hr_trial_closures(trial_id,token_hash,document_token_hash,document) values(p_trial,encode(sha256(convert_to(tok,'UTF8')),'hex'),encode(sha256(convert_to(doc,'UTF8')),'hex'),d);
 insert into public.hr_trial_closure_events(trial_id,action,payload) values(p_trial,'closure_prepared',jsonb_build_object('form_url','https://gestion.elcartelstudio.com/actualizar-expediente.html#token='||tok,'document_url','https://gestion.elcartelstudio.com/cierre-periodo-prueba.html#token='||doc));
 return jsonb_build_object('form_url','https://gestion.elcartelstudio.com/actualizar-expediente.html#token='||tok,'document_url','https://gestion.elcartelstudio.com/cierre-periodo-prueba.html#token='||doc,'full_name',n);
end $$;

create function public.hr_read_trial_closure(p_token text,p_document boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.hr_trial_closures%rowtype; v jsonb;
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return null; end if;
 select * into c from public.hr_trial_closures where (case when p_document then document_token_hash else token_hash end)=encode(sha256(convert_to(p_token,'UTF8')),'hex') and revoked_at is null and expires_at>now();
 if not found then return null; end if;
 if p_document then return c.document; end if;
 select jsonb_build_object('full_name',x.full_name,'email',x.email,'whatsapp',x.whatsapp,'municipality',x.municipality) into v from public.hr_candidates x join public.hr_trial_periods t on t.candidate_id=x.id where t.id=c.trial_id;
 v:=v || coalesce((select jsonb_object_agg(a.question_key,a.answer) from public.hr_candidate_answers a join public.hr_trial_periods t on t.candidate_id=a.candidate_id where t.id=c.trial_id and a.question_key in ('address','education_level')),'{}'::jsonb);
 return jsonb_build_object('trial_id',c.trial_id,'candidate',v,'submitted',c.submitted_at is not null,'uploaded_front',exists(select 1 from storage.objects where bucket_id='hr-identity-private' and name=c.trial_id::text||'/front'),'uploaded_back',exists(select 1 from storage.objects where bucket_id='hr-identity-private' and name=c.trial_id::text||'/back'));
end $$;

create function public.hr_submit_trial_closure(p_token text,p_data jsonb) returns void language plpgsql security definer set search_path='' as $$
declare c public.hr_trial_closures%rowtype; k text; allowed text[]:=array['identity_number','address','province','municipality','emergency_name','emergency_relation','emergency_phone','education_level'];
begin
 select * into c from public.hr_trial_closures where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and expires_at>now() and revoked_at is null for update;
 if not found or c.submitted_at is not null then raise exception 'Enlace no válido o formulario ya enviado'; end if;
 if jsonb_typeof(p_data) is distinct from 'object' or pg_column_size(p_data)>12000 then raise exception 'Datos no válidos'; end if;
 for k in select jsonb_object_keys(p_data) loop
 if not k=any(allowed) or jsonb_typeof(p_data->k) is distinct from 'string' or length(p_data->>k)>1000 then raise exception 'Campo no válido'; end if;
 end loop;
 if coalesce(p_data->>'identity_number','') !~ '^[0-9]{11}$' or coalesce(trim(p_data->>'address'),'')='' or coalesce(trim(p_data->>'emergency_name'),'')='' or coalesce(trim(p_data->>'emergency_phone'),'')='' then raise exception 'Completa identidad, dirección y contacto de emergencia'; end if;
 if (select count(*) from storage.objects where bucket_id='hr-identity-private' and name in(c.trial_id::text||'/front',c.trial_id::text||'/back'))<>2 then raise exception 'Faltan ambas caras del carné'; end if;
 update public.hr_trial_closures set data=p_data||jsonb_build_object('document_front_path',c.trial_id::text||'/front','document_back_path',c.trial_id::text||'/back'),submitted_at=now() where trial_id=c.trial_id;
 insert into public.hr_trial_closure_events(trial_id,action,actor) values(c.trial_id,'file_submitted',null);
end $$;

create function public.hr_manage_trial_closure(p_trial uuid,p_action text,p_payload jsonb default '{}') returns void language plpgsql security definer set search_path='' as $$
declare c public.hr_trial_closures%rowtype;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'No autorizado'; end if;
 select * into c from public.hr_trial_closures where trial_id=p_trial for update;
 if not found then raise exception 'Cierre inexistente'; end if;
 if p_action='message_opened' then
  if length(coalesce(p_payload->>'message','')) not between 20 and 12000 then raise exception 'Mensaje no válido'; end if;
 elsif p_action='signed_received' then update public.hr_trial_closures set signed_received_at=now() where trial_id=p_trial;
 elsif p_action='verified' then
  if c.submitted_at is null or c.signed_received_at is null then raise exception 'Falta expediente o cierre firmado'; end if;
  update public.hr_trial_closures set verified_at=now() where trial_id=p_trial;
 elsif p_action='training_prepared' then
  if c.verified_at is null or coalesce(trim(p_payload->>'tutor'),'')='' or (p_payload->>'days')::integer not between 1 and 365 or p_payload->>'start' is null then raise exception 'Verifica el cierre y completa capacitación'; end if;
  update public.hr_trial_closures set training_days=(p_payload->>'days')::integer,training_tutor=p_payload->>'tutor',training_start=(p_payload->>'start')::date where trial_id=p_trial;
 elsif p_action='revoked' then update public.hr_trial_closures set revoked_at=now() where trial_id=p_trial;
 else raise exception 'Acción no válida'; end if;
 insert into public.hr_trial_closure_events(trial_id,action,payload) values(p_trial,p_action,p_payload);
end $$;

-- Server-side gate covers the existing hire RPC and direct employee creation.
create function public.hr_require_trial_closure() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.hr_trial_closures%rowtype;
begin
 if exists(select 1 from public.hr_trial_periods where candidate_id=new.candidate_id and stage in('in_trial','evaluation_pending')) then
  select cl.* into c from public.hr_trial_closures cl join public.hr_trial_periods t on t.id=cl.trial_id where t.candidate_id=new.candidate_id;
  if c.verified_at is null or c.training_days is null or c.training_tutor is null or c.training_start is null then raise exception 'Completa y verifica el cierre de prueba y prepara la capacitación antes de contratar'; end if;
 end if;
 return new;
end $$;
create trigger require_trial_closure before insert or update of status on public.hr_employees for each row execute function public.hr_require_trial_closure();
create function public.hr_transfer_trial_file() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.hr_employee_personal_details(employee_id,data,updated_by)
 select new.id,c.data,auth.uid() from public.hr_trial_closures c join public.hr_trial_periods t on t.id=c.trial_id where t.candidate_id=new.candidate_id and c.verified_at is not null
 on conflict(employee_id) do update set data=excluded.data||public.hr_employee_personal_details.data,updated_at=now();
 return new;
end $$;
create trigger transfer_trial_file after insert on public.hr_employees for each row execute function public.hr_transfer_trial_file();
revoke all on function public.hr_require_trial_closure(),public.hr_transfer_trial_file() from public,anon,authenticated;
revoke all on function public.hr_prepare_trial_closure(uuid),public.hr_manage_trial_closure(uuid,text,jsonb) from public,anon;
grant execute on function public.hr_prepare_trial_closure(uuid),public.hr_manage_trial_closure(uuid,text,jsonb) to authenticated;
revoke all on function public.hr_read_trial_closure(text,boolean),public.hr_submit_trial_closure(text,jsonb) from public;
grant execute on function public.hr_read_trial_closure(text,boolean),public.hr_submit_trial_closure(text,jsonb) to anon,authenticated;
