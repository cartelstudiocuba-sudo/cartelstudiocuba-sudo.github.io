-- Explicitly authorized functional demo. Leaves marked test data for user testing.
do $seed$
declare
 batch constant text:='DEMO_INSUMOS_20261018_V1';
 actor uuid; pid uuid; rid uuid; i integer; k integer; supplier_index integer;
 demo_date date:=(now() at time zone 'America/Havana')::date;
 product_names text[]:=array['Cinta gaffer negra','Cinta doble cara','Bridas plásticas','Pilas AA','Guantes de montaje','Papel de fondo fotográfico','Toallitas para lentes','Gel de filtros','Cinta velcro','Paño de microfibra','Detergente líquido','Desinfectante','Bolsas de basura','Papel higiénico','Jabón de manos','Cinta aislante','Tornillos surtidos','Brocha de pintura','Lubricante multiuso','Silicona de sellado','Vasos desechables','Platos desechables','Café','Azúcar','Servilletas','Bolígrafos','Marcadores','Papel A4','Carpetas','Etiquetas adhesivas'];
 categories text[]:=array['Producción','Estudio','Limpieza','Mantenimiento','Catering','Otros'];
 units text[]:=array['Unidad','Unidad','Paquete','Paquete','Par','Metro','Paquete','Unidad','Metro','Unidad','Litro','Litro','Paquete','Paquete','Litro','Unidad','Caja','Unidad','Unidad','Unidad','Paquete','Paquete','Kilogramo','Kilogramo','Paquete','Caja','Paquete','Paquete','Unidad','Paquete'];
 providers text[]:=array['PRUEBA · Suministros Audiovisuales','PRUEBA · Foto y Estudio','PRUEBA · Limpieza Integral','PRUEBA · Ferretería Central','PRUEBA · Catering Habana','PRUEBA · Papelería Creativa','PRUEBA · Distribuidora Vedado','PRUEBA · Servicios Generales'];
 receivers text[]:=array['Receptor de prueba 01','Receptor de prueba 02','Receptor de prueba 03','Receptor de prueba 04','Receptor de prueba 05','Receptor de prueba 06'];
 areas text[]:=array['Departamento de Audiovisuales','Departamento de Producciones Gráficas','Gerencia'];
 projects text[]:=array['PRUEBA · Videoclip Amanecer','PRUEBA · Campaña de producto','PRUEBA · Podcast en estudio','PRUEBA · Sesión fotográfica','PRUEBA · Evento corporativo','PRUEBA · Producción gráfica'];
 category text; minimum_qty numeric:=5; target_qty numeric; cost1 numeric; cost2 numeric; qty numeric; d date; kind text; allocation text; reason text; body jsonb; cat_index integer;
 before_original jsonb; after_original jsonb; before_ledger bigint; before_closures bigint;
