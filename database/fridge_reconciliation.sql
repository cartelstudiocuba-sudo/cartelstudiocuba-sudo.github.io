-- Products, receipt allocation and manager reconciliation. No bank/payment APIs are invoked.
select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
alter table studio_access_private.fridge_products drop constraint fridge_products_category_check;
alter table studio_access_private.fridge_products add constraint fridge_products_category_check check(category in ('Refrescos','Jugos','Agua','Cervezas','Otros','Papitas y snacks','Frutos secos','Dulces y galletas'));
alter table studio_access_private.fridge_products add column cost_confirmed boolean not null default false;
update studio_access_private.fridge_products set cost_confirmed=true where cost>0;
create function studio_access_private.fridge_manager() returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and (studio_access_private.is_owner() or studio_access_private.inventory_order_role('manager_general'))$$;
create table studio_access_private.fridge_receipt_allocations (
 payment_id uuid not null references studio_access_private.fridge_payments(id),sale_id uuid not null references studio_access_private.fridge_sales(id),
 amount numeric(12,2) not null check(amount>0),cost numeric(12,2) not null check(cost>=0),primary key(payment_id,sale_id)
);
create index fridge_receipt_sales on studio_access_private.fridge_receipt_allocations(sale_id);
create table studio_access_private.fridge_distribution (
 id boolean primary key default true check(id),revision integer not null default 1,rows jsonb not null default '[]',updated_at timestamptz not null default now(),updated_by uuid
);
insert into studio_access_private.fridge_distribution(id) values(true);
create table studio_access_private.fridge_reconciliations (
 id uuid primary key,number bigint generated always as identity unique,created_by uuid not null,created_by_name text not null,
 created_at timestamptz not null default now(),status text not null default 'pending' check(status in ('pending','returned','confirmed')),
 revision integer not null default 1,snapshot jsonb not null,note text not null default '',manager_note text not null default '',
 confirmed_at timestamptz,confirmed_by uuid,confirmed_by_name text,distribution jsonb,plan_revision integer,
 received_cash numeric(12,2),transfer_verified boolean not null default false
);
create index fridge_reconciliation_status on studio_access_private.fridge_reconciliations(status,created_at desc);
create table studio_access_private.fridge_reconciliation_ops (
 operation_id uuid primary key references studio_access_private.fridge_operations(id),reconciliation_id uuid not null references studio_access_private.fridge_reconciliations(id)
);
create index fridge_reconciliation_ops_report on studio_access_private.fridge_reconciliation_ops(reconciliation_id);
create table studio_access_private.fridge_reconciliation_events (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,actor_id uuid not null,kind text not null,payload jsonb not null,result jsonb,created_at timestamptz not null default now()
);
create table studio_access_private.fridge_disbursements (
 id uuid primary key references studio_access_private.fridge_reconciliation_events(request_id),reconciliation_id uuid not null references studio_access_private.fridge_reconciliations(id),
 line_key text not null,amount numeric(12,2) not null check(amount>0),method text not null check(method in ('cash','transfer')),note text not null,recorded_by uuid not null,created_at timestamptz not null default now()
);
create index fridge_disbursements_report on studio_access_private.fridge_disbursements(reconciliation_id,line_key);
-- Private ledgers: writes only through checked functions.
do $$declare t text;begin foreach t in array array['fridge_receipt_allocations','fridge_distribution','fridge_reconciliations','fridge_reconciliation_ops','fridge_reconciliation_events','fridge_disbursements'] loop
 execute format('alter table studio_access_private.%I enable row level security',t);
 execute format('revoke all on studio_access_private.%I from public,anon,authenticated',t);
 execute format('create policy %I on studio_access_private.%I for select to authenticated using ((select studio_access_private.fridge_manager()) or (select studio_access_private.fridge_allowed()))',t||'_read',t);
end loop;end $$;

