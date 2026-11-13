-- Read-only checks under Daniela's actual identity; no role or order changes.
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ae4ecb7a-e581-4538-b987-edd070de8ddd","role":"authenticated"}',true);
do $$declare caps jsonb;begin
 caps:=public.inventory_order_capabilities();
 if caps->>'area' is distinct from 'Gráfica' then raise exception 'Employment area was not resolved'; end if;
 if not (caps->>'create')::boolean then raise exception 'Existing request permission lost'; end if;
 if exists(select 1 from jsonb_array_elements(public.inventory_order_catalog()) p where p->>'department' not in ('Gráfica','Generales')) then raise exception 'Other area in request catalogue';end if;
 begin
  perform public.inventory_order_create(gen_random_uuid(),'{"area":"Audiovisual","purpose":"area","recipient_name":"QA","delivery_location":"QA","items":[]}');
  raise exception 'Cross-area request accepted';
 exception when insufficient_privilege then null;end;
end $$;
select public.inventory_order_capabilities() as verified_capabilities;
rollback;
