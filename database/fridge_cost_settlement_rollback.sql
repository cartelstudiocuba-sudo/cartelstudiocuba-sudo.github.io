-- Restore prior entry points, preserving every frozen report and payment.
select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
do $$begin if exists(select 1 from studio_access_private.fridge_reconciliations where snapshot ? 'cost_settlement' and status<>'confirmed') then raise exception 'Confirma o resuelve los cuadres nuevos pendientes antes de revertir';end if;end $$;
do $$declare r record;begin for r in select definition from studio_access_private.fridge_pricing_backups where name like 'settlement.%' loop execute r.definition;end loop;end $$;
