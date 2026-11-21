const {PGlite}=require('@electric-sql/pglite'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const db=new PGlite();try{
await db.exec(`create schema auth;create schema studio_access_private;
create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
create table public.hr_candidates(id uuid primary key);
create table public.hr_employees(id uuid primary key,candidate_id uuid references hr_candidates(id) on delete set null,system_access_enabled boolean);
create table public.auth_user_fixture(id uuid primary key,employee_id uuid references hr_employees(id));
create table public.role_assignment_fixture(employee_id uuid references hr_employees(id));
create table studio_access_private.onboarding(candidate_id uuid primary key references hr_candidates(id),employee_id uuid not null unique references hr_employees(id));
create table public.answer_fixture(candidate_id uuid references hr_candidates(id) on delete cascade);
create function public.hr_delete_candidate(p_candidate_id uuid) returns void language plpgsql security definer set search_path=public as $$begin if coalesce(auth.jwt()->>'email','')<>'cartelstudiocuba@gmail.com' then raise exception 'not authorized';end if;delete from public.hr_candidates where id=p_candidate_id;end;$$;`);
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',e='00000000-0000-4000-8000-000000000003';
await db.exec(`insert into hr_candidates values('${a}'),('${b}');insert into hr_employees values('${e}','${a}',true);insert into auth_user_fixture values('${e}','${e}');insert into role_assignment_fixture values('${e}');insert into studio_access_private.onboarding values('${a}','${e}');insert into answer_fixture values('${a}');select set_config('request.jwt.claims','{"email":"cartelstudiocuba@gmail.com"}',false);`);
await assert.rejects(db.query('select hr_delete_candidate($1)',[a]),/onboarding_candidate_id_fkey/);
await db.exec(fs.readFileSync('sql/candidate-onboarding-delete.sql','utf8'));
assert.equal((await db.query('select count(*) n from hr_candidates')).rows[0].n,2,'migration itself deletes nobody');
await db.exec(`select set_config('request.jwt.claims','{"email":"other@example.invalid"}',false)`);await assert.rejects(db.query('select hr_delete_candidate($1)',[a]),/not authorized/);
await db.exec(`select set_config('request.jwt.claims','{"email":"cartelstudiocuba@gmail.com"}',false)`);await db.query('select hr_delete_candidate($1)',[a]);
assert.equal((await db.query('select count(*) n from studio_access_private.onboarding')).rows[0].n,0);assert.equal((await db.query('select count(*) n from answer_fixture')).rows[0].n,0);
assert.deepEqual((await db.query('select candidate_id,system_access_enabled from hr_employees where id=$1',[e])).rows,[{candidate_id:null,system_access_enabled:true}]);
for(const table of ['auth_user_fixture','role_assignment_fixture'])assert.equal((await db.query('select count(*) n from '+table)).rows[0].n,1,table+' retained');
assert.equal((await db.query('select id from hr_candidates')).rows[0].id,b,'another candidature untouched');await db.query('select hr_delete_candidate($1)',[a]);
// Any other blocker still rolls back the candidate and its dependent progress atomically.
await db.exec(`insert into hr_candidates values('${a}');update hr_employees set candidate_id='${a}' where id='${e}';insert into studio_access_private.onboarding values('${a}','${e}');create table blocker_fixture(candidate_id uuid references hr_candidates(id));insert into blocker_fixture values('${a}');`);await assert.rejects(db.query('select hr_delete_candidate($1)',[a]),/blocker_fixture/);assert.equal((await db.query('select count(*) n from studio_access_private.onboarding')).rows[0].n,1);
console.log('PASS: original FK failure reproduced; migration removes no data; authorized delete cascades progress and preserves employee/account/grants; denial, retry and rollback verified');
}finally{await db.close()}})().catch(e=>{console.error(e);process.exit(1)});
