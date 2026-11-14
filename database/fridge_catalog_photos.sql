-- Presentation metadata, never an authorization claim.
alter table studio_access_private.fridge_products add column photo_background_cleaned boolean not null default false;
CREATE OR REPLACE FUNCTION studio_access_private.fridge_command(p_id uuid, p_kind text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare prior studio_access_private.fridge_operations%rowtype; prod studio_access_private.fridge_products%rowtype;
 line jsonb; lines jsonb; output jsonb; target uuid; customer uuid; customer_name text; customer_kind text;
 amount numeric(12,2); paid numeric(12,2); total numeric(12,2):=0; balance numeric(12,2); q integer; expected integer; difference integer; note text:=btrim(coalesce(p_payload->>'note','')); actor text;
begin
 if not studio_access_private.fridge_allowed() then raise exception 'No tienes acceso a Nevera audiovisual' using errcode='42501'; end if;
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
  if jsonb_typeof(lines) is distinct from 'array' or jsonb_array_length(lines) not between 1 and 100 or paid is null or paid<0 then raise exception 'Revisa las bebidas y el importe cobrado'; end if;
  if (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(lines) x) then raise exception 'Hay bebidas duplicadas'; end if;
  output:='[]';
  for line in select value from jsonb_array_elements(lines) loop
   select * into prod from studio_access_private.fridge_products where id=(line->>'id')::uuid for update;
   if not found or not prod.active then raise exception 'Una bebida ya no está disponible'; end if;
   q:=(line->>'quantity')::integer;
   if q is null or q<=0 or q>prod.stock then raise exception 'Existencias insuficientes para %',prod.name; end if;
   if line->>'price' is null or (line->>'price')::numeric<>prod.price then raise exception 'Cambió el precio de %. Actualiza la venta.',prod.name; end if;
   total:=total+prod.price*q;
   output:=output||jsonb_build_array(jsonb_build_object('id',prod.id,'name',prod.name,'quantity',q,'price',prod.price,'cost',prod.cost));
   update studio_access_private.fridge_products set stock=stock-q,version=version+1,updated_at=now() where id=prod.id;
   insert into studio_access_private.fridge_movements(operation_id,product_id,kind,quantity,stock_after) values(p_id,prod.id,'sale',-q,prod.stock-q);
  end loop;
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
  if jsonb_typeof(lines) is distinct from 'array' or jsonb_array_length(lines) not between 1 and 500 then raise exception 'Selecciona al menos una bebida'; end if;
  if (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(lines) x) then raise exception 'Hay bebidas duplicadas'; end if;
  if p_kind='loss' and (note='' or p_payload->>'reason' is null or p_payload->>'reason' not in ('breakage','expiry','courtesy')) then raise exception 'Indica el tipo de salida y su motivo'; end if;
  output:='[]';
  for line in select value from jsonb_array_elements(lines) loop
   select * into prod from studio_access_private.fridge_products where id=(line->>'id')::uuid for update;
   if not found then raise exception 'Bebida no encontrada'; end if;
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
end $function$
;

