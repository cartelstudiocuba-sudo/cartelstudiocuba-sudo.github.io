-- Visible navigation is independent of employment and account lifecycle.
create or replace function studio_access_private.hiring_route(p_candidate uuid,p_action text,p_payload jsonb default '{}') returns boolean
language plpgsql security definer set search_path='' as $$
declare c public.hr_candidates; e public.hr_employees; last_event text; reopened boolean; active_account boolean; state jsonb;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'No autorizado' using errcode='42501'; end if;
 select * into c from public.hr_candidates where id=p_candidate for update;
 if c.id is null then raise exception 'Candidatura inexistente'; end if;
 select event_type into last_event from public.hr_candidate_history where candidate_id=c.id and event_type in ('onboarding_hiring_back','onboarding_hiring_continue','onboarding_hiring_training_back','onboarding_hiring_training_continue') order by created_at desc,id desc limit 1;
 reopened=coalesce(last_event in ('onboarding_hiring_back','onboarding_hiring_training_back','onboarding_hiring_training_continue'),false);
 if p_action='read' then return reopened; end if;
 if p_action='training_read' then return coalesce(last_event='onboarding_hiring_training_back',false); end if;
 if c.status<>'hired' or not exists(select 1 from public.hr_hiring_cases h join public.hr_trial_periods t on t.id=h.trial_id where h.candidate_id=c.id and t.superseded_at is null and h.notified_at is not null) then raise exception 'La etapa cambió. Actualiza la ficha'; end if;
 select * into e from public.hr_employees where candidate_id=c.id for update;
 if e.id is null or e.status='terminated' or exists(select 1 from studio_offboarding_private.cases where employee_id=e.id and (revoked_at is null or finalized_at is not null)) then raise exception 'Expediente no disponible para retroceso'; end if;
 if p_action='back' then
  if reopened then raise exception 'El paso 11 ya está abierto'; end if;
  state=studio_access_private.system_onboarding(c.id,'read','{}');
  if state->>'route_reopened_at' is null and (coalesce((state->>'protected')::boolean,false) or (state->>'configured_at' is not null and state->>'created_at' is not null and state->>'whatsapp_opened_at' is not null)) then raise exception 'La etapa cambió: primero regresa del paso 13 al paso 12'; end if;
  active_account=coalesce(e.system_access_enabled,false) and e.system_auth_user_id is not null;
  if active_account and not coalesce((p_payload->>'acknowledge_active_account')::boolean,false) then raise exception 'La cuenta está activa. Confirma el aviso de seguridad antes de regresar'; end if;
 elsif p_action='training_back' then
  if not reopened or last_event='onboarding_hiring_training_back' then raise exception 'Actualiza la ficha: primero abre el paso 11'; end if;
 elsif p_action='training_continue' then
  if last_event is distinct from 'onboarding_hiring_training_back' then raise exception 'El paso 10 ya no está abierto'; end if;
 elsif p_action='continue' then
  if not reopened then return false; end if;
  if last_event='onboarding_hiring_training_back' then raise exception 'Completa primero la revisión del paso 10'; end if;
 else raise exception 'Acción no válida'; end if;
 insert into public.hr_candidate_history(candidate_id,event_type,from_status,to_status,note,created_at) values(c.id,'onboarding_hiring_'||p_action,c.status,c.status,'Navegación de ruta: '||case p_action when 'back' then '12 → 11' when 'training_back' then '11 → 10' when 'training_continue' then '10 → 11' else '11 → 12' end||'. Contratación, contratos, cuenta y permisos conservados.',clock_timestamp());
 return p_action<>'continue';
end $$;
revoke all on function studio_access_private.hiring_route(uuid,text,jsonb) from public,anon;
grant execute on function studio_access_private.hiring_route(uuid,text,jsonb) to authenticated;

-- Read the current labor file without rotating links or changing any account.
create or replace function studio_access_private.hiring_contact(p_candidate uuid) returns text
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'No autorizado' using errcode='42501'; end if;
 return (select nullif(trim(h.data->>'email'),'') from public.hr_hiring_cases h join public.hr_trial_periods t on t.id=h.trial_id where h.candidate_id=p_candidate and t.superseded_at is null);
end $$;
revoke all on function studio_access_private.hiring_contact(uuid) from public,anon;
grant execute on function studio_access_private.hiring_contact(uuid) to authenticated;

create or replace function public.system_onboarding(p_candidate uuid,p_action text default 'read',p_payload jsonb default '{}') returns jsonb
language plpgsql set search_path='' as $$
declare reopened boolean; result jsonb;
begin
 if p_action in ('hiring_back','hiring_continue','hiring_training_back','hiring_training_continue') then
  reopened=studio_access_private.hiring_route(p_candidate,substring(p_action from 8),p_payload);
  result=studio_access_private.system_onboarding(p_candidate,'read','{}');
 else
  result=studio_access_private.system_onboarding(p_candidate,p_action,p_payload);
  reopened=studio_access_private.hiring_route(p_candidate,'read','{}');
 end if;
 return result||jsonb_build_object('hiring_reopened',reopened,'hiring_training_reopened',studio_access_private.hiring_route(p_candidate,'training_read','{}'),'hiring_email',studio_access_private.hiring_contact(p_candidate));
end $$;
revoke all on function public.system_onboarding(uuid,text,jsonb) from public,anon;
grant execute on function public.system_onboarding(uuid,text,jsonb) to authenticated;