create function studio_access_private.fridge_allocate_receipt(p_payment uuid) returns void language plpgsql security definer set search_path='' as $$
declare p studio_access_private.fridge_payments%rowtype;s studio_access_private.fridge_sales%rowtype;left_amount numeric;covered numeric;q numeric;c numeric;
begin
 select * into p from studio_access_private.fridge_payments where id=p_payment;
 if not found or exists(select 1 from studio_access_private.fridge_receipt_allocations where payment_id=p_payment) then return;end if;
 left_amount:=p.amount;
 for s in select * from studio_access_private.fridge_sales where (p.sale_id is not null and id=p.sale_id) or (p.sale_id is null and customer_id=p.customer_id) order by created_at,id loop
  select coalesce(sum(amount),0) into covered from studio_access_private.fridge_receipt_allocations where sale_id=s.id;
  q:=least(left_amount,s.amount-covered);if q<=0 then continue;end if;
  select coalesce(sum((i->>'cost')::numeric*(i->>'quantity')::integer),0) into c from jsonb_array_elements(s.items) i;
  insert into studio_access_private.fridge_receipt_allocations(payment_id,sale_id,amount,cost) values(p.id,s.id,q,round(c*(covered+q)/s.amount,2)-round(c*covered/s.amount,2));
  left_amount:=left_amount-q;exit when left_amount=0;
 end loop;
 if left_amount<>0 then raise exception 'No se pudo conciliar el cobro con los consumos de la cuenta';end if;
end $$;
revoke all on function studio_access_private.fridge_allocate_receipt(uuid) from public,anon,authenticated;
do $$declare r record;begin for r in select id from studio_access_private.fridge_payments order by created_at,id loop perform studio_access_private.fridge_allocate_receipt(r.id);end loop;end $$;

alter function studio_access_private.fridge_command(uuid,text,jsonb) rename to fridge_command_core;
revoke all on function studio_access_private.fridge_command_core(uuid,text,jsonb) from public,anon,authenticated;
do $$declare definition text;begin definition:=pg_get_functiondef('studio_access_private.fridge_command_core(uuid,text,jsonb)'::regprocedure);definition:=replace(replace(replace(replace(replace(definition,'bebidas','productos'),'bebida','producto'),'Bebida','Producto'),'productos duplicadas','productos duplicados'),'Una producto','Un producto');definition:=replace(replace(definition,'al menos una producto','al menos un producto'),'Producto no encontrada','Producto no encontrado');execute definition;end $$;
create function studio_access_private.fridge_command(p_id uuid,p_kind text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;p uuid;existed boolean;rows jsonb;
begin
 if not studio_access_private.fridge_allowed() then raise exception 'No tienes acceso a los productos de nevera' using errcode='42501';end if;
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
    update studio_access_private.fridge_products set cost=round(((stock-(rows->>'quantity')::integer)*cost+(rows->>'quantity')::integer*(rows->>'unit_cost')::numeric)/stock,2),cost_confirmed=true where id=(rows->>'id')::uuid and stock>0;
    update studio_access_private.fridge_movements set details=details||jsonb_build_object('purchase_unit_cost',(rows->>'unit_cost')::numeric) where operation_id=p_id and product_id=(rows->>'id')::uuid;
   end if;
  end loop;
 end if;
 if p_kind in ('sale','payment') then select id into p from studio_access_private.fridge_payments where operation_id=p_id;if p is not null then perform studio_access_private.fridge_allocate_receipt(p);end if;end if;
 return r;
end $$;
revoke all on function studio_access_private.fridge_command(uuid,text,jsonb) from public,anon;
grant execute on function studio_access_private.fridge_command(uuid,text,jsonb) to authenticated;

create function studio_access_private.fridge_reconciliation_snapshot(p_report uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ids uuid[];r jsonb;receipts numeric;costs numeric;
begin
 if not (studio_access_private.fridge_allowed() or studio_access_private.fridge_manager()) then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 select array_agg(o.id order by o.created_at,o.id) into ids from studio_access_private.fridge_operations o where o.kind in ('sale','payment') and
 (case when p_report is null then not exists(select 1 from studio_access_private.fridge_reconciliation_ops ro where ro.operation_id=o.id) else exists(select 1 from studio_access_private.fridge_reconciliation_ops ro where ro.operation_id=o.id and ro.reconciliation_id=p_report) end);
 select coalesce(sum(p.amount),0) into receipts from studio_access_private.fridge_payments p where p.operation_id=any(ids);
 select coalesce(sum(a.cost),0) into costs from studio_access_private.fridge_receipt_allocations a join studio_access_private.fridge_payments p on p.id=a.payment_id where p.operation_id=any(ids);
 return jsonb_build_object('fingerprint',md5(coalesce(to_jsonb(ids),'[]')::text||coalesce((select jsonb_agg(jsonb_build_array(id,version) order by id) from studio_access_private.fridge_products),'[]')::text),'operation_ids',coalesce(to_jsonb(ids),'[]'),'as_of',now(),'receipts',receipts,'attributed_cost',costs,'reserve_cost',least(receipts,costs),'realized_profit',greatest(0,receipts-costs),'unrecovered_cost',greatest(0,costs-receipts),
 'cash',coalesce((select sum(amount) from studio_access_private.fridge_payments where operation_id=any(ids) and method='cash'),0),
 'transfer',coalesce((select sum(amount) from studio_access_private.fridge_payments where operation_id=any(ids) and method='transfer'),0),
 'sold',coalesce((select sum(amount) from studio_access_private.fridge_sales where id=any(ids)),0),
 'sales',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('customer_name',coalesce(c.name,'Venta al contado'),'actor',o.actor_name) order by s.created_at,s.id) from studio_access_private.fridge_sales s join studio_access_private.fridge_operations o on o.id=s.id left join studio_access_private.fridge_customers c on c.id=s.customer_id where s.id=any(ids)),'[]'),
 'payments',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('customer_name',coalesce(c.name,'Venta al contado'),'actor',o.actor_name) order by p.created_at,p.id) from studio_access_private.fridge_payments p join studio_access_private.fridge_operations o on o.id=p.operation_id left join studio_access_private.fridge_customers c on c.id=p.customer_id where p.operation_id=any(ids)),'[]'),
 'cost_pending',exists(select 1 from studio_access_private.fridge_receipt_allocations a join studio_access_private.fridge_payments p on p.id=a.payment_id join studio_access_private.fridge_sales s on s.id=a.sale_id cross join lateral jsonb_array_elements(s.items) i where p.operation_id=any(ids) and coalesce((i->>'cost')::numeric,0)=0 and not coalesce((i->>'cost_confirmed')::boolean,false)),
 'stock',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'category',category,'stock',stock,'cost',cost,'price',price,'cost_confirmed',cost_confirmed) order by name) from studio_access_private.fridge_products),'[]'),
 'debts',coalesce((select jsonb_agg(to_jsonb(d) order by d.name) from (select c.name,c.kind,c.id,coalesce((select sum(amount) from studio_access_private.fridge_sales where customer_id=c.id),0)-coalesce((select sum(amount) from studio_access_private.fridge_payments where customer_id=c.id),0) as balance from studio_access_private.fridge_customers c) d where d.balance>0),'[]'),
 'allocations',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('items',s.items,'sale_amount',s.amount)) from studio_access_private.fridge_receipt_allocations a join studio_access_private.fridge_payments p on p.id=a.payment_id join studio_access_private.fridge_sales s on s.id=a.sale_id where p.operation_id=any(ids)),'[]'));
