-- Explicit closure. Existing records and RLS policies are preserved.
alter table public.hr_interviews add column if not exists closure_evaluation jsonb;
alter table public.hr_interviews add column if not exists closure_decision text;
alter table public.hr_interviews add column if not exists completed_by uuid;

create or replace function public.hr_validate_interview_closure() returns trigger
language plpgsql security invoker set search_path='' as $$
declare i integer; response text;
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
  for i in 0..15 loop
   response := coalesce(nullif(btrim(new.interview_notes->>('q'||i||'_choice')),''),nullif(btrim(new.interview_notes->>('q'||i)),''));
   if response is null or response='No responde / no se abordó' or response='Otra respuesta' then
    raise exception 'Falta responder la pregunta obligatoria %.', i+1 using errcode='23514';
   end if;
  end loop;
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
create trigger hr_validate_interview_closure before insert or update on public.hr_interviews
for each row execute function public.hr_validate_interview_closure();

create or replace function public.hr_audit_interview_edit() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if to_jsonb(new) is distinct from to_jsonb(old) then
  insert into public.hr_candidate_history(candidate_id,event_type,note)
  values(new.candidate_id,case when old.completed_at is null and new.completed_at is not null then 'interview_completed' else 'interview_edited' end,
   jsonb_build_object('actor',auth.uid(),'before',to_jsonb(old),'after',to_jsonb(new))::text);
 end if;
 return new;
end $$;
revoke all on function public.hr_audit_interview_edit() from public,anon,authenticated;
create trigger hr_audit_interview_edit after update on public.hr_interviews
for each row execute function public.hr_audit_interview_edit();

create or replace function public.hr_finalize_interview(p_candidate uuid,p_ratings jsonb,p_decision text,p_notes text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.hr_candidates; iv public.hr_interviews; marker text;
begin
 if auth.uid() is null then raise exception 'Se requiere una sesión autorizada.' using errcode='42501'; end if;
 select * into c from public.hr_candidates where id=p_candidate for update;
 if not found then raise exception 'Candidato no disponible o sin autorización.' using errcode='42501'; end if;
 select * into iv from public.hr_interviews where candidate_id=p_candidate for update;
 if not found then raise exception 'Entrevista no disponible o sin autorización.' using errcode='42501'; end if;
 if iv.completed_at is not null then return jsonb_build_object('interview',to_jsonb(iv),'candidate',to_jsonb(c)); end if;
 update public.hr_interviews set closure_evaluation=p_ratings,closure_decision=p_decision,
  completed_at=clock_timestamp(),updated_at=clock_timestamp() where id=iv.id returning * into iv;
 select string_agg(value,',' order by ord) into marker from jsonb_array_elements_text(p_ratings) with ordinality r(value,ord);
 update public.hr_candidates set internal_notes=coalesce(nullif(btrim(p_notes),'')||E'\n','')||'[EVALUACION_ENTREVISTA_V1]'||marker||'[/EVALUACION_ENTREVISTA_V1]',
  status=case when status='interview_scheduled' then 'interviewed' else status end,
  decision_status=case when status in ('interview_scheduled','interviewed') then p_decision else decision_status end,
  decision_updated_at=case when status in ('interview_scheduled','interviewed') then clock_timestamp() else decision_updated_at end
 where id=p_candidate returning * into c;
 if not found then raise exception 'No se pudo guardar la evaluación.'; end if;
 return jsonb_build_object('interview',to_jsonb(iv),'candidate',to_jsonb(c));
end $$;
revoke all on function public.hr_finalize_interview(uuid,jsonb,text,text) from public,anon;
grant execute on function public.hr_finalize_interview(uuid,jsonb,text,text) to authenticated;

create or replace function public.hr_audit_interview_evaluation() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if row(new.internal_notes,new.internal_first_impression,new.internal_role_fit,new.internal_strengths,new.internal_interview_checks)
 is distinct from row(old.internal_notes,old.internal_first_impression,old.internal_role_fit,old.internal_strengths,old.internal_interview_checks) then
  insert into public.hr_candidate_history(candidate_id,event_type,note)
  values(new.id,'interview_evaluation_edited',jsonb_build_object('actor',auth.uid(),'before',jsonb_build_object('notes',old.internal_notes,'impression',old.internal_first_impression,'fit',old.internal_role_fit,'strengths',old.internal_strengths,'checks',old.internal_interview_checks),'after',jsonb_build_object('notes',new.internal_notes,'impression',new.internal_first_impression,'fit',new.internal_role_fit,'strengths',new.internal_strengths,'checks',new.internal_interview_checks))::text);
 end if;
 return new;
end $$;
revoke all on function public.hr_audit_interview_evaluation() from public,anon,authenticated;
create trigger hr_audit_interview_evaluation after update on public.hr_candidates
for each row execute function public.hr_audit_interview_evaluation();
