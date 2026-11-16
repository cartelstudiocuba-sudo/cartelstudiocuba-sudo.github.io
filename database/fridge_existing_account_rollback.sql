-- Restore the former write/state paths; retain every sale, stock movement and debt.
select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
do $$declare d text;begin
 select definition into strict d from studio_access_private.fridge_pricing_backups where name='existing-account.fridge_command';execute d;
 select definition into strict d from studio_access_private.fridge_pricing_backups where name='existing-account.fridge_state';execute d;
end $$;
