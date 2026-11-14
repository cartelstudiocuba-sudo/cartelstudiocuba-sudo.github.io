-- Additive pricing layer. Existing products, sales, receipts and reconciliations are not rewritten.
select pg_advisory_xact_lock(hashtextextended('cartel.fridge.operations',0));
create table studio_access_private.fridge_pricing_backups(name text primary key,definition text not null);
insert into studio_access_private.fridge_pricing_backups select proname,pg_get_functiondef(oid) from pg_proc where pronamespace='studio_access_private'::regnamespace and proname in ('fridge_command','fridge_command_core','fridge_command_ledger');
create table studio_access_private.fridge_cost_configs(
 revision bigint generated always as identity primary key,rows jsonb not null,total numeric(5,2) not null check(total>=0 and total<100),
 created_by uuid,actor_name text not null,created_at timestamptz not null default now(),reason text not null
);
insert into studio_access_private.fridge_cost_configs(rows,total,actor_name,reason) values(
 '[{"key":"seller","label":"Vendedor","percent":10},{"key":"chief","label":"Jefe de área","percent":5},{"key":"operations","label":"Gestor Operativo","percent":2},{"key":"technical","label":"Gestor Técnico","percent":2},{"key":"manager","label":"Manager General","percent":3},{"key":"fixed","label":"Gastos fijos","percent":10},{"key":"recovery","label":"Recuperación","percent":3},{"key":"profit","label":"Utilidad","percent":20}]',55,'Sistema','Configuración inicial');
create table studio_access_private.fridge_price_requests(
 id uuid primary key,context jsonb not null,reason text not null,requested_by uuid not null,requester_name text not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected','used')),
 created_at timestamptz not null default now(),decided_by uuid,decider_name text,decided_at timestamptz,decision_reason text,used_operation uuid
);
create index fridge_price_requests_status on studio_access_private.fridge_price_requests(status,created_at desc);
create index fridge_price_requests_actor on studio_access_private.fridge_price_requests(requested_by,created_at desc);
create table studio_access_private.fridge_pricing_events(
 id uuid primary key,actor_id uuid not null,actor_name text not null,kind text not null,payload jsonb not null,result jsonb,created_at timestamptz not null default now()
);
create table studio_access_private.fridge_cost_audit(
 id uuid primary key default gen_random_uuid(),operation_id uuid not null,product_id uuid not null references studio_access_private.fridge_products(id),
 kind text not null,snapshot jsonb not null,actor_id uuid not null,actor_name text not null,created_at timestamptz not null default now(),unique(operation_id,product_id,kind)
);
create index fridge_cost_audit_product on studio_access_private.fridge_cost_audit(product_id,created_at desc);
create table studio_access_private.fridge_recipes(
 product_id uuid primary key references studio_access_private.fridge_products(id),revision integer not null default 1,components jsonb not null,
 cost numeric(12,2) not null check(cost>=0),updated_by uuid not null,updated_at timestamptz not null default now()
);
do $$declare t text;begin foreach t in array array['fridge_pricing_backups','fridge_cost_configs','fridge_price_requests','fridge_pricing_events','fridge_cost_audit','fridge_recipes'] loop
 execute format('alter table studio_access_private.%I enable row level security',t);
 execute format('revoke all on studio_access_private.%I from public,anon,authenticated',t);
 execute format('create policy %I on studio_access_private.%I as restrictive for all to anon,authenticated using(false) with check(false)',t||'_no_direct',t);
end loop;end $$;
-- All new read/write endpoints check the existing operational/manager capabilities.
create function studio_access_private.fridge_pricing_min(p_cost numeric,p_total numeric) returns numeric language plpgsql immutable set search_path='' as $$
begin
 if p_cost is null or p_cost<0 or p_cost::text in ('NaN','Infinity','-Infinity') or p_total is null or p_total<0 or p_total>=100 or p_total::text in ('NaN','Infinity','-Infinity') then raise exception 'Costo o porcentajes no válidos';end if;
 return ceil(p_cost*10000/(100-p_total))/100;
