-- Restore the previous functions only; retain all real data and pricing history.
do $$declare r record;begin perform pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));for r in select definition from studio_access_private.fridge_pricing_backups loop execute r.definition;end loop;end $$;
revoke all on function public.fridge_pricing_state(),public.fridge_pricing_command(uuid,text,jsonb),studio_access_private.fridge_pricing_state(),studio_access_private.fridge_pricing_command(uuid,text,jsonb) from authenticated;
