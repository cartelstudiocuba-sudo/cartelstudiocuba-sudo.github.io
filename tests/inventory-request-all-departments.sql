-- All data writes below are rolled back; no inventory movement is performed.
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ae4ecb7a-e581-4538-b987-edd070de8ddd","role":"authenticated"}',true);
do $$declare c jsonb;p jsonb;v_request uuid:=gen_random_uuid();payload jsonb;begin
 c:=public.inventory_request_catalog();
 if not exists(select 1 from jsonb_array_elements(c) x where x->>'department'='Audiovisual') then raise exception 'Request catalogue excludes Audiovisual';end if;
 if not exists(select 1 from jsonb_array_elements(c) x where x->>'department'='Generales') then raise exception 'Request catalogue excludes Generales';end if;
 if exists(select 1 from jsonb_array_elements(public.inventory_graphics_catalog('',0,100,null)->'rows') x where x->>'department'<>'Gráfica') then raise exception 'Graphics consultation scope changed';end if;
 select x into strict p from jsonb_array_elements(c) x where x->>'department'='Audiovisual' and (x->>'available')::numeric>=1 limit 1;
 payload:=jsonb_build_object('area','Gráfica','purpose','area','recipient_name','QA rollback','delivery_location','QA rollback','items',jsonb_build_array(jsonb_build_object('product_id',p->>'id','quantity',1)));
 perform public.inventory_order_create(v_request,payload);
 perform set_config('cartel.qa_order',v_request::text,true);
 perform set_config('cartel.qa_payload',payload::text,true);
 if not exists(select 1 from public.inventory_orders o join public.inventory_order_items i on i.order_id=o.id where o.id=v_request and o.area='Gráfica' and i.product_id=(p->>'id')::uuid) then raise exception 'Cross-department request not saved';end if;
 begin
  perform public.inventory_order_create(gen_random_uuid(),payload||'{"area":"Audiovisual"}'::jsonb);
  raise exception 'Responsible area was editable';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
update public.inventory_orders set status='returned',decision_note='QA rollback' where id=current_setting('cartel.qa_order')::uuid;
set local role authenticated;
do $$begin
 perform public.inventory_order_resubmit(current_setting('cartel.qa_order')::uuid,1,gen_random_uuid(),current_setting('cartel.qa_payload')::jsonb);
 if not exists(select 1 from public.inventory_orders where id=current_setting('cartel.qa_order')::uuid and area='Gráfica' and status='pending' and revision=2) then raise exception 'Cross-department correction failed';end if;
end $$;
rollback;
select 'Request catalogue, cross-department creation and correction verified; all test writes rolled back' as result;
