-- Run after sql/inventory-graphics-read.sql. Every fixture and temporary permission change rolls back.
begin;
create temp table graphics_other_state as select jsonb_build_object('employees',(select jsonb_agg(to_jsonb(e)) from public.hr_employees e)) state;
insert into public.inventory_products(id,name,category,unit,currency,stock,unit_cost,minimum_stock) values
('00000000-0000-4000-8000-000000000001','Pullover negro talla XXM algodón','Departamento Gráfica','Unidad','CUP',7,99,2),
('00000000-0000-4000-8000-000000000002','Pullover blanco talla M','Departamento Gráfica','Unidad','CUP',0,88,0),
('00000000-0000-4000-8000-000000000003','Vinilo rojo 60 cm','Departamento Gráfica','Metro','CUP',1.5,77,2),
('00000000-0000-4000-8000-000000000004','NO MOSTRAR audiovisual','Departamento Audiovisual','Unidad','CUP',5,66,0),
('00000000-0000-4000-8000-000000000005','NO MOSTRAR otros','Otros','Unidad','CUP',5,55,0),
('00000000-0000-4000-8000-000000000006','NO MOSTRAR histórico','Producción','Unidad','CUP',5,44,0);

create function pg_temp.denied(q text) returns void language plpgsql as $f$
begin
 begin execute q; exception when insufficient_privilege then return; end;
 raise exception 'SECURITY FAILURE: %',q;
end $f$;
select set_config('request.jwt.claims','{"sub":"ff6bcd72-963c-4ea4-9a33-1722fe44c384","role":"authenticated"}',true);
set local role authenticated;
do $test$
declare j jsonb;n bigint;v jsonb;q text;
begin
 if public.inventory_has_access('read') or public.inventory_has_access('write') or public.system_has_permission('inventario_insumos','write') then raise exception 'Administrative permission leaked';end if;
 if public.system_has_permission('rrhh','read') or public.system_has_permission('usuarios_roles','read') then raise exception 'Other module allowed';end if;
 v=public.system_my_views();
 if v<>'[{"code":"inventory_graphics_read","is_default":true}]'::jsonb then raise exception 'Unique view failed: %',v;end if;
 j=public.inventory_graphics_catalog();
 if (j->>'total')::integer<>3 or jsonb_array_length(j->'rows')<>3 then raise exception 'Category scope failed: %',j;end if;
 if j::text~'unit_cost|reference_cost|supplier|currency|NO MOSTRAR' then raise exception 'Sensitive field leak';end if;
 if public.inventory_graphics_catalog('XXM')->>'total'<>'1' then raise exception 'Name characteristic search failed';end if;
 if public.inventory_graphics_catalog('000000000001')->>'total'<>'1' then raise exception 'Code search failed';end if;
 if public.inventory_graphics_catalog('',0,1)->>'total'<>'3' or jsonb_array_length(public.inventory_graphics_catalog('',1,1)->'rows')<>1 then raise exception 'Pagination failed';end if;
 if public.inventory_graphics_catalog('',0,1,'00000000-0000-4000-8000-000000000004')->>'total'<>'0' then raise exception 'IDOR audiovisual';end if;
 if public.inventory_graphics_catalog('',0,1,'00000000-0000-4000-8000-000000000005')->>'total'<>'0' then raise exception 'IDOR otros';end if;
 if public.inventory_graphics_catalog('',0,1,'00000000-0000-4000-8000-000000000006')->>'total'<>'0' then raise exception 'IDOR historical';end if;
 if public.inventory_graphics_catalog('',0,1,'00000000-0000-4000-8000-000000000002')->'rows'->0->>'stock_status'<>'Agotado' then raise exception 'Empty status failed';end if;
 if public.inventory_graphics_catalog('',0,1,'00000000-0000-4000-8000-000000000003')->'rows'->0->>'stock_status'<>'Bajo mínimo' then raise exception 'Real threshold failed';end if;
 foreach q in array array['inventory_products','inventory_movements','inventory_economic_movements','inventory_fund_ledger','inventory_cash_reimbursements','inventory_weekly_closures','inventory_closure_events','hr_employees'] loop
 execute format('select count(*) from public.%I',q) into n;
 if n<>0 then raise exception 'Direct table leak %',q;end if;
 end loop;
 begin update public.inventory_products set name='HACKED',stock=999 where id='00000000-0000-4000-8000-000000000001';get diagnostics n=row_count;if n<>0 then raise exception 'Direct update allowed';end if;exception when insufficient_privilege then null;end;
 begin delete from public.inventory_products where id='00000000-0000-4000-8000-000000000001';get diagnostics n=row_count;if n<>0 then raise exception 'Direct delete allowed';end if;exception when insufficient_privilege then null;end;
 perform pg_temp.denied($q$insert into public.inventory_products(name,category,unit,currency) values('HACKED','Departamento Gráfica','Unidad','CUP')$q$);
 perform pg_temp.denied($q$select public.inventory_record_movement(gen_random_uuid(),'{"kind":"entry","name":"HACKED","category":"Departamento Gráfica","unit":"Unidad","currency":"CUP","quantity":1,"unit_cost":1}'::jsonb)$q$);
 perform pg_temp.denied($q$select public.inventory_record_movement(gen_random_uuid(),'{"kind":"out","product_id":"00000000-0000-4000-8000-000000000001","quantity":1}'::jsonb)$q$);
 perform pg_temp.denied($q$select public.inventory_edit_product('00000000-0000-4000-8000-000000000001','{}','{}')$q$);
 perform pg_temp.denied($q$select public.inventory_set_minimum('00000000-0000-4000-8000-000000000001',99)$q$);
 perform pg_temp.denied($q$select public.inventory_update_product_details('00000000-0000-4000-8000-000000000001','HACKED','Otros','Unidad','',0)$q$);
 perform pg_temp.denied($q$select public.inventory_update_product_details('00000000-0000-4000-8000-000000000001','HACKED','Otros','Unidad','',0,'')$q$);
 perform pg_temp.denied($q$select public.inventory_update_product_photo('00000000-0000-4000-8000-000000000001','fake')$q$);
 perform pg_temp.denied($q$select public.inventory_fund_record(gen_random_uuid(),'{}')$q$);
 perform pg_temp.denied($q$select public.inventory_close_week(gen_random_uuid(),'{}')$q$);
 perform pg_temp.denied($q$select public.inventory_fund_report(current_date-6,current_date)$q$);
 perform pg_temp.denied($q$select public.system_set_user_role('ff6bcd72-963c-4ea4-9a33-1722fe44c384','administrador',true)$q$);
 perform pg_temp.denied($q$select public.system_manage_user_view('d450e920-8410-4377-b75d-65bce9b6c646','inventory_admin',true,true)$q$);
 if exists(select 1 from storage.objects where bucket_id='inventory-images') then raise exception 'Storage leak';end if;
