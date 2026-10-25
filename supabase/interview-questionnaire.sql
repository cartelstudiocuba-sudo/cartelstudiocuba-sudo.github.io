-- Additive schema. No RLS policies, candidates, existing notes or closures are changed.
set local lock_timeout='5s';
alter table public.hr_interviews add column if not exists questionnaire_snapshot jsonb;
-- Existing rows stay NULL (legacy); only later INSERTs require a published version.
alter table public.hr_interviews add column if not exists questionnaire_required boolean;
alter table public.hr_interviews alter column questionnaire_required set default true;

create or replace function public.hr_check_role_questions(p_questions jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare q jsonb; seen text[]='{}'; opt text;
begin
 if jsonb_typeof(p_questions) is distinct from 'array' then raise exception 'Lista de preguntas inválida.' using errcode='23514'; end if;
 if jsonb_array_length(p_questions) not between 1 and 100 then raise exception 'Se requieren entre 1 y 100 preguntas para publicar.' using errcode='23514'; end if;
 for q in select value from jsonb_array_elements(p_questions) loop
  if coalesce(q->>'id','') !~ '^iq_[a-zA-Z0-9_-]{1,80}$' or q->>'id'=any(seen)
   or jsonb_typeof(q->'text') is distinct from 'string'
   or jsonb_typeof(q->'section') is distinct from 'string' or jsonb_typeof(q->'help') is distinct from 'string'
   or length(btrim(coalesce(q->>'text',''))) not between 1 and 4000
   or length(coalesce(q->>'section',''))>200 or length(coalesce(q->>'help',''))>4000
   or coalesce(q->>'type','') not in ('text','select') or jsonb_typeof(q->'required') is distinct from 'boolean'
   or jsonb_typeof(q->'options') is distinct from 'array' then
   raise exception 'Pregunta inválida o identificador repetido.' using errcode='23514';
  end if;
  seen:=array_append(seen,q->>'id');
  if exists(select 1 from jsonb_array_elements(q->'options') e where jsonb_typeof(e.value)<>'string') then raise exception 'Las opciones deben ser textos.' using errcode='23514';end if;
  if q->>'type'='select' then
   if jsonb_array_length(q->'options') not between 2 and 30 then raise exception 'Revisa las opciones.' using errcode='23514'; end if;
   if (select count(distinct value) from jsonb_array_elements_text(q->'options'))<>jsonb_array_length(q->'options') then raise exception 'Opciones repetidas.' using errcode='23514'; end if;
   for opt in select value from jsonb_array_elements_text(q->'options') loop
    if length(btrim(coalesce(opt,''))) not between 1 and 500 then raise exception 'Opción inválida.' using errcode='23514';end if;
   end loop;
  end if;
 end loop;
end $$;
revoke all on function public.hr_check_role_questions(jsonb) from public,anon;
grant execute on function public.hr_check_role_questions(jsonb) to authenticated;

create or replace function public.hr_candidate_questionnaire(p_candidate uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v public.hr_vacancies; r public.hr_roles; rid uuid; n integer;
begin
 if auth.uid() is null then raise exception 'Sesión requerida.' using errcode='42501';end if;
 select v1.* into v from public.hr_candidates c join public.hr_vacancies v1 on v1.id=c.vacancy_id where c.id=p_candidate;
 if not found then raise exception 'Convocatoria no disponible.' using errcode='23514';end if;
 if v.recruitment_cycle_id is not null then
  select role_id into rid from public.hr_recruitment_cycles where id=v.recruitment_cycle_id;
  if rid is null then raise exception 'La convocatoria no tiene una plaza verificable.' using errcode='23514';end if;
  select * into r from public.hr_roles where id=rid;
 else
  select count(*) into n from public.hr_roles where title=v.title;
  if n<>1 then raise exception 'Plaza ausente o ambigua. Vincula la convocatoria a su ciclo.' using errcode='23514';end if;
  select * into r from public.hr_roles where title=v.title;
 end if;
 if r.id is null or r.work_content->'interview_questionnaire_published'->>'status' is distinct from 'published' then
  raise exception 'Esta plaza no tiene cuestionario aprobado y publicado. Su borrador no se activa.' using errcode='23514';
 end if;
 perform public.hr_check_role_questions(r.work_content->'interview_questionnaire_published'->'questions');
 return r.work_content->'interview_questionnaire_published'||jsonb_build_object('role_id',r.id,'role_title',r.title);
end $$;
revoke all on function public.hr_candidate_questionnaire(uuid) from public,anon;
grant execute on function public.hr_candidate_questionnaire(uuid) to authenticated;

create or replace function public.hr_publish_role_questionnaire(p_role uuid,p_expected jsonb) returns public.hr_roles
language plpgsql security invoker set search_path='' as $$
declare r public.hr_roles; d jsonb; p jsonb;
begin
 if auth.uid() is null then raise exception 'Sesión requerida.' using errcode='42501';end if;
 select * into r from public.hr_roles where id=p_role for update;
 if not found then raise exception 'Plaza no disponible.' using errcode='42501';end if;
 d:=r.work_content->'interview_questionnaire_draft';
 if d is distinct from p_expected or d->>'status' is distinct from 'draft' then raise exception 'El borrador cambió. Recarga y revisa antes de aprobar.' using errcode='40001';end if;
 perform public.hr_check_role_questions(d->'questions');
 p:=jsonb_build_object('version',1,'revision',coalesce((r.work_content->'interview_questionnaire_published'->>'revision')::integer,0)+1,'status','published','questions',d->'questions','published_at',clock_timestamp(),'published_by',auth.uid());
 update public.hr_roles set work_content=jsonb_set(work_content,'{interview_questionnaire_published}',p),updated_at=clock_timestamp() where id=p_role returning * into r;
 if not found then raise exception 'No se pudo publicar la plaza.' using errcode='42501';end if;
 return r;
end $$;
revoke all on function public.hr_publish_role_questionnaire(uuid,jsonb) from public,anon;
grant execute on function public.hr_publish_role_questionnaire(uuid,jsonb) to authenticated;

create or replace function public.hr_guard_questionnaire_snapshot() returns trigger
language plpgsql security invoker set search_path='' as $$
declare canonical jsonb;
begin
 if tg_op='INSERT' then new.questionnaire_required:=true;end if;
 if tg_op='UPDATE' then
  if new.questionnaire_required is distinct from old.questionnaire_required then
   raise exception 'Se conserva el formato original de la entrevista.' using errcode='23514';end if;
  if old.questionnaire_snapshot is not null and (new.questionnaire_snapshot is distinct from old.questionnaire_snapshot or new.candidate_id is distinct from old.candidate_id) then
   raise exception 'La versión iniciada y su candidato se conservan.' using errcode='23514';end if;
  if old.questionnaire_snapshot is null and new.questionnaire_snapshot is not null and old.completed_at is not null then
   raise exception 'Una entrevista histórica cerrada conserva su cuestionario original.' using errcode='23514';end if;
  if new.questionnaire_snapshot is not null and exists(select 1 from jsonb_each(coalesce(old.interview_notes,'{}')) e where e.key ~ '^q[0-9]+(_choice)?$' and new.interview_notes->e.key is distinct from e.value) then
   raise exception 'Las respuestas históricas no se sobrescriben.' using errcode='23514';end if;
 end if;
 if new.questionnaire_snapshot is not null and (tg_op='INSERT' or old.questionnaire_snapshot is null) then
  canonical:=public.hr_candidate_questionnaire(new.candidate_id);
  if canonical is distinct from new.questionnaire_snapshot then raise exception 'Solo se puede iniciar la versión publicada de esta plaza.' using errcode='23514';end if;
 end if;
 return new;
end $$;
revoke all on function public.hr_guard_questionnaire_snapshot() from public,anon,authenticated;
create trigger hr_guard_questionnaire_snapshot before insert or update on public.hr_interviews for each row execute function public.hr_guard_questionnaire_snapshot();

create or replace function public.hr_begin_role_questionnaire(p_candidate uuid) returns public.hr_interviews
language plpgsql security invoker set search_path='' as $$
declare iv public.hr_interviews; snap jsonb;
begin
 if auth.uid() is null then raise exception 'Sesión requerida.' using errcode='42501';end if;
 -- Lock order matches finalization: candidate, then interview.
 perform 1 from public.hr_candidates where id=p_candidate for update;
 if not found then raise exception 'Candidato no disponible.' using errcode='42501';end if;
 select * into iv from public.hr_interviews where candidate_id=p_candidate for update;
 if not found then raise exception 'Entrevista no disponible.' using errcode='42501';end if;
 if iv.questionnaire_snapshot is not null then return iv;end if;
 if iv.completed_at is not null then raise exception 'Entrevista histórica cerrada.' using errcode='23514';end if;
 snap:=public.hr_candidate_questionnaire(p_candidate);
 update public.hr_interviews set questionnaire_snapshot=snap,updated_at=clock_timestamp() where id=iv.id returning * into iv;
 if not found then raise exception 'No se pudo iniciar la entrevista.' using errcode='42501';end if;
 return iv;
end $$;
revoke all on function public.hr_begin_role_questionnaire(uuid) from public,anon;
grant execute on function public.hr_begin_role_questionnaire(uuid) to authenticated;

create or replace function public.hr_save_role_interview_answer(p_candidate uuid,p_question text,p_value text,p_expected text,p_revision integer) returns public.hr_interviews
language plpgsql security invoker set search_path='' as $$
declare iv public.hr_interviews; q jsonb;
begin
 if auth.uid() is null then raise exception 'Sesión requerida.' using errcode='42501';end if;
 perform 1 from public.hr_candidates where id=p_candidate for update;
 if not found then raise exception 'Candidato no disponible.' using errcode='42501';end if;
 select * into iv from public.hr_interviews where candidate_id=p_candidate for update;
 if not found then raise exception 'Entrevista no disponible.' using errcode='42501';end if;
 if iv.questionnaire_snapshot->>'status' is distinct from 'published' or (iv.questionnaire_snapshot->>'revision')::integer is distinct from p_revision then raise exception 'Versión no disponible.' using errcode='23514';end if;
 if iv.completed_at is not null then raise exception 'La entrevista está cerrada.' using errcode='23514';end if;
 select value into q from jsonb_array_elements(iv.questionnaire_snapshot->'questions') where value->>'id'=p_question;
 if q is null or p_value is null or length(p_value)>12000 or (q->>'type'='select' and p_value<>'' and not (q->'options' ? p_value)) then raise exception 'Respuesta inválida.' using errcode='23514';end if;
 if iv.interview_notes->>p_question is distinct from p_expected then raise exception 'Otra sesión cambió esta respuesta. Recarga antes de guardar.' using errcode='40001';end if;
 update public.hr_interviews set interview_notes=coalesce(interview_notes,'{}')||jsonb_build_object(p_question,p_value),updated_at=clock_timestamp() where id=iv.id returning * into iv;
 if not found then raise exception 'No se pudo guardar.' using errcode='42501';end if;
 return iv;
end $$;
revoke all on function public.hr_save_role_interview_answer(uuid,text,text,text,integer) from public,anon;
grant execute on function public.hr_save_role_interview_answer(uuid,text,text,text,integer) to authenticated;