end $$;
create function studio_access_private.fridge_pricing_snapshot(p_cost numeric,p_price numeric,p_config studio_access_private.fridge_cost_configs) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('cost',p_cost,'price',p_price,'config_revision',p_config.revision,'percentages',p_config.rows,'total_percent',p_config.total,'raw_minimum',p_cost/(1-p_config.total/100),'minimum',studio_access_private.fridge_pricing_min(p_cost,p_config.total),'review',p_price<studio_access_private.fridge_pricing_min(p_cost,p_config.total));
$$;
create function studio_access_private.fridge_pricing_authorize(p_context jsonb,p_payload jsonb,p_operation uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare req studio_access_private.fridge_price_requests%rowtype;reason text:=btrim(coalesce(p_payload->>'exception_reason',''));minimum numeric;cfg studio_access_private.fridge_cost_configs%rowtype;
begin
 select * into strict cfg from studio_access_private.fridge_cost_configs order by revision desc limit 1;
 minimum:=studio_access_private.fridge_pricing_min((p_context->>'cost')::numeric,cfg.total);
 if (p_context->>'price')::numeric>=minimum then return null;end if;
 if studio_access_private.fridge_manager() and coalesce((p_payload->>'approve_exception')::boolean,false) and length(reason) between 5 and 2000 then return jsonb_build_object('authorized_by',auth.uid(),'authorized_name',studio_access_private.inventory_actor_name(),'authorized_at',now(),'reason',reason,'context',p_context);end if;
 select * into req from studio_access_private.fridge_price_requests where id=(p_payload->>'approval_id')::uuid for update;
 if not found or req.status<>'approved' or req.requested_by<>auth.uid() or req.context<>p_context then raise exception 'El precio está por debajo del mínimo de % USD. Solicita aprobación al Manager General.',minimum;end if;
 update studio_access_private.fridge_price_requests set status='used',used_operation=p_operation where id=req.id;
 return jsonb_build_object('request_id',req.id,'authorized_by',req.decided_by,'authorized_name',req.decider_name,'authorized_at',req.decided_at,'reason',req.decision_reason,'request_reason',req.reason,'context',req.context);
end $$;
-- Supersede the previous cost-floor rule, only for future operations.
do $$declare d text;begin
 d:=pg_get_functiondef('studio_access_private.fridge_command_core(uuid,text,jsonb)'::regprocedure);
 if position('cost=greatest(fridge_products.cost,excluded.cost)' in d)=0 then raise exception 'Versión de costo inesperada';end if;
 execute replace(d,'cost=greatest(fridge_products.cost,excluded.cost)','cost=excluded.cost');
 d:=pg_get_functiondef('studio_access_private.fridge_command_ledger(uuid,text,jsonb)'::regprocedure);
 if position('cost=greatest(cost,round((rows->>''unit_cost'')::numeric,2))' in d)=0 then raise exception 'Versión de costo de compra inesperada';end if;
 execute replace(d,'cost=greatest(cost,round((rows->>''unit_cost'')::numeric,2))','cost=round((rows->>''unit_cost'')::numeric,2)');
end $$;
alter function studio_access_private.fridge_command(uuid,text,jsonb) rename to fridge_command_pre_pricing;
revoke all on function studio_access_private.fridge_command_pre_pricing(uuid,text,jsonb) from public,anon,authenticated;
create function studio_access_private.fridge_command(p_id uuid,p_kind text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<pricewrap>>
declare cfg studio_access_private.fridge_cost_configs%rowtype;prod studio_access_private.fridge_products%rowtype;prior studio_access_private.fridge_operations%rowtype;r jsonb;ctx jsonb;exception jsonb;snap jsonb;i jsonb;items jsonb;target uuid;
begin
 if not studio_access_private.fridge_allowed() then raise exception 'No tienes acceso a Nevera audiovisual' using errcode='42501';end if;
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
end $$;
create function studio_access_private.fridge_pricing_state() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare cfg studio_access_private.fridge_cost_configs%rowtype;manager boolean:=studio_access_private.fridge_manager();
begin
 if not (manager or studio_access_private.fridge_allowed()) then raise exception 'Acceso no autorizado a fichas de costo' using errcode='42501';end if;
 select * into strict cfg from studio_access_private.fridge_cost_configs order by revision desc limit 1;
 return jsonb_build_object('manager',manager,'config',to_jsonb(cfg),
 'products',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'cost',cost,'price',price,'version',version,'minimum_price',studio_access_private.fridge_pricing_min(cost,cfg.total),'review',price<studio_access_private.fridge_pricing_min(cost,cfg.total)) order by name) from studio_access_private.fridge_products),'[]'),
 'requests',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc) from (select * from studio_access_private.fridge_price_requests where manager or requested_by=auth.uid() order by created_at desc limit 100) x),'[]'),
 'history',case when manager then coalesce((select jsonb_agg(to_jsonb(x) order by revision desc) from (select * from studio_access_private.fridge_cost_configs order by revision desc limit 50) x),'[]') else '[]'::jsonb end,
 'audit',case when manager then coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc) from (select a.*,p.name as product_name from studio_access_private.fridge_cost_audit a join studio_access_private.fridge_products p on p.id=a.product_id order by a.created_at desc limit 100) x),'[]') else '[]'::jsonb end,
 'recipes',coalesce((select jsonb_agg(to_jsonb(x)) from studio_access_private.fridge_recipes x),'[]'));
