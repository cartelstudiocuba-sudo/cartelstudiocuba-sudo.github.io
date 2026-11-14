-- Separate beverage ledger: sales affect stock; payments never affect stock.
create table studio_access_private.fridge_products (
 id uuid primary key default gen_random_uuid(), name text not null check(length(btrim(name)) between 1 and 160),
 category text not null check(category in ('Refrescos','Jugos','Agua','Cervezas','Otros')),
 price numeric(12,2) not null check(price>0), cost numeric(12,2) not null default 0 check(cost>=0),
 stock integer not null default 0 check(stock>=0), minimum integer not null default 5 check(minimum>=0),
 photo_path text, active boolean not null default true, version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table studio_access_private.fridge_customers (
 id uuid primary key default gen_random_uuid(), name text not null check(length(btrim(name)) between 1 and 160),
 kind text not null check(kind in ('staff','client')), employee_id uuid references public.hr_employees(id),
 created_at timestamptz not null default now(), check((kind='staff')=(employee_id is not null))
);
create unique index fridge_customer_employee on studio_access_private.fridge_customers(employee_id) where employee_id is not null;
create unique index fridge_customer_client_name on studio_access_private.fridge_customers(lower(btrim(name))) where kind='client';
create table studio_access_private.fridge_operations (
 id uuid primary key, actor_id uuid not null, actor_name text not null, kind text not null,
 payload jsonb not null, result jsonb, created_at timestamptz not null default now()
);
create index fridge_operations_created on studio_access_private.fridge_operations(created_at desc,id);
create index fridge_operations_customer on studio_access_private.fridge_operations((result->>'customer_id'),created_at desc);
create table studio_access_private.fridge_sales (
 id uuid primary key references studio_access_private.fridge_operations(id), customer_id uuid references studio_access_private.fridge_customers(id),
 amount numeric(12,2) not null check(amount>0), items jsonb not null, note text not null default '', created_at timestamptz not null default now()
);
create index fridge_sales_customer on studio_access_private.fridge_sales(customer_id,created_at desc);
create table studio_access_private.fridge_payments (
 id uuid primary key default gen_random_uuid(), operation_id uuid not null references studio_access_private.fridge_operations(id),
 customer_id uuid references studio_access_private.fridge_customers(id), sale_id uuid references studio_access_private.fridge_sales(id),
 amount numeric(12,2) not null check(amount>0), method text not null check(method in ('cash','transfer')),
 created_at timestamptz not null default now(), unique(operation_id)
);
create index fridge_payments_customer on studio_access_private.fridge_payments(customer_id,created_at desc);
create table studio_access_private.fridge_movements (
 id uuid primary key default gen_random_uuid(), operation_id uuid not null references studio_access_private.fridge_operations(id),
 product_id uuid not null references studio_access_private.fridge_products(id), kind text not null,
 quantity integer not null, stock_after integer not null check(stock_after>=0), details jsonb not null default '{}', created_at timestamptz not null default now(),
 unique(operation_id,product_id)
);
create index fridge_movements_product on studio_access_private.fridge_movements(product_id,created_at desc);

create function studio_access_private.fridge_allowed() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (studio_access_private.is_owner() or studio_access_private.inventory_order_role('jefe_audiovisuales'));
$$;
-- No direct client writes. Private data is accessible only through checked, atomic functions.
alter table studio_access_private.fridge_products enable row level security;
alter table studio_access_private.fridge_customers enable row level security;
alter table studio_access_private.fridge_operations enable row level security;
alter table studio_access_private.fridge_sales enable row level security;
alter table studio_access_private.fridge_payments enable row level security;
alter table studio_access_private.fridge_movements enable row level security;
create policy fridge_products_read on studio_access_private.fridge_products for select to authenticated using((select studio_access_private.fridge_allowed()));
create policy fridge_customers_read on studio_access_private.fridge_customers for select to authenticated using((select studio_access_private.fridge_allowed()));
create policy fridge_operations_read on studio_access_private.fridge_operations for select to authenticated using((select studio_access_private.fridge_allowed()));
create policy fridge_sales_read on studio_access_private.fridge_sales for select to authenticated using((select studio_access_private.fridge_allowed()));
create policy fridge_payments_read on studio_access_private.fridge_payments for select to authenticated using((select studio_access_private.fridge_allowed()));
create policy fridge_movements_read on studio_access_private.fridge_movements for select to authenticated using((select studio_access_private.fridge_allowed()));
revoke all on studio_access_private.fridge_products,studio_access_private.fridge_customers,studio_access_private.fridge_operations,studio_access_private.fridge_sales,studio_access_private.fridge_payments,studio_access_private.fridge_movements from public,anon,authenticated;

create function studio_access_private.fridge_state() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare balances jsonb; today_start timestamptz:=date_trunc('day',now() at time zone 'America/Havana') at time zone 'America/Havana';
begin
 if not studio_access_private.fridge_allowed() then raise exception 'No tienes acceso a Nevera audiovisual' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('balance',
 coalesce((select sum(s.amount) from studio_access_private.fridge_sales s where s.customer_id=c.id),0)-coalesce((select sum(p.amount) from studio_access_private.fridge_payments p where p.customer_id=c.id),0)) order by c.name),'[]') into balances from studio_access_private.fridge_customers c;
 return jsonb_build_object('currency','CUP','products',coalesce((select jsonb_agg(to_jsonb(p) order by p.name) from studio_access_private.fridge_products p),'[]'),
 'customers',balances,'staff',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.full_name) order by e.full_name) from public.hr_employees e where e.status<>'terminated'),'[]'),
 'stats',jsonb_build_object('sales_today',coalesce((select sum(s.amount) from studio_access_private.fridge_sales s where s.created_at>=today_start),0),
 'collected_today',coalesce((select sum(p.amount) from studio_access_private.fridge_payments p where p.created_at>=today_start),0),
 'owed',coalesce((select sum((b->>'balance')::numeric) from jsonb_array_elements(balances) b),0),
 'open_accounts',(select count(*) from jsonb_array_elements(balances) b where (b->>'balance')::numeric>0),
 'stock',coalesce((select sum(stock) from studio_access_private.fridge_products),0)), 'as_of',now());
