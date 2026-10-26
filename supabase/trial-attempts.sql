-- Preserve every closed trial; only one attempt per candidate is current.
alter table public.hr_trial_periods add column if not exists superseded_at timestamptz;
alter table public.hr_trial_periods drop constraint if exists hr_trial_periods_candidate_id_key;
create unique index if not exists hr_trial_periods_current_candidate on public.hr_trial_periods(candidate_id) where superseded_at is null;

create or replace function public.hr_request_trial(p_candidate uuid,p_expected_trial uuid,p_terms jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare person public.hr_candidates%rowtype; t public.hr_trial_periods%rowtype; result public.hr_trial_periods%rowtype; previous_id uuid;
begin
 if auth.uid() is null or not coalesce(studio_access_private.is_owner(),false) then raise exception 'No autorizado'; end if;
 select * into person from public.hr_candidates where id=p_candidate for update;
 if not found or person.status not in ('interviewed','talent_pool','trial') or exists(select 1 from public.hr_employees where candidate_id=p_candidate and status='active') then raise exception 'La candidatura cambió. Actualiza la ficha'; end if;
 select * into t from public.hr_trial_periods where candidate_id=p_candidate and superseded_at is null for update;
 if t.id is distinct from p_expected_trial then raise exception 'La prueba cambió. Actualiza la ficha antes de enviar otra propuesta'; end if;
 if (p_terms->>'duration_days')::integer not between 1 and 90 or nullif(p_terms->>'start_date','') is null or nullif(trim(p_terms->>'role_title'),'') is null then raise exception 'Completa fecha, duración y plaza'; end if;
 if t.id is not null and (t.stage='completed' or exists(select 1 from public.hr_trial_closure_events where trial_id=t.id and action='finish_without_advance')) then
  if person.status<>'interviewed' then raise exception 'Para iniciar otra prueba, pasa primero la ficha a Por decidir'; end if;
  previous_id:=t.id;
  update public.hr_trial_periods set superseded_at=now() where id=t.id;
  t.id:=null;
 elsif t.id is not null and t.stage not in ('pending_confirmation','pending_agreement') then
  raise exception 'Ya hay una prueba en curso. Actualiza la ficha';
 end if;
 if t.id is null then
  insert into public.hr_trial_periods(candidate_id,vacancy_id,role_title,start_date,duration_days,schedule,compensation,location,notes,stage,proposal_sent_at)
  values(p_candidate,person.vacancy_id,p_terms->>'role_title',(p_terms->>'start_date')::date,(p_terms->>'duration_days')::integer,p_terms->>'schedule',p_terms->>'compensation',p_terms->>'location',p_terms->>'notes','pending_agreement',now()) returning * into result;
 else
  update public.hr_trial_periods set role_title=p_terms->>'role_title',start_date=(p_terms->>'start_date')::date,duration_days=(p_terms->>'duration_days')::integer,schedule=p_terms->>'schedule',compensation=p_terms->>'compensation',location=p_terms->>'location',notes=p_terms->>'notes',stage='pending_agreement',proposal_sent_at=now(),updated_at=now() where id=t.id returning * into result;
 end if;
 update public.hr_candidates set decision_status=null,decision_note=null,decision_updated_at=now() where id=p_candidate;
 if previous_id is not null then
  insert into public.hr_candidate_history(candidate_id,event_type,from_status,to_status,note) values(p_candidate,'trial_restarted',person.status,person.status,jsonb_build_object('previous_trial_id',previous_id,'trial_id',result.id,'actor',auth.uid())::text);
 end if;
 return to_jsonb(result);
end $$;
revoke all on function public.hr_request_trial(uuid,uuid,jsonb) from public,anon;
grant execute on function public.hr_request_trial(uuid,uuid,jsonb) to authenticated;

-- Stale browser tabs cannot mutate an archived attempt or reapply its destination.
create or replace function public.hr_guard_closed_trial_stage() returns trigger language plpgsql set search_path='' as $$
begin
 if old.superseded_at is not null or (new.stage<>'completed' and exists(select 1 from public.hr_trial_closure_events where trial_id=old.id and action='finish_without_advance')) then
  raise exception 'Esta prueba ya tiene un cierre confirmado. Actualiza la ficha' using errcode='23514';
 end if;
 return new;
end $$;
