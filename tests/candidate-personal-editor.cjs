const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const source=fs.readFileSync('tests/interview-navigation.cjs','utf8');let mock=source.split('const mock=`')[1].split('`;')[0];
mock=mock.replace('select(){return q}', 'select(){return q},is(){return q},limit(){return q},maybeSingle(){return Promise.resolve({data:null,error:null})}');
mock=mock.replace('auth:{',`storage:{from:()=>({createSignedUrl:async()=>({data:null}),upload:async(p)=>{window.uploads=(window.uploads||0)+1;return {error:null}}})},rpc:async(name,p)=>{
if(name!=='hr_edit_candidate_personal')return {data:null};window.editorCalls??=[];editorCalls.push(p);if(window.denied)return {error:{message:'No tienes permiso'}};
window.personal??={full_name:'Persona A',whatsapp:'+5350000000',email:'prueba@example.com',municipality:'Playa','answer:sex':'Femenino','answer:address':'Dirección original','answer:education_level':'Universitario','answer:interview_identity_card':'90010112345','answer:photo_path':null};
if(p.p_changes&&window.failSave)return {error:{message:'Conflicto de edición'}};
if(p.p_changes)Object.assign(personal,p.p_changes);return {data:{values:structuredClone(personal),candidate:{id:'A',full_name:personal.full_name,whatsapp:personal.whatsapp,email:personal.email,municipality:personal.municipality,status:'interview_scheduled',vacancy_id:'V'},answers:[]}};},auth:{`);
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
for(const width of [390,768,1440]){
 const page=await browser.newPage({viewport:{width,height:950}});let writes=0;const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE',e.message)});page.on('console',m=>{if(m.type()==='error')console.error(m.text())});
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(r.request().method()!=='GET'){if(u.pathname.includes('hr-ai-summary'))return r.fulfill({json:{summary:'Resumen sintético'}});writes++;return r.abort();}if(u.pathname.includes('vendor/supabase'))return r.fulfill({contentType:'text/javascript',body:mock});const file=path.join(process.cwd(),decodeURIComponent(u.pathname));return fs.existsSync(file)&&fs.statSync(file).isFile()?r.fulfill({path:file}):r.fulfill({status:404,body:''});});
 await page.goto('https://isolated.test/rrhh.html?candidate=A');await page.waitForFunction(()=>document.getElementById('detail')?.dataset.candidateId==='A');
 await page.waitForTimeout(700);
 const button=page.locator('.personal-editor-action');await button.click();const dialog=page.locator('#candidatePersonalEditor');await dialog.locator('[data-personal-key=full_name]').waitFor();
 assert.equal(await dialog.locator('[data-personal-key=full_name]').inputValue(),'Persona A');assert.equal(await dialog.locator('[data-personal-key="answer:sex"]').inputValue(),'Femenino');
 assert.equal(await dialog.locator('input').count(),9);assert(!/plaza|contrato|nacimiento|emergencia/i.test(await dialog.innerText()));
 assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 await page.screenshot({path:'test-results/personal-editor-'+width+'.png'});
 await dialog.locator('[data-personal-key=full_name]').fill('Descartado');await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();assert(await page.locator('#detail').isVisible());assert.equal(await page.evaluate(()=>editorCalls.filter(p=>p.p_changes).length),0);
 await button.click();await dialog.locator('[data-personal-key=full_name]').waitFor();await dialog.getByRole('button',{name:'Guardar cambios'}).click();await page.waitForFunction(()=>document.querySelector('#candidatePersonalEditor [role=status]').textContent.includes('No hay cambios'));assert.equal(await page.evaluate(()=>editorCalls.filter(p=>p.p_changes).length),0);
 await dialog.locator('[data-personal-key=full_name]').fill('Nombre actualizado');await page.evaluate(()=>window.failSave=true);await dialog.getByRole('button',{name:'Guardar cambios'}).click();await page.waitForFunction(()=>document.querySelector('#candidatePersonalEditor [role=status]').textContent.includes('Conflicto'));assert.equal(await dialog.locator('[data-personal-key=full_name]').inputValue(),'Nombre actualizado');
 await page.evaluate(()=>window.failSave=false);await dialog.getByRole('button',{name:'Guardar cambios'}).click();await dialog.waitFor({state:'detached'});assert(await page.locator('#detail').isVisible());assert((await page.locator('#detailBody').innerText()).includes('Nombre actualizado'));assert(await page.locator('.personal-editor-saved').isVisible());assert(page.url().includes('rrhh.html?candidate=A'));
 assert.deepEqual(await page.evaluate(()=>Object.keys(editorCalls.filter(p=>p.p_changes).at(-1).p_changes)),['full_name']);
 await button.click();await dialog.locator('[data-personal-key=full_name]').waitFor();await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
 await button.click();await dialog.locator('[data-personal-key=full_name]').waitFor();
 await dialog.locator('input[type=file]').setInputFiles({name:'fake.jpg',mimeType:'image/jpeg',buffer:Buffer.from('invalid image')});await dialog.getByRole('button',{name:'Guardar cambios'}).click();await page.waitForFunction(()=>document.querySelector('#candidatePersonalEditor [role=status]').textContent.includes('fotografía'));assert.equal(await page.evaluate(()=>window.uploads||0),0);
 const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=40;c.height=40;c.getContext('2d').fillRect(0,0,40,40);return c.toDataURL('image/png').split(',')[1]});
 await dialog.locator('input[type=file]').setInputFiles({name:'valid.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});await dialog.getByRole('button',{name:'Guardar cambios'}).click();await dialog.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>window.uploads),1);assert.deepEqual(await page.evaluate(()=>Object.keys(editorCalls.filter(p=>p.p_changes).at(-1).p_changes)),['answer:photo_path']);
 await page.evaluate(()=>window.denied=true);await button.click();await page.waitForFunction(()=>document.querySelector('#candidatePersonalEditor [role=status]').textContent.includes('No tienes permiso'));assert(await dialog.getByRole('button',{name:'Guardar cambios'}).isDisabled());await dialog.getByRole('button',{name:'Cancelar'}).click();
 assert.equal(writes,0);assert.deepEqual(errors,[]);console.log('PASS preload, allowlist, cancel/Escape, no-op, conflict/retry, minimal patch, same-sheet refresh, denied; '+width);await page.close();
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});