end $$;

create function studio_access_private.fridge_reconciliation_state() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not (studio_access_private.fridge_allowed() or studio_access_private.fridge_manager()) then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 return jsonb_build_object('manager',studio_access_private.fridge_manager(),'operator',studio_access_private.fridge_allowed(),
 'pending_count',(select count(*) from studio_access_private.fridge_reconciliations where status='pending'),
 'unsettled',(select coalesce(sum(p.amount),0) from studio_access_private.fridge_payments p where not exists(select 1 from studio_access_private.fridge_reconciliation_ops ro join studio_access_private.fridge_reconciliations r on r.id=ro.reconciliation_id where ro.operation_id=p.operation_id and r.status='confirmed')),
 'draft',studio_access_private.fridge_reconciliation_snapshot(),'plan',(select to_jsonb(d) from studio_access_private.fridge_distribution d),
 'staff',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',full_name) order by full_name) from public.hr_employees where status<>'terminated'),'[]'),
 'reports',coalesce((select jsonb_agg(jsonb_build_object('id',id,'number',number,'status',status,'revision',revision,'created_at',created_at,'created_by',created_by,'created_by_name',created_by_name,'cash',snapshot->'cash','transfer',snapshot->'transfer','confirmed_at',confirmed_at) order by created_at desc) from studio_access_private.fridge_reconciliations),'[]'));
end $$;

