-- Real server/RLS checks. All test rows are inside a rolled-back transaction.
begin;
select set_config('request.jwt.claims','{"sub":"aedb58e6-56ca-4308-9796-bb77070f649a","role":"authenticated"}',true);
set local role authenticated;
do $$
declare pid uuid; first_request uuid=gen_random_uuid(); second_request uuid=gen_random_uuid(); out_request uuid=gen_random_uuid(); buy jsonb; sale jsonb; before_count bigint;
begin
 if not public.inventory_has_access('read') or not public.inventory_has_access('write') then raise exception 'Alejandro permissions failed'; end if;
 buy=jsonb_build_object('kind','entry','name','ROLLBACK ONLY inventory verification','category','Otros','unit','Unidad','currency','CUP','quantity',10,'unit_cost',10,'minimum_stock',3,'occurred_on',current_date);
 perform public.inventory_record_movement(first_request,buy);
 select product_id into strict pid from public.inventory_movements where id=first_request;
 perform public.inventory_record_movement(first_request,buy);
 if (select stock from public.inventory_products where id=pid)<>10 then raise exception 'Duplicate entry'; end if;
 begin
  perform public.inventory_record_movement(first_request,buy||'{"quantity":11}'::jsonb);
  raise exception 'Changed replay accepted';
 exception when raise_exception then if sqlerrm='Changed replay accepted' then raise; end if; end;
 buy=buy||jsonb_build_object('product_id',pid,'quantity',5,'unit_cost',20);
 perform public.inventory_record_movement(second_request,buy);
 if not exists(select 1 from public.inventory_products where id=pid and stock=15 and unit_cost=20) then raise exception 'Last purchase failed'; end if;
 sale=jsonb_build_object('kind','out','product_id',pid,'quantity',4,'unit_cost',999,'occurred_on',current_date,'allocation_type','project','project_reference','VERIFICATION ONLY','receiving_area','Diseño','received_by','Test receiver');
 perform public.inventory_record_movement(out_request,sale);
 perform public.inventory_record_movement(out_request,sale);
 if not exists(select 1 from public.inventory_products where id=pid and stock=11 and unit_cost=20) then raise exception 'Output stock/cost failed'; end if;
 if not exists(select 1 from public.inventory_movements where id=out_request and unit_cost=20 and currency='CUP' and product_unit='Unidad' and recorded_by_name='Alejandro Garcés Noriega') then raise exception 'Output snapshot failed'; end if;
 if (select count(*) from public.inventory_economic_movements where source_movement_id=out_request and unit_cost=20 and currency='CUP')<>1 then raise exception 'Economic idempotency failed'; end if;
 perform public.inventory_record_movement(gen_random_uuid(),buy||'{"quantity":1,"unit_cost":30}'::jsonb);
 if (select unit_cost from public.inventory_movements where id=out_request)<>20 or (select unit_cost from public.inventory_economic_movements where source_movement_id=out_request)<>20 then raise exception 'Historical cost changed'; end if;
 perform public.inventory_record_movement(gen_random_uuid(),sale||'{"quantity":1,"allocation_type":"administrative","project_reference":null}'::jsonb);
 if not exists(select 1 from public.inventory_products where id=pid and stock=11 and unit_cost=30) then raise exception 'Administrative output changed purchase cost'; end if;
 select count(*) into before_count from public.inventory_movements where product_id=pid;
 begin
  perform public.inventory_record_movement(gen_random_uuid(),sale||'{"quantity":100000}'::jsonb);raise exception 'Negative stock allowed';
 exception when raise_exception then if sqlerrm='Negative stock allowed' then raise; end if; end;
 begin
  perform public.inventory_record_movement(gen_random_uuid(),buy||'{"currency":"USD"}'::jsonb);raise exception 'Currency mixing allowed';
 exception when raise_exception then if sqlerrm='Currency mixing allowed' then raise; end if; end;
 begin
  perform public.inventory_record_movement(gen_random_uuid(),sale||'{"received_by":""}'::jsonb);raise exception 'Missing receiver accepted';
 exception when raise_exception then if sqlerrm='Missing receiver accepted' then raise; end if; end;
 if (select count(*) from public.inventory_movements where product_id=pid)<>before_count then raise exception 'Failed operation leaked movement'; end if;
 perform public.inventory_set_minimum(pid,5);
 if (select minimum_stock from public.inventory_products where id=pid)<>5 then raise exception 'Minimum update failed'; end if;
 update public.inventory_products set stock=999 where id=pid;
 if (select stock from public.inventory_products where id=pid)<>11 then raise exception 'Direct stock mutation permitted'; end if;
 begin
  update public.inventory_movements set unit_cost=99 where id=out_request;raise exception 'Movement mutable';
 exception when insufficient_privilege then null; end;
 if not exists(select 1 from storage.objects where bucket_id='inventory-images') then raise exception 'Alejandro private photo read failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"ff6bcd72-963c-4ea4-9a33-1722fe44c384","role":"authenticated"}',true);
set local role authenticated;
do $$ declare pid uuid; begin
 if not public.inventory_has_access('read') or public.inventory_has_access('write') then raise exception 'Melanie permissions failed'; end if;
 select id into strict pid from public.inventory_products where name='ROLLBACK ONLY inventory verification';
 if not exists(select 1 from public.inventory_movements where product_id=pid) then raise exception 'History read failed'; end if;
 if not exists(select 1 from storage.objects where bucket_id='inventory-images') then raise exception 'Melanie private photo read failed'; end if;
 begin perform public.inventory_set_minimum(pid,1);raise exception 'Reader changed minimum';exception when insufficient_privilege then null;end;
 begin perform public.inventory_record_movement(gen_random_uuid(),'{}');raise exception 'Reader recorded movement';exception when insufficient_privilege then null;end;
 begin insert into public.inventory_products(name,category,unit,currency) values('FORBIDDEN','Otros','Unidad','CUP');raise exception 'Reader created product';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: Alejandro write/read; Melanie read-only; last purchase 10 -> 20 -> 30; output snapshot frozen at 20; project/admin; no negative stock; currency isolation; exact replay; changed replay rejected; minimums; private photo metadata; direct mutations denied; fixtures rolled back.' as result;
