CREATE OR REPLACE FUNCTION public.hr_confirm_trial_hire(p_trial_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 v_trial public.hr_trial_periods%rowtype;
 v_candidate public.hr_candidates%rowtype;
 v_employee_id uuid;
 v_role_id uuid;
 v_now timestamptz := now();
begin
 if auth.uid() is null or not studio_access_private.is_owner() then
  raise exception 'No autorizado para contratar';
 end if;
 select * into v_trial from public.hr_trial_periods where id=p_trial_id for update;
 if not found then raise exception 'Período de prueba inexistente'; end if;
 if v_trial.stage not in ('in_trial','evaluation_pending') then
  raise exception 'Etapa no válida para contratación';
 end if;
 select * into v_candidate from public.hr_candidates where id=v_trial.candidate_id for update;
 if not found then raise exception 'Candidato inexistente'; end if;
 if v_candidate.status='hired' then raise exception 'Candidato ya contratado'; end if;
 if exists(select 1 from public.hr_employees where candidate_id=v_candidate.id and status='active') then
  raise exception 'Ya existe un expediente activo para este candidato';
 end if;
 select cy.role_id into v_role_id
 from public.hr_vacancies v join public.hr_recruitment_cycles cy on cy.id=v.recruitment_cycle_id
 where v.id=coalesce(v_trial.vacancy_id,v_candidate.vacancy_id);
 insert into public.hr_employees(candidate_id,role_id,vacancy_id,full_name,email,whatsapp,role_title,status,hired_at,updated_at)
 values(v_candidate.id,v_role_id,coalesce(v_trial.vacancy_id,v_candidate.vacancy_id),v_candidate.full_name,v_candidate.email,v_candidate.whatsapp,coalesce(v_trial.role_title,v_candidate.profiled_target_role),'active',v_now,v_now)
 on conflict(candidate_id) do update set
 status='active',updated_at=excluded.updated_at,
 role_id=coalesce(excluded.role_id,public.hr_employees.role_id),
 vacancy_id=coalesce(excluded.vacancy_id,public.hr_employees.vacancy_id)
 returning id into v_employee_id;
 update public.hr_candidates set status='hired',decision_status='hired',decision_updated_at=v_now where id=v_candidate.id;
 update public.hr_trial_periods set stage='completed',completed_at=v_now,updated_at=v_now where id=p_trial_id;
 return v_employee_id;
end;
$function$

