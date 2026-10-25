const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const {chromium}=require('C:/Users/julio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {PGlite}=require('../../correcciones-cv/node_modules/@electric-sql/pglite');
const read=p=>fs.readFileSync(p,'utf8');
(async()=>{
 const db=new PGlite(),test=read('tests/role-questionnaire-sql.cjs');
 await db.exec(test.match(/await db.exec\(`([\s\S]*?)`\);/)[1]);
 await db.exec(`alter table hr_candidates add column full_name text,add column municipality text,add column submitted_at timestamptz,add column experience_range text,add column excel_level text,add column whatsapp text;
 alter table hr_interviews add column interview_time time,add column attendance_status text;
 create table hr_candidate_answers(id uuid,candidate_id uuid,question_key text,answer text);`);
 const base=read('supabase/interview-completion.sql');await db.exec(base.slice(base.indexOf('create or replace function public.hr_finalize_interview('),base.indexOf('create or replace function public.hr_audit_interview_evaluation')));
 await db.exec(read('supabase/interview-questionnaire.sql')+read('supabase/interview-questionnaire-closure.sql')+'create trigger hr_validate_interview_closure before insert or update on hr_interviews for each row execute function hr_validate_interview_closure();');
 const all=JSON.parse(read('INTERVIEW-QUESTIONNAIRES-REVIEW.json')),ids=[];
 for(const source of all){
  const published={version:1,revision:1,status:'published',questions:source.questions};
  // Other roles are published only inside this isolated test database to exercise multiple questionnaires.
  const r=(await db.query('insert into hr_roles(title,work_content) values ($1,$2) returning id',[source.title,{interview_questionnaire_draft:{...published,status:'draft'},...(source.questions.length?{interview_questionnaire_published:published}:{})}])).rows[0];
  const v=(await db.query('insert into hr_vacancies(title) values ($1) returning id',[source.title])).rows[0];
  const c=(await db.query("insert into hr_candidates(vacancy_id,full_name,status,submitted_at) values ($1,$2,'interview_scheduled',now()) returning id",[v.id,'SINTÉTICO '+source.title])).rows[0];
  await db.query("insert into hr_interviews(candidate_id,interview_date,interviewer,interview_notes) values ($1,current_date,'Entrevistador sintético',$2)",[c.id,{q3:'Histórico de origen incierto'}]);ids.push(c.id);
 }
 const identifier=s=>{assert.match(s,/^[a-z_]+$/);return s};
 async function bridge(req){try{
  if(req.rpc){const entries=Object.entries(req.args);const sql='select to_jsonb('+identifier(req.rpc)+'('+entries.map(([k],i)=>identifier(k)+' => $'+(i+1)).join(',')+')) as result';const row=(await db.query(sql,entries.map(e=>e[1]))).rows[0].result;return {data:req.rpc==='hr_finalize_interview'?row:[row],error:null};}
  const columns=req.select==='*'?'*':req.select.split(',').map(identifier).join(',');const params=[];let sql='select '+columns+' from '+identifier(req.table);
  if(req.filters.length)sql+=' where '+req.filters.map(([k,v])=>{params.push(v);return identifier(k)+'=$'+params.length}).join(' and ');
  const rows=(await db.query(sql,params)).rows;return {data:req.single?rows[0]||null:rows,error:null};
 }catch(e){return {data:null,error:{message:e.message,code:e.code}}}}
 const mock=`window.CartelLoad={run:(_n,fn)=>fn(),deadline:fn=>fn(),createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{email:'cartelstudiocuba@gmail.com'}}}})},rpc:(rpc,args)=>bridge({rpc,args}),from(table){const req={table,select:'*',filters:[],single:false};const q={select(s){req.select=s;return q},eq(k,v){req.filters.push([k,v]);return q},order(){return q},range(){return q},single(){req.single=true;return bridge(req)},maybeSingle(){req.single=true;return bridge(req)},then(a,b){return bridge(req).then(a,b)}};return q}})};`;
 const browser=await chromium.launch({headless:true,channel:'msedge'}),results=[];
 try{for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:950}}),errors=[],alerts=[];page.setDefaultTimeout(12000);
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{alerts.push(d.message());await d.accept()});await page.exposeFunction('bridge',bridge);
  await page.route('**/*',route=>{
   const u=new URL(route.request().url());if(u.hostname!=='interview.test')return route.abort();
   if(u.pathname==='/assets/loading-runtime.js')return route.fulfill({body:mock,contentType:'application/javascript'});
   if(u.pathname.includes('supabase-'))return route.fulfill({body:'',contentType:'application/javascript'});
   if(u.pathname==='/rrhh.html')return route.fulfill({body:'<html><body>Revisión sintética</body></html>',contentType:'text/html'});
   const file=path.join(process.cwd(),u.pathname);return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:''});
  });
  await page.goto('https://interview.test/entrevistas.html?view=agenda');await page.waitForFunction(()=>candidates.length===5);
  for(let i=0;i<ids.length;i++){
   console.log('Viewport',width,'role',i);
   await page.evaluate(id=>startInterview(id),ids[i]);await page.waitForFunction(id=>interviewReadyId===id,ids[i]);await page.evaluate(()=>goInterviewStep(4));
   if(i===2){await page.getByRole('button',{name:'Iniciar cuestionario publicado de esta plaza',exact:true}).click();assert.match(alerts.at(-1),/no tiene cuestionario/);assert.equal(await page.locator('[data-iq]').count(),0);continue}
   await page.getByRole('button',{name:'Iniciar cuestionario publicado de esta plaza',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('[data-iq]').length>0);
   const n=all[i].questions.length;assert.equal(await page.locator('[data-iq]').count(),n);assert.ok((await page.locator('#interviewStepQuestionnaire').textContent()).includes('Histórico de origen incierto'));
   if(i===0){
    const key=all[i].questions[0].id;
    await db.query('select hr_save_role_interview_answer($1,$2,$3,$4,$5)',[ids[i],key,'Respuesta de otra sesión',null,1]);
    await page.locator('[data-iq]').first().fill('Edición sobre una copia desactualizada');await page.locator('[data-iq]').first().dispatchEvent('change');
    await assert.rejects(()=>page.evaluate(()=>questionnaireSaveQueue));assert.ok(alerts.some(a=>a.includes('Otra sesión cambió')));
    const saved=(await db.query('select interview_notes from hr_interviews where candidate_id=$1',[ids[i]])).rows[0];assert.equal(saved.interview_notes[key],'Respuesta de otra sesión');
    await page.reload();await page.waitForFunction(()=>candidates.length===5);await page.evaluate(id=>startInterview(id),ids[i]);await page.waitForFunction(id=>interviewReadyId===id,ids[i]);await page.evaluate(()=>goInterviewStep(4));
   }
   for(const field of await page.locator('[data-iq]').all()){if(await field.evaluate(el=>el.tagName)==='SELECT')await field.selectOption({index:1});else await field.fill('Respuesta práctica sintética');await field.dispatchEvent('change');}
   await page.evaluate(()=>questionnaireSaveQueue);
   await page.evaluate(()=>goInterviewStep(5));await page.evaluate(()=>{document.querySelectorAll('.interview-rating-select').forEach(el=>el.value='4')});
   assert.deepEqual(await page.evaluate(()=>interviewCompletionMissing()),[]);
   const printed=await page.evaluate(()=>interviewPrintHtml(current));assert.ok(printed.includes(all[i].questions[0].text));assert.ok(printed.includes('Respuesta práctica sintética'));
   assert.equal(await page.evaluate(()=>finalizeInterview('pending')),true);
   assert.equal(await page.evaluate(()=>finalizeInterview('pending')),true);
   await page.reload();await page.waitForFunction(()=>candidates.length===5);await page.evaluate(id=>startInterview(id),ids[i]);await page.waitForFunction(id=>interviewReadyId===id,ids[i]);await page.evaluate(()=>goInterviewStep(4));assert.equal(await page.locator('[data-iq]').count(),0);
  }
  // Rapid navigation must finish on the requested candidate, with their own snapshot only.
  await page.evaluate(ids=>Promise.all([startInterview(ids[0]),startInterview(ids[3])]),ids);assert.equal(await page.evaluate(()=>current.id),ids[3]);
  await page.evaluate(()=>goInterviewStep(4));assert.ok((await page.locator('#interviewStepQuestionnaire').textContent()).includes(all[3].questions[0].text));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'tests/role-questionnaire-runtime-'+width+'.png',fullPage:true});
  assert.deepEqual(errors,[]);results.push({width,passed:true,roles:5,cases:['published per role','draft blocked','literal 16 assistant questions','historical interpretation','answer persistence','real SQL closure','idempotent closure','reload closed','rapid candidate switch','print content','no horizontal overflow']});await page.close();
  // Fresh interviews for the second viewport, so it tests editing as well as closed readback.
  if(width===390){await db.exec('drop trigger hr_guard_questionnaire_snapshot on hr_interviews;drop trigger hr_validate_interview_closure on hr_interviews;update hr_interviews set questionnaire_snapshot=null,completed_at=null,closure_evaluation=null,closure_decision=null,completed_by=null,interview_notes=\'{"q3":"Histórico de origen incierto"}\';update hr_candidates set status=\'interview_scheduled\';create trigger hr_guard_questionnaire_snapshot before insert or update on hr_interviews for each row execute function hr_guard_questionnaire_snapshot();create trigger hr_validate_interview_closure before insert or update on hr_interviews for each row execute function hr_validate_interview_closure();');}
 }
 fs.writeFileSync('tests/role-questionnaire-browser-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
 }finally{await browser.close();await db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