end $$;

create function studio_access_private.fridge_history(p_customer uuid default null,p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not studio_access_private.fridge_allowed() then raise exception 'No tienes acceso a Nevera audiovisual' using errcode='42501'; end if;
 if p_offset<0 then raise exception 'Página no válida'; end if;
 return jsonb_build_object('rows',coalesce((select jsonb_agg(x.row_data order by x.created_at desc,x.id) from (
 select o.id,o.created_at,jsonb_build_object('id',o.id,'kind',o.kind,'created_at',o.created_at,'actor',o.actor_name,'details',o.result) as row_data
 from studio_access_private.fridge_operations o where (p_customer is null or o.result->>'customer_id'=p_customer::text)
 order by o.created_at desc,o.id limit 30 offset p_offset) x),'[]'),
 'more',(select count(*)>p_offset+30 from studio_access_private.fridge_operations o where p_customer is null or o.result->>'customer_id'=p_customer::text));
end $$;

create function studio_access_private.fridge_command(p_id uuid,p_kind text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
end $$;

create function public.fridge_access() returns boolean language sql stable security invoker set search_path='' as $$select studio_access_private.fridge_allowed()$$;
create function public.fridge_state() returns jsonb language sql stable security invoker set search_path='' as $$select studio_access_private.fridge_state()$$;
create function public.fridge_history(p_customer uuid default null,p_offset integer default 0) returns jsonb language sql stable security invoker set search_path='' as $$select studio_access_private.fridge_history(p_customer,p_offset)$$;
create function public.fridge_command(p_id uuid,p_kind text,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select studio_access_private.fridge_command(p_id,p_kind,p_payload)$$;
revoke all on function studio_access_private.fridge_allowed(),studio_access_private.fridge_state(),studio_access_private.fridge_history(uuid,integer),studio_access_private.fridge_command(uuid,text,jsonb),public.fridge_access(),public.fridge_state(),public.fridge_history(uuid,integer),public.fridge_command(uuid,text,jsonb) from public,anon;
grant execute on function studio_access_private.fridge_allowed(),studio_access_private.fridge_state(),studio_access_private.fridge_history(uuid,integer),studio_access_private.fridge_command(uuid,text,jsonb),public.fridge_access(),public.fridge_state(),public.fridge_history(uuid,integer),public.fridge_command(uuid,text,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('fridge-images','fridge-images',false,200000,array['image/jpeg']);
create policy fridge_images_read on storage.objects for select to authenticated using(bucket_id='fridge-images' and (select studio_access_private.fridge_allowed()));
create policy fridge_images_insert on storage.objects for insert to authenticated with check(bucket_id='fridge-images' and (select studio_access_private.fridge_allowed()) and name ~ ('^'||(select auth.uid())::text||'/[0-9a-f-]{36}\.jpg$'));
