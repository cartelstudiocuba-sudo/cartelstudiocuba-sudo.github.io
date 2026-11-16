select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
drop function studio_access_private.fridge_reconciliation_command(uuid,text,jsonb);
alter function studio_access_private.fridge_reconciliation_command_before_original_currency(uuid,text,jsonb) rename to fridge_reconciliation_command;
grant execute on function studio_access_private.fridge_reconciliation_command(uuid,text,jsonb) to authenticated;
drop function studio_access_private.fridge_original_receipts(jsonb);
