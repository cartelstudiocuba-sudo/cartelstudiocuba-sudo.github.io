begin;
update studio_access_private.inventory_order_settings set enforce_approval=true;
insert into public.inventory_products(id,name,category,department,unit,currency,stock,unit_cost) values
('ab222222-1111-4111-8111-111111111111','__orders_test_AV__','Limpieza','Audiovisual','Unidad','USD',100,1),
('ab222222-1111-4111-8111-111111111112','__orders_test_General__','Limpieza','Generales','Unidad','USD',100,2),
('ab222222-1111-4111-8111-111111111113','__orders_test_Grafica__','Limpieza','Gráfica','Unidad','USD',100,3);
insert into storage.objects(bucket_id,name,owner_id,metadata) values('inventory-delivery-evidence','aedb58e6-56ca-4308-9796-bb77070f649a/ab222222-1111-4111-8111-111111111115.jpg','aedb58e6-56ca-4308-9796-bb77070f649a','{"size":1000,"mimetype":"image/jpeg"}');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aedb58e6-56ca-4308-9796-bb77070f649a","role":"authenticated"}',true);
select public.inventory_order_create('ab222222-1111-4111-8111-111111111114','{"area":"Audiovisual","purpose":"area","recipient_name":"Receptor de prueba","delivery_location":"Taller","needed_on":"2026-11-13","items":[{"product_id":"ab222222-1111-4111-8111-111111111111","quantity":20},{"product_id":"ab222222-1111-4111-8111-111111111112","quantity":10}]}');
do $$begin
 if (select stock from public.inventory_products where id='ab222222-1111-4111-8111-111111111111')<>100 then raise exception 'Request changed stock';end if;
 begin perform public.inventory_order_decide('ab222222-1111-4111-8111-111111111114','approve','{}','');raise exception 'Administrator approval accepted';exception when insufficient_privilege then null;end;
 begin perform public.inventory_record_movement('ab222222-1111-4111-8111-111111111119','{"kind":"out","product_id":"ab222222-1111-4111-8111-111111111111","quantity":1,"occurred_on":"2026-11-12","allocation_type":"administrative","receiving_area":"Audiovisual","received_by":"Test","notes":"Test"}');raise exception 'Unapproved movement accepted';exception when others then if sqlerrm='Unapproved movement accepted' then raise;end if;end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"6418ad20-d0e8-49c0-8d9a-e1da3daf71b6","role":"authenticated"}',true);
select public.inventory_order_decide('ab222222-1111-4111-8111-111111111114','approve',(select jsonb_object_agg(id,requested_quantity) from public.inventory_order_items where order_id='ab222222-1111-4111-8111-111111111114'),'');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aedb58e6-56ca-4308-9796-bb77070f649a","role":"authenticated"}',true);
select public.inventory_order_prepare('ab222222-1111-4111-8111-111111111114',(select jsonb_object_agg(id,approved_quantity) from public.inventory_order_items where order_id='ab222222-1111-4111-8111-111111111114'));
do $$declare payload jsonb;before_stock numeric;begin
 select jsonb_build_object('recipient_name','Receptor de prueba','proof_type','photo','proof_path','aedb58e6-56ca-4308-9796-bb77070f649a/ab222222-1111-4111-8111-111111111115.jpg','items',jsonb_agg(jsonb_build_object('item_id',id,'quantity',5))) into payload from public.inventory_order_items where order_id='ab222222-1111-4111-8111-111111111114';
 perform public.inventory_order_deliver('ab222222-1111-4111-8111-111111111115','ab222222-1111-4111-8111-111111111114',payload);
 if (select status from public.inventory_orders where id='ab222222-1111-4111-8111-111111111114')<>'partial' then raise exception 'Partial state incorrect';end if;
 select stock into before_stock from public.inventory_products where id='ab222222-1111-4111-8111-111111111111';if before_stock<>95 then raise exception 'Stock incorrect';end if;
 perform public.inventory_order_deliver('ab222222-1111-4111-8111-111111111115','ab222222-1111-4111-8111-111111111114',payload);
 if (select stock from public.inventory_products where id='ab222222-1111-4111-8111-111111111111')<>95 then raise exception 'Delivery duplicated';end if;
 if (select (p->>'reserved')::numeric from jsonb_array_elements(public.inventory_order_catalog()) p where p->>'id'='ab222222-1111-4111-8111-111111111111')<>15 then raise exception 'Reservation incorrect';end if;
 begin perform public.inventory_order_deliver('ab222222-1111-4111-8111-111111111115','ab222222-1111-4111-8111-111111111114',payload||'{"recipient_name":"Changed"}');raise exception 'Changed idempotent request accepted';exception when others then if sqlerrm='Changed idempotent request accepted' then raise;end if;end;
end $$;
reset role;
select 'request, approval, partial delivery, reservations, approval guard and idempotency passed; fixtures rolled back' as result;
rollback;
