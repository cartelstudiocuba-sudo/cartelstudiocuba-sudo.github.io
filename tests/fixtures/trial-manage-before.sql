CREATE OR REPLACE FUNCTION public.hr_manage_trial_closure(p_trial uuid, p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$

