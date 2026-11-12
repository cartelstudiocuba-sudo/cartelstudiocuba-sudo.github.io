const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),vm=require('vm');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.argv[2]||path.join(__dirname,'..'),base=process.env.HIRING_BASE||root;
const output=process.env.HIRING_OUTPUT_DIR||path.join(require('os').tmpdir(),'hiring-submission-tests');fs.mkdirSync(output,{recursive:true});
for(const file of ['assets/hiring.js','assets/hiring-submission.js'])new vm.Script(fs.readFileSync(path.join(root,file),'utf8'));
// The transport reports only browser byte events, including non-computable totals.
{
 let xhr;class FakeXHR{constructor(){xhr=this;this.upload={};}open(){}setRequestHeader(){}send(){}getAllResponseHeaders(){return 'Content-Type: application/json';}}
 const context=vm.createContext({XMLHttpRequest:FakeXHR,Request,Headers,Response});vm.runInContext(fs.readFileSync(path.join(root,'assets/hiring-submission.js'),'utf8'),context);const seen=[];context.update=n=>seen.push(n);const promise=vm.runInContext("hiringProgressFetch(update)('https://test.local',{method:'POST',body:'data'})",context);
 xhr.upload.onprogress({lengthComputable:true,loaded:25,total:100});xhr.upload.onprogress({lengthComputable:false});xhr.upload.onload();assert.deepEqual(seen,[.25,null,1]);xhr.status=200;xhr.response=Buffer.from('1');xhr.onload();promise.then(r=>assert.equal(r.status,200));
}
const fields={full_name:'Persona simulada',identity_number:'99010112345',birth_date:'1999-01-01',nationality:'Cubana',province:'La Habana',municipality:'Plaza de la Revolución',address:'Calle simulada 123',mobile:'5355555555',fixed_phone:'',email:'prueba@example.com',alternative_address:'',emergency_name:'Contacto simulado',emergency_relation:'Hermana',emergency_phone:'5355555556',education_level:'Universitario',civil_status:'',has_children:'',care_responsibilities:'',planned_absence:''};
(async()=>{
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[];
// Real local HTTP transfer, without interception: browser upload reaches 100%
// before the deliberately delayed server acknowledgement resolves the promise.
const http=require('http');const server=http.createServer((req,res)=>{if(req.method==='POST'){req.resume();req.on('end',()=>setTimeout(()=>res.end('1'),500));}else res.end('<html></html>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const transportPage=await browser.newPage();await transportPage.goto('http://127.0.0.1:'+server.address().port);await transportPage.addScriptTag({path:path.join(root,'assets/hiring-submission.js')});
const transport=await transportPage.evaluate(async()=>{let resolved=false;const events=[];const r=await hiringProgressFetch(f=>events.push({fraction:f,resolved}))('/upload',{method:'POST',body:new Blob([new Uint8Array(2000000)])});resolved=true;return {events,status:r.status};});assert.equal(transport.status,200);assert(transport.events.some(e=>e.fraction===1&&!e.resolved));await transportPage.close();await new Promise(r=>server.close(r));console.log('PASS real HTTP progress before acknowledgement');
for(const width of [320,390,1440])for(const scenario of (process.env.SCENARIOS||'success,upload-lost,submit-lost,upload-reject,submit-reject,conflict,locked,invalid').split(',')){
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.waitingStates=[];new MutationObserver(()=>{const s=document.getElementById('hiringSendStatus'),b=document.getElementById('hiringSendFinish');if(s?.textContent.includes('100 %'))window.waitingStates.push(b.disabled);}).observe(document,{subtree:true,childList:true,characterData:true});});
 let state={trial_id:'synthetic',data:{...fields},revision:0,front:true,back:true,portrait:scenario!=='success',locked:scenario==='locked',submitted:false,role_title:'Plaza simulada'},attempts=0,submits=0,uploads=0,readCount=0,failed=false;const blobs={};
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.hostname==='jhumvctocphyiwhszeaz.supabase.co'){
   const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST,GET,OPTIONS'};
   if(req.method()==='OPTIONS')return route.fulfill({status:200,headers:cors});
   const reply=(body,status=200)=>route.fulfill({status,headers:cors,contentType:'application/json',body:JSON.stringify(body)});
   if(u.pathname.endsWith('/hr_read_hiring')){readCount++;if(scenario==='conflict'&&readCount>1)state.revision=10;return reply(state);}
   if(u.pathname.endsWith('/hr_submit_hiring')){
    attempts++;const a=req.postDataJSON();assert.equal(a.p_token,'a'.repeat(64));assert.equal(a.p_revision,state.revision);
    if(scenario==='submit-reject'&&!failed){failed=true;return reply({message:'Error simulado de validación'},400);}
    state.revision++;submits++;state.submitted=true;state.data=Object.fromEntries(Object.keys(fields).map(k=>[k,a.p_data[k]]));
    await new Promise(r=>setTimeout(r,350));
    if(scenario==='submit-lost'&&!failed){failed=true;return route.abort('connectionreset');}return reply(state.revision);
   }
   if(u.pathname.includes('/storage/v1/object/')){
    const key=u.pathname.split('/').at(-1);assert.equal(req.headers()['x-hiring-token'],'a'.repeat(64));
    if(req.method()==='GET')return route.fulfill({status:200,headers:cors,contentType:'image/jpeg',body:blobs[key]});
    assert.equal(req.headers()['x-hiring-revision'],String(state.revision));
    if(scenario==='upload-reject'&&!failed){failed=true;return reply({message:'Error simulado de subida'},400);}
    const body=req.postDataBuffer(),boundary=req.headers()['content-type'].split('boundary=')[1],marker=Buffer.from('Content-Type: image/jpeg\r\n\r\n');let pos=body.indexOf(marker);assert(pos>=0);pos+=marker.length;blobs[key]=body.subarray(pos,body.indexOf(Buffer.from('\r\n--'+boundary),pos));
    uploads++;state.revision++;state[key]=true;state.submitted=false;await new Promise(r=>setTimeout(r,250));
    if(scenario==='upload-lost'&&!failed){failed=true;return route.abort('connectionreset');}return reply({Key:'hr-hiring-private/synthetic/'+key});
   }
   throw Error('Unexpected remote request '+u.pathname);
  }
  assert.equal(u.hostname,'test.local','External request blocked');
  if(u.pathname==='/other.html')return route.fulfill({body:'<a href="/expediente-contratacion.html#token='+ 'a'.repeat(64)+'">Abrir enlace autorizado</a>'});
  const file=u.pathname.slice(1),local=path.join(root,file),fallback=path.join(base,file);const p=fs.existsSync(local)?local:fallback;
  return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':'text/html',body:fs.existsSync(p)?fs.readFileSync(p):''});
 });
 await page.goto('https://test.local/expediente-contratacion.html#token='+(scenario==='invalid'?'bad':'a'.repeat(64)));
 if(scenario==='locked'||scenario==='invalid'){await page.getByText(scenario==='locked'?'Tu expediente está validado.':'Enlace no válido,',{exact:false}).waitFor();assert.equal(await page.locator('form').count(),0);}
 else {
  await page.locator('[name=full_name]').waitFor();await page.locator('[name=full_name]').fill('Persona corregida');await page.getByRole('button',{name:'Siguiente',exact:true}).click();
  await page.locator('[name=email]').fill('');await page.getByRole('button',{name:'Siguiente',exact:true}).click();assert.equal(await page.locator('[name=email]').isVisible(),true);await page.locator('[name=email]').fill(fields.email);await page.getByRole('button',{name:'Siguiente',exact:true}).click();
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=2400;c.height=1400;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='90px sans-serif';x.fillText('DOCUMENTO SIMULADO',50,300);return c.toDataURL('image/png').split(',')[1]});
  for(const key of ['front','back','portrait']){await page.locator('[name='+key+']').setInputFiles({name:'simulado.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.locator('[name='+key+']').locator('..').locator('img').waitFor({state:'visible'});}
  await page.getByRole('button',{name:'Siguiente',exact:true}).click();await page.locator('[name=truth_confirmed]').check();
  await page.evaluate(()=>{document.getElementById('hiringForm').requestSubmit();document.getElementById('hiringForm').requestSubmit();});await page.locator('[role=dialog]').waitFor();assert(await page.locator('#hiringSendFinish').isDisabled());assert(await page.locator('#hiring').evaluate(e=>e.inert));
  if(scenario==='conflict'){await page.getByText('No se ha confirmado el envío',{exact:true}).waitFor();assert.equal(uploads,0);assert.equal(submits,0);assert(await page.locator('#hiringSendFinish').isDisabled());}
  else {
   if(scenario!=='success'){try{await page.locator('#hiringSendRetry').waitFor({state:'visible',timeout:10000});}catch(e){console.log({scenario,uploads,submits,failed,errors,text:await page.locator('[role=dialog]').innerText()});throw e;}assert(await page.locator('#hiringSendFinish').isDisabled());assert.equal(await page.locator('[name=full_name]').inputValue(),'Persona corregida');await page.locator('#hiringSendRetry').click();}
   await page.getByText('Expediente enviado correctamente',{exact:true}).waitFor();assert.equal(submits,1);assert.equal(uploads,3);assert.equal(state.data.full_name,'Persona corregida');assert.equal(await page.locator('#hiringSendFinish').isEnabled(),true);assert.equal(new URL(page.url()).hash,'');
   assert(await page.locator('.hiring-send-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth));
   if(scenario==='success')await page.screenshot({path:path.join(output,'success-'+width+'.png'),fullPage:false});
   await page.locator('#hiringSendFinish').click();await page.getByRole('heading',{name:'Proceso completado. Ya puedes cerrar esta ventana'}).waitFor();assert.equal(await page.locator('form').count(),0);
   await page.reload();assert.equal(await page.locator('form').count(),0);
   await page.goto('https://test.local/other.html');await page.goBack();await page.getByRole('heading',{name:'Proceso completado. Ya puedes cerrar esta ventana'}).waitFor();assert.equal(await page.locator('form').count(),0);
   await page.goto('https://test.local/other.html');await page.getByRole('link').click();await page.locator('form').waitFor();assert.equal(await page.locator('[name=full_name]').inputValue(),'Persona corregida');
  }
 }
 assert.deepEqual(errors,[]);results.push({width,scenario,uploads,submits,attempts});console.log('PASS',width,scenario);await context.close();
}
await browser.close();fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1)});

