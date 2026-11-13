begin;
insert into public.system_user_role_grants(user_id,role_code,active,granted_by) values('aedb58e6-56ca-4308-9796-bb77070f649a','jefe_audiovisuales',true,'6418ad20-d0e8-49c0-8d9a-e1da3daf71b6') on conflict(user_id,role_code) do update set active=true;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aedb58e6-56ca-4308-9796-bb77070f649a","role":"authenticated"}',true);
do $$declare c jsonb;begin
c:=public.inventory_order_capabilities();
if c->>'area' is distinct from 'Audiovisual' or not (c->>'create')::boolean then raise exception 'Chief area not locked';end if;
if exists(select 1 from jsonb_array_elements(public.inventory_order_catalog()) p where p->>'department' not in ('Audiovisual','Generales')) then raise exception 'Other area leaked';end if;
begin
 perform public.inventory_order_create(gen_random_uuid(),'{"area":"Gráfica","purpose":"area","recipient_name":"QA","delivery_location":"QA","items":[]}');
 raise exception 'Cross area request accepted';
exception when insufficient_privilege then null;end;
end $$;
reset role;
update public.system_user_role_grants set active=false where user_id='aedb58e6-56ca-4308-9796-bb77070f649a' and role_code='jefe_audiovisuales';
insert into public.system_user_role_grants(user_id,role_code,active,granted_by) values('aedb58e6-56ca-4308-9796-bb77070f649a','jefe_grafica',true,'6418ad20-d0e8-49c0-8d9a-e1da3daf71b6') on conflict(user_id,role_code) do update set active=true;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aedb58e6-56ca-4308-9796-bb77070f649a","role":"authenticated"}',true);
do $$begin
if public.inventory_order_capabilities()->>'area' is distinct from 'Gráfica' then raise exception 'Graphics area not locked';end if;
if exists(select 1 from jsonb_array_elements(public.inventory_order_catalog()) p where p->>'department' not in ('Gráfica','Generales')) then raise exception 'Other area leaked';end if;
begin
 perform public.inventory_order_create(gen_random_uuid(),'{"area":"Audiovisual","purpose":"area","recipient_name":"QA","delivery_location":"QA","items":[]}');
 raise exception 'Cross area request accepted';
exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'Área del jefe y catálogo verificados; toda la prueba revertida' as result;