begin
 perform set_config('lock_timeout','3s',true);perform set_config('statement_timeout','30s',true);
 if exists(select 1 from public.inventory_products where description like '%'||batch||'%') then raise exception 'Este lote de pruebas ya existe. No se generará otro.'; end if;
 if exists(select 1 from public.inventory_products where id in (select md5(batch||':product:'||g)::uuid from generate_series(1,30) g)) then raise exception 'Colisión de identificadores de prueba'; end if;
 if exists(select 1 from pg_trigger where tgrelid='public.inventory_movements'::regclass and tgname='z_inventory_purchase_ledger' and tgenabled<>'D') then raise exception 'Finance must stay deferred'; end if;
 select created_by into strict actor from public.inventory_movements order by created_at limit 1;
 select jsonb_build_object('products',(select jsonb_agg(to_jsonb(p) order by p.id) from public.inventory_products p),'movements',(select jsonb_agg(to_jsonb(m) order by m.id) from public.inventory_movements m)) into before_original;
 select count(*) into before_ledger from public.inventory_fund_ledger;
 select count(*) into before_closures from public.inventory_weekly_closures;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor::text,'role','authenticated')::text,true);
 perform set_config('role','authenticated',true);
 if not public.inventory_has_access('write') then raise exception 'No authorized inventory seed principal'; end if;
 for i in 1..30 loop
  pid:=md5(batch||':product:'||i)::uuid;cat_index:=((i-1)/5)+1;category:=categories[cat_index];
  target_qty:=case (i-1)%3 when 0 then 0 when 1 then 3 else 12 end;
  cost1:=round((50+i*37.5)::numeric,2);cost2:=round(cost1*1.15,2);
  insert into public.inventory_products(id,name,category,unit,description,currency,minimum_stock,location)
  values(pid,'PRUEBA · '||product_names[i],category,units[i],'Datos ficticios para pruebas funcionales. Lote '||batch||'. Marca de ejemplo ECS. Presentación de prueba. No representa inventario real.','CUP',minimum_qty,'PRUEBA · Almacén '||case when i%2=0 then 'principal' else 'auxiliar' end||' · Estante '||chr(65+(i-1)%6)||' · Nivel '||(((i-1)%3)+1));
  for k in 1..4 loop
   rid:=md5(batch||':movement:'||i||':'||k)::uuid;
   kind:=case when k in (1,3) then 'entry' else 'out' end;
   qty:=case k when 1 then 10 when 2 then 5 when 3 then 10 else 15-target_qty end;
   d:=case k when 1 then demo_date-20+(i%5) when 2 then demo_date-14+(i%4) when 3 then demo_date-7+(i%3) else demo_date-(i%3) end;
   body:=jsonb_build_object('test_batch',batch,'test_product_index',i,'test_stage',k,'kind',kind,'product_id',pid,'name','PRUEBA · '||product_names[i],'unit',units[i],'currency','CUP','quantity',qty,'unit_cost',case when k=1 then cost1 when k=3 then cost2 else 0 end,'occurred_on',d,'notes','PRUEBA · Movimiento ficticio '||i||'/'||k||' · Lote '||batch||'. Usar para revisar historial, filtros, costos y comprobantes.');
   if kind='entry' then
    supplier_index:=case when k=1 then (i-1)%8+1 else i%8+1 end;
    body:=body||jsonb_build_object('location','PRUEBA · Almacén '||case when i%2=0 then 'principal' else 'auxiliar' end||' · Estante '||chr(65+(i-1)%6)||' · Nivel '||(((i-1)%3)+1),
     'supplier',jsonb_build_object('name',providers[supplier_index],'phone','+1 202-555-'||lpad((100+supplier_index)::text,4,'0'),'address','Dirección ficticia de prueba '||supplier_index||' · No corresponde a un negocio real'));
   else
    reason:=case (i+k)%3 when 0 then 'project' when 1 then 'administrative' else 'breakage' end;
    allocation:=case when reason='project' then 'project' else 'administrative' end;
    body:=body||jsonb_build_object('allocation_type',allocation,'consumption_reason',case when reason='breakage' then 'breakage' end,'project_reference',case when allocation='project' then projects[(i+k)%6+1] end,'receiving_area',areas[(i+k)%3+1],'received_by',receivers[(i+k)%6+1]);
   end if;
   perform public.inventory_record_movement(rid,body);
  end loop;
  if (select stock from public.inventory_products where id=pid)<>target_qty or (select unit_cost from public.inventory_products where id=pid)<>cost2 then raise exception 'Invalid seeded stock or cost at %',i; end if;
 end loop;
 perform set_config('role','postgres',true);
 if (select count(*) from public.inventory_movements where request_payload->>'test_batch'=batch)<>120 then raise exception 'Invalid seed movement count'; end if;
 if (select count(*) from public.inventory_economic_movements where source_movement_id in (select id from public.inventory_movements where request_payload->>'test_batch'=batch))<>60 then raise exception 'Invalid consumption count'; end if;
 select jsonb_build_object('products',(select jsonb_agg(to_jsonb(p) order by p.id) from public.inventory_products p where p.id not in(select md5(batch||':product:'||g)::uuid from generate_series(1,30)g)),'movements',(select jsonb_agg(to_jsonb(m) order by m.id) from public.inventory_movements m where m.request_payload->>'test_batch' is distinct from batch)) into after_original;
 if before_original is distinct from after_original then raise exception 'Original records changed'; end if;
 if before_ledger<>(select count(*) from public.inventory_fund_ledger) or before_closures<>(select count(*) from public.inventory_weekly_closures) then raise exception 'Finance records changed'; end if;
end $seed$;
select jsonb_build_object('batch','DEMO_INSUMOS_20261018_V1','products',(select count(*) from public.inventory_products where description like '%DEMO_INSUMOS_20261018_V1%'),'movements',(select count(*) from public.inventory_movements where request_payload->>'test_batch'='DEMO_INSUMOS_20261018_V1'),'consumptions',(select count(*) from public.inventory_economic_movements where product_id in(select md5('DEMO_INSUMOS_20261018_V1:product:'||g)::uuid from generate_series(1,30)g)),'providers',(select count(distinct supplier->>'name') from public.inventory_movements where request_payload->>'test_batch'='DEMO_INSUMOS_20261018_V1' and kind='entry'),'stock_states',(select jsonb_object_agg(state,n) from(select case when stock=0 then 'empty' when stock<=minimum_stock then 'low' else 'available' end state,count(*) n from public.inventory_products where description like '%DEMO_INSUMOS_20261018_V1%' group by 1)s),'ledger_count',(select count(*) from public.inventory_fund_ledger),'originals_preserved',true) as seeded;
