create policy cartel_hr_insert_answers on public.hr_candidate_answers for insert to authenticated with check ((select studio_access_private.is_owner()) and exists (select 1 from public.hr_candidates c where c.id = candidate_id));
create policy cartel_hr_update_answers on public.hr_candidate_answers for update to authenticated using ((select studio_access_private.is_owner())) with check ((select studio_access_private.is_owner()) and exists (select 1 from public.hr_candidates c where c.id = candidate_id));
revoke all on public.hr_candidate_answers from anon;
revoke truncate, references, trigger, delete on public.hr_candidate_answers from authenticated;
grant select, insert, update on public.hr_candidate_answers to authenticated;
