const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.join(__dirname,'..'),out=path.join(root,'test-results','logout');fs.mkdirSync(out,{recursive:true});
const origin='https://gestion.test',key='sb-jhumvctocphyiwhszeaz-auth-token';
const user={id:'10000000-0000-4000-8000-000000000001',email:'synthetic@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
const jwt=[{alg:'HS256',typ:'JWT'},{sub:user.id,exp:4102444800,role:'authenticated'},'synthetic'].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
const session={access_token:jwt,refresh_token:'synthetic-refresh',expires_at:4102444800,expires_in:3600,token_type:'bearer',user};
const harness=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="/assets/vendor/supabase-2.117.3.min.js"></script><script src="/assets/loading-runtime.js"></script></head><body><h1>Ficha sintética</h1><input value="Dato sin guardar"><button onclick="window.legacy=true">Salir</button><script>window.client=CartelLoad.createClient('https://jhumvctocphyiwhszeaz.supabase.co','synthetic-key');</script></body></html>`;
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];try{
for(const width of [390,1440])for(const account of ['propietario','cartelstudiocubasecundaria']){
const ctx=await browser.newContext({viewport:{width,height:900}});let logouts=0,writes=0,failLogout=false;
await ctx.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.hostname.endsWith('supabase.co')){
 if(url.pathname==='/auth/v1/logout'){logouts++;assert.equal(url.searchParams.get('scope'),'local');return route.fulfill({status:failLogout?500:204,body:failLogout?'{}':''});}
 if(!['GET','HEAD'].includes(req.method()))writes++;
 if(url.pathname==='/auth/v1/user')return route.fulfill({json:user});
 if(url.pathname.includes('system_has_permission'))return route.fulfill({json:true});
 return route.fulfill({json:[]});
}if(url.origin!==origin)return route.abort();
if(url.pathname==='/rrhh-login.html')return route.fulfill({contentType:'text/html',body:'<h1>Login sintético</h1>'});
if(url.pathname==='/dashboard.html'&&!url.searchParams.has('actual'))return route.fulfill({contentType:'text/html',body:harness});
const file=path.join(root,url.pathname.slice(1));if(!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html',body:fs.readFileSync(file)});
});
const page=await ctx.newPage();await page.goto(origin+'/rrhh-login.html');await page.evaluate(({key,session,account})=>{session.user.user_metadata={username:account};localStorage.setItem(key,JSON.stringify(session));localStorage.setItem('user-preference','preserve');sessionStorage.setItem('draft','preserve');},{key,session,account});
await page.goto(origin+'/dashboard.html');const button=page.getByRole('button',{name:'Cerrar sesión',exact:true});await button.waitFor();await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-session-pending'));
assert(await button.isVisible());const box=await button.boundingBox();assert(box.width>=44&&box.height>=44&&box.x>=0&&box.x+box.width<=width);
await button.focus();assert(await button.evaluate(n=>n===document.activeElement));await page.screenshot({path:path.join(out,`${account}-${width}.png`)});
page.once('dialog',d=>d.dismiss());await button.click();assert.equal(logouts,0);assert(await page.evaluate(key=>!!localStorage.getItem(key),key));
await page.evaluate(()=>{CartelLoad.setReadOnly(true);window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-session-pending'));page.once('dialog',d=>d.accept());await button.focus();await page.keyboard.press('Enter');await page.waitForURL('**/rrhh-login.html?**');assert.equal(logouts,1);assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),null);assert.equal(await page.evaluate(()=>localStorage.getItem('user-preference')),'preserve');assert.equal(await page.evaluate(()=>sessionStorage.getItem('draft')),'preserve');
await page.goBack();await page.waitForURL('**/rrhh-login.html*');assert.equal(await page.getByText('Ficha sintética').count(),0);
// Direct return to protected page without a session must redirect before revealing it.
await page.goto(origin+'/dashboard.html');await page.waitForURL('**/rrhh-login.html?**');
// Even when server revocation fails, the installed SDK removes its local session.
await page.evaluate(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key,session});await page.goto(origin+'/dashboard.html');await button.waitFor();failLogout=true;page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Salir',exact:true}).click();await page.waitForURL('**/rrhh-login.html?**logout=local-only');assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),null);
assert.equal(writes,0);results.push({width,account,logoutRequests:logouts,cancel:true,readonly:true,keyboard:true,bfcacheEvent:true,serverError:true,legacyExit:true,back:true,directAccess:true,preservedData:true});await ctx.close();
}
// Real dashboard markup, including profile-hidden mobile layout, and cross-tab sign-out.
const ctx=await browser.newContext({viewport:{width:390,height:900}});let logoutRequests=0;
await ctx.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname.endsWith('supabase.co')){if(u.pathname==='/auth/v1/logout'){logoutRequests++;return r.fulfill({status:204,body:''});}if(u.pathname.includes('system_has_permission'))return r.fulfill({json:true});if(u.pathname==='/auth/v1/user')return r.fulfill({json:user});return r.fulfill({json:[]});}if(u.origin!==origin)return r.abort();if(u.pathname==='/rrhh-login.html')return r.fulfill({contentType:'text/html',body:'<h1>Login sintético</h1>'});const f=path.join(root,u.pathname.slice(1));return r.fulfill({contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.svg')?'image/svg+xml':'text/html',body:fs.existsSync(f)?fs.readFileSync(f):''});});
const p=await ctx.newPage();await p.goto(origin+'/rrhh-login.html');await p.evaluate(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key,session});
await p.goto(origin+'/dashboard.html?actual=1');await p.waitForFunction(()=>!document.documentElement.hasAttribute('data-session-pending'));await p.getByRole('button',{name:'Cerrar sesión',exact:true}).waitFor();await p.screenshot({path:path.join(out,'dashboard-mobile.png'),fullPage:true});
await p.setViewportSize({width:1440,height:900});await p.screenshot({path:path.join(out,'dashboard-desktop.png'),fullPage:true});
const second=await ctx.newPage();await second.goto(origin+'/dashboard.html?actual=2');await second.waitForFunction(()=>!document.documentElement.hasAttribute('data-session-pending'));
p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await p.waitForURL('**/rrhh-login.html?**');await second.waitForURL('**/rrhh-login.html?**');assert.equal(logoutRequests,1);results.push({actualDashboard:true,mobile:true,desktop:true,crossTab:true});
for(const file of ['dashboard.html','rrhh.html','rrhh-20261101.html','recursos-humanos.html','usuarios-permisos.html','inventario-insumos.html','contratacion.html','contratados.html','cv-admin.html','entrevistas.html','nomencladores.html','plazas.html','plaza-ficha.html','trabajador-ficha.html','bajas.html','gestionar-cierre-prueba.html']){console.log('Checking protected route',file);await p.goto(origin+'/'+file);await p.waitForURL('**/rrhh-login.html?**',{timeout:15000});results.push({protectedRoute:file,unauthenticatedRedirect:true});}
await p.goto(origin+'/activar-cuenta.html');assert.equal(await p.locator('#cartel-sign-out').count(),0);assert.equal(await p.evaluate(()=>document.documentElement.hasAttribute('data-session-pending')),false);results.push({publicActivationUnchanged:true});await ctx.close();
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});




