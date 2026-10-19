-- RUN ONLY AFTER THE USER FINISHES THE DEMO AND REQUESTS ITS REMOVAL.
-- Removes only fixed demo product IDs and their linked inventory activity.
-- Existing products, including the original Mouse, are outside this scope.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
do $cleanup$
declare ids uuid[]; before_other jsonb; after_other jsonb;
begin
 select array_agg(md5('DEMO_INSUMOS_20261018_V1:product:'||g)::uuid) into ids from generate_series(1,30)g;
 if exists(select 1 from public.inventory_products where id=any(ids) and photo_path is not null) then
  raise exception 'Review uploaded demo photos and remove them through the Storage API before database cleanup';
 end if;
 if exists(select 1 from public.inventory_fund_ledger where movement_id in(select id from public.inventory_movements where product_id=any(ids))) or
    exists(select 1 from public.inventory_cash_reimbursements where economic_movement_id in(select id from public.inventory_economic_movements where product_id=any(ids))) then
  raise exception 'Demo data now has Finance references; review before removal';
 end if;
 select jsonb_build_object('products',(select jsonb_agg(to_jsonb(p) order by p.id) from public.inventory_products p where not(p.id=any(ids))),'movements',(select jsonb_agg(to_jsonb(m) order by m.id) from public.inventory_movements m where not(m.product_id=any(ids)))) into before_other;
 delete from public.inventory_economic_movements where product_id=any(ids) or source_movement_id in(select id from public.inventory_movements where product_id=any(ids));
 delete from public.inventory_movements where product_id=any(ids);
 delete from public.inventory_products where id=any(ids);
 select jsonb_build_object('products',(select jsonb_agg(to_jsonb(p) order by p.id) from public.inventory_products p where not(p.id=any(ids))),'movements',(select jsonb_agg(to_jsonb(m) order by m.id) from public.inventory_movements m where not(m.product_id=any(ids)))) into after_other;
 if before_other is distinct from after_other then raise exception 'Non-demo data changed'; end if;
end $cleanup$;
commit;
