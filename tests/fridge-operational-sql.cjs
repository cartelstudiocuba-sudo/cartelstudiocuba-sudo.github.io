const {PGlite}=require('@electric-sql/pglite'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
const db=new PGlite(),owner='6418ad20-d0e8-49c0-8d9a-e1da3daf71b6',chief='aedb58e6-56ca-4308-9796-bb77070f649a',manager='a0ee4b57-1f73-480b-bc68-0aa034d19bda',worker='12345678-1234-4234-8234-123456789012';let passed=0;
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create schema studio_access_private;grant usage on schema auth,studio_access_private to authenticated,anon;
create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
create table public.hr_employees(id uuid primary key,full_name text,status text);
insert into public.hr_employees values('${worker}','Trabajador de prueba','active');
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text,owner uuid,owner_id text,metadata jsonb);
create function studio_access_private.is_owner() returns boolean language sql stable as $$select auth.uid()='${owner}'::uuid$$;
create function studio_access_private.inventory_order_role(text) returns boolean language sql stable as $$select ($1='jefe_audiovisuales' and auth.uid()='${chief}'::uuid) or ($1='manager_general' and auth.uid()='${manager}'::uuid)$$;
create function studio_access_private.inventory_actor_name() returns text language sql stable as $$select case when auth.uid()='${manager}' then 'Manager' else 'Jefe' end$$;
create function public.system_my_views() returns jsonb language sql as $$select '[]'::jsonb$$;`);
for(const file of ['fridge_audiovisual','fridge_catalog_photos','fridge_reconciliation','fridge_usd','fridge_product_quantity','fridge_latest_purchase_cost','fridge_cost_floor'])await db.exec(fs.readFileSync('database/'+file+'.sql','utf8'));

await db.exec(`alter table public.hr_employees add column system_auth_user_id uuid,add column system_access_enabled boolean default true;
create table public.system_access_roles(id uuid primary key,code text,is_active boolean default true);
create table public.system_employee_role_assignments(employee_id uuid,access_role_id uuid,ended_at timestamptz);
insert into public.system_access_roles values('11111111-1111-4111-8111-111111111111','gestor_operativo_audiovisual',true);
update public.hr_employees set system_auth_user_id=id;
insert into public.system_employee_role_assignments values('${worker}','11111111-1111-4111-8111-111111111111',null);`);
await db.exec(fs.readFileSync('database/fridge_operational_workspace.sql','utf8'));
const who=async uid=>db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:uid,role:'authenticated'})]);
await who(worker);await db.exec('set role authenticated');
const nav=(await db.query('select public.system_my_navigation() data')).rows[0].data;
assert.equal(nav.fridge_audiovisual,true);assert.equal(nav.fridge_limited,true);assert.equal(nav.fridge_manager,false);assert.equal(nav.finance_cost_sheets,false);
assert.deepEqual((await db.query('select public.fridge_state() data')).rows[0].data.workspace_sections,['sale','accounts','stock']);
await assert.rejects(()=>db.query('select public.fridge_reconciliation_state()'),/Acceso no autorizado/);
await db.exec('reset role');await db.query("update public.hr_employees set status='terminated' where id=$1",[worker]);
assert.equal((await db.query('select public.fridge_access() allowed')).rows[0].allowed,false);
await db.query("update public.hr_employees set status='active',system_access_enabled=false where id=$1",[worker]);
assert.equal((await db.query('select public.fridge_access() allowed')).rows[0].allowed,false);
for(const uid of [owner,chief]){await who(uid);assert.equal((await db.query('select public.fridge_access() allowed')).rows[0].allowed,true);assert.equal((await db.query('select public.fridge_state() data')).rows[0].data.workspace_sections,null);}
await who(manager);assert.equal((await db.query('select public.system_my_navigation() data')).rows[0].data.fridge_manager,true);
await who(null);assert.equal((await db.query('select public.fridge_access() allowed')).rows[0].allowed,false);
await db.close();console.log('PASS: active operational role, disabled/terminated/no session denied, full roles retained, reconciliation denied');
})().catch(e=>{console.error(e);process.exit(1);});
