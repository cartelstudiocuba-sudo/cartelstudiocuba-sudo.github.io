const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const {chromium}=require('C:/Users/julio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
new vm.Script(fs.readFileSync('assets/role-interview-draft.js','utf8'));
for(const m of fs.readFileSync('plaza-ficha.html','utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
const fixture=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/role-interview-draft.css"><script>
const stored=localStorage.getItem('roles');window.records=stored?JSON.parse(stored):Array.from({length:5},(_,i)=>({id:'R'+i,title:'Plaza sintética '+i,updated_at:'t0',work_content:{standard:{sentinel:'conservar'},evaluation_master:{criteria:[]}}}));
let role=records[0];window.writes=[];window.fail=false;window.race=false;window.pause=false;window.alert=()=>{};window.confirm=()=>true;
const sb={from(table){if(table!=='hr_roles')throw Error('Forbidden table '+table);let patch=null,filters=[];
const q={select(){return q},eq(k,v){filters.push([k,v]);return q},is(k,v){filters.push([k,v]);return q},update(p){patch=p;return q},single(){return run()},maybeSingle(){return run()}};
async function run(){if(window.pause)await new Promise(r=>window.release=r);const row=records.find(r=>r.id===filters.find(f=>f[0]==='id')[1]);if(fail)return {error:{message:'Error sintético'}};
if(!patch)return {data:JSON.parse(JSON.stringify(row))};if(race)row.work_content.standard.sentinel='edición concurrente';
if(filters.some(([k,v])=>(k==='work_content'?JSON.stringify(row[k]):row[k])!==v))return {data:null,error:null};
writes.push({table,patch});Object.assign(row,patch);localStorage.setItem('roles',JSON.stringify(records));return {data:JSON.parse(JSON.stringify(row)),error:null}}
return q}};
</script><script src="/assets/role-interview-draft.js"></script><button id="open" onclick="openRoleInterviewDraft()">Editar</button>`;
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});const results=[];
try{for(const width of [390,1440]){const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE',e.message)});
await page.route('**/*',route=>{const u=new URL(route.request().url());assert.equal(u.origin,'https://draft.test');return u.pathname==='/'?route.fulfill({body:fixture,contentType:'text/html'}):route.fulfill({path:path.join(process.cwd(),u.pathname)})});
await page.goto('https://draft.test/');await page.click('#open');assert.equal(await page.locator('fieldset').count(),0);
await page.getByRole('button',{name:'Añadir pregunta',exact:true}).click();await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();assert.match(await page.locator('[role=status]').textContent(),/No se guardó/);assert.equal(await page.evaluate(()=>writes.length),0);
let rows=page.locator('fieldset');await rows.nth(0).locator('[name=text]').fill('Texto sintético A');const firstId=await rows.nth(0).getAttribute('data-question-id');
await page.getByRole('button',{name:'Añadir pregunta',exact:true}).click();await rows.nth(1).locator('[name=text]').fill('Texto sintético B');await rows.nth(1).locator('[name=type]').selectOption('select');await rows.nth(1).locator('[name=options]').fill('Uno\nUno');
await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();assert.match(await page.locator('[role=status]').textContent(),/distintas/);assert.equal(await page.evaluate(()=>writes.length),0);
await rows.nth(1).locator('[name=options]').fill('Uno\nDos');await rows.nth(1).getByRole('button',{name:'Subir',exact:true}).click();assert.equal(await rows.nth(1).getAttribute('data-question-id'),firstId);
await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.waitForFunction(()=>writes.length===1);await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('Borrador guardado'));
assert.equal(await page.evaluate(()=>records[0].work_content.standard.sentinel),'conservar');assert.equal(await page.evaluate(()=>records[0].work_content.interview_questionnaire_draft.status),'draft');
assert.equal(await page.evaluate(()=>records[0].work_content.interview_questionnaire_draft.questions[1].id),firstId);
assert.equal(await page.evaluate(()=>document.querySelector('dialog').scrollWidth<=document.querySelector('dialog').clientWidth),true);
await page.screenshot({path:'tests/role-interview-draft-'+width+'.png'});
await page.reload();await page.click('#open');assert.equal(await rows.count(),2);assert.equal(await rows.nth(1).getAttribute('data-question-id'),firstId);
// A fresh read merges unrelated edits made after opening the editor.
await page.evaluate(()=>{records[0].work_content.training_master={sentinel:'nuevo'};records[0].updated_at='t1';records[0].work_content.interview_questionnaire_draft=Object.fromEntries(Object.entries(records[0].work_content.interview_questionnaire_draft).reverse())});
await rows.nth(1).locator('[name=text]').fill('Texto sintético editado');await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.waitForFunction(()=>writes.length===1);assert.equal(await page.evaluate(()=>records[0].work_content.training_master.sentinel),'nuevo');
// Another questionnaire editor wins: the stale draft must not overwrite it.
await page.evaluate(()=>records[0].work_content.interview_questionnaire_draft.revision++);await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('Otra sesión'));assert.equal(await page.evaluate(()=>writes.length),1);
await page.getByRole('button',{name:'Cerrar',exact:true}).click();await page.evaluate(()=>role=JSON.parse(JSON.stringify(records[0])));await page.click('#open');await page.evaluate(()=>window.race=true);await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('durante el guardado'));assert.equal(await page.evaluate(()=>writes.length),1);await page.evaluate(()=>window.race=false);
await page.getByRole('button',{name:'Cerrar',exact:true}).click();
// Five independent roles, rapid switches, and missing configuration never borrow questions.
for(let i=1;i<5;i++){await page.evaluate(i=>role=records[i],i);await page.click('#open');assert.equal(await rows.count(),0);await page.getByRole('button',{name:'Cerrar',exact:true}).click()}
await page.evaluate(()=>role=records[2]);await page.click('#open');await page.evaluate(()=>{window.pause=true;window.pending=saveRoleInterviewDraft();window.duplicate=saveRoleInterviewDraft();role=records[3];window.pause=false;release()});await page.evaluate(()=>pending);assert.match(await page.locator('[role=status]').textContent(),/plaza cambió/);assert.equal(await page.evaluate(()=>writes.length),1);
assert.equal(await page.evaluate(()=>records[2].work_content.interview_questionnaire_draft),undefined);
await page.getByRole('button',{name:'Cerrar',exact:true}).click();await page.evaluate(()=>role=records[4]);await page.click('#open');await page.evaluate(()=>window.fail=true);await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('Error sintético'));assert.equal(await page.evaluate(()=>writes.length),1);
assert.deepEqual(errors,[]);results.push({width,passed:true,cases:['empty','validation','stable IDs','reorder','persistence','five roles','unrelated content','stale editor','concurrent write','rapid switch','double save','error','mobile overflow']});await page.close()}
fs.writeFileSync('tests/role-interview-draft-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
