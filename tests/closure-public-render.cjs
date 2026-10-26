const fs=require('fs'),assert=require('node:assert/strict'),vm=require('vm');
const {chromium}=require('C:/Users/julio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('path'),root=path.join(__dirname,'..');
const js=fs.readFileSync(root+'/assets/trial-closure.js','utf8');new vm.Script(js);
const document=JSON.parse(fs.readFileSync(__dirname+'/fixtures/closure-public.json','utf8'));
document.full_name='CANDIDATO NO DEBE MOSTRARSE';
document.representative={name:'Representante Sintético',ci:'11111111111',position:'Dirección',address:'Sede de prueba',start_date:'2026-10-01',end_date:'2026-10-25',observations:'Observación $& <prueba>\nSegunda línea'};
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const url=route.request().url();if(url.includes('trial-closure.js'))return route.fulfill({contentType:'text/javascript',body:js});if(url.includes('.svg'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg"/>'});return route.fulfill({contentType:'text/html',body:fs.readFileSync(root+'/cierre-periodo-prueba.html','utf8').replace(/<script src="\/assets\/(vendor\/supabase[^" ]*|loading-runtime.js)"><\/script>/g,'')});});
 await page.addInitScript(doc=>{window.CartelLoad={createClient:()=>({rpc:async()=>({data:doc}),storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'https://test/logo.svg'}})})}})}},document);
 await page.goto('https://test/cierre-periodo-prueba.html#token='+'a'.repeat(64));await page.locator('#actDocument').waitFor();
 const text=await page.locator('#actDocument').innerText();assert(!text.includes('CANDIDATO NO DEBE'));assert(!text.includes('Cantidad |'));assert(text.includes('Cualquier incidencia'));assert(text.toUpperCase().includes('QUINTA – DEVOLUCIÓN'));assert(text.toUpperCase().includes('OCTAVA – ASUNTOS'));assert(text.includes('01 / 10 / 2026'));assert(text.includes('25 / 10 / 2026'));assert(text.includes('Observación $& <prueba>'));assert.equal(text.split('Representante Sintético').length-1,2);assert(text.includes('Se emiten las copias'));assert.equal(await page.locator('#actDocument script').count(),0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 await page.screenshot({path:root+'/tests/closure-public-'+width+'.png',fullPage:true});await page.close();
}
await browser.close();console.log('PASS: public closure on mobile/desktop, representative twice, candidate blank, dates, observations, no table, clauses preserved, logo and escaping');})().catch(e=>{console.error(e);process.exitCode=1});

