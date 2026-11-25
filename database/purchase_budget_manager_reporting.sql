create policy purchase_budget_manager_reporting on public.purchase_budget_requests
for select to authenticated
using (coalesce((public.purchase_budget_capabilities()->>'manager')::boolean,false));
