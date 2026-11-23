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
 if h.trial_id is null or t.superseded_at is not null or c.status not in ('trial','hired') or (h.employee_id is not null and p_action<>'validate_and_advance') then raise exception 'Candidatura no vigente'; end if;
 if p_action='notify' then
  select action into last_action from public.hr_trial_closure_events where trial_id=p_trial and action in ('message_opened','training_step_back','training_notification_confirmed','training_notification_back') order by created_at desc,id desc limit 1;
  if last_action is distinct from 'training_notification_confirmed' or h.revoked_at is not null or h.expires_at<=now() then raise exception 'Actualiza la etapa o renueva los enlaces'; end if;
  if h.notified_at is not null then return; end if;
  update public.hr_hiring_cases set notified_at=coalesce(notified_at,clock_timestamp()) where trial_id=p_trial;
 elsif p_action='validate_and_advance' then
  if h.notified_at is null or h.submitted_at is null or h.revision is distinct from p_revision then
   raise exception 'Revisa la última versión del expediente recibido';
  end if;
  select action into last_action from public.hr_trial_closure_events
   where trial_id=p_trial and action in ('message_opened','training_step_back','training_notification_confirmed','training_notification_back')
   order by created_at desc,id desc limit 1;
  if c.status='trial' and last_action is distinct from 'training_notification_confirmed' then
   raise exception 'Actualiza la etapa de adiestramiento';
  end if;
  if exists(select 1 from public.hr_employees where candidate_id=c.id and status='terminated') then
   raise exception 'Expediente dado de baja; requiere revisión';
  end if;
  if h.verified_at is null then
   update public.hr_hiring_cases set verified_at=clock_timestamp() where trial_id=p_trial;
   insert into public.hr_candidate_history(candidate_id,event_type,from_status,to_status,note)
   values(c.id,'hiring_verify',c.status,case when c.status='trial' then 'hired' else c.status end,'Expediente laboral validado. Versión '||h.revision);
  end if;
  if c.status='trial' then
   insert into public.hr_employees(candidate_id,role_id,vacancy_id,full_name,email,whatsapp,role_title,status,hired_at)
   values(c.id,h.role_id,c.vacancy_id,c.full_name,c.email,c.whatsapp,t.role_title,'active',now())
   on conflict(candidate_id) do nothing;
   update public.hr_candidates set status='hired',decision_status='hired',decision_updated_at=now() where id=c.id;
  elsif studio_access_private.hiring_route(c.id,'read','{}') then
   perform studio_access_private.hiring_route(c.id,'continue','{}');
  end if;
  return;
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
 insert into public.hr_candidate_history(candidate_id,event_type,from_status,to_status,note) values(c.id,'hiring_'||p_action,c.status,c.status,'Contratación: '||p_action||'. Versión '||h.revision);
end $function$
;
