-- Align legacy employee-insert guard with the confirmed Step 11 training workflow.
-- Applied to production Supabase as migration allow_hiring_step11_after_confirmed_training_notification.
CREATE OR REPLACE FUNCTION public.hr_require_trial_closure()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $function$
declare c public.hr_trial_closures%rowtype; t public.hr_trial_periods%rowtype;
begin
 select * into t from public.hr_trial_periods where candidate_id=new.candidate_id and superseded_at is null and stage in ('in_trial','evaluation_pending') order by created_at desc limit 1;
 if t.id is not null then
  select * into c from public.hr_trial_closures where trial_id=t.id;
  if c.verified_at is null or c.training_days is null or c.training_tutor is null or c.training_start is null then
   if not (
    new.status='active'
    and exists (select 1 from public.hr_hiring_cases h where h.trial_id=t.id and h.candidate_id=new.candidate_id and h.notified_at is not null and h.revoked_at is null)
    and (select e.action from public.hr_trial_closure_events e where e.trial_id=t.id and e.action in ('message_opened','training_step_back','training_notification_confirmed','training_notification_back') order by e.created_at desc,e.id desc limit 1)='training_notification_confirmed'
    and (select e.payload->>'decision' from public.hr_trial_closure_events e where e.trial_id=t.id and e.action in ('message_opened','training_step_back') and e.payload ? 'decision' order by e.created_at desc,e.id desc limit 1)='continue'
   ) then
    raise exception 'Completa y verifica el cierre de prueba y prepara la capacitación antes de contratar';
   end if;
  end if;
 end if;
 return new;
end $function$;
