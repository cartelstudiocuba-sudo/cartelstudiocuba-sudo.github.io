const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const runtime=fs.readFileSync(process.env.SESSION_RUNTIME||path.join(__dirname,'../assets/loading-runtime.js'),'utf8');
(async()=>{const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});let cases=0;
try{for(const width of [320,390,1440])for(const [url,publicView] of [
 ['/plaza-ficha.html?documento=contenido#token='+'a'.repeat(64),true],
 ['/plaza-ficha.html?documento=presentacion#token=invalid',true],
 ['/plaza-ficha.html?documento=contenido',true],
 ['/plaza-ficha.html?id=role',false],
 ['/plaza-ficha.html?documento=other',false],
 ['/rrhh.html?documento=contenido',false],
 ['/usuarios-permisos.html?documento=presentacion',false]
]){const ctx=await browser.newContext({viewport:{width,height:900}});let networkWrites=0;
await ctx.route('**/*',r=>{if(r.request().method()!=='GET'){networkWrites++;return r.abort();}return r.fulfill({contentType:'text/html',body:new URL(r.request().url()).pathname==='/rrhh-login.html'?'<p>Acceso</p>':'<main>Vista sintética</main>'});});
const page=await ctx.newPage();await page.goto('https://capability.test'+url);await page.addScriptTag({content:runtime});
await page.evaluate(()=>{window.authReads=0;window.authEvents=0;window.supabase={createClient:()=>({auth:{getSession:async()=>{authReads++;return {data:{session:null}}},onAuthStateChange:()=>{authEvents++;return {data:{subscription:{unsubscribe(){}}}}}}})};CartelLoad.createClient('https://unused.invalid','synthetic');});
if(publicView){await page.evaluate(()=>{dispatchEvent(new Event('pageshow'));document.dispatchEvent(new Event('visibilitychange'));});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(new URL(page.url()).pathname,'/plaza-ficha.html','public document must not redirect to login');assert.equal(await page.evaluate(()=>authReads),0);assert.equal(await page.evaluate(()=>authEvents),0);assert.equal(await page.locator('#cartel-account').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.hasAttribute('data-session-pending')),false);}
else await page.waitForURL('**/rrhh-login.html?**');
assert.equal(networkWrites,0);cases++;await ctx.close();}
console.log(JSON.stringify({passed:true,cases,widths:[320,390,1440],publicTokenValidation:'remains in document RPC; no editor session bypass',realWrites:0}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
