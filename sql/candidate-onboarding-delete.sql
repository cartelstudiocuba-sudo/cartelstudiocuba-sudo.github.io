-- Candidate-owned onboarding progress follows an explicitly deleted candidature.
-- Employee, Auth user, role/view grants and access snapshots remain independent.
-- Existing hr_employees.candidate_id uses ON DELETE SET NULL; do not change it.
-- This migration deletes no existing records and changes no authorization grants.
begin;
alter table studio_access_private.onboarding
 drop constraint onboarding_candidate_id_fkey;
alter table studio_access_private.onboarding
 add constraint onboarding_candidate_id_fkey
 foreign key (candidate_id) references public.hr_candidates(id) on delete cascade;
commit;
