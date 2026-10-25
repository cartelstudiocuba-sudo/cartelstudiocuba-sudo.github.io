create or replace function public.hr_validate_interview_closure() returns trigger
language plpgsql security invoker set search_path='' as $$
declare i integer; response text; q jsonb;
begin
 if tg_op='UPDATE' then
  if old.completed_at is not null and (new.completed_at is distinct from old.completed_at or new.candidate_id is distinct from old.candidate_id or new.completed_by is distinct from old.completed_by or (old.closure_evaluation is not null and new.closure_evaluation is null)) then
   raise exception 'El cierre original y el candidato de una entrevista finalizada se conservan.' using errcode='23514';
  end if;
 end if;
 if new.completed_at is not null and (tg_op='INSERT' or old.completed_at is null or new.closure_evaluation is not null) then
  if new.candidate_id is null or new.interview_date is null or nullif(btrim(new.interviewer),'') is null then
   raise exception 'Completa candidato, fecha y entrevistador.' using errcode='23514';
  end if;
  if new.questionnaire_snapshot is not null then
   if new.questionnaire_snapshot->>'status' is distinct from 'published' then raise exception 'Cuestionario sin publicar.' using errcode='23514';end if;
   perform public.hr_check_role_questions(new.questionnaire_snapshot->'questions');
   for q in select value from jsonb_array_elements(new.questionnaire_snapshot->'questions') loop
    response:=new.interview_notes->>(q->>'id');
    if (q->>'required')::boolean and (nullif(btrim(response),'') is null or response in ('Otra respuesta','No responde / no se abordó')) then
     raise exception 'Falta responder: %',q->>'text' using errcode='23514';end if;
    if nullif(response,'') is not null and q->>'type'='select' and not (q->'options' ? response) then
     raise exception 'Opción fuera del cuestionario publicado.' using errcode='23514';end if;
   end loop;
  else
  if new.questionnaire_required is true then raise exception 'Inicia el cuestionario publicado de esta plaza antes del cierre.' using errcode='23514';end if;
  -- Legacy validation is retained only for interviews created before this migration.
  for i in 0..15 loop
   response := coalesce(nullif(btrim(new.interview_notes->>('q'||i||'_choice')),''),nullif(btrim(new.interview_notes->>('q'||i)),''));
   if response is null or response='No responde / no se abordó' or response='Otra respuesta' then
    raise exception 'Falta responder la pregunta obligatoria %.', i+1 using errcode='23514';
   end if;
  end loop;
  end if;
  if jsonb_typeof(new.closure_evaluation) is distinct from 'array' then
   raise exception 'Se requieren diez calificaciones de 1 a 5.' using errcode='23514';
  end if;
  if jsonb_array_length(new.closure_evaluation)<>10 or exists(select 1 from jsonb_array_elements_text(new.closure_evaluation) v where coalesce(v,'') !~ '^[1-5]$') then
   raise exception 'Se requieren diez calificaciones de 1 a 5.' using errcode='23514';
  end if;
  if new.closure_decision is null or new.closure_decision not in ('pending','selected','not_selected','talent_pool','profiled') then
   raise exception 'Registra una decisión; Por decidir es válida.' using errcode='23514';
  end if;
  if tg_op='INSERT' or old.completed_at is null then
   new.completed_at:=clock_timestamp(); new.completed_by:=auth.uid();
  end if;
 end if;
 return new;
end $$;
revoke all on function public.hr_validate_interview_closure() from public,anon,authenticated;
