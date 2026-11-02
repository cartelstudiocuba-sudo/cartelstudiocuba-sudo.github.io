CREATE OR REPLACE FUNCTION public.hr_manage_trial_closure(p_trial uuid, p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.hr_trial_closures%rowtype; t public.hr_trial_periods%rowtype;
 person public.hr_candidates%rowtype; dest public.hr_vacancies%rowtype;
 outcome text; target uuid; new_id uuid; previous jsonb; links jsonb; msg text; phone text;
 next_stage text; next_status text;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'No autorizado'; end if;


 if p_action in ('training_notification_confirmed','training_notification_back') then
  select * into t from public.hr_trial_periods where id=p_trial for update;
  if not found or t.superseded_at is not null then raise exception 'Prueba no vigente'; end if;
  select * into person from public.hr_candidates where id=t.candidate_id for update;
  if person.status<>'trial' or t.stage not in ('agreement_sent','agreement_accepted','in_trial','evaluation_pending')
   or exists(select 1 from public.hr_employees where candidate_id=person.id and status='active')
   then raise exception 'La candidatura cambió. Actualiza la ficha'; end if;
  if t.stage is distinct from p_payload->>'expected_stage' then raise exception 'La etapa cambió. Actualiza la ficha'; end if;
  select payload into previous from public.hr_trial_closure_events where trial_id=p_trial
   and action in ('message_opened','training_step_back') and payload ? 'decision'
   order by created_at desc,id desc limit 1;
  if coalesce(previous->>'decision','')<>'continue' then raise exception 'La candidatura ya no está en adiestramiento'; end if;
  -- Only the latest event in this training cycle may establish the visible step.
  select jsonb_build_object('action',action) into previous from public.hr_trial_closure_events
   where trial_id=p_trial and action in ('message_opened','training_step_back','training_notification_confirmed','training_notification_back')
   order by created_at desc,id desc limit 1;
  if p_action='training_notification_confirmed' and previous->>'action'='training_notification_confirmed' then return; end if;
  if p_action='training_notification_back' and coalesce(previous->>'action','')<>'training_notification_confirmed' then return; end if;
  insert into public.hr_trial_closure_events(trial_id,action,payload,created_at)
   values(p_trial,p_action,jsonb_build_object('actor',auth.uid(),'delivery',case when p_action='training_notification_confirmed' then 'operator_confirmed' else 'not_confirmed' end,'route_step',case when p_action='training_notification_confirmed' then 11 else 10 end),clock_timestamp());
  insert into public.hr_candidate_history(candidate_id,event_type,from_status,to_status,note)
   values(person.id,p_action,'trial','trial',case when p_action='training_notification_confirmed'
    then 'Notificación de inicio de capacitación confirmada por RRHH. Paso 11: Preparar contratación.'
    else 'Regreso al paso 10: Comienzo de adiestramiento.' end);
  return;
 end if;

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
 if p_action in ('visible_step_back','finish_without_advance') then
  select * into t from public.hr_trial_periods where id=p_trial for update;
  if not found then raise exception 'Prueba no encontrada'; end if; if t.superseded_at is not null then raise exception 'Esta prueba pertenece a un intento anterior. Actualiza la ficha'; end if;
  select * into person from public.hr_candidates where id=t.candidate_id for update;
  if not found then raise exception 'Candidatura no encontrada'; end if;
  if p_action='finish_without_advance' then
   outcome:=p_payload->>'outcome'; target:=nullif(p_payload->>'vacancy_id','')::uuid;
   if outcome is null or outcome not in ('talent_pool','not_selected','profiled') then raise exception 'Selecciona un destino válido'; end if;
   -- A retry of the same committed decision is a no-op, including after a lost response.
   select payload into previous from public.hr_trial_closure_events where trial_id=p_trial and action='finish_without_advance' order by created_at desc limit 1;
   if previous is not null then
    if previous->>'outcome'=outcome and (previous->>'vacancy_id') is not distinct from (target::text)
     and coalesce(previous->>'reason','')=coalesce(p_payload->>'reason','') then
     next_status:=case outcome when 'profiled' then 'archived' else outcome end;
     if person.status not in ('trial','interviewed',next_status) or exists(select 1 from public.hr_employees where candidate_id=person.id and status='active') then
      raise exception 'La candidatura cambió después del cierre. Revisa su historial';
     end if;
     update public.hr_candidates set status=next_status,decision_status=outcome,
      decision_note=case when outcome='not_selected' then previous->>'reason' else decision_note end
      where id=person.id and (status is distinct from next_status or decision_status is distinct from outcome);
     update public.hr_trial_periods set stage='completed',updated_at=now() where id=p_trial and stage<>'completed';
     return;
    end if;
    raise exception 'La prueba ya tiene una decisión de cierre. Actualiza la ficha';
   end if;
  end if;
  if person.status not in ('trial','interviewed') or exists(select 1 from public.hr_employees where candidate_id=person.id and status='active') then raise exception 'La candidatura cambió. Actualiza la ficha'; end if;
  if p_action='visible_step_back' then
   if t.stage is distinct from p_payload->>'expected_stage' or person.status is distinct from p_payload->>'expected_status' then raise exception 'La etapa cambió. Actualiza la ficha'; end if;
   if t.stage in ('agreement_sent','agreement_accepted','in_trial','evaluation_pending') then next_stage:='pending_agreement';
   elsif t.stage='pending_agreement' or (t.stage='pending_confirmation' and t.proposal_sent_at is not null) then next_stage:='pending_confirmation';
   else raise exception 'No hay etapa anterior de prueba disponible'; end if;
   update public.hr_trial_periods set stage=next_stage,proposal_sent_at=case when next_stage='pending_confirmation' then null else proposal_sent_at end,updated_at=now() where id=p_trial;
   update public.hr_candidates set status='interviewed' where id=person.id;
   insert into public.hr_candidate_history(candidate_id,event_type,from_status,to_status,note) values(person.id,'trial_visible_step_back',person.status,'interviewed',jsonb_build_object('actor',auth.uid(),'from_stage',t.stage,'to_stage',next_stage,'trial_before',to_jsonb(t))::text);
   return;
  end if;
  if t.stage not in ('agreement_sent','agreement_accepted','in_trial','evaluation_pending') then raise exception 'Etapa no válida para cerrar'; end if;
  if outcome='not_selected' and length(btrim(coalesce(p_payload->>'reason',''))) not between 1 and 1000 then raise exception 'Selecciona el motivo de no selección'; end if;
  if outcome='profiled' then
   select * into dest from public.hr_vacancies where id=target for share;
   if not found or dest.status<>'active' or dest.id=person.vacancy_id then raise exception 'Selecciona otra convocatoria activa'; end if;
   -- Serialize decisions for the same contact/destination, even from different source applications.
   perform pg_advisory_xact_lock(hashtextextended(dest.id::text||regexp_replace(person.whatsapp,'[^0-9]','','g'),0));
   if exists(select 1 from public.hr_candidates where vacancy_id=dest.id and regexp_replace(whatsapp,'[^0-9]','','g')=regexp_replace(person.whatsapp,'[^0-9]','','g') and status not in ('archived','not_selected')) then raise exception 'Ya existe una candidatura abierta en esa plaza. No se duplicó ni modificó'; end if;
  end if;
  phone:=regexp_replace(person.whatsapp,'[^0-9]','','g');
  if length(phone) not between 8 and 15 then raise exception 'El candidato no tiene un WhatsApp válido'; end if;
  -- Preparing the act and changing destination roll back together on any failure.
  update public.hr_trial_periods set stage='evaluation_pending',updated_at=now() where id=p_trial;
  select * into c from public.hr_trial_closures where trial_id=p_trial for update;
  if not found then links:=public.hr_prepare_trial_closure(p_trial);
  else
   if c.revoked_at is not null or c.expires_at<=now() then raise exception 'El acta está revocada o vencida. Revisa el cierre antes de continuar'; end if;
   select payload into links from public.hr_trial_closure_events where trial_id=p_trial and action='closure_prepared' order by created_at desc limit 1;
  end if;
  if coalesce(links->>'document_url','')='' then raise exception 'No se encontró el Acta de Cierre'; end if;
  if outcome='profiled' then
   -- Copy only identity/contact. No interview, evaluation, trial or old role answers.
   insert into public.hr_candidates(vacancy_id,recruitment_cycle_id,full_name,whatsapp,email,municipality,status,source)
   values(dest.id,dest.recruitment_cycle_id,person.full_name,person.whatsapp,person.email,person.municipality,'new','trial_reprofile') returning id into new_id;
   next_status:='archived';
  else next_status:=outcome; end if;
  update public.hr_candidates set status=next_status,decision_status=outcome,decision_updated_at=now(),
   decision_note=case when outcome='not_selected' then p_payload->>'reason' else decision_note end,
   profiled_target_role=case when outcome='profiled' then dest.title else profiled_target_role end,
   profiled_at=case when outcome='profiled' then now() else profiled_at end where id=person.id;
  update public.hr_trial_periods set stage='completed',completed_at=now(),updated_at=now() where id=p_trial;
  msg:='Hola, '||split_part(trim(person.full_name),' ',1)||E'.\n\nHemos finalizado tu período de prueba para la plaza de '||t.role_title||E' en El Cartel Studio. Gracias por tu esfuerzo y disposición.\n\nPor favor, descarga el Acta de Cierre, imprímela, complétala y fírmala. Entrégala a tu jefe inmediato para formalizar el cierre de esta etapa.\n\n'||(links->>'document_url')||E'\n\n'||case outcome when 'talent_pool' then 'Conservaremos tu candidatura en cantera para futuras oportunidades.' when 'profiled' then 'Te proponemos iniciar un nuevo proceso de selección para la plaza de '||dest.title||'. Esto no implica una contratación.' else 'En esta ocasión no continuaremos con tu candidatura para esta plaza. Gracias por tu participación.' end;
  previous:=jsonb_build_object('outcome',outcome,'vacancy_id',target,'reason',p_payload->>'reason','new_candidate_id',new_id,'original_candidate_id',person.id,'actor',auth.uid(),'message',msg,'phone',phone,'document_url',links->>'document_url','whatsapp_delivery','unconfirmed');
  insert into public.hr_trial_closure_events(trial_id,action,payload) values(p_trial,'finish_without_advance',previous);
  insert into public.hr_candidate_history(candidate_id,event_type,from_status,to_status,note) values(person.id,'trial_closed',person.status,next_status,previous::text);
  if new_id is not null then insert into public.hr_candidate_history(candidate_id,event_type,to_status,note) values(new_id,'trial_reprofile_created','new',jsonb_build_object('original_candidate_id',person.id,'trial_id',p_trial,'actor',auth.uid())::text); end if;
  return;
 end if;
 -- Existing administrative closure actions retained.
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
