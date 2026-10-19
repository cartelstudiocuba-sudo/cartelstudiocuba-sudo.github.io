-- Permission regression test using existing read/write assignments; all fixture changes roll back.
do $test$
declare
 writer_id uuid; reader_id uuid; pid uuid:=gen_random_uuid(); rid uuid:=gen_random_uuid();
 actor uuid; profile text; n bigint; changed bigint; denied integer; results jsonb:='[]'; before_counts jsonb; after_counts jsonb;
begin
 perform set_config('lock_timeout','2s',true);perform set_config('statement_timeout','15s',true);
 select e.system_auth_user_id into strict writer_id from public.hr_employees e
 join public.system_employee_role_assignments a on a.employee_id=e.id and a.ended_at is null
 join public.system_access_roles r on r.id=a.access_role_id and r.is_active
 join public.system_role_module_permissions p on p.access_role_id=r.id and p.module_code='inventario_insumos'
 where e.system_access_enabled and e.status<>'terminated' and p.can_read and p.can_write limit 1;
 select e.system_auth_user_id into strict reader_id from public.hr_employees e
 join public.system_employee_role_assignments a on a.employee_id=e.id and a.ended_at is null
 join public.system_access_roles r on r.id=a.access_role_id and r.is_active
 join public.system_role_module_permissions p on p.access_role_id=r.id and p.module_code='inventario_insumos'
 where e.system_access_enabled and e.status<>'terminated' and p.can_read and not p.can_write
 and not exists(select 1 from public.system_employee_role_assignments aa join public.system_role_module_permissions pp on pp.access_role_id=aa.access_role_id where aa.employee_id=e.id and aa.ended_at is null and pp.module_code='inventario_insumos' and pp.can_write) limit 1;
 select jsonb_build_object('products',(select count(*) from public.inventory_products),'movements',(select count(*) from public.inventory_movements),'ledger',(select count(*) from public.inventory_fund_ledger)) into before_counts;
 begin
 insert into public.inventory_products(id,name,category,unit,currency,stock,unit_cost,minimum_stock)
 values(pid,'TEST ROLLBACK permissions '||pid,'Otros','Unidad','CUP',0,0,0);
 foreach profile in array array['reader','writer','unassigned'] loop
  actor:=case profile when 'reader' then reader_id when 'writer' then writer_id else gen_random_uuid() end;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor::text,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  if public.inventory_has_access('read') is distinct from (profile<>'unassigned') then raise exception 'Read permission mismatch %',profile; end if;
  if public.inventory_has_access('write') is distinct from (profile='writer') then raise exception 'Write permission mismatch %',profile; end if;
  select count(*) into n from public.inventory_products where id=pid;
  if n<>(case when profile='unassigned' then 0 else 1 end) then raise exception 'RLS read mismatch %',profile; end if;
  -- Direct edits must remain unavailable even to writers; changes use controlled RPCs.
  update public.inventory_products set stock=99 where id=pid;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Direct stock edit allowed %',profile; end if;
  if profile='writer' then
   perform public.inventory_update_product_details(pid,'TEST ROLLBACK edited','Otros','Unidad','test',2,'Test');
   perform public.inventory_record_movement(rid,jsonb_build_object('product_id',pid,'kind','entry','quantity',1,'unit_cost',25,'currency','CUP','occurred_on',(now() at time zone 'America/Havana')::date));
   if (select stock from public.inventory_products where id=pid)<>1 then raise exception 'Writer movement failed'; end if;
   results:=results||jsonb_build_array(jsonb_build_object('profile',profile,'read',true,'controlled_edit',true,'movement',true,'direct_stock_edit_blocked',true));
  else
   denied:=0;
   begin
    perform public.inventory_update_product_details(pid,'NOT ALLOWED','Otros','Unidad','test',2,'Test');
   exception when insufficient_privilege then denied:=denied+1; end;
   begin
    perform public.inventory_update_product_photo(pid,actor::text||'/00000000-0000-4000-8000-000000000001.jpg');
   exception when insufficient_privilege then denied:=denied+1; end;
   begin
    perform public.inventory_record_movement(gen_random_uuid(),jsonb_build_object('product_id',pid,'kind','entry','quantity',1,'unit_cost',25,'currency','CUP','occurred_on',(now() at time zone 'America/Havana')::date));
   exception when insufficient_privilege then denied:=denied+1; end;
   begin
    insert into public.inventory_products(name,category,unit,currency) values('NOT ALLOWED','Otros','Unidad','CUP');
   exception when insufficient_privilege then denied:=denied+1; end;
   if denied<>4 then raise exception 'Unauthorized mutation not blocked %',profile; end if;
   results:=results||jsonb_build_array(jsonb_build_object('profile',profile,'read',profile='reader','blocked_write_attempts',denied,'direct_stock_edit_blocked',true));
  end if;
  perform set_config('role','postgres',true);
 end loop;
 raise exception using errcode='PZ001',message='PERMISSION_TEST_PASSED_ROLLBACK';
 exception when sqlstate 'PZ001' then if sqlerrm<>'PERMISSION_TEST_PASSED_ROLLBACK' then raise; end if;
 end;
 select jsonb_build_object('products',(select count(*) from public.inventory_products),'movements',(select count(*) from public.inventory_movements),'ledger',(select count(*) from public.inventory_fund_ledger)) into after_counts;
 if before_counts<>after_counts or exists(select 1 from public.inventory_products where id=pid) then raise exception 'Rollback verification failed'; end if;
 perform set_config('cartel_test.result',jsonb_build_object('status','PASS','profiles',results,'rollback_verified',true,'before',before_counts,'after',after_counts)::text,true);
end $test$;
select current_setting('cartel_test.result')::jsonb as permission_test;
