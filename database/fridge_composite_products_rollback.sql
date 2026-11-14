-- Restore prior behavior without deleting compositions, audit or product metadata.
select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
do $$declare r record;begin
 for r in select definition from studio_access_private.fridge_pricing_backups where name in ('composite.fridge_command','composite.fridge_pricing_command') loop execute r.definition;end loop;
end $$;
