-- Integration test: fixture writes always roll back; production records are preserved.
do $test$
declare
 actor uuid; pid uuid:=gen_random_uuid(); purchase_id uuid:=gen_random_uuid(); next_id uuid:=gen_random_uuid(); out_id uuid:=gen_random_uuid();
 body jsonb; before_counts jsonb; after_counts jsonb; changed_rejected boolean:=false; cup_rejected boolean:=false; stock_rejected boolean:=false;
begin
 perform set_config('lock_timeout','2s',true);
 perform set_config('statement_timeout','15s',true);
 select created_by into strict actor from public.inventory_movements order by created_at limit 1;
 select jsonb_build_object('products',(select count(*) from public.inventory_products),'movements',(select count(*) from public.inventory_movements),'economic',(select count(*) from public.inventory_economic_movements),'ledger',(select count(*) from public.inventory_fund_ledger)) into before_counts;
 begin
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor::text,'role','authenticated')::text,true);
  insert into public.inventory_products(id,name,category,unit,currency,stock,unit_cost,minimum_stock)
  values(pid,'TEST ROLLBACK finance deferred '||pid::text,'Otros','Unidad','CUP',0,0,0);
  perform set_config('role','authenticated',true);
  body:=jsonb_build_object('product_id',pid,'kind','entry','quantity',2,'unit_cost',25,'currency','CUP','occurred_on',(now() at time zone 'America/Havana')::date,'notes','TEST ROLLBACK no finance');
  perform public.inventory_record_movement(purchase_id,body);
  perform public.inventory_record_movement(purchase_id,body);
  perform public.inventory_record_movement(purchase_id,body);
  if (select stock from public.inventory_products where id=pid)<>2 or (select count(*) from public.inventory_movements where id=purchase_id)<>1 then raise exception 'Purchase retry duplicated stock or movement'; end if;
  if exists(select 1 from public.inventory_fund_ledger) then raise exception 'Purchase posted to deferred fund'; end if;
  begin
   perform public.inventory_record_movement(purchase_id,body||jsonb_build_object('quantity',1));
  exception when others then if sqlerrm not like '%otros datos%' then raise; end if; changed_rejected:=true;
  end;
  if not changed_rejected then raise exception 'Changed retry accepted'; end if;
  begin
   perform public.inventory_record_movement(gen_random_uuid(),body||jsonb_build_object('currency','USD'));
  exception when others then if sqlerrm not like '%CUP%' and sqlerrm not like '%moneda debe coincidir%' then raise; end if; cup_rejected:=true;
  end;
  if not cup_rejected then raise exception 'USD accepted'; end if;
  perform public.inventory_record_movement(next_id,body||jsonb_build_object('quantity',1,'unit_cost',40));
  if (select stock from public.inventory_products where id=pid)<>3 or (select unit_cost from public.inventory_products where id=pid)<>40 then raise exception 'Last purchase cost or stock failed'; end if;
  body:=jsonb_build_object('product_id',pid,'kind','out','quantity',1,'currency','CUP','occurred_on',(now() at time zone 'America/Havana')::date,'allocation_type','project','project_reference','TEST ROLLBACK','receiving_area','Gerencia','received_by','TEST','notes','TEST ROLLBACK');
  perform public.inventory_record_movement(out_id,body);
  perform public.inventory_record_movement(out_id,body);
  if (select stock from public.inventory_products where id=pid)<>2 or (select unit_cost from public.inventory_movements where id=out_id)<>40 or (select count(*) from public.inventory_economic_movements where source_movement_id=out_id)<>1 then raise exception 'Consumption cost or retry failed'; end if;
  begin
   perform public.inventory_record_movement(gen_random_uuid(),body||jsonb_build_object('quantity',99));
  exception when others then if sqlerrm not like '%Existencias insuficientes%' then raise; end if; stock_rejected:=true;
  end;
  if not stock_rejected or (select stock from public.inventory_products where id=pid)<>2 then raise exception 'Stock protection failed'; end if;
  if exists(select 1 from public.inventory_fund_ledger) then raise exception 'Deferred ledger changed'; end if;
  raise exception using errcode='PZ001',message='FINANCE_DEFERRED_TEST_PASSED_ROLLBACK';
 exception when sqlstate 'PZ001' then
  if sqlerrm<>'FINANCE_DEFERRED_TEST_PASSED_ROLLBACK' then raise; end if;
 end;
 select jsonb_build_object('products',(select count(*) from public.inventory_products),'movements',(select count(*) from public.inventory_movements),'economic',(select count(*) from public.inventory_economic_movements),'ledger',(select count(*) from public.inventory_fund_ledger)) into after_counts;
 if before_counts<>after_counts or exists(select 1 from public.inventory_products where id=pid) then raise exception 'Rollback mismatch'; end if;
 perform set_config('cartel_test.result',jsonb_build_object('status','PASS','purchase_without_opening',true,'purchase_attempts_same_id',3,'cash_posts',0,'last_purchase_cost',40,'exit_historical_cost',40,'changed_retry_rejected',changed_rejected,'usd_rejected',cup_rejected,'insufficient_stock_rejected',stock_rejected,'rollback_verified',true,'counts_before',before_counts,'counts_after',after_counts)::text,true);
end
$test$;
select current_setting('cartel_test.result')::jsonb as test_result;
