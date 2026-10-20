-- Restore the intended owner workflow. The restrictive guard alone denies all rows.
-- Both policies require the existing owner identity; no other role gains access.
create policy hr_trial_periods_owner_access
on public.hr_trial_periods as permissive for all to authenticated
using ((select studio_access_private.is_owner()))
with check ((select studio_access_private.is_owner()));