end $test$;
reset role;
-- No threshold inferred from zero.
update inventory_products set stock=1,minimum_stock=0 where id='00000000-0000-4000-8000-000000000003';
select set_config('request.jwt.claims','{"sub":"ff6bcd72-963c-4ea4-9a33-1722fe44c384","role":"authenticated"}',true);
set local role authenticated;
do $t$ begin if public.inventory_graphics_catalog('',0,1,'00000000-0000-4000-8000-000000000003')->'rows'->0->>'stock_status'<>'Disponible' then raise exception 'Invented minimum';end if;end $t$;
reset role;
-- Revocation is evaluated on every request, including already issued JWTs.
update hr_employees set system_access_enabled=false where system_username='melanie.medina';
set local role authenticated;
select pg_temp.denied('select public.inventory_graphics_catalog()');
reset role;
update hr_employees set system_access_enabled=true where system_username='melanie.medina';
-- Above toggle touches updated_at: restore the original row exactly before preservation check.
update hr_employees e set updated_at=(select (x->>'updated_at')::timestamptz from graphics_other_state s,jsonb_array_elements(s.state->'employees') x where x->>'id'=e.id::text) where system_username='melanie.medina';
select set_config('request.jwt.claims','{"sub":"aedb58e6-56ca-4308-9796-bb77070f649a","role":"authenticated"}',true);
set local role authenticated;
do $t$ begin
 if not public.inventory_has_access('read') or not public.inventory_has_access('write') then raise exception 'Alejandro lost permissions';end if;
 if not exists(select 1 from public.inventory_products where category='Departamento Audiovisual') then raise exception 'Alejandro category access lost';end if;
 if not public.system_my_views() @> '[{"code":"inventory_admin"}]' then raise exception 'Alejandro lost view';end if;
 perform pg_temp.denied('select public.inventory_graphics_catalog()');
 perform public.inventory_update_product_details('00000000-0000-4000-8000-000000000001','Pullover negro talla XXM algodón','Departamento Gráfica','Unidad','',2);
end $t$;
reset role;
-- Existing administrator continues to operate the same inventory.
select set_config('request.jwt.claims','{"sub":"aedb58e6-56ca-4308-9796-bb77070f649a","role":"authenticated"}',true);
set local role authenticated;
select public.inventory_record_movement('00000000-0000-4000-8000-000000000101','{"product_id":"00000000-0000-4000-8000-000000000001","kind":"entry","quantity":2,"unit_cost":101,"currency":"CUP"}'::jsonb||jsonb_build_object('occurred_on',current_date));
select public.inventory_record_movement('00000000-0000-4000-8000-000000000102','{"product_id":"00000000-0000-4000-8000-000000000001","kind":"out","quantity":1,"allocation_type":"project","project_reference":"ROLLBACK TEST","receiving_area":"Gráfica","received_by":"Prueba"}'::jsonb||jsonb_build_object('occurred_on',current_date));
reset role;
select set_config('request.jwt.claims','{"sub":"ff6bcd72-963c-4ea4-9a33-1722fe44c384","role":"authenticated"}',true);
set local role authenticated;
do $t$ begin
 if (public.inventory_graphics_catalog('',0,1,'00000000-0000-4000-8000-000000000001')->'rows'->0->>'stock')::numeric<>8 then raise exception 'Reader stock did not reflect administrator movements';end if;
 if exists(select 1 from public.inventory_movements) or exists(select 1 from public.inventory_economic_movements) or exists(select 1 from public.inventory_fund_ledger) then raise exception 'Real movement data leaked';end if;
end $t$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-999999999999","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.denied('select public.inventory_graphics_catalog()');
reset role;
set local role anon;
select pg_temp.denied('select public.inventory_graphics_catalog()');
reset role;
rollback;
