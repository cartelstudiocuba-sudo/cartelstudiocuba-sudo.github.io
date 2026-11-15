-- Preserve all sales, accounts, receipts and historical cost-only fund calculations.
-- Block new clients until their checkout is refreshed; restore old pricing ledger.
select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
do $$declare d text;begin
 select definition into strict d from studio_access_private.fridge_pricing_backups where name='cost-courtesy.fridge_command_core';execute d;
 select definition into strict d from studio_access_private.fridge_pricing_backups where name='cost-courtesy.fridge_command';execute d;
end $$;
-- Cost-only sales are rejected by the restored checkout; no silent free loss fallback.
