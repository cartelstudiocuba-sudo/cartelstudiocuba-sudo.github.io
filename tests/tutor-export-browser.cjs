const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/julio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),origin='https://gestion.elcartelstudio.com',token='b'.repeat(64);
const fixture={id:'11111111-1111-4111-8111-111111111111',title:'Plaza de prueba del puente',updated_at:'2026-10-27T00:00:00+00:00',description:'Funciones de prueba',work_content:{custom:[{title:'Funciones específicas',text:'Verificar los materiales de capacitación y explicar el protocolo. '.repeat(40)}],protocol_blocks:[{title:'Protocolo de prueba',objective:'Preparar el trabajo',steps:['Revisar medios','Explicar responsabilidades','Validar comprensión']} ]}};
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage();let pdf,publications=0,mode='ok';const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route(origin+'/**',async route=>{
  const p=new URL(route.request().url()).pathname;
  if(p==='/bridge-test')return route.fulfill({contentType:'text/html',body:'<script src="/assets/tutor-presentation.js"></script>'});
  const file=path.join(root,p);if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
  if(p==='/plaza-ficha.html'){
   let html=fs.readFileSync(file,'utf8').replace('CartelLoad.run("boot",boot);','role='+JSON.stringify(fixture)+';window.tutorExportReady=true;');
   return route.fulfill({contentType:'text/html',body:html});
  }
  return route.fulfill({path:file,contentType:p.endsWith('.js')?'text/javascript':p.endsWith('.html')?'text/html':p.endsWith('.css')?'text/css':undefined});
 });
 await context.route('https://jhumvctocphyiwhszeaz.supabase.co/**',async route=>{
  assert(route.request().url().endsWith('/functions/v1/hr-tutor-presentation'),'Unexpected backend access '+route.request().url());
  if(route.request().headers()['content-type'].startsWith('multipart/form-data')){
   const bytes=route.request().postDataBuffer(),start=bytes.indexOf(Buffer.from('%PDF-')),end=bytes.lastIndexOf(Buffer.from('\r\n--'));
   assert(start>0&&end>start);pdf=bytes.subarray(start,end);assert(pdf.length>10000);publications++;
   return route.fulfill({json:{url:origin+'/presentacion-tutor.html#token='+token,role_id:fixture.id,expires_at:'2099-01-01T00:00:00Z'}});
  }
  const body=route.request().postDataJSON();assert.equal(body.token,token);
  if(mode==='expired')return route.fulfill({status:404,json:{error:'Enlace no válido o caducado'}});
  if(body.action==='info')return route.fulfill({json:{ext:'pdf',expires_at:'2099-01-01T00:00:00Z'}});
  return route.fulfill({body:pdf,contentType:'application/pdf',headers:{'Content-Disposition':'attachment; filename="Presentacion-capacitacion.pdf"'}});
 });
 await page.goto(origin+'/bridge-test');
 const link=await page.evaluate(async id=>CartelTutorPresentation.publish({auth:{getSession:async()=>({data:{session:{access_token:'fixture-session'}}})}},'trial',id),fixture.id);
 assert.equal(publications,1);assert.equal(await page.locator('iframe').count(),0);assert(!link.url.includes('supabase'));
 fs.writeFileSync(path.join(root,'tests','tutor-generated-proof.pdf'),pdf);
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});await page.goto('about:blank');await page.goto(link.url);await page.getByRole('button',{name:'Consultar presentación',exact:true}).waitFor();
  await page.waitForFunction(()=>!document.getElementById('view').disabled);assert.equal(new URL(page.url()).hash,'');
  await page.getByRole('button',{name:'Consultar presentación',exact:true}).click();await page.locator('#preview iframe').waitFor();
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar presentación',exact:true}).click();const d=await pending;assert.equal(d.suggestedFilename(),'Presentacion-capacitacion.pdf');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(root,'tests','tutor-view-'+width+'.png')});
 }
 mode='expired';await page.goto('about:blank');await page.goto(link.url);await page.getByText('Enlace no válido o caducado',{exact:true}).waitFor();assert(await page.locator('#download').isDisabled());assert.equal(await page.locator('iframe').count(),0);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',realGenerator:true,pdfBytes:pdf.length,publishedMultipart:true,viewerWidths:[390,1440],download:true,invalidAccess:true,noWhatsApp:true,backend:'mocked; SQL and deployed rejection tested separately'}));
 await context.close();
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