create function studio_access_private.fridge_reconciliation_detail(p_report uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r studio_access_private.fridge_reconciliations%rowtype;plan jsonb;revision integer;profit numeric;part numeric;used numeric:=0;company_index integer;row jsonb;out_rows jsonb:='[]';idx integer:=0;
begin
 if not (studio_access_private.fridge_allowed() or studio_access_private.fridge_manager()) then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 select * into r from studio_access_private.fridge_reconciliations where id=p_report;if not found then raise exception 'Cuadre no encontrado';end if;
 select d.rows,d.revision into plan,revision from studio_access_private.fridge_distribution d;
 if r.status='confirmed' then out_rows:=r.distribution;else
 profit:=(r.snapshot->>'realized_profit')::numeric;
 for row in select value from jsonb_array_elements(plan) loop
  part:=trunc(profit*(row->>'percent')::numeric/100,2);used:=used+part;
  if row->>'kind'='company' then company_index:=idx;end if;
  out_rows:=out_rows||jsonb_build_array(row||jsonb_build_object('key','share-'||idx,'amount',part));idx:=idx+1;
 end loop;
 if company_index is not null then out_rows:=jsonb_set(out_rows,array[company_index::text,'amount'],to_jsonb((out_rows->company_index->>'amount')::numeric+profit-used));end if;
 out_rows:=jsonb_build_array(jsonb_build_object('key','cost-reserve','kind','reserve','name','Fondo de reposición · costo de compra','amount',(r.snapshot->>'reserve_cost')::numeric))||out_rows;
 end if;
 return to_jsonb(r)||jsonb_build_object('proposed_distribution',out_rows,'current_plan_revision',revision,'plan_ready',jsonb_array_length(plan)>0,'payments_recorded',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at) from studio_access_private.fridge_disbursements d where d.reconciliation_id=r.id),'[]'));
end $$;

