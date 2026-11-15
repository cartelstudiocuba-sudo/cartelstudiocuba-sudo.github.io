-- Courtesy is now a payable cost-only sale. Historic free courtesy losses stay intact.
select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
insert into studio_access_private.fridge_pricing_backups(name,definition)
select 'cost-courtesy.'||p.proname,pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace='studio_access_private'::regnamespace and p.proname in ('fridge_command','fridge_command_core','fridge_cost_settlement') on conflict(name) do nothing;
-- Change the locked ledger's unit price basis, without ever changing catalog prices.
do $migration$ declare d text;original text;begin
 d:=pg_get_functiondef('studio_access_private.fridge_command_core(uuid,text,jsonb)'::regprocedure);original:=d;
 d:=replace(d,'q:=(line->>''quantity'')::integer;', $patch$   if p_payload->'sale_context'->>'kind'='courtesy' and (line->>'quantity')::numeric<>trunc((line->>'quantity')::numeric) then raise exception 'Introduce una cantidad entera de productos';end if;
   q:=(line->>'quantity')::integer;$patch$);
 d:=replace(d,'total:=total+prod.price*q;',$patch$
   if p_payload->'sale_context'->>'kind'='courtesy' and (line->>'cost')::numeric is distinct from prod.cost then raise exception 'Cambió el costo de %. Actualiza la selección.',prod.name;end if;
   total:=total+(case when p_payload->'sale_context'->>'kind'='courtesy' then prod.cost else prod.price end)*q;
 $patch$);
 d:=replace(d,'if total<=0 or paid>total', $patch$if p_payload->'sale_context'->>'kind'='courtesy' and total<=0 then raise exception 'La cortesía debe tener un costo total mayor que cero';end if;
  if total<=0 or paid>total$patch$);
 d:=replace(d,'''price'',prod.price,''cost'',prod.cost','''price'',case when p_payload->''sale_context''->>''kind''=''courtesy'' then prod.cost else prod.price end,''cost'',prod.cost');
 if d=original or position('Cambió el costo de' in d)=0 or position('''price'',case when' in d)=0 then raise exception 'No se reconoce el libro de ventas; se cancela la migración';end if;
 execute d;
end $migration$;
create or replace function studio_access_private.fridge_command(p_id uuid,p_kind text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare prior studio_access_private.fridge_operations%rowtype;ctx jsonb;checkout_kind text;label text;employee uuid;customer uuid;normalized jsonb:=p_payload;r jsonb;col jsonb;amount numeric;rate numeric;paid numeric;line jsonb;prod studio_access_private.fridge_products%rowtype;cost_total numeric:=0;courtesy_items jsonb:='[]';
begin
 if not studio_access_private.fridge_allowed() then raise exception 'No tienes acceso a Nevera audiovisual' using errcode='42501';end if;
 if p_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Operación no válida';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
 select * into prior from studio_access_private.fridge_operations where id=p_id;
 if found then if prior.actor_id<>auth.uid() or prior.kind<>p_kind or prior.payload<>p_payload then raise exception 'El identificador ya pertenece a otra operación';end if;return prior.result;end if;
 if not ((p_kind='sale' and p_payload ? 'sale_context') or (p_kind='loss' and p_payload ? 'sale_context') or (p_kind in ('sale','payment') and p_payload ? 'collection')) then return studio_access_private.fridge_command_before_checkout(p_id,p_kind,p_payload);end if;
 if p_payload->>'currency' is distinct from 'USD' then raise exception 'Los cálculos de la nevera se registran en USD';end if;
 if p_kind in ('sale','loss') then
  if jsonb_typeof(p_payload->'sale_context') is distinct from 'object' then raise exception 'Selecciona el destino de la venta';end if;
  checkout_kind:=p_payload->'sale_context'->>'kind';label:=btrim(coalesce(p_payload->'sale_context'->>'name',''));
  if checkout_kind is null or checkout_kind not in ('general','project','staff','courtesy') or (p_kind='loss' and checkout_kind<>'courtesy') then raise exception 'Destino de venta no válido';end if;
  ctx:=jsonb_build_object('kind',checkout_kind);
  if checkout_kind='project' then
   if length(label) not between 1 and 140 then raise exception 'Declara el nombre del proyecto';end if;
   insert into studio_access_private.fridge_customers(name,kind) values('Proyecto · '||label,'client') on conflict(lower(btrim(name))) where kind='client' do update set name=studio_access_private.fridge_customers.name returning id into customer;
   ctx:=ctx||jsonb_build_object('name',label);
  elsif checkout_kind='staff' then
   employee:=nullif(p_payload->'sale_context'->>'employee_id','')::uuid;
   if employee is not null then
    select full_name into label from public.hr_employees where id=employee and status<>'terminated';if not found then raise exception 'Selecciona un trabajador válido';end if;
    insert into studio_access_private.fridge_customers(name,kind,employee_id) values(label,'staff',employee) on conflict(employee_id) where employee_id is not null do update set name=excluded.name returning id into customer;
   else
    if length(label) not between 1 and 160 then raise exception 'Declara el nombre del staff';end if;
    insert into studio_access_private.fridge_customers(name,kind,manual_staff) values(label,'staff',true) on conflict(lower(btrim(name))) where kind='staff' and manual_staff do update set name=studio_access_private.fridge_customers.name returning id into customer;
   end if;
   ctx:=ctx||jsonb_build_object('name',label,'employee_id',employee,'manual',employee is null);
  elsif checkout_kind='courtesy' and p_kind='sale' then
   if length(label) not between 1 and 160 or nullif(btrim(p_payload->>'note'),'') is null then raise exception 'Indica para quién es la cortesía y el motivo';end if;
   insert into studio_access_private.fridge_customers(name,kind) values('Cortesía · '||label,'client') on conflict(lower(btrim(name))) where kind='client' do update set name=studio_access_private.fridge_customers.name returning id into customer;
   ctx:=ctx||jsonb_build_object('name',label,'pricing_basis','cost_only');
  elsif checkout_kind='courtesy' then
   if length(label) not between 1 and 160 or nullif(btrim(p_payload->>'note'),'') is null then raise exception 'Indica para quién es la cortesía y el motivo';end if;
   if coalesce((p_payload->>'paid')::numeric,0)<>0 or nullif(p_payload->>'customer_id','') is not null or p_payload->>'reason' is distinct from 'courtesy' or coalesce(jsonb_typeof(p_payload->'collection'),'null')<>'null' then raise exception 'La cortesía no genera cobro ni deuda';end if;
   ctx:=ctx||jsonb_build_object('name',label);
   if jsonb_typeof(p_payload->'items') is distinct from 'array' then raise exception 'Selecciona los productos de la cortesía';end if;
   for line in select value from jsonb_array_elements(p_payload->'items') loop
    select * into prod from studio_access_private.fridge_products where id=(line->>'id')::uuid for update;
    if not found or not prod.active then raise exception 'Un producto ya no está disponible';end if;
    if (line->>'price')::numeric is distinct from prod.price then raise exception 'Cambió el precio de %. Actualiza la selección.',prod.name;end if;
    cost_total:=cost_total+prod.cost*(line->>'quantity')::numeric;
    courtesy_items:=courtesy_items||jsonb_build_array(jsonb_build_object('id',prod.id,'name',prod.name,'quantity',(line->>'quantity')::numeric,'cost',prod.cost,'product_type',prod.product_type,'components',(select components from studio_access_private.fridge_recipes where product_id=prod.id)));
   end loop;
  end if;
  if checkout_kind in ('staff','project') or (checkout_kind='courtesy' and p_kind='sale') then normalized:=normalized||jsonb_build_object('customer_id',customer);end if;
 end if;
 if p_kind in ('sale','payment') then
  paid:=case when p_kind='sale' then (p_payload->>'paid')::numeric else (p_payload->>'amount')::numeric end;col:=p_payload->'collection';
  if paid>0 and col is not null and jsonb_typeof(col)<>'null' then
   if jsonb_typeof(col)<>'object' or col->>'currency' is null or col->>'currency' not in ('USD','CUP') then raise exception 'Selecciona USD o CUP para el cobro';end if;
   amount:=(col->>'amount')::numeric;rate:=(col->>'rate')::numeric;
   if amount is null or rate is null or amount<=0 or rate<=0 or amount::text in ('NaN','Infinity','-Infinity') or rate::text in ('NaN','Infinity','-Infinity') or rate>1000000 or amount<>round(amount,2) or (col->>'currency'='USD' and rate<>1) or round(amount/rate,2)<>paid then raise exception 'El importe cobrado no coincide con la conversión en USD. Revisa importe y tasa';end if;
   if col->>'source' is null or col->>'source' not in ('manual','reference') then raise exception 'Indica la referencia de la tasa';end if;
   col:=jsonb_build_object('currency',col->>'currency','amount',amount,'rate',rate,'usd',paid,'source',col->>'source');
  elsif paid>0 then col:=jsonb_build_object('currency','USD','amount',paid,'rate',1,'usd',paid,'source','manual');
  else
   if col is not null and jsonb_typeof(col)<>'null' then raise exception 'Una venta sin cobro no debe declarar dinero recibido';end if;col:=null;
  end if;
 end if;
 r:=studio_access_private.fridge_command_before_checkout(p_id,p_kind,normalized);
 if checkout_kind='courtesy' and p_kind='sale' then
  -- Freeze an explicitly cost-only sheet. Later receipts must never accrue commissions.
  select jsonb_agg(i||jsonb_build_object('pricing_basis','cost_only','pricing',(i->'pricing')||jsonb_build_object('percentages','[]'::jsonb,'total_percent',0,'minimum',(i->>'cost')::numeric,'raw_minimum',(i->>'cost')::numeric,'review',false,'pricing_basis','cost_only'))) into courtesy_items from jsonb_array_elements(r->'items') i;
  update studio_access_private.fridge_sales set items=courtesy_items where id=p_id;
  r:=r||jsonb_build_object('items',courtesy_items,'pricing_basis','cost_only');
 end if;
 if ctx is not null then
  update studio_access_private.fridge_sales set sale_context=ctx where id=p_id;
  r:=r||jsonb_build_object('sale_context',ctx);
  if checkout_kind='courtesy' and p_kind='loss' then r:=r||jsonb_build_object('courtesy_items',courtesy_items,'courtesy_cost',cost_total,'paid',0,'pending',0);end if;
 end if;
 if col is not null then update studio_access_private.fridge_payments set collection=col where operation_id=p_id;r:=r||jsonb_build_object('collection',col);end if;
 update studio_access_private.fridge_operations set payload=p_payload,result=r where id=p_id;
 return r;
end $$;
revoke all on function studio_access_private.fridge_command(uuid,text,jsonb) from public,anon;
grant execute on function studio_access_private.fridge_command(uuid,text,jsonb) to authenticated;

-- Existing report snapshots are not recalculated or rewritten.
do $migration$ declare d text;begin
 d:=pg_get_functiondef('studio_access_private.fridge_cost_settlement(jsonb)'::regprocedure);
 if position('if paid>0 then' in d)=0 then raise exception 'No se reconoce el cálculo del fondo';end if;
 d:=replace(d,'if paid>0 then','if paid>0 and item->>''pricing_basis'' is distinct from ''cost_only'' then');execute d;
end $migration$;
