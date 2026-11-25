create function public.treasury_bar_linked(p_id uuid) returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if not studio_access_private.fridge_manager() then return false;end if;
 return exists(select 1 from studio_access_private.treasury_ledger where source='bar' and metadata->>'report_id'=p_id::text);
end $$;
revoke all on function public.treasury_bar_linked(uuid) from public,anon;
grant execute on function public.treasury_bar_linked(uuid) to authenticated;
create function studio_access_private.treasury_disbursement_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from studio_access_private.treasury_ledger where source='bar' and metadata->>'report_id'=new.reconciliation_id::text) then raise exception 'Este cuadre ya fue distribuido en Tesorería. Registra los pagos desde Finanzas.';end if;return new;
end $$;
create trigger treasury_disbursement_guard before insert on studio_access_private.fridge_disbursements for each row execute function studio_access_private.treasury_disbursement_guard();
revoke all on function studio_access_private.treasury_disbursement_guard() from public,anon,authenticated;
