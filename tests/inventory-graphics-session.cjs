'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
// Use the actual shared runtime and Supabase SDK: getUser errors are wrapped by the runtime.
await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='https://session.test')return route.abort();if(u.pathname==='/rrhh-login.html')return route.fulfill({contentType:'text/html',body:'<form id="loginForm">Acceso</form>'});const file=path.join(root,u.pathname.slice(1));if(!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(file)});});
await page.goto('https://session.test/consulta-insumos-grafica.html');await page.waitForURL('**/rrhh-login.html?next=**',{timeout:15000});assert.equal(new URL(page.url()).searchParams.get('next'),'/consulta-insumos-grafica.html');assert.equal(await page.locator('#loginForm').count(),1);assert.deepEqual(errors,[]);console.log('PASS real shared runtime + SDK: absent session redirects to login with consultation destination');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
