const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const runtime=fs.readFileSync(path.join(__dirname,'../assets/loading-runtime.js'),'utf8');
(async()=>{const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});try{
 for(const mode of ['event','restore','late']){
  const ctx=await browser.newContext();const page=await ctx.newPage();let logouts=0;
  await ctx.route('**/*',r=>{const p=new URL(r.request().url()).pathname;if(r.request().method()!=='GET'){logouts++;return r.abort();}return r.fulfill({contentType:'text/html',body:p==='/rrhh-login.html'?'<p>Acceso</p>':'<main id="private">Synthetic private view</main>'});});
  await page.goto('https://session.test/usuarios-permisos.html');await page.addScriptTag({content:runtime});
  await page.evaluate(()=>{window.current={user:{id:'synthetic-A',email:'a@example.invalid'}};window.signouts=0;window.supabase={createClient:()=>({auth:{getSession:()=>window.pending?new Promise(resolve=>window.resolvePending=resolve):Promise.resolve({data:{session:current},error:null}),onAuthStateChange:cb=>window.authChange=cb,signOut:()=>{window.signouts++;return Promise.resolve({error:null});}}})};CartelLoad.createClient('https://unused.invalid','synthetic');});
  await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-session-pending'));
  await page.evaluate(()=>authChange('TOKEN_REFRESHED',current));assert.equal(await page.locator('#private').count(),1);
  if(mode==='late')await page.evaluate(()=>{window.pending=true;dispatchEvent(new Event('pageshow'));});
  if(mode==='restore')await page.evaluate(()=>{window.current={user:{id:'synthetic-B'}};dispatchEvent(new Event('pageshow'));});
  else await page.evaluate(mode=>{authChange('SIGNED_IN',{user:{id:'synthetic-B'}});if(mode==='late')resolvePending({data:{session:current},error:null});},mode);
  await page.waitForURL('**/rrhh-login.html?**');assert.equal(await page.locator('#private').count(),0);assert.equal(logouts,0);await ctx.close();console.log(mode,'passed');
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
