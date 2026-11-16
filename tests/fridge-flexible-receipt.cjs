const {PGlite}=require('@electric-sql/pglite'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
const db=new PGlite(),owner='6418ad20-d0e8-49c0-8d9a-e1da3daf71b6',chief='aedb58e6-56ca-4308-9796-bb77070f649a',manager='a0ee4b57-1f73-480b-bc68-0aa034d19bda',worker='12345678-1234-4234-8234-123456789012';let passed=0;
await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;create schema studio_access_private;grant usage on schema auth,studio_access_private to authenticated,anon;
create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
create table public.hr_employees(id uuid primary key,full_name text,status text);
insert into public.hr_employees values('${worker}','Trabajador de prueba','active');
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text);
create function studio_access_private.is_owner() returns boolean language sql stable as $$select auth.uid()='${owner}'::uuid$$;
create function studio_access_private.inventory_order_role(text) returns boolean language sql stable as $$select ($1='jefe_audiovisuales' and auth.uid()='${chief}'::uuid) or ($1='manager_general' and auth.uid()='${manager}'::uuid)$$;
create function studio_access_private.inventory_actor_name() returns text language sql stable as $$select case when auth.uid()='${manager}' then 'Manager' else 'Jefe' end$$;
create function public.system_my_views() returns jsonb language sql as $$select '[]'::jsonb$$;`);
for(const file of ['fridge_audiovisual','fridge_catalog_photos','fridge_reconciliation','fridge_usd','fridge_product_quantity','fridge_latest_purchase_cost','fridge_cost_floor'])await db.exec(fs.readFileSync('database/'+file+'.sql','utf8'));
const who=async uid=>db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:uid,role:'authenticated'})]);
const call=async(fn,args=[])=> (await db.query('select public.'+fn+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') value',args)).rows[0].value;
const cmd=(kind,payload,id=crypto.randomUUID())=>call('fridge_command',[id,kind,{...payload,currency:'USD',...(kind==='product'?{purchase:{currency:'USD',amount:payload.cost||0,rate:1}}:{}),...(kind==='replenish'?{items:payload.items.map(i=>({...i,unit_cost:i.unit_cost??100,purchase:{currency:'USD',amount:i.unit_cost??100,rate:1}}))}:{})}]),rec=(kind,payload,id=crypto.randomUUID())=>call('fridge_reconciliation_command',[id,kind,payload]);
const state=()=>call('fridge_reconciliation_state'),detail=id=>call('fridge_reconciliation_detail',[id]);
const ok=(value,msg)=>{assert(value,msg);passed++;},fail=async(fn,regex)=>{await assert.rejects(fn,regex);passed++;};


await db.exec(fs.readFileSync('database/fridge_standard_costs.sql','utf8'));await db.exec(fs.readFileSync('database/finance_cost_sheets.sql','utf8'));await db.exec(fs.readFileSync('database/fridge_composite_products.sql','utf8'));
const c=(kind,payload,id=crypto.randomUUID())=>call('fridge_command',[id,kind,payload]);
await db.exec(fs.readFileSync('database/fridge_cost_settlement.sql','utf8'));await who(chief);await db.exec('set role authenticated');await call('fridge_state');await state();await c('customer',{currency:'USD',kind:'client',name:'Cuenta anterior'});await db.exec('reset role');await db.exec(fs.readFileSync('database/fridge_sale_context.sql','utf8'));
await db.exec(fs.readFileSync('database/fridge_cost_courtesy.sql','utf8'));await db.exec(fs.readFileSync('database/fridge_existing_account.sql','utf8'));await who(chief);await db.exec('set role authenticated');

await db.exec('reset role');await db.exec(fs.readFileSync('database/fridge_reconciliation_currencies.sql','utf8'));await db.exec('set role authenticated');
const p=await c('product',{name:'Prueba moneda',category:'Agua',price:1.2,cost:.5,currency:'USD',minimum:1,stock_quantity:12,cost_confirmed:true,pricing_revision:1,purchase:{currency:'USD',amount:.5,rate:1}}),pid=p.product_id;
for(const [q,currency,amount,rate,method] of [[1,'CUP',1098,915,'cash'],[2,'USD',2.4,1,'cash'],[1,'CUP',1080,900,'transfer']])await c('sale',{currency:'USD',items:[{id:pid,quantity:q,price:1.2}],paid:q*1.2,method,sale_context:{kind:'project',name:currency+method},collection:{currency,amount,rate,source:'manual'}});
let draft=(await state()).draft;const report=(await rec('submit',{fingerprint:draft.fingerprint})).report_id;
await who(manager);const d=await detail(report),snap=JSON.stringify(d.snapshot),request=crypto.randomUUID();
const payload={report_id:report,revision:d.revision,plan_revision:d.current_plan_revision,received_cash:3.6,transfer_verified:true,sales_reviewed:true,received_by_currency:[{currency:'CUP',amount:1098},{currency:'USD',amount:2.4}],verified_transfers:[{currency:'CUP',amount:1080,verified:true}]};
await assert.rejects(()=>rec('approve',{...payload,received_by_currency:undefined}),/moneda/);
await assert.rejects(()=>rec('approve',{...payload,received_by_currency:[{currency:'CUP',amount:1000},{currency:'USD',amount:2.4}]}),/moneda/);
await assert.rejects(()=>rec('approve',{...payload,received_by_currency:[{currency:'CUP',amount:1098},{currency:'CUP',amount:2.4}]}),/duplicadas/);
await assert.rejects(()=>rec('approve',{...payload,verified_transfers:[{currency:'CUP',amount:1080,verified:false}]}),/transferencia/);
await db.exec('reset role');await db.exec(fs.readFileSync('database/fridge_flexible_receipt.sql','utf8'));await db.exec('set role authenticated');Object.assign(payload,{cash_settlement_mode:'equivalent',settlement_rate:915,inventory_confirmed:true,received_by_currency:[{currency:'USD',amount:3.6},{currency:'CUP',amount:0}]});await assert.rejects(()=>rec('approve',{...payload,inventory_confirmed:false}),/insumos/);await assert.rejects(()=>rec('approve',{...payload,received_by_currency:[{currency:'USD',amount:3.5}]}),/total/);await rec('approve',payload,request);await rec('approve',payload,request);await assert.rejects(()=>rec('approve',{...payload,note:'Alterado'},request),/identificador/i);
assert.equal(JSON.stringify((await detail(report)).snapshot),snap);assert.equal((await detail(report)).status,'confirmed');
await db.exec('reset role');const audit=(await db.query('select payload from studio_access_private.fridge_reconciliation_events where request_id=$1',[request])).rows[0].payload;assert.deepEqual(audit.received_by_currency,payload.received_by_currency);assert.deepEqual(audit.verified_transfers,payload.verified_transfers);
assert.equal((await detail(report)).receipt_settlement.rate,915);assert.equal((await db.query('select count(*) n from studio_access_private.fridge_reconciliations where status=\'confirmed\'')).rows[0].n,1);
await db.close();console.log('PASS: mixed original currencies, manual receipt per currency, transfer verification, idempotency, immutable snapshots, audit and rollback');
})().catch(e=>{console.error(e);process.exit(1);});
