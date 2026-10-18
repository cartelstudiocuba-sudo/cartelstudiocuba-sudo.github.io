-- Test real PostgreSQL authenticated-role RLS and RPC, then roll back every fixture.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('10000000-0000-4000-8000-000000000001','admin-access-test@example.invalid',now()),
 ('10000000-0000-4000-8000-000000000002','commercial-access-test@example.invalid',now());
insert into public.hr_employees(id,full_name,status,system_username,system_auth_user_id,system_access_enabled) values
 ('20000000-0000-4000-8000-000000000001','Access test administrator','active','test.admin.access','10000000-0000-4000-8000-000000000001',true),
 ('20000000-0000-4000-8000-000000000002','Access test commercial','active','test.commercial.access','10000000-0000-4000-8000-000000000002',true);
insert into public.system_employee_role_assignments(employee_id,access_role_id)
 select '20000000-0000-4000-8000-000000000001'::uuid,id from public.system_access_roles where code='administrador'
 union all select '20000000-0000-4000-8000-000000000002'::uuid,id from public.system_access_roles where code='gestor_comercial_grafica';
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","email":"admin-access-test@example.invalid"}',true);
set local role authenticated;
do $$ declare movement uuid; begin
 if not public.inventory_has_access('read') or not public.inventory_has_access('write') then raise exception 'Admin permission failed'; end if;
 movement=public.inventory_record_movement('30000000-0000-4000-8000-000000000001','{"kind":"entry","name":"ACCESS TEST ONLY","category":"Otros","unit":"unidad","currency":"CUP","quantity":3,"unit_cost":10,"occurred_on":"2026-10-18"}'::jsonb);
 if not exists(select 1 from public.inventory_products where name='ACCESS TEST ONLY' and stock=3 and unit_cost=10) then raise exception 'Admin stock write failed'; end if;
 if public.system_has_permission('rrhh','read') or public.system_has_permission('usuarios_roles','write') then raise exception 'Admin HR escalation'; end if;
 if exists(select 1 from public.hr_employees) or exists(select 1 from public.hr_trial_periods) or exists(select 1 from public.hr_nomenclators) then raise exception 'Admin HR data visible'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","email":"commercial-access-test@example.invalid"}',true);
set local role authenticated;
do $$ begin
 if not public.inventory_has_access('read') or public.inventory_has_access('write') then raise exception 'Commercial permissions failed'; end if;
 if not exists(select 1 from public.inventory_products where name='ACCESS TEST ONLY' and stock=3) then raise exception 'Commercial inventory read failed'; end if;
 if not exists(select 1 from public.inventory_movements where id='30000000-0000-4000-8000-000000000001') then raise exception 'Commercial movement read failed'; end if;
 begin
 perform public.inventory_record_movement('30000000-0000-4000-8000-000000000002','{}');
 raise exception 'Commercial RPC write allowed';
 exception when insufficient_privilege then null; end;
 begin
 insert into public.inventory_products(name,category,unit,currency) values('COMMERCIAL FORBIDDEN','Otros','unidad','CUP');
 raise exception 'Commercial direct write allowed';
 exception when insufficient_privilege then null; end;
 if exists(select 1 from public.hr_employees) or exists(select 1 from public.hr_trial_periods) or exists(select 1 from public.hr_nomenclators) then raise exception 'Commercial HR data visible'; end if;
 begin
 perform public.system_set_employee_role('20000000-0000-4000-8000-000000000002','administrador',true);
 raise exception 'Self escalation allowed';
 exception when insufficient_privilege then null; end;
 begin
 perform public.system_set_role_permission((select id from public.system_access_roles where code='gestor_comercial_grafica'),'inventario_insumos',true,true);
 raise exception 'Commercial permission mutation allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Multiple roles accumulate; revocation takes effect without token refresh.
insert into public.system_employee_role_assignments(employee_id,access_role_id) select '20000000-0000-4000-8000-000000000002',id from public.system_access_roles where code='administrador';
set local role authenticated;
do $$ begin if not public.inventory_has_access('write') then raise exception 'Multiple role union failed'; end if; end $$;
reset role;
update public.system_employee_role_assignments set ended_at=now() where employee_id='20000000-0000-4000-8000-000000000002' and access_role_id=(select id from public.system_access_roles where code='administrador');
set local role authenticated;
do $$ begin if public.inventory_has_access('write') then raise exception 'Role revocation failed'; end if; end $$;
reset role;
update public.hr_employees set system_access_enabled=false where id='20000000-0000-4000-8000-000000000002';
set local role authenticated;
do $$ begin if public.inventory_has_access('read') then raise exception 'Disabled account retains access'; end if; end $$;
reset role;
-- Owner management and live matrix enforcement.
select set_config('request.jwt.claims','{"sub":"6418ad20-d0e8-49c0-8d9a-e1da3daf71b6","role":"authenticated","email":"cartelstudiocuba@gmail.com"}',true);
set local role authenticated;
do $$ begin
 if jsonb_array_length(public.system_list_users())<3 then raise exception 'Owner directory failed'; end if;
 perform public.system_set_role_permission((select id from public.system_access_roles where code='administrador'),'inventario_insumos',true,false);
 begin
 perform public.system_set_role_permission((select id from public.system_access_roles where code='administrador'),'rrhh',true,true);
 raise exception 'HR delegation allowed';
 exception when raise_exception then if sqlerrm='HR delegation allowed' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin if public.inventory_has_access('write') then raise exception 'Matrix update did not enforce'; end if; end $$;
reset role;
rollback;
select 'PASS: admin writes and stock; commercial reads, RPC/direct writes denied; HR denied; self escalation denied; multiple roles, immediate revocation, disabled account and live matrix enforced. All fixtures rolled back.' as result;
