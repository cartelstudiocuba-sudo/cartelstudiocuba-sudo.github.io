-- Frontend must be reverted together. Historical reports and business records are untouched.
select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
drop function if exists public.fridge_account_board();
drop function if exists studio_access_private.fridge_account_board();
do $$declare r record;d text;begin
 for r in select oid from pg_proc where pronamespace='studio_access_private'::regnamespace and proname like 'fridge_reconciliation_snapshot%' loop
 d:=pg_get_functiondef(r.oid);
 if position('studio_access_private.fridge_account_settled' in d)>0 then
 d:=replace(d,' (p_report is not null or studio_access_private.fridge_account_settled(nullif(o.result->>''customer_id'','''')::uuid)) and','');execute d;
 end if;
 end loop;
end $$;
drop function studio_access_private.fridge_account_settled(uuid);
