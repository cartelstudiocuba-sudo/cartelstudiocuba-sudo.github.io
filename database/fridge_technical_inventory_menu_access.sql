begin;
CREATE OR REPLACE FUNCTION public.fridge_access()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$select (studio_access_private.fridge_allowed() or studio_access_private.fridge_technical_access())$function$;
CREATE OR REPLACE FUNCTION public.fridge_inventory_report_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not (studio_access_private.fridge_allowed() or studio_access_private.fridge_technical_access()) then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 return jsonb_build_object('as_of',now(),'requested_by',case when studio_access_private.is_owner() then 'Julio Martínez · CEO' else studio_access_private.inventory_actor_name() end,'products',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'stock',stock,'minimum',minimum,'active',active) order by name) from studio_access_private.fridge_products),'[]'));
end $function$;
CREATE OR REPLACE FUNCTION studio_access_private.fridge_command(p_id uuid, p_kind text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare prior studio_access_private.fridge_operations%rowtype;ctx jsonb;checkout_kind text;label text;employee uuid;customer uuid;normalized jsonb:=p_payload;r jsonb;col jsonb;amount numeric;rate numeric;paid numeric;line jsonb;prod studio_access_private.fridge_products%rowtype;cost_total numeric:=0;courtesy_items jsonb:='[]';acct studio_access_private.fridge_customers%rowtype;balance numeric;
begin
 if not (studio_access_private.fridge_allowed() or (studio_access_private.fridge_technical_access() and p_kind in ('product','replenish','count','loss') and not (p_kind='loss' and coalesce(p_payload ? 'sale_context',false)))) then raise exception 'No tienes acceso a Nevera audiovisual' using errcode='42501';end if;
 if p_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Operación no válida';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
 select * into prior from studio_access_private.fridge_operations where id=p_id;
 if found then if prior.actor_id<>auth.uid() or prior.kind<>p_kind or prior.payload<>p_payload then raise exception 'El identificador ya pertenece a otra operación';end if;return prior.result;end if;
 if not ((p_kind='sale' and p_payload ? 'sale_context') or (p_kind='loss' and p_payload ? 'sale_context') or (p_kind in ('sale','payment') and p_payload ? 'collection')) then return studio_access_private.fridge_command_before_checkout(p_id,p_kind,p_payload);end if;
 if p_payload->>'currency' is distinct from 'USD' then raise exception 'Los cálculos de la nevera se registran en USD';end if;
 if p_kind in ('sale','loss') then
  if jsonb_typeof(p_payload->'sale_context') is distinct from 'object' then raise exception 'Selecciona el destino de la venta';end if;
  checkout_kind:=p_payload->'sale_context'->>'kind';label:=btrim(coalesce(p_payload->'sale_context'->>'name',''));
  if checkout_kind is null or checkout_kind not in ('general','project','staff','courtesy','existing') or (p_kind='loss' and checkout_kind<>'courtesy') then raise exception 'Destino de venta no válido';end if;
  ctx:=jsonb_build_object('kind',checkout_kind);
  if checkout_kind='existing' then
   select * into acct from studio_access_private.fridge_customers where id=nullif(p_payload->>'customer_id','')::uuid for update;
   if not found then raise exception 'La cuenta seleccionada no existe';end if;
   if coalesce((p_payload->>'paid')::numeric,-1)<>0 or coalesce(jsonb_typeof(p_payload->'collection'),'null')<>'null' then raise exception 'Agregar a cuenta existente deja el consumo pendiente, sin cobro';end if;
   select coalesce((select sum(s.amount) from studio_access_private.fridge_sales s where s.customer_id=acct.id),0)-coalesce((select sum(p.amount) from studio_access_private.fridge_payments p where p.customer_id=acct.id),0) into balance;
   if balance<=0 then raise exception 'Esta cuenta ya no tiene saldo pendiente. Actualiza las cuentas abiertas';end if;
   select s.sale_context into ctx from studio_access_private.fridge_sales s where s.customer_id=acct.id order by s.created_at desc,s.id desc limit 1;
   ctx:=coalesce(ctx,'{}'::jsonb);
   checkout_kind:=case when ctx->>'kind' in ('project','staff','general') then ctx->>'kind' when ctx->>'kind'='courtesy' and ctx->>'pricing_basis'='cost_only' then 'courtesy' when acct.kind='staff' then 'staff' else 'general' end;
   customer:=acct.id;
   ctx:=ctx||jsonb_build_object('kind',checkout_kind,'name',coalesce(nullif(ctx->>'name',''),acct.name),'existing_account',true,'account_id',acct.id);
   normalized:=normalized||jsonb_build_object('customer_id',acct.id,'sale_context',ctx,'note',coalesce(nullif(btrim(p_payload->>'note'),''),'Consumo agregado a una cuenta existente.'));
  elsif checkout_kind='project' then
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
end $function$;
CREATE OR REPLACE FUNCTION studio_access_private.fridge_command_before_checkout(p_id uuid, p_kind text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
<<composite>>
declare prior studio_access_private.fridge_operations%rowtype;prod studio_access_private.fridge_products%rowtype;checked jsonb;normalized jsonb:=p_payload;r jsonb;kind text;recipe_rev integer;target uuid;line jsonb;items jsonb;
begin
 if not (studio_access_private.fridge_allowed() or (studio_access_private.fridge_technical_access() and p_kind in ('product','replenish','count','loss') and not (p_kind='loss' and coalesce(p_payload ? 'sale_context',false)))) then raise exception 'No tienes acceso a Nevera audiovisual' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
 select * into prior from studio_access_private.fridge_operations where id=p_id;
 if found then if prior.actor_id<>auth.uid() or prior.kind<>p_kind or prior.payload<>p_payload then raise exception 'El identificador ya pertenece a otra operación';end if;return prior.result;end if;
 if p_kind='product' then
  select * into prod from studio_access_private.fridge_products where id=(p_payload->>'id')::uuid for update;
  kind:=case when p_payload ? 'product_type' then p_payload->>'product_type' else coalesce(prod.product_type,'resale') end;
  if kind is null or kind not in ('resale','composite') then raise exception 'Selecciona un tipo de producto válido';end if;
  if kind='composite' then
   checked:=studio_access_private.fridge_composition_validate(p_payload->'components');
   select revision into recipe_rev from studio_access_private.fridge_recipes where product_id=prod.id;
   if (p_payload->>'recipe_revision')::integer is distinct from coalesce(recipe_rev,0) then raise exception 'La composición cambió. Actualiza antes de guardar.';end if;
   if (p_payload->>'cost')::numeric is distinct from (checked->>'cost')::numeric then raise exception 'El costo no coincide con la composición calculada';end if;
   normalized:=p_payload||jsonb_build_object('cost',checked->'cost','purchase',jsonb_build_object('currency','USD','amount',checked->'cost','rate',1,'source','composition'));
  end if;
 elsif p_kind='replenish' then
  for line in select value from jsonb_array_elements(p_payload->'items') loop
   select * into prod from studio_access_private.fridge_products where id=(line->>'id')::uuid;
   if prod.product_type='composite' and (line->>'unit_cost')::numeric is distinct from prod.cost then raise exception 'El costo de este producto se modifica desde su composición';end if;
  end loop;
 end if;
 r:=studio_access_private.fridge_command_before_composite(p_id,p_kind,normalized);
 if p_kind='product' then
  target:=(r->>'product_id')::uuid;
  update studio_access_private.fridge_products set product_type=kind where id=target;
  if kind='composite' then
   insert into studio_access_private.fridge_recipes(product_id,components,cost,updated_by) values(target,checked->'components',(checked->>'cost')::numeric,auth.uid()) on conflict(product_id) do update set components=excluded.components,cost=excluded.cost,revision=fridge_recipes.revision+1,updated_by=auth.uid(),updated_at=now();
   select revision into recipe_rev from studio_access_private.fridge_recipes where product_id=target;
  end if;
  checked:=jsonb_build_object('product_type',kind,'components',case when kind='composite' then checked->'components' else null end,'recipe_revision',case when kind='composite' then recipe_rev else null end,'inventory_consumption_enabled',false);
  update studio_access_private.fridge_cost_audit set snapshot=snapshot||checked where operation_id=p_id and product_id=target and fridge_cost_audit.kind='product';
  r:=r||checked;r:=jsonb_set(r,'{pricing}',coalesce(r->'pricing','{}')||checked);
 elsif p_kind='sale' then
  items:='[]';for line in select value from jsonb_array_elements(r->'items') loop
   select * into prod from studio_access_private.fridge_products where id=(line->>'id')::uuid;
   checked:=jsonb_build_object('product_type',prod.product_type,'inventory_consumption_enabled',false);
   if prod.product_type='composite' then select checked||jsonb_build_object('components',components,'recipe_revision',revision) into checked from studio_access_private.fridge_recipes where product_id=prod.id;end if;
   items:=items||jsonb_build_array(line||coalesce(checked,'{}'));
  end loop;
  r:=jsonb_set(r,'{items}',items);update studio_access_private.fridge_sales set items=composite.items where id=p_id;
 end if;
 update studio_access_private.fridge_operations set payload=p_payload,result=r where id=p_id;
 return r;
end $function$;
CREATE OR REPLACE FUNCTION studio_access_private.fridge_command_before_composite(p_id uuid, p_kind text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
<<pricewrap>>
declare cfg studio_access_private.fridge_cost_configs%rowtype;prod studio_access_private.fridge_products%rowtype;prior studio_access_private.fridge_operations%rowtype;r jsonb;ctx jsonb;exception jsonb;snap jsonb;i jsonb;items jsonb;target uuid;
begin
 if not (studio_access_private.fridge_allowed() or (studio_access_private.fridge_technical_access() and p_kind in ('product','replenish','count','loss') and not (p_kind='loss' and coalesce(p_payload ? 'sale_context',false)))) then raise exception 'No tienes acceso a Nevera audiovisual' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
 select * into prior from studio_access_private.fridge_operations where id=p_id;
 if found then
  if prior.actor_id<>auth.uid() or prior.kind<>p_kind or prior.payload<>p_payload then raise exception 'El identificador ya pertenece a otra operación';end if;
  return prior.result;
 end if;
 select * into strict cfg from studio_access_private.fridge_cost_configs order by revision desc limit 1;
 if p_kind='product' then
  if p_payload->>'cost' is null or (p_payload->>'cost')::numeric<>round((p_payload->>'cost')::numeric,2) or p_payload->>'price' is null or (p_payload->>'price')::numeric<>round((p_payload->>'price')::numeric,2) then raise exception 'Costo y precio deben indicarse con dos decimales';end if;
  select * into prod from studio_access_private.fridge_products where id=(p_payload->>'id')::uuid;
  if not found or prod.price is distinct from (p_payload->>'price')::numeric then
   if (p_payload->>'pricing_revision')::bigint is distinct from cfg.revision then raise exception 'La ficha de costo cambió. Actualiza el cálculo antes de guardar el precio.';end if;
   ctx:=jsonb_build_object('product_id',prod.id,'name',btrim(p_payload->>'name'),'cost',(p_payload->>'cost')::numeric,'price',(p_payload->>'price')::numeric,'config_revision',cfg.revision);
   exception:=studio_access_private.fridge_pricing_authorize(ctx,p_payload,p_id);
  end if;
 end if;
 r:=studio_access_private.fridge_command_pre_pricing(p_id,p_kind,p_payload);
 if p_kind='product' then
  target:=(r->>'product_id')::uuid;select * into strict prod from studio_access_private.fridge_products where id=target;
  snap:=studio_access_private.fridge_pricing_snapshot(prod.cost,prod.price,cfg)||jsonb_build_object('exception',exception,'purchase',p_payload->'purchase');
  insert into studio_access_private.fridge_cost_audit(operation_id,product_id,kind,snapshot,actor_id,actor_name) values(p_id,target,'product',snap,auth.uid(),studio_access_private.inventory_actor_name());
  r:=r||jsonb_build_object('pricing',snap);
 elsif p_kind='replenish' then
  items:='[]';for i in select value from jsonb_array_elements(p_payload->'items') loop
   select * into strict prod from studio_access_private.fridge_products where id=(i->>'id')::uuid;
   snap:=studio_access_private.fridge_pricing_snapshot(prod.cost,prod.price,cfg)||jsonb_build_object('purchase',i->'purchase','quantity',i->'quantity');
   insert into studio_access_private.fridge_cost_audit(operation_id,product_id,kind,snapshot,actor_id,actor_name) values(p_id,prod.id,'purchase',snap,auth.uid(),studio_access_private.inventory_actor_name());
   items:=items||jsonb_build_array(jsonb_build_object('product_id',prod.id,'name',prod.name,'pricing',snap));
  end loop;r:=r||jsonb_build_object('pricing_reviews',items);
 elsif p_kind='sale' then
  items:='[]';for i in select value from jsonb_array_elements(r->'items') loop
   snap:=studio_access_private.fridge_pricing_snapshot((i->>'cost')::numeric,(i->>'price')::numeric,cfg);
   snap:=snap||jsonb_build_object('last_price_authorization',(select snapshot->'exception' from studio_access_private.fridge_cost_audit where product_id=(i->>'id')::uuid and snapshot->'exception' is not null and snapshot->'exception'<>'null'::jsonb order by created_at desc limit 1));
   items:=items||jsonb_build_array(i||jsonb_build_object('pricing',snap));
  end loop;
  update studio_access_private.fridge_sales set items=pricewrap.items where id=p_id;
  r:=jsonb_set(r,'{items}',items);
 end if;
 update studio_access_private.fridge_operations set result=r where id=p_id;
 return r;
end $function$;
CREATE OR REPLACE FUNCTION studio_access_private.fridge_command_core(p_id uuid, p_kind text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare prior studio_access_private.fridge_operations%rowtype; prod studio_access_private.fridge_products%rowtype;
 line jsonb; lines jsonb; output jsonb; target uuid; customer uuid; customer_name text; customer_kind text;
 amount numeric(12,2); paid numeric(12,2); total numeric(12,2):=0; balance numeric(12,2); q integer; expected integer; difference integer; note text:=btrim(coalesce(p_payload->>'note','')); actor text;
begin
 if not (studio_access_private.fridge_allowed() or (studio_access_private.fridge_technical_access() and p_kind in ('product','replenish','count','loss') and not (p_kind='loss' and coalesce(p_payload ? 'sale_context',false)))) then raise exception 'No tienes acceso a Nevera audiovisual' using errcode='42501'; end if;
 if p_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or p_kind is null or p_kind not in ('product','customer','sale','payment','replenish','count','loss') then raise exception 'Operación no válida'; end if;
 if length(note)>2000 then raise exception 'La observación no puede superar 2000 caracteres'; end if;
 -- Single small sales point: serialize writes to make stock, balances and retries consistent.
 perform pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
 select * into prior from studio_access_private.fridge_operations where id=p_id;
 if found then
  if prior.actor_id<>auth.uid() or prior.kind<>p_kind or prior.payload<>p_payload then raise exception 'El identificador ya pertenece a otra operación'; end if;
  return prior.result;
 end if;
 actor:=studio_access_private.inventory_actor_name();
 insert into studio_access_private.fridge_operations(id,actor_id,actor_name,kind,payload) values(p_id,auth.uid(),actor,p_kind,p_payload);
 if p_kind='product' then
  target:=coalesce((p_payload->>'id')::uuid,gen_random_uuid());
  select * into prod from studio_access_private.fridge_products where id=target for update;
  if found and prod.version<>(p_payload->>'version')::integer then raise exception 'El producto cambió. Actualiza antes de editarlo.'; end if;
  if found and p_payload->>'version' is null then raise exception 'Falta la versión del producto'; end if;
  if nullif(p_payload->>'photo_path','') is not null and p_payload->>'photo_path' is distinct from prod.photo_path
   and p_payload->>'photo_path' !~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}\.jpg$') then raise exception 'Foto no válida'; end if;
  if nullif(btrim(p_payload->>'name'),'') is null or p_payload->>'price' is null or p_payload->>'category' is null or p_payload->>'minimum' is null then raise exception 'Completa nombre, categoría, precio y mínimo'; end if;
  insert into studio_access_private.fridge_products(id,name,category,price,cost,minimum,photo_path,active)
  values(target,btrim(p_payload->>'name'),p_payload->>'category',(p_payload->>'price')::numeric,coalesce((p_payload->>'cost')::numeric,0),(p_payload->>'minimum')::integer,nullif(p_payload->>'photo_path',''),coalesce((p_payload->>'active')::boolean,true))
  on conflict(id) do update set name=excluded.name,category=excluded.category,price=excluded.price,cost=excluded.cost,minimum=excluded.minimum,photo_path=excluded.photo_path,active=excluded.active,version=fridge_products.version+1,updated_at=now();
  update studio_access_private.fridge_products set photo_background_cleaned=case when p_payload ? 'photo_background_cleaned' then coalesce((p_payload->>'photo_background_cleaned')::boolean,false) when prod.photo_path is distinct from nullif(p_payload->>'photo_path','') then false else photo_background_cleaned end where id=target;
  output:=jsonb_build_object('product_id',target,'name',p_payload->>'name');
 elsif p_kind='customer' then
  customer_kind:=p_payload->>'kind';
  if customer_kind='staff' then
   select full_name into customer_name from public.hr_employees where id=(p_payload->>'employee_id')::uuid and status<>'terminated';
   if customer_name is null then raise exception 'Selecciona un trabajador válido'; end if;
   insert into studio_access_private.fridge_customers(name,kind,employee_id) values(customer_name,'staff',(p_payload->>'employee_id')::uuid) on conflict(employee_id) where employee_id is not null do update set name=excluded.name returning id into customer;
  elsif customer_kind='client' then
   customer_name:=btrim(p_payload->>'name');
   if nullif(customer_name,'') is null then raise exception 'Escribe el nombre del cliente'; end if;
   insert into studio_access_private.fridge_customers(name,kind) values(customer_name,'client') on conflict(lower(btrim(name))) where kind='client' do update set name=excluded.name returning id into customer;
  else raise exception 'Selecciona Staff o Cliente'; end if;
  output:=jsonb_build_object('customer_id',customer,'name',customer_name);
 elsif p_kind='sale' then
  customer:=nullif(p_payload->>'customer_id','')::uuid;
  if customer is not null then select name into customer_name from studio_access_private.fridge_customers where id=customer; if not found then raise exception 'Cuenta no encontrada'; end if; end if;
  lines:=p_payload->'items'; paid:=(p_payload->>'paid')::numeric;
  if jsonb_typeof(lines) is distinct from 'array' or jsonb_array_length(lines) not between 1 and 100 or paid is null or paid<0 then raise exception 'Revisa las productos y el importe cobrado'; end if;
  if (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(lines) x) then raise exception 'Hay productos duplicados'; end if;
  output:='[]';
  for line in select value from jsonb_array_elements(lines) loop
   select * into prod from studio_access_private.fridge_products where id=(line->>'id')::uuid for update;
   if not found or not prod.active then raise exception 'Un producto ya no está disponible'; end if;
      if p_payload->'sale_context'->>'kind'='courtesy' and (line->>'quantity')::numeric<>trunc((line->>'quantity')::numeric) then raise exception 'Introduce una cantidad entera de productos';end if;
   q:=(line->>'quantity')::integer;
   if q is null or q<=0 or q>prod.stock then raise exception 'Existencias insuficientes para %',prod.name; end if;
   if line->>'price' is null or (line->>'price')::numeric<>prod.price then raise exception 'Cambió el precio de %. Actualiza la venta.',prod.name; end if;
   
   if p_payload->'sale_context'->>'kind'='courtesy' and (line->>'cost')::numeric is distinct from prod.cost then raise exception 'Cambió el costo de %. Actualiza la selección.',prod.name;end if;
   total:=total+(case when p_payload->'sale_context'->>'kind'='courtesy' then prod.cost else prod.price end)*q;
 
   output:=output||jsonb_build_array(jsonb_build_object('id',prod.id,'name',prod.name,'quantity',q,'price',case when p_payload->'sale_context'->>'kind'='courtesy' then prod.cost else prod.price end,'cost',prod.cost));
   update studio_access_private.fridge_products set stock=stock-q,version=version+1,updated_at=now() where id=prod.id;
   insert into studio_access_private.fridge_movements(operation_id,product_id,kind,quantity,stock_after) values(p_id,prod.id,'sale',-q,prod.stock-q);
  end loop;
  if p_payload->'sale_context'->>'kind'='courtesy' and total<=0 then raise exception 'La cortesía debe tener un costo total mayor que cero';end if;
  if total<=0 or paid>total or (paid<total and customer is null) then raise exception 'Para dejar saldo pendiente, selecciona una cuenta. El cobro no puede superar la venta.'; end if;
  if paid>0 and (p_payload->>'method' is null or p_payload->>'method' not in ('cash','transfer')) then raise exception 'Selecciona el medio de cobro'; end if;
  insert into studio_access_private.fridge_sales(id,customer_id,amount,items,note) values(p_id,customer,total,output,note);
  if paid>0 then insert into studio_access_private.fridge_payments(operation_id,customer_id,sale_id,amount,method) values(p_id,customer,p_id,paid,p_payload->>'method'); end if;
  output:=jsonb_build_object('customer_id',customer,'customer_name',coalesce(customer_name,'Venta al contado'),'amount',total,'paid',paid,'method',p_payload->>'method','pending',total-paid,'items',output,'note',note);
 elsif p_kind='payment' then
  customer:=(p_payload->>'customer_id')::uuid; amount:=(p_payload->>'amount')::numeric;
  select name into customer_name from studio_access_private.fridge_customers where id=customer;
  if not found then raise exception 'Cuenta no encontrada'; end if;
  select coalesce((select sum(s.amount) from studio_access_private.fridge_sales s where s.customer_id=customer),0)-coalesce((select sum(p.amount) from studio_access_private.fridge_payments p where p.customer_id=customer),0) into balance;
  if amount is null or amount<=0 or amount>balance then raise exception 'El cobro debe ser mayor que cero y no superar la deuda actual (%)',balance; end if;
  if p_payload->>'method' is null or p_payload->>'method' not in ('cash','transfer') then raise exception 'Selecciona el medio de cobro'; end if;
  insert into studio_access_private.fridge_payments(operation_id,customer_id,amount,method) values(p_id,customer,amount,p_payload->>'method');
  output:=jsonb_build_object('customer_id',customer,'customer_name',customer_name,'paid',amount,'balance',balance-amount,'method',p_payload->>'method','note',note);
 else
  lines:=p_payload->'items';
  if jsonb_typeof(lines) is distinct from 'array' or jsonb_array_length(lines) not between 1 and 500 then raise exception 'Selecciona al menos un producto'; end if;
  if (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(lines) x) then raise exception 'Hay productos duplicados'; end if;
  if p_kind='loss' and (note='' or p_payload->>'reason' is null or p_payload->>'reason' not in ('breakage','expiry','courtesy')) then raise exception 'Indica el tipo de salida y su motivo'; end if;
  output:='[]';
  for line in select value from jsonb_array_elements(lines) loop
   select * into prod from studio_access_private.fridge_products where id=(line->>'id')::uuid for update;
   if not found then raise exception 'Producto no encontrado'; end if;
      if p_payload->'sale_context'->>'kind'='courtesy' and (line->>'quantity')::numeric<>trunc((line->>'quantity')::numeric) then raise exception 'Introduce una cantidad entera de productos';end if;
   q:=(line->>'quantity')::integer;
   if q is null or q<0 or (p_kind<>'count' and q=0) then raise exception 'Introduce cantidades válidas'; end if;
   if p_kind='count' then
    if line->>'version' is null or prod.version<>(line->>'version')::integer then raise exception 'Las existencias de % cambiaron durante el conteo. Actualiza y vuelve a contar.',prod.name; end if;
    expected:=prod.stock; difference:=q-expected;
    if difference<>0 and note='' then raise exception 'Explica la diferencia del conteo antes de ajustar'; end if;
   else expected:=prod.stock; difference:=case when p_kind='loss' then -q else q end; end if;
   if expected+difference<0 then raise exception 'Existencias insuficientes para %',prod.name; end if;
   update studio_access_private.fridge_products set stock=stock+difference,version=version+1,updated_at=now() where id=prod.id;
   insert into studio_access_private.fridge_movements(operation_id,product_id,kind,quantity,stock_after,details) values(p_id,prod.id,p_kind,difference,expected+difference,jsonb_build_object('expected',expected,'counted',case when p_kind='count' then q end,'reason',p_payload->>'reason','note',note));
   output:=output||jsonb_build_array(jsonb_build_object('id',prod.id,'name',prod.name,'before',expected,'quantity',difference,'after',expected+difference));
  end loop;
  output:=jsonb_build_object('items',output,'note',note,'reason',p_payload->>'reason');
 end if;
 update studio_access_private.fridge_operations set result=output where id=p_id;
 return output;
end $function$;
CREATE OR REPLACE FUNCTION studio_access_private.fridge_command_ledger(p_id uuid, p_kind text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r jsonb;p uuid;existed boolean;rows jsonb;
begin
 if not (studio_access_private.fridge_allowed() or (studio_access_private.fridge_technical_access() and p_kind in ('product','replenish','count','loss') and not (p_kind='loss' and coalesce(p_payload ? 'sale_context',false)))) then raise exception 'No tienes acceso a los productos de nevera' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
 existed:=exists(select 1 from studio_access_private.fridge_operations where id=p_id);
 if not existed and p_kind='replenish' and exists(select 1 from jsonb_array_elements(p_payload->'items') i join studio_access_private.fridge_products prod on prod.id=(i->>'id')::uuid where prod.stock>0 and not prod.cost_confirmed and prod.cost=0) then raise exception 'Confirma primero el costo de las existencias actuales';end if;
 if not existed and p_kind='sale' and exists(select 1 from jsonb_array_elements(p_payload->'items') i join studio_access_private.fridge_products prod on prod.id=(i->>'id')::uuid where not prod.cost_confirmed and prod.cost=0) then raise exception 'Confirma el costo de compra de los productos antes de venderlos';end if;
 if p_kind='product' and not existed and coalesce((p_payload->>'cost')::numeric,0)=0 and not coalesce((p_payload->>'cost_confirmed')::boolean,false) then raise exception 'Indica el costo de compra o confirma que el producto no tuvo costo';end if;
 r:=studio_access_private.fridge_command_core(p_id,p_kind,p_payload);
 if not existed and p_kind='product' then update studio_access_private.fridge_products set cost_confirmed=(cost>0 or coalesce((p_payload->>'cost_confirmed')::boolean,false)) where id=(r->>'product_id')::uuid;end if;
 if not existed and p_kind='sale' then
  select jsonb_agg(i||jsonb_build_object('cost_confirmed',true)) into rows from jsonb_array_elements(r->'items') i;
  update studio_access_private.fridge_sales set items=rows where id=p_id;r:=jsonb_set(r,'{items}',rows);
  update studio_access_private.fridge_operations set result=r where id=p_id;
 end if;
 if not existed and p_kind='replenish' then
  for rows in select value from jsonb_array_elements(p_payload->'items') loop
   if rows->>'unit_cost' is not null then
    if (rows->>'unit_cost')::numeric<0 then raise exception 'El costo de compra no puede ser negativo';end if;
    update studio_access_private.fridge_products set cost=round((rows->>'unit_cost')::numeric,2),cost_confirmed=true where id=(rows->>'id')::uuid and stock>0;
    update studio_access_private.fridge_movements set details=details||jsonb_build_object('purchase_unit_cost',(rows->>'unit_cost')::numeric) where operation_id=p_id and product_id=(rows->>'id')::uuid;
   end if;
  end loop;
 end if;
 if p_kind in ('sale','payment') then select id into p from studio_access_private.fridge_payments where operation_id=p_id;if p is not null then perform studio_access_private.fridge_allocate_receipt(p);end if;end if;
 return r;
end $function$;
CREATE OR REPLACE FUNCTION studio_access_private.fridge_command_pre_pricing(p_id uuid, p_kind text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare i jsonb;r jsonb;existed boolean;quantity integer;previous integer;target uuid;
begin
 if not (studio_access_private.fridge_allowed() or (studio_access_private.fridge_technical_access() and p_kind in ('product','replenish','count','loss') and not (p_kind='loss' and coalesce(p_payload ? 'sale_context',false)))) then raise exception 'No tienes acceso a los productos de nevera' using errcode='42501';end if;
 if p_payload->>'currency' is distinct from 'USD' then raise exception 'Actualiza Nevera audiovisual para trabajar en USD';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
 existed:=exists(select 1 from studio_access_private.fridge_operations where id=p_id);
 if p_kind='product' and p_payload ? 'stock_quantity' then
  if jsonb_typeof(p_payload->'stock_quantity') is distinct from 'number' or (p_payload->>'stock_quantity')::numeric<0 or (p_payload->>'stock_quantity')::numeric>1000000 or (p_payload->>'stock_quantity')::numeric<>trunc((p_payload->>'stock_quantity')::numeric) then raise exception 'La cantidad debe ser un número entero entre 0 y 1000000';end if;
  quantity:=(p_payload->>'stock_quantity')::integer;
  select stock into previous from studio_access_private.fridge_products where id=(p_payload->>'id')::uuid;
  previous:=coalesce(previous,0);
 end if;
 if p_kind='product' then perform studio_access_private.fridge_purchase_check(p_payload->'purchase',(p_payload->>'cost')::numeric);end if;
 if p_kind='replenish' then
  for i in select value from jsonb_array_elements(p_payload->'items') loop
   perform studio_access_private.fridge_purchase_check(i->'purchase',(i->>'unit_cost')::numeric);
  end loop;
 end if;
 r:=studio_access_private.fridge_command_ledger(p_id,p_kind,p_payload);
 if p_kind='product' and quantity is not null and not existed then
  target:=(r->>'product_id')::uuid;
  if quantity<>previous then
   update studio_access_private.fridge_products set stock=quantity,version=version+1,updated_at=now() where id=target;
   insert into studio_access_private.fridge_movements(operation_id,product_id,kind,quantity,stock_after,details)
   values(p_id,target,case when p_payload->>'id' is null then 'replenish' else 'count' end,quantity-previous,quantity,
    jsonb_build_object('expected',previous,'counted',quantity,'purchase_unit_cost',(p_payload->>'cost')::numeric,'currency','USD','purchase',p_payload->'purchase','note',case when p_payload->>'id' is null then 'Existencias iniciales al crear el producto' else 'Cantidad declarada al editar el producto' end));
  end if;
  r:=r||jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id',target,'name',p_payload->>'name','before',previous,'quantity',quantity-previous,'after',quantity)));
  update studio_access_private.fridge_operations set result=r where id=p_id;
 end if;
 if p_kind='replenish' then
  for i in select value from jsonb_array_elements(p_payload->'items') loop
   update studio_access_private.fridge_movements set details=details||jsonb_build_object('currency','USD','purchase',i->'purchase') where operation_id=p_id and product_id=(i->>'id')::uuid;
  end loop;
 end if;
 return r;
end $function$;
CREATE OR REPLACE FUNCTION studio_access_private.fridge_history(p_customer uuid DEFAULT NULL::uuid, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not (studio_access_private.fridge_allowed() or studio_access_private.fridge_technical_access()) then raise exception 'No tienes acceso a Nevera audiovisual' using errcode='42501'; end if;
 if p_offset<0 then raise exception 'Página no válida'; end if;
 return jsonb_build_object('rows',coalesce((select jsonb_agg(x.row_data order by x.created_at desc,x.id) from (
 select o.id,o.created_at,jsonb_build_object('id',o.id,'kind',o.kind,'created_at',o.created_at,'actor',o.actor_name,'details',o.result) as row_data
 from studio_access_private.fridge_operations o where (p_customer is null or o.result->>'customer_id'=p_customer::text) and (not studio_access_private.fridge_technical_access() or (p_customer is null and o.kind in ('product','replenish','count','loss') and not (o.payload ? 'sale_context')))
 order by o.created_at desc,o.id limit 30 offset p_offset) x),'[]'),
 'more',(select count(*)>p_offset+30 from studio_access_private.fridge_operations o where (p_customer is null or o.result->>'customer_id'=p_customer::text) and (not studio_access_private.fridge_technical_access() or (p_customer is null and o.kind in ('product','replenish','count','loss') and not (o.payload ? 'sale_context')))));
end $function$;
CREATE OR REPLACE FUNCTION studio_access_private.fridge_menu_allowed()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$select auth.uid() is not null and (studio_access_private.fridge_technical_access() or studio_access_private.fridge_full_access() or studio_access_private.fridge_manager())$function$;
CREATE OR REPLACE FUNCTION studio_access_private.fridge_pricing_command(p_id uuid, p_kind text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare checked jsonb;r jsonb;existed boolean;
begin
 if not (studio_access_private.fridge_manager() or (studio_access_private.fridge_allowed() or studio_access_private.fridge_technical_access())) then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 if p_kind='config' then raise exception 'Administra los conceptos y porcentajes desde Finanzas → Fichas de costo';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
 existed:=exists(select 1 from studio_access_private.fridge_pricing_events where id=p_id);
 if p_kind='recipe' and not existed then checked:=studio_access_private.fridge_composition_validate(p_payload->'components');end if;
 r:=studio_access_private.fridge_pricing_command_before_finance(p_id,p_kind,p_payload);
 if p_kind='recipe' and not existed then update studio_access_private.fridge_products set product_type='composite' where id=(p_payload->>'product_id')::uuid;end if;
 return r;
end $function$;
CREATE OR REPLACE FUNCTION studio_access_private.fridge_pricing_command_before_finance(p_id uuid, p_kind text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
<<pricing>>
declare manager boolean:=studio_access_private.fridge_manager();prior studio_access_private.fridge_pricing_events%rowtype;cfg studio_access_private.fridge_cost_configs%rowtype;prod studio_access_private.fridge_products%rowtype;req studio_access_private.fridge_price_requests%rowtype;r jsonb;rows jsonb;line jsonb;total numeric:=0;v numeric;price numeric;cost numeric;ctx jsonb;exception jsonb;snap jsonb;reason text:=btrim(coalesce(p_payload->>'reason',''));keys text[]:=array['seller','chief','operations','technical','manager','fixed','recovery','profit'];k text;existing_revision integer;
begin
 if not (manager or (studio_access_private.fridge_allowed() or studio_access_private.fridge_technical_access())) then raise exception 'Acceso no autorizado a fichas de costo' using errcode='42501';end if;
 if p_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or p_kind is null then raise exception 'Operación no válida';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
 select * into prior from studio_access_private.fridge_pricing_events where id=p_id;
 if found then if prior.actor_id<>auth.uid() or prior.kind<>p_kind or prior.payload<>p_payload then raise exception 'Identificador utilizado por otra operación';end if;return prior.result;end if;
 select * into strict cfg from studio_access_private.fridge_cost_configs order by revision desc limit 1;
 insert into studio_access_private.fridge_pricing_events(id,actor_id,actor_name,kind,payload) values(p_id,auth.uid(),studio_access_private.inventory_actor_name(),p_kind,p_payload);
 if p_kind in ('config','approve','reject','recipe') and not manager then raise exception 'Solo el Manager General puede realizar esta acción' using errcode='42501';end if;
 if p_kind='config' then
  if (p_payload->>'revision')::bigint is distinct from cfg.revision then raise exception 'La ficha cambió. Actualiza antes de editar.';end if;
  if length(reason) not between 5 and 2000 then raise exception 'Indica el motivo del cambio';end if;
  rows:=p_payload->'rows';if jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows)<>8 then raise exception 'La ficha requiere sus ocho conceptos';end if;
  foreach k in array keys loop
   if (select count(*) from jsonb_array_elements(rows) x where x->>'key'=k)<>1 then raise exception 'Conceptos incompletos o duplicados';end if;
   select (x->>'percent')::numeric into v from jsonb_array_elements(rows) x where x->>'key'=k;
   if v is null or v<0 or v>=100 or v::text in ('NaN','Infinity','-Infinity') or v<>round(v,2) then raise exception 'Porcentaje inválido';end if;
   total:=total+v;
  end loop;
  if total>=100 then raise exception 'La suma de porcentajes debe ser inferior al 100 %%';end if;
  select jsonb_agg(jsonb_build_object('key',c->>'key','label',c->>'label','percent',(x->>'percent')::numeric) order by ord) into rows from jsonb_array_elements(cfg.rows) with ordinality t(c,ord) join jsonb_array_elements(rows) x on x->>'key'=c->>'key';
  insert into studio_access_private.fridge_cost_configs(rows,total,created_by,actor_name,reason) values(rows,total,auth.uid(),studio_access_private.inventory_actor_name(),reason) returning to_jsonb(fridge_cost_configs.*) into r;
 elsif p_kind='request' then
  if length(reason) not between 5 and 2000 then raise exception 'Explica el motivo de la excepción';end if;
  ctx:=p_payload->'context';cost:=(ctx->>'cost')::numeric;price:=(ctx->>'price')::numeric;
  if cost is null or cost<0 or cost>9999999999.99 or cost<>round(cost,2) or price is null or price<=0 or price>9999999999.99 or price<>round(price,2) or (ctx->>'config_revision')::bigint is distinct from cfg.revision or length(btrim(coalesce(ctx->>'name',''))) not between 1 and 160 then raise exception 'Revisa la solicitud y la ficha vigente';end if;
  if ctx->>'product_id' is not null and not exists(select 1 from studio_access_private.fridge_products where id=(ctx->>'product_id')::uuid) then raise exception 'Producto no encontrado';end if;
  if price>=studio_access_private.fridge_pricing_min(cost+cfg.fixed_total,cfg.total) then raise exception 'Este precio no necesita excepción';end if;
  ctx:=jsonb_build_object('product_id',(ctx->>'product_id')::uuid,'name',btrim(ctx->>'name'),'cost',cost,'price',price,'config_revision',cfg.revision);
  select to_jsonb(q) into r from studio_access_private.fridge_price_requests q where q.context=ctx and q.requested_by=auth.uid() and q.status in ('pending','approved') order by q.created_at desc limit 1;
  if r is null then insert into studio_access_private.fridge_price_requests(id,context,reason,requested_by,requester_name) values(p_id,ctx,reason,auth.uid(),studio_access_private.inventory_actor_name()) returning to_jsonb(fridge_price_requests.*) into r;end if;
 elsif p_kind in ('approve','reject') then
  select * into req from studio_access_private.fridge_price_requests where id=(p_payload->>'request_id')::uuid for update;
  if not found or req.status<>'pending' then raise exception 'La solicitud ya no está pendiente';end if;
  if p_kind='approve' and (req.context->>'config_revision')::bigint<>cfg.revision then raise exception 'La ficha cambió: solicita una aprobación nueva';end if;
  if length(reason) not between 5 and 2000 then raise exception 'Indica el motivo de la decisión';end if;
  update studio_access_private.fridge_price_requests set status=case when p_kind='approve' then 'approved' else 'rejected' end,decided_by=auth.uid(),decider_name=studio_access_private.inventory_actor_name(),decided_at=now(),decision_reason=pricing.reason where id=req.id returning to_jsonb(fridge_price_requests.*) into r;
 elsif p_kind='price' then
  select * into prod from studio_access_private.fridge_products where id=(p_payload->>'product_id')::uuid for update;
  if not found or (p_payload->>'version')::integer is distinct from prod.version or (p_payload->>'revision')::bigint is distinct from cfg.revision then raise exception 'El producto o la ficha cambió. Actualiza antes de cambiar el precio.';end if;
  price:=(p_payload->>'price')::numeric;if price is null or price<=0 or price>9999999999.99 or price<>round(price,2) then raise exception 'Precio no válido';end if;
  ctx:=jsonb_build_object('product_id',prod.id,'name',prod.name,'cost',prod.cost,'price',price,'config_revision',cfg.revision);
  exception:=studio_access_private.fridge_pricing_authorize(ctx,p_payload,p_id);
  update studio_access_private.fridge_products set price=pricing.price,version=version+1,updated_at=now() where id=prod.id;
  snap:=studio_access_private.fridge_pricing_snapshot(prod.cost,price,cfg)||jsonb_build_object('exception',exception);
  insert into studio_access_private.fridge_cost_audit(operation_id,product_id,kind,snapshot,actor_id,actor_name) values(p_id,prod.id,'price',snap,auth.uid(),studio_access_private.inventory_actor_name());r:=snap;
 elsif p_kind='recipe' then
  select * into prod from studio_access_private.fridge_products where id=(p_payload->>'product_id')::uuid for update;
  if not found or (p_payload->>'version')::integer is distinct from prod.version then raise exception 'El producto cambió. Actualiza antes de guardar la composición.';end if;
  select revision into existing_revision from studio_access_private.fridge_recipes where product_id=prod.id;
  if coalesce(existing_revision,0) is distinct from (p_payload->>'recipe_revision')::integer then raise exception 'La composición cambió. Actualiza.';end if;
  rows:=p_payload->'components';if jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows) not between 1 and 100 then raise exception 'Agrega al menos un componente';end if;
  for line in select value from jsonb_array_elements(rows) loop
   if length(btrim(coalesce(line->>'name',''))) not between 1 and 160 or length(coalesce(line->>'unit',''))>60 then raise exception 'Indica el nombre y unidad de cada insumo';end if;
   v:=(line->>'quantity')::numeric;cost:=(line->>'unit_cost')::numeric;
   if v is null or v<=0 or v>1000000 or v::text in ('NaN','Infinity','-Infinity') or cost is null or cost<0 or cost>9999999999.99 or cost::text in ('NaN','Infinity','-Infinity') then raise exception 'Revisa las cantidades y costos de los componentes';end if;
   total:=total+v*cost;
  end loop;cost:=ceil(total*100)/100;
  insert into studio_access_private.fridge_recipes(product_id,components,cost,updated_by) values(prod.id,rows,cost,auth.uid()) on conflict(product_id) do update set components=excluded.components,cost=excluded.cost,revision=fridge_recipes.revision+1,updated_by=auth.uid(),updated_at=now();
  update studio_access_private.fridge_products set cost=pricing.cost,cost_confirmed=true,version=version+1,updated_at=now() where id=prod.id;
  snap:=studio_access_private.fridge_pricing_snapshot(cost,prod.price,cfg)||jsonb_build_object('components',rows,'inventory_consumption_enabled',false);
  insert into studio_access_private.fridge_cost_audit(operation_id,product_id,kind,snapshot,actor_id,actor_name) values(p_id,prod.id,'recipe',snap,auth.uid(),studio_access_private.inventory_actor_name());r:=snap;
 else raise exception 'Operación no válida';end if;
 update studio_access_private.fridge_pricing_events set result=r where id=p_id;return r;
end $function$;
CREATE OR REPLACE FUNCTION studio_access_private.fridge_pricing_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare cfg studio_access_private.fridge_cost_configs%rowtype;manager boolean:=studio_access_private.fridge_manager();
begin
 if not (manager or (studio_access_private.fridge_allowed() or studio_access_private.fridge_technical_access())) then raise exception 'Acceso no autorizado a fichas de costo' using errcode='42501';end if;
 select * into strict cfg from studio_access_private.fridge_cost_configs order by revision desc limit 1;
 return jsonb_build_object('manager',manager,'config',to_jsonb(cfg),
 'products',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'cost',cost,'price',price,'version',version,'minimum_price',studio_access_private.fridge_pricing_min(cost+cfg.fixed_total,cfg.total),'review',price<studio_access_private.fridge_pricing_min(cost+cfg.fixed_total,cfg.total)) order by name) from studio_access_private.fridge_products),'[]'),
 'requests',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc) from (select * from studio_access_private.fridge_price_requests where manager or requested_by=auth.uid() order by created_at desc limit 100) x),'[]'),
 'history',case when manager then coalesce((select jsonb_agg(to_jsonb(x) order by revision desc) from (select * from studio_access_private.fridge_cost_configs order by revision desc limit 50) x),'[]') else '[]'::jsonb end,
 'audit',case when manager then coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc) from (select a.*,p.name as product_name from studio_access_private.fridge_cost_audit a join studio_access_private.fridge_products p on p.id=a.product_id order by a.created_at desc limit 100) x),'[]') else '[]'::jsonb end,
 'recipes',coalesce((select jsonb_agg(to_jsonb(x)) from studio_access_private.fridge_recipes x),'[]'));
