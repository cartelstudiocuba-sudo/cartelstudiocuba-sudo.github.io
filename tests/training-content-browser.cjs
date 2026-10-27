const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),vm=require('vm');
const {chromium}=require('C:/Users/julio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const published=process.argv.includes('--published');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'rrhh.html'),'utf8');
for(const name of ['rrhh.html','plaza-ficha.html'])for(const m of fs.readFileSync(path.join(root,name),'utf8').matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))if(m[1].trim())new vm.Script(m[1]);
const functions=html.slice(html.indexOf('async function openTrainingDocumentation('),html.indexOf('function candidateGuidedFlow('));
const mock=`const candidates=[{id:'c',vacancy_id:'v',status:'trial',full_name:'Daniel Ficticio'}],vacancies=[{id:'v'}],roles=[];
const role={id:'r',title:'Plaza ficticia',work_days:'De lunes a sábado',schedule:'De 9:00 a. m. a 6:00 p. m.',compensation:'15000',payment_frequency:'Semanal'};
const trialPeriodsByCandidate={c:{id:'t'}},trainingDecisionByTrial={t:'continue'},roleForVacancy=()=>role,candidatePhone=()=> '5350000000',preserveCandidateSheet=()=>{};
window.scenario='ok';window.calls=[];window.open=(...args)=>window.opened=args;
const sb={async rpc(name,args){calls.push({name,args});if(scenario==='slow')await new Promise(r=>setTimeout(r,300));return scenario==='fail'?{error:{message:'denied'}}:{data:{url:(scenario==='foreign'?'https://attacker.invalid':'https://gestion.elcartelstudio.com')+'/plaza-ficha.html?documento=contenido#token='+'a'.repeat(64),role_id:scenario==='wrongrole'?'other':'r'}};}};`;
const fixture={role:{id:'r',title:'Plaza de verificación',description:'Descripción vigente',direct_manager:'Tutor',work_content:{custom:[{title:'Función vigente',text:'CONTENIDO VIGENTE DEL GENERADOR'}],protocol_blocks:[{title:'Protocolo vigente',objective:'Objetivo vigente',steps:['Paso uno']}],evaluation_master:{criteria:[{name:'Puntualidad',desc:'Llegar a tiempo',weight:100}]}}},nomenclators:[{id:'n',category:'informacion_institucional',key:'mision',label:'Misión',value:'MISIÓN VIGENTE',applies_to_all_roles:true}],roles:[],expires_at:'2099-01-01T00:00:00Z'};
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 for(const width of [390,1440]){
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
 await page.route('http://isolated.test/**',r=>r.fulfill({body:'<meta name="viewport" content="width=device-width,initial-scale=1">',contentType:'text/html'}));await page.goto('http://isolated.test/');await page.addScriptTag({content:mock+functions});await page.evaluate(()=>openTrainingDocumentation('c'));
 const dialog=page.getByRole('dialog');assert.equal(await dialog.locator('[name=days]').inputValue(),'7');assert.equal(await dialog.locator('[name=salary]').inputValue(),'15000');assert.equal(await dialog.locator('[name=tutor]').inputValue(),'');
 await dialog.locator('[name=tutor]').fill('Tutor de prueba');await dialog.locator('[name=phone]').fill('5350000001');
 const prepare=dialog.getByRole('button',{name:'Preparar mensaje y enlaces'});await prepare.click();await page.locator('[data-preview]').waitFor();let message=await page.locator('[data-preview]>div').innerText();assert(message.startsWith('Perfecto, Daniel.'));assert(message.includes('\n\n📅'));assert(!message.includes('\\n'));assert(message.includes('Ademas en el siguiente enlace te agrupamos'));assert(message.includes('?documento=contenido#token='));assert(!/contrato|actualizar-expediente/i.test(message));assert.deepEqual(await page.evaluate(()=>calls),[{name:'hr_issue_training_content',args:{p_trial:'t'}}]);
 await dialog.getByRole('button',{name:'Abrir WhatsApp'}).click();assert.equal(await page.evaluate(()=>new URL(opened[0]).searchParams.get('text')),message);
 await dialog.locator('[name=tutor]').fill('Otro tutor');assert.equal(await page.locator('[data-preview]').count(),0);
 for(const scenario of ['fail','foreign','wrongrole']){await page.evaluate(s=>window.scenario=s,scenario);await prepare.click();await page.waitForFunction(()=>!document.querySelector('form button').disabled);assert.equal(await page.locator('[data-preview]').count(),0);assert(await page.locator('#trainingDocumentationError').innerText());}
 await page.evaluate(()=>window.scenario='slow');await prepare.click();await dialog.locator('[name=tutor]').fill('Cambio concurrente');await page.waitForFunction(()=>!document.querySelector('form button').disabled);assert.equal(await page.locator('[data-preview]').count(),0);
 // Custom options must pass the concurrency check after normalization.
 await page.evaluate(()=>window.scenario='ok');await dialog.locator('[name=workdays]').selectOption('__other__');await dialog.locator('[name=workdaysOther]').fill('Martes y jueves');await prepare.click();await page.locator('[data-preview]').waitFor();assert((await page.locator('[data-preview]').innerText()).includes('Martes y jueves'));assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 await context.close();console.log('PASS training form and WhatsApp, no attachments/contracts, errors, custom options, concurrent edits, '+width+'px');
 }
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true}),page=await context.newPage();let response=fixture,reads=0;const requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://gestion.elcartelstudio.com/**',async route=>{if(published)return route.continue();const p=new URL(route.request().url()).pathname;const file=path.join(root,decodeURIComponent(p));if(fs.existsSync(file)&&fs.statSync(file).isFile())await route.fulfill({path:file,contentType:p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':undefined});else await route.fulfill({status:404,body:''});});
 await page.route('https://jhumvctocphyiwhszeaz.supabase.co/**',route=>{requests.push(route.request().url());if(route.request().url().endsWith('/rpc/hr_read_training_content')){reads++;return route.fulfill({json:response,headers:{'Cache-Control':'no-store'}});}return route.fulfill({status:403,json:{message:'unexpected request'}});});
 await page.goto('https://gestion.elcartelstudio.com/plaza-ficha.html?documento=contenido#token='+'a'.repeat(64));await page.getByRole('button',{name:'Descargar PDF',exact:true}).waitFor();await page.waitForFunction(()=>!document.getElementById('trainingContentDownload').disabled);
 assert((await page.locator('#trainingPublicContent').innerText()).includes('CONTENIDO VIGENTE DEL GENERADOR'));assert((await page.locator('#trainingPublicContent').innerText()).includes('MISIÓN VIGENTE'));assert.equal(await page.locator('.wrap').isVisible(),false);assert(!requests.some(x=>/auth\/|hr_roles|hr_candidates/.test(x)));assert.equal(await page.evaluate(()=>Object.keys(localStorage).length),0);
 // Renderer parity with the editor, not an independently implemented summary.
 const parity=await page.evaluate(()=>{const box=document.createElement('div');box.style.width='1000px';document.body.append(box);buildDocumentationInformativePages('role_content',box);const text=box.innerText;box.remove();return text;});assert(parity.includes('CONTENIDO VIGENTE DEL GENERADOR'));

 // Stress the shared paginator without any real candidate or server mutations.
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});
  const result=await page.evaluate(()=>{
   const box=document.createElement('div');box.className='training-public-pdf-stage';document.body.append(box);
   const value=('Párrafo áéíóú con contenido largo y verificable. '.repeat(120)+'\n\n').repeat(12)+'FINAL SIN PÉRDIDA';
   const groups=[{title:'Prueba extensa',kind:'blocks',items:[['Bloque',value]]},{title:'Campos extensos',kind:'grouped_fields',groups:[{title:'Grupo',items:[['Campo',value]]}]}];
   buildDocumentationInformativePages('role_content',box,groups);
   const blocks=[...box.querySelectorAll('.doc-info-content')];
   const text=blocks.map(x=>x.textContent).join('');
   const fits=blocks.every(c=>!c.lastElementChild||c.lastElementChild.getBoundingClientRect().bottom<=c.closest('article').querySelector('footer').getBoundingClientRect().top-27);
   const normalize=t=>t.replace(/\s/g,'');
   const expected=normalize('Prueba extensaBloque'+value+'Campos extensosGrupoCampo'+value);
   const exact=normalize(text)===expected,pages=box.querySelectorAll('article.contract-paper-page').length;
   const warnings=roleContentWarnings();box.remove();
   return {fits,exact,pages,warnings};
  });
  assert(result.fits,JSON.stringify(result));assert(result.exact,'Text must be preserved exactly');assert(result.pages>10);
  console.log('PASS long paragraphs, grouped fields, exact text integrity and page bounds '+width+'px');
 }
 await page.setViewportSize({width:390,height:844});
 await page.waitForFunction(()=>!!window.jspdf?.jsPDF&&!!window.html2canvas,{},{timeout:45000});
 const download=page.waitForEvent('download',{timeout:120000});await page.getByRole('button',{name:'Descargar PDF',exact:true}).click();const file=await download;const dest=path.join(root,'tests','training-content-proof.pdf');await file.saveAs(dest);assert(fs.statSync(dest).size>15000);assert(fs.readFileSync(dest).subarray(0,5).toString()==='%PDF-');assert(reads>=2);assert.deepEqual(context.pages().filter(p=>p!==page).map(p=>p.url()).filter(url=>url!=='edge://downloads-hub/'),[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await page.locator('.contract-preview-toolbar').isVisible(),false);assert.deepEqual(errors,[]);
 await page.screenshot({path:path.join(root,'tests','training-content-mobile.png'),fullPage:false});
 await page.setViewportSize({width:1440,height:900});const desktopDownload=page.waitForEvent('download',{timeout:120000});await page.getByRole('button',{name:'Descargar PDF',exact:true}).click();assert((await desktopDownload).suggestedFilename().endsWith('.pdf'));assert.deepEqual(context.pages().filter(p=>p!==page).map(p=>p.url()).filter(url=>url!=='edge://downloads-hub/'),[]);
 response=null;await page.getByRole('button',{name:'Descargar PDF',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#trainingContentStatus').textContent.includes('vencido'));assert.equal(await page.locator('.contract-paper-page').count(),0);assert((await page.locator('[role=status]').innerText()).includes('vencido'));
 await page.goto('https://gestion.elcartelstudio.com/plaza-ficha.html?documento=contenido#token=bad');await page.getByText('El enlace no es válido.',{exact:false}).waitFor();assert.equal(await page.locator('.contract-paper-page').count(),0);
 await context.close();console.log('PASS public full page without login, shared live generator, actual PDF download, no admin reads/storage, revocation and invalid token');
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
