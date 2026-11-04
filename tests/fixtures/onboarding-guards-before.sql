CREATE OR REPLACE FUNCTION public.hr_guard_candidate_workflow_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if new.status='hired' and old.status is distinct from 'hired' then
  if not exists(select 1 from public.hr_employees e where e.candidate_id=new.id and e.status='active') then
   raise exception 'No se puede marcar Contratado sin expediente laboral activo. Utiliza Decisión final.' using errcode='23514';
  end if;
 end if;
 if new.status='trial' and old.status is distinct from 'trial' then
  if not exists(select 1 from public.hr_trial_periods t where t.candidate_id=new.id and t.superseded_at is null and t.stage in ('pending_confirmation','pending_agreement','agreement_sent','agreement_accepted','in_trial','evaluation_pending')) then
   raise exception 'No se puede marcar En período de prueba sin una propuesta de prueba registrada.' using errcode='23514';
  end if;
 end if;
 return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.hr_require_trial_closure()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.hr_trial_closures%rowtype;
begin
 if exists(select 1 from public.hr_trial_periods where candidate_id=new.candidate_id and superseded_at is null and stage in('in_trial','evaluation_pending')) then
  select cl.* into c from public.hr_trial_closures cl join public.hr_trial_periods t on t.id=cl.trial_id where t.candidate_id=new.candidate_id and t.superseded_at is null;
  if c.verified_at is null or c.training_days is null or c.training_tutor is null or c.training_start is null then raise exception 'Completa y verifica el cierre de prueba y prepara la capacitación antes de contratar'; end if;
 end if;
 return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.hr_transfer_trial_file()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 insert into public.hr_employee_personal_details(employee_id,data,updated_by)
 select new.id,c.data,auth.uid() from public.hr_trial_closures c join public.hr_trial_periods t on t.id=c.trial_id where t.candidate_id=new.candidate_id and t.superseded_at is null and c.verified_at is not null
 on conflict(employee_id) do update set data=excluded.data||public.hr_employee_personal_details.data,updated_at=now();
 return new;
end $function$
;
