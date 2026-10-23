const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),vm=require('vm');
const {chromium}=require('C:/Users/julio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.join(__dirname,'..'),js=fs.readFileSync(root+'/assets/trial-closure.js','utf8');
new vm.Script(js);
for(const name of ['gestionar-cierre-prueba','actualizar-expediente','cierre-periodo-prueba','periodo-prueba']){const html=fs.readFileSync(root+'/'+name+'.html','utf8');for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))if(m[1].trim())new vm.Script(m[1]);}
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
for(const width of [390,1280]){
const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const links={document_url:'https://test/cierre#token='+'a'.repeat(64),form_url:'https://test/form#token='+'b'.repeat(64)};
await page.route('**/*',r=>{if(r.request().url().includes('trial-closure.js'))return r.fulfill({contentType:'text/javascript',body:js});return r.fulfill({contentType:'text/html',body:fs.readFileSync(root+'/gestionar-cierre-prueba.html','utf8').replace(/<script src="\/assets\/(vendor\/supabase[^" ]*|loading-runtime.js)"><\/script>/g,'')});});
await page.addInitScript(links=>{window.open=(...args)=>{window.opened=args};window.alert=()=>{};const t={id:'synthetic',hr_candidates:{full_name:'Persona Prueba',whatsapp:'5355555555'}},c={trial_id:'synthetic',data:{},expires_at:'2026-12-31',created_at:'2026-10-23'};window.CartelLoad={createClient:()=>({rpc:async(n,a)=>{window.lastRpc={n,a};return {data:null}},from:n=>{const q={select:()=>q,eq:()=>q,single:async()=>({data:t}),maybeSingle:async()=>({data:c}),order:async()=>({data:[{action:'closure_prepared',payload:links,created_at:'2026-10-23'}]})};return q}})}},links);
await page.goto('https://test/gestionar-cierre-prueba.html?trial=synthetic');await page.locator('#edit').click();let message=await page.locator('#message').inputValue();assert(message.includes('prueba:\n'+links.document_url));assert(message.includes('identidad:\n'+links.form_url));await page.locator('#message').fill(message+'\nEdición individual');await page.locator('#send').click();assert((await page.evaluate(()=>window.lastRpc.a.p_payload.message)).endsWith('Edición individual'));assert((await page.evaluate(()=>window.opened[0])).startsWith('https://wa.me/'));assert(!await page.evaluate(()=>closureTemplate.includes('Edición individual')));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
await page.close();
}
const live=await browser.newPage();
for(const name of ['actualizar-expediente','cierre-periodo-prueba']){
 await live.goto('https://gestion.elcartelstudio.com/'+name+'.html#token='+'f'.repeat(64));
 await live.getByText('Enlace no válido, caducado o revocado.',{exact:false}).waitFor();
 assert.equal(await live.locator('form').count(),0);
}
await live.close();await browser.close();console.log('PASS: syntax, responsive editor, inline links, individual edit, unchanged template, WhatsApp handoff; published form/document reject invalid links');})().catch(e=>{console.error(e);process.exitCode=1});
