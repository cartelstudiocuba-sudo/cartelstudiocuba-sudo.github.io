
-- A completed decision belongs to this trial, never reopen it via an old browser tab.
create or replace function public.hr_guard_closed_trial_stage() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.stage<>'completed' and exists(select 1 from public.hr_trial_closure_events where trial_id=old.id and action='finish_without_advance') then
  raise exception 'Esta prueba ya tiene un cierre confirmado. Actualiza la ficha' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function public.hr_guard_closed_trial_stage() from public,anon,authenticated;
drop trigger if exists hr_guard_closed_trial_stage on public.hr_trial_periods;
create trigger hr_guard_closed_trial_stage before update of stage on public.hr_trial_periods for each row execute function public.hr_guard_closed_trial_stage();
