-- Authenticated server integration test. Fixture writes are rolled back by a caught subtransaction exception.
-- Requires an existing authorized inventory movement to choose a test principal.
-- Never commits fixture products, movements, economic entries or ledger records.
do $test$
declare
 actor uuid; pid uuid:=gen_random_uuid(); rid uuid:=gen_random_uuid(); extra_rid uuid:=gen_random_uuid();
 body jsonb; before_counts jsonb; after_counts jsonb;
 stock_after numeric; row_count bigint; economic_count bigint; changed_rejected boolean:=false; insufficient_rejected boolean:=false; rejected_code text;
begin
 perform set_config('lock_timeout','2s',true);
 perform set_config('statement_timeout','15s',true);
 select created_by into strict actor from public.inventory_movements order by created_at limit 1;
 select jsonb_build_object('products',(select count(*) from public.inventory_products),'movements',(select count(*) from public.inventory_movements),'economic',(select count(*) from public.inventory_economic_movements),'ledger',(select count(*) from public.inventory_fund_ledger)) into before_counts;
 begin
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor::text,'role','authenticated')::text,true);
  if not public.inventory_has_access('write') then raise exception 'Test actor has no write access'; end if;
  insert into public.inventory_products(id,name,category,unit,currency,stock,unit_cost,minimum_stock)
  values(pid,'TEST ROLLBACK recovery '||rid::text,'Otros','Unidad','CUP',5,25,0);
  perform set_config('role','authenticated',true);
  body:=jsonb_build_object('product_id',pid,'kind','out','quantity',2,'currency','CUP','occurred_on',(now() at time zone 'America/Havana')::date,'allocation_type','project','project_reference','TEST ROLLBACK','receiving_area','Gerencia','received_by','TEST ROLLBACK','notes','Prueba transaccional: siempre revertida');
  -- Save then retry twice with the same request, including recovery after an assumed lost response.
  perform public.inventory_record_movement(rid,body);
  perform public.inventory_record_movement(rid,body);
  perform public.inventory_record_movement(rid,body);
  select stock into stock_after from public.inventory_products where id=pid;
  select count(*) into row_count from public.inventory_movements where id=rid;
  select count(*) into economic_count from public.inventory_economic_movements where source_movement_id=rid;
  if stock_after<>3 or row_count<>1 or economic_count<>1 then raise exception 'Idempotency assertion failed'; end if;
  begin
   perform public.inventory_record_movement(rid,body||jsonb_build_object('quantity',1));
  exception when others then
   get stacked diagnostics rejected_code=returned_sqlstate;
   if sqlerrm not like '%otros datos%' then raise; end if;
   changed_rejected:=true;
  end;
  if not changed_rejected then raise exception 'Changed payload was accepted'; end if;
  begin
   perform public.inventory_record_movement(extra_rid,body||jsonb_build_object('quantity',99));
  exception when others then
   if sqlerrm not like '%Existencias insuficientes%' then raise; end if;
   insufficient_rejected:=true;
  end;
  if not insufficient_rejected then raise exception 'Insufficient stock was accepted'; end if;
  if (select stock from public.inventory_products where id=pid)<>3 then raise exception 'Rejected requests modified stock'; end if;
  if exists(select 1 from public.inventory_movements where id=extra_rid) then raise exception 'Rejected request was recorded'; end if;
  -- Roll back the entire fixture subtransaction, including product, stock and economic entries.
  raise exception using errcode='PZ001',message='ALL_ASSERTIONS_PASSED_ROLLBACK';
 exception when sqlstate 'PZ001' then
  if sqlerrm<>'ALL_ASSERTIONS_PASSED_ROLLBACK' then raise; end if;
 end;
 select jsonb_build_object('products',(select count(*) from public.inventory_products),'movements',(select count(*) from public.inventory_movements),'economic',(select count(*) from public.inventory_economic_movements),'ledger',(select count(*) from public.inventory_fund_ledger)) into after_counts;
 if before_counts<>after_counts or exists(select 1 from public.inventory_products where id=pid) or exists(select 1 from public.inventory_movements where id in (rid,extra_rid)) then raise exception 'Rollback verification failed'; end if;
 perform set_config('cartel_test.result',jsonb_build_object('status','PASS','same_request_attempts',3,'movement_rows',row_count,'economic_rows',economic_count,'fixture_stock_after',stock_after,'changed_payload_rejected',changed_rejected,'insufficient_stock_rejected',insufficient_rejected,'rollback_verified',true,'counts_before',before_counts,'counts_after',after_counts)::text,true);
end
$test$;
select current_setting('cartel_test.result')::jsonb as isolated_transaction_test;
