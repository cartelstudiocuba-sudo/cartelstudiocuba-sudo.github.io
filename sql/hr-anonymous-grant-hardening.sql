-- RLS already denies anonymous HR row access. Remove unused anonymous table capabilities too.
-- Authenticated worker roles, RLS policies, public-token RPCs and existing data are unchanged.
revoke all on public.hr_employees,public.hr_employee_documents,public.hr_employee_assets from anon;