create function studio_access_private.fridge_reconciliation_command(p_id uuid,p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<command_block>>
declare prior studio_access_private.fridge_reconciliation_events%rowtype;r studio_access_private.fridge_reconciliations%rowtype;result jsonb;row jsonb;plan jsonb:='[]';pct numeric;total_pct numeric:=0;emp_name text;company_count integer:=0;idx integer:=0;snap jsonb;amount numeric;due numeric;paid numeric;revision integer;
begin
 if not (studio_access_private.fridge_allowed() or studio_access_private.fridge_manager()) then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 if p_id is null or p_action is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or p_action not in ('submit','approve','return','resubmit','plan','disburse') then raise exception 'Operación no válida';end if;
 perform pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
 select * into prior from studio_access_private.fridge_reconciliation_events where request_id=p_id;
 if found then if prior.actor_id<>auth.uid() or prior.kind<>p_action or prior.payload<>p_payload then raise exception 'Identificador de otra operación';end if;return prior.result;end if;
 if p_action in ('approve','return','plan','disburse') and not studio_access_private.fridge_manager() then raise exception 'Solo el Manager General o el propietario pueden revisar cuadres' using errcode='42501';end if;
 if p_action in ('submit','resubmit') and not studio_access_private.fridge_allowed() then raise exception 'Solo la operación puede generar el cuadre' using errcode='42501';end if;
 if length(coalesce(p_payload->>'note',''))>2000 then raise exception 'La observación supera 2000 caracteres';end if;
 insert into studio_access_private.fridge_reconciliation_events(request_id,actor_id,kind,payload) values(p_id,auth.uid(),p_action,p_payload);
 if p_action='plan' then
  select d.revision into revision from studio_access_private.fridge_distribution d;
  if revision is distinct from (p_payload->>'revision')::integer then raise exception 'La configuración cambió. Actualiza antes de guardar';end if;
  if jsonb_typeof(p_payload->'rows') is distinct from 'array' or jsonb_array_length(p_payload->'rows') not between 1 and 30 then raise exception 'Configura el reparto de la utilidad';end if;
  for row in select value from jsonb_array_elements(p_payload->'rows') loop
   pct:=(row->>'percent')::numeric;if pct is null or pct<0 or pct>100 or round(pct,2)<>pct then raise exception 'Porcentaje no válido';end if;
   if row->>'kind'='commission' then select full_name into emp_name from public.hr_employees where id=(row->>'employee_id')::uuid and status<>'terminated';if not found then raise exception 'Selecciona el trabajador de la comisión';end if;
   elsif row->>'kind'='company' then emp_name:='Utilidad de la empresa';company_count:=company_count+1;
   elsif row->>'kind'='fund' then emp_name:='Fondo adicional sobre la utilidad';else raise exception 'Destino de reparto no válido';end if;
   plan:=plan||jsonb_build_array(jsonb_build_object('kind',row->>'kind','name',emp_name,'employee_id',case when row->>'kind'='commission' then row->>'employee_id' end,'percent',pct));total_pct:=total_pct+pct;
  end loop;
  if total_pct<>100 or company_count<>1 then raise exception 'El reparto debe sumar 100%% e incluir una sola línea de empresa';end if;
  if (select count(*)<>count(distinct i->>'employee_id') from jsonb_array_elements(plan) i where i->>'kind'='commission') then raise exception 'No repitas trabajadores en el reparto';end if;
  update studio_access_private.fridge_distribution d set rows=plan,revision=d.revision+1,updated_at=now(),updated_by=auth.uid();result:=jsonb_build_object('saved',true);
 elsif p_action='submit' then
  snap:=studio_access_private.fridge_reconciliation_snapshot();if jsonb_array_length(snap->'operation_ids')=0 then raise exception 'No hay ventas ni cobros nuevos para cuadrar';end if;
  -- The preview fingerprint protects the operator from submitting a changed period.
  if p_payload->>'fingerprint' is distinct from snap->>'fingerprint' then raise exception 'Entraron ventas o cobros nuevos. Actualiza y revisa el cuadre';end if;
  insert into studio_access_private.fridge_reconciliations(id,created_by,created_by_name,snapshot,note) values(p_id,auth.uid(),studio_access_private.inventory_actor_name(),snap,btrim(coalesce(p_payload->>'note','')));
  insert into studio_access_private.fridge_reconciliation_ops(operation_id,reconciliation_id) select value::text::uuid,p_id from jsonb_array_elements_text(snap->'operation_ids');result:=jsonb_build_object('report_id',p_id);
 else
  select * into r from studio_access_private.fridge_reconciliations where id=(p_payload->>'report_id')::uuid for update;if not found then raise exception 'Cuadre no encontrado';end if;
  if r.revision is distinct from (p_payload->>'revision')::integer then raise exception 'El cuadre cambió. Actualiza antes de continuar';end if;
  if p_action='approve' then
   if r.status<>'pending' then raise exception 'El cuadre ya no está pendiente';end if;
   if r.created_by=auth.uid() then raise exception 'Otro usuario autorizado debe confirmar tu cuadre';end if;
   if not coalesce((p_payload->>'sales_reviewed')::boolean,false) then raise exception 'Confirma que revisaste las ventas y los saldos';end if;
   amount:=(p_payload->>'received_cash')::numeric;
   if amount is null or amount<>(r.snapshot->>'cash')::numeric then raise exception 'El efectivo recibido debe coincidir con el cuadre';end if;
   if (r.snapshot->>'transfer')::numeric>0 and not coalesce((p_payload->>'transfer_verified')::boolean,false) then raise exception 'Verifica las transferencias antes de confirmar';end if;
   if (r.snapshot->>'cost_pending')::boolean then raise exception 'Hay ventas con costos históricos sin confirmar. No se puede repartir esa utilidad';end if;
   result:=studio_access_private.fridge_reconciliation_detail(r.id);
   if (result->>'current_plan_revision')::integer is distinct from (p_payload->>'plan_revision')::integer then raise exception 'Cambió el reparto. Revisa el desglose actualizado';end if;
   if (r.snapshot->>'realized_profit')::numeric>0 and not (result->>'plan_ready')::boolean then raise exception 'Configura los porcentajes antes de aprobar el reparto';end if;
   update studio_access_private.fridge_reconciliations current_report set status='confirmed',revision=current_report.revision+1,confirmed_at=now(),confirmed_by=auth.uid(),confirmed_by_name=studio_access_private.inventory_actor_name(),received_cash=amount,transfer_verified=coalesce((p_payload->>'transfer_verified')::boolean,false),distribution=result->'proposed_distribution',plan_revision=(result->>'current_plan_revision')::integer,manager_note=btrim(coalesce(p_payload->>'note','')) where id=r.id;
  elsif p_action='return' then
   if r.status<>'pending' or nullif(btrim(p_payload->>'note'),'') is null then raise exception 'Indica el motivo para devolver el cuadre pendiente';end if;
   update studio_access_private.fridge_reconciliations current_report set status='returned',revision=current_report.revision+1,manager_note=btrim(p_payload->>'note') where id=r.id;
  elsif p_action='resubmit' then
   if r.status<>'returned' or nullif(btrim(p_payload->>'note'),'') is null then raise exception 'Explica la corrección antes de reenviar';end if;
   update studio_access_private.fridge_reconciliations current_report set status='pending',revision=current_report.revision+1,note=note||E'\nCorrección: '||btrim(p_payload->>'note') where id=r.id;
  elsif p_action='disburse' then
   if r.status<>'confirmed' then raise exception 'Primero confirma el recibido y aprueba el cuadre';end if;
   select (i->>'amount')::numeric into due from jsonb_array_elements(r.distribution) i where i->>'key'=p_payload->>'line_key';
   select coalesce(sum(d.amount),0) into paid from studio_access_private.fridge_disbursements d where d.reconciliation_id=r.id and d.line_key=p_payload->>'line_key';amount:=(p_payload->>'amount')::numeric;
   if due is null or amount is null or amount<=0 or amount>due-paid then raise exception 'El importe supera el saldo pendiente de ese destino';end if;
   if nullif(btrim(p_payload->>'note'),'') is null or p_payload->>'method' is null or p_payload->>'method' not in ('cash','transfer') then raise exception 'Indica el medio y la referencia o constancia del pago/apartado';end if;
   insert into studio_access_private.fridge_disbursements(id,reconciliation_id,line_key,amount,method,note,recorded_by) values(p_id,r.id,p_payload->>'line_key',amount,p_payload->>'method',btrim(p_payload->>'note'),auth.uid());
  end if;
  result:=jsonb_build_object('report_id',r.id);
 end if;
 update studio_access_private.fridge_reconciliation_events set result=command_block.result where request_id=p_id;
 return result;
end $$;

-- Stable public entry points; privileged implementations stay private.
create function public.fridge_reconciliation_state() returns jsonb language sql stable security invoker set search_path='' as $$select studio_access_private.fridge_reconciliation_state()$$;
create function public.fridge_reconciliation_detail(p_report uuid) returns jsonb language sql stable security invoker set search_path='' as $$select studio_access_private.fridge_reconciliation_detail(p_report)$$;
create function public.fridge_reconciliation_command(p_id uuid,p_action text,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select studio_access_private.fridge_reconciliation_command(p_id,p_action,p_payload)$$;
revoke all on function studio_access_private.fridge_manager(),studio_access_private.fridge_reconciliation_snapshot(uuid),studio_access_private.fridge_reconciliation_state(),studio_access_private.fridge_reconciliation_detail(uuid),studio_access_private.fridge_reconciliation_command(uuid,text,jsonb),public.fridge_reconciliation_state(),public.fridge_reconciliation_detail(uuid),public.fridge_reconciliation_command(uuid,text,jsonb) from public,anon;
grant execute on function studio_access_private.fridge_manager(),studio_access_private.fridge_reconciliation_state(),studio_access_private.fridge_reconciliation_detail(uuid),studio_access_private.fridge_reconciliation_command(uuid,text,jsonb),public.fridge_reconciliation_state(),public.fridge_reconciliation_detail(uuid),public.fridge_reconciliation_command(uuid,text,jsonb) to authenticated;
revoke all on function studio_access_private.fridge_reconciliation_snapshot(uuid) from authenticated;
create or replace function public.system_my_navigation() returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object('is_owner',coalesce(studio_access_private.is_owner(),false),'views',public.system_my_views(),'fridge_audiovisual',coalesce(studio_access_private.fridge_allowed(),false),'fridge_manager',coalesce(studio_access_private.fridge_manager(),false))$$;

create or replace function public.fridge_command(p_id uuid,p_kind text,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select studio_access_private.fridge_command(p_id,p_kind,p_payload)$$;

create function studio_access_private.fridge_reconciliation_notice() returns integer language plpgsql stable security definer set search_path='' as $$begin
 if studio_access_private.fridge_manager() then return (select count(*)::integer from studio_access_private.fridge_reconciliations where status='pending');
 elsif studio_access_private.fridge_allowed() then return (select count(*)::integer from studio_access_private.fridge_reconciliations where status='returned');else return 0;end if;
end $$;
create function public.fridge_reconciliation_notice() returns integer language sql stable security invoker set search_path='' as $$select studio_access_private.fridge_reconciliation_notice()$$;
revoke all on function studio_access_private.fridge_reconciliation_notice(),public.fridge_reconciliation_notice() from public,anon;
grant execute on function studio_access_private.fridge_reconciliation_notice(),public.fridge_reconciliation_notice() to authenticated;