end $function$;
CREATE OR REPLACE FUNCTION studio_access_private.fridge_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare balances jsonb; today_start timestamptz:=date_trunc('day',now() at time zone 'America/Havana') at time zone 'America/Havana';
begin
 if studio_access_private.fridge_technical_access() then
 return jsonb_build_object('technical_workspace',true,'workspace_sections','["summary","stock","menu"]'::jsonb,'products',coalesce((select jsonb_agg(to_jsonb(p) order by p.name) from studio_access_private.fridge_products p),'[]'::jsonb),'customers','[]'::jsonb,'staff','[]'::jsonb,'stats','{}'::jsonb,'as_of',now());
 end if;
 if not studio_access_private.fridge_allowed() then raise exception 'No tienes acceso a Nevera audiovisual' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('pricing_basis',coalesce((select s.sale_context->>'pricing_basis' from studio_access_private.fridge_sales s where s.customer_id=c.id order by s.created_at desc,s.id desc limit 1),'standard'),'balance',
 coalesce((select sum(s.amount) from studio_access_private.fridge_sales s where s.customer_id=c.id),0)-coalesce((select sum(p.amount) from studio_access_private.fridge_payments p where p.customer_id=c.id),0)) order by c.name),'[]') into balances from studio_access_private.fridge_customers c;
 return jsonb_build_object('workspace_sections',case when studio_access_private.fridge_operational_access() and not studio_access_private.fridge_full_access() then '["sale","accounts","stock"]'::jsonb else null end,'operational_workspace',studio_access_private.fridge_operational_access() and not studio_access_private.fridge_full_access(),'currency','USD','products',coalesce((select jsonb_agg(to_jsonb(p) order by p.name) from studio_access_private.fridge_products p),'[]'),
 'customers',balances,'staff',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.full_name) order by e.full_name) from public.hr_employees e where e.status<>'terminated'),'[]'),
 'stats',jsonb_build_object('sales_today',coalesce((select sum(s.amount) from studio_access_private.fridge_sales s where s.created_at>=today_start),0),
 'collected_today',coalesce((select sum(p.amount) from studio_access_private.fridge_payments p where p.created_at>=today_start),0),
 'owed',coalesce((select sum((b->>'balance')::numeric) from jsonb_array_elements(balances) b),0),
 'open_accounts',(select count(*) from jsonb_array_elements(balances) b where (b->>'balance')::numeric>0),
 'stock',coalesce((select sum(stock) from studio_access_private.fridge_products),0)), 'as_of',now());
end $function$;
alter policy fridge_images_read on storage.objects using (bucket_id='fridge-images' and (select studio_access_private.fridge_allowed() or studio_access_private.fridge_technical_access()));
alter policy fridge_images_insert on storage.objects with check (bucket_id='fridge-images' and (select studio_access_private.fridge_allowed() or studio_access_private.fridge_technical_access()) and name ~ ('^'||(select auth.uid())::text||'/[0-9a-f-]{36}[.]jpg$'));
commit;