end $$;
create function studio_access_private.fridge_pricing_command(p_id uuid,p_kind text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<pricing>>
declare manager boolean:=studio_access_private.fridge_manager();prior studio_access_private.fridge_pricing_events%rowtype;cfg studio_access_private.fridge_cost_configs%rowtype;prod studio_access_private.fridge_products%rowtype;req studio_access_private.fridge_price_requests%rowtype;r jsonb;rows jsonb;line jsonb;total numeric:=0;v numeric;price numeric;cost numeric;ctx jsonb;exception jsonb;snap jsonb;reason text:=btrim(coalesce(p_payload->>'reason',''));keys text[]:=array['seller','chief','operations','technical','manager','fixed','recovery','profit'];k text;existing_revision integer;
begin
 if not (manager or studio_access_private.fridge_allowed()) then raise exception 'Acceso no autorizado a fichas de costo' using errcode='42501';end if;
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
  if price>=studio_access_private.fridge_pricing_min(cost,cfg.total) then raise exception 'Este precio no necesita excepción';end if;
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
end $$;
create function public.fridge_pricing_state() returns jsonb language sql stable security invoker set search_path='' as $$select studio_access_private.fridge_pricing_state()$$;
create function public.fridge_pricing_command(p_id uuid,p_kind text,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select studio_access_private.fridge_pricing_command(p_id,p_kind,p_payload)$$;
revoke all on function studio_access_private.fridge_pricing_min(numeric,numeric),studio_access_private.fridge_pricing_snapshot(numeric,numeric,studio_access_private.fridge_cost_configs),studio_access_private.fridge_pricing_authorize(jsonb,jsonb,uuid),studio_access_private.fridge_pricing_state(),studio_access_private.fridge_pricing_command(uuid,text,jsonb),studio_access_private.fridge_command(uuid,text,jsonb),public.fridge_pricing_state(),public.fridge_pricing_command(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function studio_access_private.fridge_pricing_state(),studio_access_private.fridge_pricing_command(uuid,text,jsonb),studio_access_private.fridge_command(uuid,text,jsonb),public.fridge_pricing_state(),public.fridge_pricing_command(uuid,text,jsonb) to authenticated;
