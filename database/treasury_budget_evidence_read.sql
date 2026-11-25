create function public.treasury_budget_evidence(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not (studio_access_private.fridge_manager() or exists(select 1 from public.purchase_budget_requests where id=p_id and requester=auth.uid())) then raise exception 'Acceso no autorizado';end if;
 return (select evidence from studio_access_private.treasury_reservations where request_id=p_id and status='delivered');
end $$;
revoke all on function public.treasury_budget_evidence(uuid) from public,anon;
grant execute on function public.treasury_budget_evidence(uuid) to authenticated;
