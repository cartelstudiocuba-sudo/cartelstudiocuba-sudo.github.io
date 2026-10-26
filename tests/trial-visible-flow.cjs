const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {PGlite}=require('../../correcciones-cv/node_modules/@electric-sql/pglite');
const {chromium}=require('C:/Users/julio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.join(__dirname,'..');
const ids={a:'10000000-0000-0000-0000-000000000001',b:'10000000-0000-0000-0000-000000000002',v:'20000000-0000-0000-0000-000000000001',w:'20000000-0000-0000-0000-000000000002',t:'30000000-0000-0000-0000-000000000001'};
async function database(){
 const db=new PGlite();await db.exec(`create schema auth;create schema studio_access_private;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create function studio_access_private.is_owner() returns boolean language sql stable as $$select auth.uid()='6418ad20-d0e8-49c0-8d9a-e1da3daf71b6'::uuid$$;set test.uid='6418ad20-d0e8-49c0-8d9a-e1da3daf71b6';`);
 await db.exec(fs.readFileSync(root+'/tests/fixtures/trial-schema.sql','utf8'));
 await db.exec(`create table hr_candidate_answers(id uuid default gen_random_uuid(),candidate_id uuid,question_key text,question_text text,answer jsonb);create table hr_interviews(id uuid,candidate_id uuid);create table hr_recruitment_cycles(id uuid,role_id uuid,status text,opens_at timestamptz,closes_at timestamptz,updated_at timestamptz);`);
 await db.exec(fs.readFileSync(root+'/supabase/trial-attempts.sql','utf8').replace(/(?:revoke all|grant execute)[^;]+;/g,''));await db.exec(fs.readFileSync(root+'/supabase/trial-visible-flow.sql','utf8'));return db;
}
async function seed(db,stage='evaluation_pending'){
 await db.exec('truncate hr_candidates,hr_trial_periods,hr_trial_closures,hr_trial_closure_events,hr_candidate_history,hr_vacancies,hr_roles,hr_employees,hr_candidate_answers;');
 await db.query(`insert into hr_vacancies(id,title,slug,status) values($1,'Plaza ficticia','test-source','active'),($2,'Destino ficticio','test-dest','active')`,[ids.v,ids.w]);
 await db.query(`insert into hr_roles(title,work_content) values('Plaza ficticia',$1)`,[{contract_templates:{trial:{applies:true,documents:[{key:'trial_close',blocks:[]}]}}}]);
 await db.query(`insert into hr_candidates(id,vacancy_id,full_name,whatsapp,status,internal_notes) values($1,$3,'Persona sintética A','+53 5000 0001','trial','Historial original'),($2,$3,'Persona sintética B','5350000002','new','No alterar')`,[ids.a,ids.b,ids.v]);
 await db.query(`insert into hr_trial_periods(id,candidate_id,vacancy_id,role_title,stage,proposal_sent_at,agreement_sent_at,trial_started_at) values($1,$2,$3,'Plaza ficticia',$4,now(),now(),now())`,[ids.t,ids.a,ids.v,stage]);
 await db.query(`insert into hr_candidate_history(candidate_id,event_type,note) values($1,'previous_history','Conservar')`,[ids.a]);
}
async function rpc(db,action,payload){return db.query('select hr_manage_trial_closure($1,$2,$3)',[ids.t,action,payload])}
async function row(db,table,id=ids.a){return (await db.query('select * from '+table+' where id=$1',[id])).rows[0]}
async function backend(db){
 const report=[];
 for(const outcome of ['talent_pool','not_selected','profiled']){
  await seed(db);const beforeB=await row(db,'hr_candidates',ids.b),before=await row(db,'hr_candidates');
  const payload={outcome,vacancy_id:outcome==='profiled'?ids.w:null,reason:outcome==='not_selected'?'No es el candidato idóneo':null};
  await rpc(db,'finish_without_advance',payload);
  // Reproduce legacy reopening: retry must reconcile the persisted decision without duplicates.
  await db.query("update hr_candidates set status='trial',decision_status='selected' where id=$1",[ids.a]);
  await db.query("update hr_trial_periods set stage='evaluation_pending' where id=$1",[ids.t]);
  await rpc(db,'finish_without_advance',payload);
  const original=await row(db,'hr_candidates'),trial=await row(db,'hr_trial_periods',ids.t);
  assert.equal(original.status,outcome==='profiled'?'archived':outcome);assert.equal(original.vacancy_id,before.vacancy_id);assert.equal(original.internal_notes,before.internal_notes);assert.equal(trial.stage,'completed');
  assert.deepEqual(await row(db,'hr_candidates',ids.b),beforeB);
  const ev=(await db.query("select payload from hr_trial_closure_events where action='finish_without_advance'")).rows;assert.equal(ev.length,1);assert.equal(ev[0].payload.whatsapp_delivery,'unconfirmed');assert(ev[0].payload.message.includes('#token='));
  assert.equal((await db.query("select count(*)::int n from hr_candidate_history where event_type='previous_history'")).rows[0].n,1);
  if(outcome==='profiled'){const fresh=await row(db,'hr_candidates',ev[0].payload.new_candidate_id);assert.equal(fresh.status,'new');assert.equal(fresh.vacancy_id,ids.w);assert.equal(fresh.internal_notes,null);assert.equal(fresh.decision_status,null);assert.notEqual(fresh.id,original.id)}
  await assert.rejects(()=>rpc(db,'finish_without_advance',{outcome:'invalid'}));report.push(outcome+' + same-decision retry + history');
 }
 for(const stage of ['agreement_sent','agreement_accepted','in_trial','evaluation_pending']){
  await seed(db,stage);await rpc(db,'visible_step_back',{expected_stage:stage,expected_status:'trial'});assert.equal((await row(db,'hr_trial_periods',ids.t)).stage,'pending_agreement');assert.equal((await row(db,'hr_candidates')).status,'interviewed');
  await rpc(db,'visible_step_back',{expected_stage:'pending_agreement',expected_status:'interviewed'});assert.equal((await row(db,'hr_trial_periods',ids.t)).stage,'pending_confirmation');assert.equal((await row(db,'hr_trial_periods',ids.t)).proposal_sent_at,null);
 }
 await seed(db);await assert.rejects(()=>rpc(db,'visible_step_back',{expected_stage:'agreement_sent',expected_status:'trial'}));assert.equal((await row(db,'hr_trial_periods',ids.t)).stage,'evaluation_pending');
 for(const payload of [{outcome:'not_selected'},{outcome:'profiled',vacancy_id:ids.v}]){await seed(db);await assert.rejects(()=>rpc(db,'finish_without_advance',payload));assert.equal((await row(db,'hr_candidates')).status,'trial')}
 await seed(db);await db.query('update hr_candidates set vacancy_id=$1,whatsapp=$2 where id=$3',[ids.w,'5350000001',ids.b]);await assert.rejects(()=>rpc(db,'finish_without_advance',{outcome:'profiled',vacancy_id:ids.w}));assert.equal((await row(db,'hr_candidates')).status,'trial');
 // Failure after act preparation and candidate insertion must undo the entire operation.
 await seed(db);await db.exec(`create function test_fail_history() returns trigger language plpgsql as $$begin if new.event_type='trial_closed' then raise exception 'Synthetic failure';end if;return new;end$$;create trigger test_fail after insert on hr_candidate_history for each row execute function test_fail_history();`);
 await assert.rejects(()=>rpc(db,'finish_without_advance',{outcome:'profiled',vacancy_id:ids.w}));assert.equal((await row(db,'hr_candidates')).status,'trial');assert.equal((await db.query('select count(*)::int n from hr_candidates')).rows[0].n,2);assert.equal((await db.query('select count(*)::int n from hr_trial_closures')).rows[0].n,0);await db.exec('drop trigger test_fail on hr_candidate_history;drop function test_fail_history();');
 await db.exec("set test.uid='00000000-0000-0000-0000-000000000001'");await assert.rejects(()=>rpc(db,'finish_without_advance',{outcome:'talent_pool'}),/No autorizado/);await db.exec("set test.uid='6418ad20-d0e8-49c0-8d9a-e1da3daf71b6'");
 await seed(db);await rpc(db,'finish_without_advance',{outcome:'talent_pool'});
 await assert.rejects(()=>rpc(db,'visible_step_back',{expected_stage:'completed',expected_status:'talent_pool'}));
 await db.exec(fs.readFileSync(root+'/supabase/trial-closure-state-guard.sql','utf8').replace(/revoke all[^;]+;/g,''));
 await assert.rejects(()=>db.query("update hr_trial_periods set stage='in_trial' where id=$1",[ids.t]),/cierre confirmado/);
 assert.equal((await row(db,'hr_trial_periods',ids.t)).stage,'completed');

 const closedBefore=await row(db,'hr_trial_periods',ids.t),closureBefore=(await db.query('select * from hr_trial_closures')).rows;
 await db.query("update hr_candidates set status='interviewed' where id=$1",[ids.a]);
 const terms={role_title:'Plaza ficticia',start_date:'2026-10-26',duration_days:7,schedule:'Horario nuevo',compensation:'10000',location:'Sede',notes:'Segundo intento'};
 await assert.rejects(()=>db.query('select hr_request_trial($1,$2,$3)',[ids.a,ids.t,{...terms,duration_days:0}]));
 assert.equal((await row(db,'hr_trial_periods',ids.t)).superseded_at,null);
 const next=(await db.query('select hr_request_trial($1,$2,$3) data',[ids.a,ids.t,terms])).rows[0].data;
 assert.notEqual(next.id,ids.t);assert.equal(next.stage,'pending_agreement');assert.equal(next.agreement_url,null);assert.equal(next.completed_at,null);
 assert.equal((await row(db,'hr_trial_periods',ids.t)).stage,closedBefore.stage);assert((await row(db,'hr_trial_periods',ids.t)).superseded_at);
 assert.deepEqual((await db.query('select * from hr_trial_closures')).rows,closureBefore);
 await assert.rejects(()=>db.query('select hr_request_trial($1,$2,$3)',[ids.a,ids.t,terms]));
 await assert.rejects(()=>rpc(db,'finish_without_advance',{outcome:'talent_pool'}),/intento anterior/);
 await db.query("update hr_trial_periods set stage='in_trial' where id=$1",[next.id]);
 await db.query("update hr_candidates set status='trial' where id=$1",[ids.a]);
 await db.query('select hr_manage_trial_closure($1,$2,$3)',[next.id,'finish_without_advance',{outcome:'not_selected',reason:'No es el candidato idóneo'}]);
 assert.equal((await row(db,'hr_candidates')).status,'not_selected');
 assert.equal((await db.query("select count(*)::int n from hr_trial_closure_events where action='finish_without_advance'")).rows[0].n,2);
 assert.equal((await db.query('select count(*)::int n from hr_trial_periods where superseded_at is null')).rows[0].n,1);
 report.push('restart retains original act and events; new attempt closes independently; stale and invalid requests rejected');
 report.push('closed trial cannot reopen','three outcomes reconcile legacy state without duplicate decisions');
 report.push('four internal stages → contract → availability','stale request rejected','missing reason rejected','same vacancy rejected','duplicate open application rejected','late failure rolls back act/new application/status/history','non-owner rejected');return report;
}
const mock=`(()=>{window.alerts=[];window.alert=m=>alerts.push(m);window.confirm=()=>true;const api=async payload=>{const r=await fetch('/synthetic-api',{method:'POST',body:JSON.stringify(payload)});return r.json()};window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{email:'cartelstudiocuba@gmail.com'},access_token:'fake'}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},storage:{from:()=>({createSignedUrl:async()=>({data:null})})},rpc:(name,args)=>api({name,args}),from(table){let filters=[],patch,orders=[],limit,one=false;const q={select(){return q},update(v){patch=v;return q},eq(k,v){filters.push([k,v]);return q},is(k,v){filters.push([k,v]);return q},in(){return q},order(k,o){orders.push([k,o]);return q},range(){return q},limit(n){limit=n;return q},single(){one=true;return q},maybeSingle(){one=true;return q},then(ok,bad){return api({table,filters,patch,orders,limit,one}).then(ok,bad)}};return q}})};})();`;
async function browserTests(db){const browser=await chromium.launch({headless:true,channel:'msedge'}),report=[];
try{for(const width of [390,1440]){
 await seed(db);const context=await browser.newContext({viewport:{width,height:950}});let realRequests=0,lostResponse=false,failRead=false;const calls=[];
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.hostname==='wa.me')return route.fulfill({body:'WhatsApp sintético, sin envío'});
  if(u.hostname!=='isolated.test'){realRequests++;return route.fulfill({body:''})}
  if(u.pathname==='/synthetic-api'){
   const p=route.request().postDataJSON();calls.push(p);
   try{let result;
    if(p.name==='hr_request_trial'){const result=await db.query('select hr_request_trial($1,$2,$3) data',[p.args.p_candidate,p.args.p_expected_trial,p.args.p_terms]);return route.fulfill({json:{data:result.rows[0].data,error:null}})}if(p.name==='hr_set_trial_closure_representative')return route.fulfill({json:{data:null,error:null}});if(p.name){assert.equal(p.name,'hr_manage_trial_closure');await db.query('select hr_manage_trial_closure($1,$2,$3)',[p.args.p_trial,p.args.p_action,p.args.p_payload]);result={data:null,error:null};if(lostResponse){lostResponse=false;return route.fulfill({json:{data:null,error:{message:'Respuesta perdida simulada'}}})}}
    else {assert(/^[a-z_]+$/.test(p.table));let values=[],where=p.filters.map(([key,value])=>{assert(/^[a-z_]+$/.test(key));if(value===null)return key+' is null';values.push(value);return key+'=$'+values.length}).join(' and ');if(failRead&&p.table==='hr_trial_closure_events'){failRead=false;throw Error('Lectura fallida simulada')};
     let query='select * from '+p.table;if(p.patch){const sets=Object.entries(p.patch).map(([key,v])=>{assert(/^[a-z_]+$/.test(key));values.push(v);return key+'=$'+values.length});query='update '+p.table+' set '+sets.join(',')}
     if(where)query+=' where '+where;if(p.patch)query+=' returning *';else{if(p.orders.length)query+=' order by '+p.orders.map(([k,o])=>{assert(/^[a-z_]+$/.test(k));return k+(o?.ascending===false?' desc':' asc')}).join(',');if(p.limit)query+=' limit '+Number(p.limit)}const rows=(await db.query(query,values)).rows;result={data:p.one?(rows[0]||null):rows,error:null}}
    return route.fulfill({json:result});
   }catch(e){return route.fulfill({json:{data:null,error:{message:e.message}}})}
  }
  if(u.pathname.includes('/assets/vendor/supabase'))return route.fulfill({contentType:'application/javascript',body:mock});
  if(u.pathname.startsWith('/functions/'))return route.fulfill({json:{summary:'Resumen sintético'}});
  const file=path.join(root,u.pathname);return fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({path:file}):route.fulfill({status:404,body:''});
 });
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
 async function open(){await page.goto('http://isolated.test/rrhh.html?embedded=1&candidate='+ids.a);await page.locator('#detail[data-candidate-id="'+ids.a+'"]').waitFor({state:'visible'})}
 await open();
 for(const [expected,label] of [['pending_agreement','contrato de período de prueba'],['pending_confirmation','confirmar disponibilidad']]){
  await page.evaluate(id=>openCandidateStageBack(id),ids.a);assert((await page.locator('.candidate-back-option').innerText()).includes(label));await page.locator('.candidate-back-option').click();await page.locator('#candidateBackOverlay').waitFor({state:'detached'});assert.equal((await row(db,'hr_trial_periods',ids.t)).stage,expected);await open();
 }
 for(const outcome of ['talent_pool','not_selected','profiled']){
  await seed(db);await open();const before=calls.length;
  await page.evaluate(id=>openTrialClosureDecision(id),ids.a);await page.locator('#trialCloseFinish').click();await page.locator('#trialFinishOverlay .candidate-back-cancel').click();assert.equal(calls.slice(before).filter(x=>x.name||x.patch).length,0);
  await page.evaluate(id=>openTrialClosureDecision(id),ids.a);await page.locator('#trialCloseFinish').click();await page.locator('.trial-finish-choice[data-value="'+outcome+'"]').click();
  if(outcome==='profiled')await page.locator('#trialFinishVacancy').selectOption(ids.w);
  await page.locator('#trialFinishRepresentative [name=start_date]').fill('2026-10-20');await page.locator('#trialFinishRepresentative [name=end_date]').fill('2026-10-26');await page.locator('#trialFinishConfirm').click();
  if(outcome==='not_selected'){await page.locator('input[value="No es el candidato idóneo"]').check();await page.locator('#rejectionReasonOverlay [data-action="confirm"]').click()}
  await page.getByRole('link',{name:'Enviar por WhatsApp',exact:true}).waitFor();
  assert.equal((await row(db,'hr_candidates')).status,outcome==='profiled'?'archived':outcome);assert(!/Cierre del período de prueba|Recepción del acuerdo|Volver al inicio/.test(await page.locator('#detail .candidate-flow').innerText()));
  const popupPromise=context.waitForEvent('page');await page.getByRole('link',{name:'Enviar por WhatsApp',exact:true}).click();const popup=await popupPromise;await popup.waitForLoadState();assert(popup.url().startsWith('https://wa.me/5350000001'));await popup.close();if(await page.locator('#trialFinishOverlay .candidate-back-cancel').isVisible())await page.locator('#trialFinishOverlay .candidate-back-cancel').click();await open();
  await page.waitForFunction(()=>document.querySelector('[data-trial-history]')?.textContent.includes('Prueba finalizada'));
  if(outcome==='profiled'){await page.locator('[data-trial-history] a').waitFor({state:'attached'});assert((await page.locator('[data-trial-history]').innerText()).includes('Perfilado'));}
  await page.getByRole('button',{name:'Ver cierre del período de prueba →'}).click();await page.locator('.trial-review-back').click();await page.evaluate(id=>openTrialClosureDecision(id),ids.a);await page.getByRole('link',{name:'Enviar por WhatsApp',exact:true}).waitFor();
  assert.equal(await page.locator('#trialFinishOverlay').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
  fs.mkdirSync(root+'/../outputs/cierre-seguro',{recursive:true});await page.screenshot({path:root+'/../outputs/cierre-seguro/'+outcome+'-'+width+'.png'});
 }
 await seed(db);await rpc(db,'finish_without_advance',{outcome:'talent_pool'});await db.query("update hr_candidates set status='interviewed' where id=$1",[ids.a]);await open();
 await page.evaluate(id=>toggleTrialForm(id),ids.a);await page.waitForFunction(id=>document.getElementById('trialStart-'+id)?.value,ids.a);
 await page.evaluate(()=>{window.waOpen=()=>{};localStorage.setItem('cartel-training-start-'+"10000000-0000-0000-0000-000000000001",'1')});
 await page.evaluate(id=>submitTrialRequest(id),ids.a);
 assert.equal((await db.query('select count(*)::int n from hr_trial_periods')).rows[0].n,2);
 assert.equal((await row(db,'hr_trial_periods',ids.t)).stage,'completed');
 assert((await page.locator('#detail .candidate-flow').innerText()).includes('Enviar contrato'));
 await open();assert((await page.locator('#detail .candidate-flow').innerText()).includes('Enviar contrato'));
 // Cancel the existing rejection reason dialog without any mutation.
 await seed(db);await open();await page.evaluate(id=>openTrialFinishDestination(id,'not_selected'),ids.a);await page.locator('#trialFinishRepresentative [name=start_date]').fill('2026-10-20');await page.locator('#trialFinishRepresentative [name=end_date]').fill('2026-10-26');await page.locator('#trialFinishConfirm').click();await page.locator('#rejectionReasonOverlay [data-action="cancel"]').click();assert.equal((await row(db,'hr_candidates')).status,'trial');await page.locator('#trialFinishOverlay .candidate-back-cancel').click();
 // Early interview navigation keeps its existing behavior.
 await db.query("update hr_candidates set status='preselected',interview_availability_confirmed_at=now() where id=$1",[ids.a]);await open();await page.evaluate(id=>openCandidateStageBack(id),ids.a);assert((await page.locator('.candidate-back-option').innerText()).includes('confirmar disponibilidad para entrevista'));await page.locator('.candidate-back-option').click();await page.locator('#candidateBackOverlay').waitFor({state:'detached'});assert.equal((await row(db,'hr_candidates')).interview_availability_confirmed_at,null);
 // A failed acknowledgment must reconcile the real committed state and preserve recovery on reload.
 await seed(db);await open();lostResponse=true;await page.evaluate(id=>openTrialFinishDestination(id),ids.a);await page.locator('.trial-finish-choice[data-value="talent_pool"]').click();await page.locator('#trialFinishRepresentative [name=start_date]').fill('2026-10-20');await page.locator('#trialFinishRepresentative [name=end_date]').fill('2026-10-26');await page.locator('#trialFinishConfirm').click();await page.waitForFunction(()=>document.querySelector('#detail .candidate-flow')?.textContent.includes('Candidatura en cantera'));await open();failRead=true;await page.evaluate(id=>openTrialFinishReceipt(id),ids.a);await page.getByText('Lectura fallida simulada',{exact:false}).waitFor();await page.locator('#trialFinishOverlay .candidate-back-cancel').click();await page.evaluate(id=>openTrialFinishReceipt(id),ids.a);await page.getByRole('link',{name:'Enviar por WhatsApp',exact:true}).waitFor();
 assert.deepEqual(errors,[]);report.push({width,decisions:3,navigation:true,cancelNoWrites:true,whatsAppUnconfirmed:true,reloadRecovery:true,lostResponse:true,readFailureRecovery:true,realDatabaseRequests:0,blockedExternalRequests:realRequests});await context.close();
}}finally{await browser.close()}return report}
(async()=>{const db=await database();try{const results={backend:await backend(db),browser:await browserTests(db)};console.log(JSON.stringify(results,null,2));fs.mkdirSync(root+'/../outputs/cierre-seguro',{recursive:true});fs.writeFileSync(root+'/../outputs/cierre-seguro/results.json',JSON.stringify(results,null,2))}finally{await db.close()}})().catch(e=>{console.error(e);process.exit(1)});
