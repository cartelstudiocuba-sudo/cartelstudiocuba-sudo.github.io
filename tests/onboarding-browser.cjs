const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
for(const f of ['assets/hiring.js','assets/onboarding.js','assets/role-templates.js','assets/account-activation.js'])new vm.Script(read(f));
for(const f of ['rrhh.html','rrhh-20261101.html','usuarios-permisos.html','activar-cuenta.html','reset-password.html'])for(const m of read(f).matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))if(m[1].trim())new vm.Script(m[1]);
const candidate='20000000-0000-4000-8000-000000000001',role='30000000-0000-4000-8000-000000000001',token='c'.repeat(64);
const outputs=path.join(root,'test-results');fs.mkdirSync(outputs,{recursive:true});
(async()=>{
 const browser=await chromium.launch({...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:process.platform==='win32'?{channel:'msedge'}:{}),headless:true});
 try{for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];let blocked=0,opens=[],failOpen=false,failConfig=false,ready=false,updates=0,completed=0,applied=0;
  let state={candidate_id:candidate,labor_status:'hired',employee_id:'employee',username:'persona.simulada',email:'persona@example.invalid',configured_at:null,created_at:null,document_verified:null,contract_signed:null,role_id:null};
  let template={revision:1,can_read:true,can_write:false,views:[{code:'inventory_admin',is_default:true}]};
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('**/*',async r=>{const u=new URL(r.request().url());if(u.origin!=='https://test.local'){blocked++;return r.abort();}if(u.pathname==='/harness.html')return r.fulfill({contentType:'text/html; charset=utf-8',body:'<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><button id="launch" onclick="openSystemOnboarding(\''+candidate+'\')">Configurar acceso</button><script src="/assets/hiring.js"></script><script src="/assets/onboarding.js"></script></body></html>'});const file=path.join(root,u.pathname.slice(1));return r.fulfill({contentType:(file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html')+'; charset=utf-8',body:fs.readFileSync(file)});});
  await page.route('**/assets/loading-runtime.js*',r=>r.fulfill({contentType:'text/javascript',body:''}));
  await page.exposeFunction('fakeRpc',async(n,a)=>{
   if(n==='system_role_template'){if(a.p_action==='save')template={...a.p_payload,revision:template.revision+1};return {data:template};}
   if(n==='system_list_users')return {data:[{id:'existing-auth',employee_id:'employee',username:'persona.simulada',email:state.email,full_name:'Persona Simulada',confirmed:true,enabled:true,position_linked:true,roles:[{code:'gestor',title:'Gestor Comercial de Gráfica'}]}]};
   if(n==='system_owner_employee_views')return {data:[{code:'__template__',template_revision:1,can_read:true,can_write:false},{code:'inventory_admin',enabled:true,is_default:true}]};
   if(n==='system_apply_role_template'){applied++;return {data:null};}
   if(n==='system_onboarding_activation_ready')return {data:ready};
   if(n==='system_activate_onboarding'){completed++;return {data:null};}
   assert.equal(n,'system_onboarding');
   if(a.p_action==='configure'){if(failConfig)return {error:{message:'Usuario ya registrado'}};state={...state,...a.p_payload,configured_at:'now'};}
   if(a.p_action==='message')state.message=a.p_payload.message;
   if(a.p_action==='opened'){if(failOpen)return {error:{message:'Guardado interrumpido'}};state.whatsapp_opened_at='now';}
   return {data:structuredClone(state)};
  });
  await page.exposeFunction('fakeEdge',async(action)=>{if(action==='activation_email')return {data:{message:'Revisa tu correo registrado.'}};if(action==='provision')state.created_at='now';state.expires_at=new Date(Date.now()+86400000).toISOString();return {data:{activation_url:'https://gestion.elcartelstudio.com/activar-cuenta.html#activation='+token,expires_at:state.expires_at}};});
  await page.exposeFunction('fakePassword',async()=>{updates++;return {error:null};});
  await page.addInitScript(({candidate,role})=>{
   window.blockPopup=false;window.opened=[];window.open=(url)=>{if(window.blockPopup)return null;const tab={opener:{},location:{replace:url=>window.opened.push(url)},close(){}};return tab;};
   window.candidates=[{id:candidate,full_name:'Persona Simulada',status:'hired'}];window.candidatePhone=()=> '5355555555';
   const client={rpc:(n,a)=>window.fakeRpc(n,a),functions:{invoke:async(n,a)=>window.fakeEdge(a.body.action)},from:table=>{const result=()=>({data:table==='system_role_module_permissions'?[{access_role_id:role,module_code:'inventario_insumos',can_read:true,can_write:false}]:[{id:role,code:'gestor',title:'Gestor Comercial de Gráfica',is_active:true}]});return {select(){return this;},eq(){return this;},order:async()=>result(),then:(a,b)=>Promise.resolve(result()).then(a,b)};},auth:{getSession:async()=>({data:{session:{}}}),getUser:async()=>({data:{user:{id:'simulated'}}}),updateUser:()=>window.fakePassword()}};
   window.sb=client;window.CartelLoad={createClient:()=>client,run:(_,fn)=>fn()};
  },{candidate,role});
  await page.goto('https://test.local/harness.html');await page.getByRole('button',{name:'Configurar acceso',exact:true}).click();
  await page.locator('#onboardingUsername').waitFor();assert.equal(await page.locator('ol li').count(),3);assert.equal(await page.getByRole('button',{name:'2 · Crear cuenta y preparar notificación',exact:true}).isEnabled(),false);
  await page.locator('#onboardingRole').selectOption(role);await page.getByText('Plantilla versión 1',{exact:false}).waitFor();
  failConfig=true;await page.getByRole('button',{name:'Guardar configuración',exact:true}).click();await page.getByText('Usuario ya registrado',{exact:false}).waitFor();assert.equal(state.configured_at,null);failConfig=false;
  await page.getByRole('button',{name:'Guardar configuración',exact:true}).click();await page.getByRole('button',{name:'2 · Crear cuenta y preparar notificación',exact:true}).waitFor();assert(state.configured_at);
  await page.reload();await page.getByRole('button',{name:'Configurar acceso',exact:true}).click();await page.getByRole('button',{name:'2 · Crear cuenta y preparar notificación',exact:true}).click();
  const editor=page.getByRole('textbox',{name:'Mensaje de acceso para WhatsApp (editable)'});await editor.waitFor();
  assert.equal(await page.locator('ol li').count(),3);assert(await page.getByRole('link',{name:'Gestionar acceso',exact:true}).isVisible());
  const original=await editor.inputValue();assert(original.includes('nuestra Plataforma Automatizada'));assert(original.endsWith('Bienvenido a nuestra plataforma automatizada.'));assert(!original.includes('&#'));
  const edited=original+'\nTexto añadido <img src=x onerror=alert(1)> & ñ';await editor.fill(edited);await page.getByRole('button',{name:'Guardar mensaje',exact:true}).click();await page.getByText('Mensaje guardado.',{exact:true}).waitFor();assert(!state.message.includes(token));assert(state.message.includes('[Enlace seguro de activación]'));
  await page.locator('.hiring-close').click();await page.getByRole('button',{name:'Configurar acceso',exact:true}).click();await editor.waitFor();assert.equal(await editor.inputValue(),edited);
  assert.equal(await page.locator('.onboarding-dialog img').count(),0);assert(await page.locator('.onboarding-dialog').evaluate(n=>n.scrollWidth<=n.clientWidth));
  await page.screenshot({path:path.join(outputs,'onboarding-'+width+'.png'),fullPage:true});
  await page.evaluate(()=>window.blockPopup=true);await page.getByRole('button',{name:'3 · Abrir WhatsApp',exact:true}).click();await page.getByText('El navegador bloqueó WhatsApp.',{exact:false}).waitFor();assert.equal(state.whatsapp_opened_at,undefined);
  await page.evaluate(()=>window.blockPopup=false);failOpen=true;await page.getByRole('button',{name:'3 · Abrir WhatsApp',exact:true}).click();await page.getByRole('button',{name:'Reintentar guardar apertura',exact:true}).waitFor();const opened=await page.evaluate(()=>window.opened);assert.equal(opened.length,1);assert.equal(new URL(opened[0]).searchParams.get('text'),edited);failOpen=false;
  await page.getByRole('button',{name:'Reintentar guardar apertura',exact:true}).click();await page.getByText('WhatsApp abierto. El envío no está confirmado.',{exact:false}).waitFor();assert.equal((await page.evaluate(()=>window.opened)).length,1);assert(state.whatsapp_opened_at);
  await page.reload();await page.getByRole('button',{name:'Configurar acceso',exact:true}).click();await page.getByText('Notificar por WhatsApp · Completado',{exact:true}).waitFor();
  await page.goto('https://test.local/activar-cuenta.html#activation='+token);await page.getByText('Verifica tu correo registrado.',{exact:false}).waitFor();assert.equal(await page.locator('#activationPassword').isVisible(),false);assert.equal(await page.evaluate(()=>location.hash),'');
  await page.getByRole('button',{name:'Verificar mi correo',exact:true}).click();await page.getByText('Revisa tu correo registrado.',{exact:true}).waitFor();assert.equal(updates,0);
  ready=true;await page.getByRole('button',{name:'Ya verifiqué mi correo',exact:true}).click();await page.locator('#activationPassword').waitFor({state:'visible'});await page.locator('#newPassword').fill('Contraseña simulada 123');await page.locator('#confirmPassword').fill('Contraseña distinta 123');await page.getByRole('button',{name:'Establecer contraseña y activar',exact:true}).click();await page.getByText('Las contraseñas no coinciden.',{exact:true}).waitFor();assert.equal(updates,0);
  await page.locator('#confirmPassword').fill('Contraseña simulada 123');await page.getByRole('button',{name:'Establecer contraseña y activar',exact:true}).click();await page.getByRole('link',{name:'Entrar a Cartel Gestión',exact:false}).waitFor();assert.equal(updates,1);assert.equal(completed,1);assert.equal(await page.evaluate(()=>sessionStorage.getItem('cartel-onboarding-capability')),null);
  await page.goto('https://test.local/guia-acceso-movil.html');assert.equal(await page.getByRole('heading',{name:'Android · Chrome'}).count(),1);assert.equal(await page.getByRole('heading',{name:'iPhone · Safari'}).count(),1);assert(await page.locator('body').evaluate(n=>n.scrollWidth<=innerWidth));
  await page.goto('https://test.local/usuarios-permisos.html?section=roles');await page.locator('[data-role="0"]').waitFor();await page.locator('[data-role="0"]').click();await page.getByRole('button',{name:'Guardar plantilla',exact:true}).waitFor();assert.equal(await page.locator('#role-detail input[name=write]').isEnabled(),false);await page.locator('#role-detail input[name=read]').uncheck();await page.getByRole('button',{name:'Guardar plantilla',exact:true}).click();await page.getByText('Plantilla guardada. Los accesos existentes se conservan.',{exact:true}).waitFor();assert.equal(applied,0);assert.equal(template.can_read,false);assert.equal(template.views.length,0);
  await page.screenshot({path:path.join(outputs,'role-template-'+width+'.png'),fullPage:true});
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();await page.goto('https://test.local/usuarios-permisos.html?section=users&employee=employee');await page.getByRole('button',{name:'Vistas',exact:false}).click();await page.getByText('Vistas heredadas de la plantilla',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Guardar vistas',exact:true}).count(),0);
  await page.getByRole('button',{name:'Regresar a la ficha',exact:false}).click();await page.getByRole('button',{name:'Permisos',exact:false}).click();await page.getByRole('button',{name:'Aplicar plantilla a este trabajador',exact:true}).click();await page.getByText('Plantilla aplicada a este trabajador y registrada en auditoría.',{exact:true}).waitFor();assert.equal(applied,1);
  assert.equal(blocked,0);assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
 console.log('PASS: 390/1440px candidate configuration, three persistent substeps, real role template summary, errors, reopen/reload, permanent management, exact message, safe editable text, blocked WhatsApp, save retry without reopening, email gate, password errors, activation, guide and no external requests.');
})().catch(e=>{console.error(e);process.exitCode=1;});
