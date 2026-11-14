-- Restore prior commands/state; retain area metadata and historical snapshots.
select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
do $$declare r record;begin for r in select definition from studio_access_private.finance_cost_backups where name in ('areas.finance_cost_state','areas.finance_cost_command') loop execute r.definition;end loop;end $$;
