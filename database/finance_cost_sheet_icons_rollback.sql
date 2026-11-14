-- Keep saved identifiers and historical icons while restoring the prior command.
select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
do $$declare d text;begin select definition into strict d from studio_access_private.finance_cost_backups where name='icons.finance_cost_command';execute d;end $$;
