-- Preserve the existing RPC, owner checks, signature and permissions.
-- Persist route 10 -> 09 as an auditable decision; no existing candidates change here.
do $patch$ declare definition text; marker text:=' if p_action in (''visible_step_back'',''finish_without_advance'') then'; begin select pg_get_functiondef('public.hr_manage_trial_closure(uuid,text,jsonb)'::regprocedure) into definition; if position('if p_action=''training_step_back''' in definition)>0 then return; end if; if position(marker in definition)=0 then raise exception 'Missing expected function branch'; end if; execute replace(definition,marker,$branch$
 if p_action='training_step_back' then
  select * into t from public.hr_trial_periods where id=p_trial for update;
  if not found or t.superseded_at is not null then raise exception 'Prueba no vigente'; end if;
  select * into person from public.hr_candidates where id=t.candidate_id for update;
  if person.status<>'trial' or t.stage not in ('agreement_sent','agreement_accepted','in_trial','evaluation_pending') or exists(select 1 from public.hr_employees where candidate_id=person.id and status='active') then raise exception 'La candidatura cambió. Actualiza la ficha'; end if;
  if t.stage is distinct from p_payload->>'expected_stage' then raise exception 'La etapa cambió. Actualiza la ficha'; end if;
  select payload into previous from public.hr_trial_closure_events where trial_id=p_trial and action in ('message_opened','training_step_back') and payload ? 'decision' order by created_at desc,id desc limit 1;
  if coalesce(previous->>'decision','')='trial' then return; end if;
  if coalesce(previous->>'decision','')<>'continue' then raise exception 'La candidatura ya no está en adiestramiento'; end if;
  insert into public.hr_trial_closure_events(trial_id,action,payload) values(p_trial,'training_step_back',jsonb_build_object('decision','trial','actor',auth.uid()));
  insert into public.hr_candidate_history(candidate_id,event_type,from_status,to_status,note) values(person.id,'training_step_back','trial','trial','Regreso al paso 09: cierre del período de prueba');
  return;
 end if;
$branch$||marker); end $patch$;