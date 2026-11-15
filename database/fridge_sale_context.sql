-- Additive checkout context and collection currency. Existing ledgers remain in USD.
select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
insert into studio_access_private.fridge_pricing_backups(name,definition)
select 'checkout.'||p.proname,pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace='studio_access_private'::regnamespace and p.proname in ('fridge_command','fridge_reconciliation_snapshot') on conflict(name) do nothing;
alter table studio_access_private.fridge_sales add column sale_context jsonb not null default '{}';
alter table studio_access_private.fridge_payments add column collection jsonb;
alter table studio_access_private.fridge_customers add column manual_staff boolean not null default false;
alter table studio_access_private.fridge_customers drop constraint fridge_customers_check;
alter table studio_access_private.fridge_customers add constraint fridge_customers_check check((kind='staff' and (employee_id is not null or manual_staff)) or (kind='client' and employee_id is null and not manual_staff));
create unique index fridge_manual_staff_name on studio_access_private.fridge_customers(lower(btrim(name))) where kind='staff' and manual_staff;
alter function studio_access_private.fridge_command(uuid,text,jsonb) rename to fridge_command_before_checkout;
revoke all on function studio_access_private.fridge_command_before_checkout(uuid,text,jsonb) from public,anon,authenticated;
create function studio_access_private.fridge_command(p_id uuid,p_kind text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
  if checkout_kind is null or checkout_kind not in ('general','project','staff','courtesy') or (p_kind='sale' and checkout_kind='courtesy') or (p_kind='loss' and checkout_kind<>'courtesy') then raise exception 'Destino de venta no válido';end if;
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
  if checkout_kind in ('staff','project') then normalized:=normalized||jsonb_build_object('customer_id',customer);end if;
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
 if ctx is not null then
  update studio_access_private.fridge_sales set sale_context=ctx where id=p_id;
  r:=r||jsonb_build_object('sale_context',ctx);
  if checkout_kind='courtesy' then r:=r||jsonb_build_object('courtesy_items',courtesy_items,'courtesy_cost',cost_total,'paid',0,'pending',0);end if;
 end if;
 if col is not null then update studio_access_private.fridge_payments set collection=col where operation_id=p_id;r:=r||jsonb_build_object('collection',col);end if;
 update studio_access_private.fridge_operations set payload=p_payload,result=r where id=p_id;
 return r;
end $$;
revoke all on function studio_access_private.fridge_command(uuid,text,jsonb) from public,anon;
grant execute on function studio_access_private.fridge_command(uuid,text,jsonb) to authenticated;
-- Include new checkout courtesies in the next report without inflating sales/receipts.
alter function studio_access_private.fridge_reconciliation_snapshot(uuid) rename to fridge_reconciliation_snapshot_before_checkout;
revoke all on function studio_access_private.fridge_reconciliation_snapshot_before_checkout(uuid) from public,anon,authenticated;
create function studio_access_private.fridge_reconciliation_snapshot(p_report uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;courtesies jsonb;ids jsonb;totals jsonb;begin
 if not (studio_access_private.fridge_allowed() or studio_access_private.fridge_manager()) then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 r:=studio_access_private.fridge_reconciliation_snapshot_before_checkout(p_report);
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'created_at',o.created_at,'actor',o.actor_name)||o.result order by o.created_at,o.id),'[]') into courtesies from studio_access_private.fridge_operations o where o.kind='loss' and o.result->'sale_context'->>'kind'='courtesy' and (case when p_report is null then not exists(select 1 from studio_access_private.fridge_reconciliation_ops ro where ro.operation_id=o.id) else exists(select 1 from studio_access_private.fridge_reconciliation_ops ro where ro.operation_id=o.id and ro.reconciliation_id=p_report) end);
 select coalesce(jsonb_agg(id order by id),'[]') into ids from (select distinct value as id from jsonb_array_elements((r->'operation_ids')||coalesce((select jsonb_agg(x->'id') from jsonb_array_elements(courtesies) x),'[]'))) q;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into totals from (select coalesce(p->'collection'->>'currency','USD') as currency,p->>'method' as method,sum(coalesce((p->'collection'->>'amount')::numeric,(p->>'amount')::numeric)) as amount,sum((p->>'amount')::numeric) as usd from jsonb_array_elements(r->'payments') p group by 1,2 order by 1,2) t;
 return r||jsonb_build_object('collection_totals',totals,'courtesies',courtesies,'operation_ids',ids,'fingerprint',case when jsonb_array_length(courtesies)=0 then r->>'fingerprint' else md5((r->>'fingerprint')||ids::text||courtesies::text) end);
end $$;
revoke all on function studio_access_private.fridge_reconciliation_snapshot(uuid) from public,anon,authenticated;
