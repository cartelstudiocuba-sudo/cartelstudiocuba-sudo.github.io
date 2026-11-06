/* Shared loading protection. No query values, tokens or personal data in diagnostics. */
(function (root) {
 'use strict';
 const nativeFetch=root.fetch.bind(root), inflight=new Map(), authFlights=new WeakMap(), diagnostics=[];
 const LIMITS={readMs:12000,documentMs:120000,sessionMs:10000,retries:1,backoffMs:350};
 function failure(code){const error=new Error(code);error.code=code;return error;}
 function record(label,code,duration){diagnostics.push({operation:String(label).replace(/[^a-z0-9_-]/gi,'').slice(0,50),code,duration:Math.round(duration)});if(diagnostics.length>50)diagnostics.shift();if(root.console&&root.console.debug)root.console.debug('CartelLoad '+JSON.stringify(diagnostics[diagnostics.length-1]));}
 function deadline(work,ms){let timer;return Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{timer=setTimeout(()=>reject(failure('timeout')),ms)})]).finally(()=>clearTimeout(timer));}
 function textFor(code){return code==='timeout'?'La carga está tardando demasiado. Puedes reintentar sin perder la sesión.':code==='offline'?'No hay conexión. Comprueba Internet y vuelve a intentar.':'No se pudo completar la carga. Puedes reintentar.';}
 function notice(message,retry){let bar=document.getElementById('cartel-load-notice');if(!bar){bar=document.createElement('div');bar.id='cartel-load-notice';bar.setAttribute('role','status');bar.style.cssText='position:fixed;bottom:12px;left:12px;right:12px;z-index:2147483000;padding:14px;background:#fff8d8;border:1px solid #d7bd39;border-radius:12px;font:14px system-ui;color:#222;box-shadow:0 2px 14px #0002';(document.body||document.documentElement).append(bar);}bar.replaceChildren();const span=document.createElement('span');span.textContent=message;bar.append(span);if(retry){const button=document.createElement('button');button.type='button';button.textContent='Reintentar carga';button.style.marginLeft='12px';button.onclick=()=>{button.disabled=true;if(retry()===false)button.disabled=false;};bar.append(button);}return bar;}
 let dirty=false;root.addEventListener('input',event=>{if(event.isTrusted)dirty=true;},true);root.addEventListener('change',event=>{if(event.isTrusted)dirty=true;},true);
 function recover(work){if(dirty&&!root.confirm('Hay cambios en pantalla. Reintentar la carga puede descartarlos. ¿Quieres continuar?'))return false;return work();}
 function fail(error,retry){const code=error&&['timeout','offline','auth','read_failed'].includes(error.code)?error.code:'load_failed';record('screen',code,0);const loading=document.getElementById('loading');if(loading)loading.style.display='none';notice(textFor(code),()=>recover(retry||(()=>root.location.reload())));}
 async function run(label,work){const key='run:'+label;if(inflight.has(key))return inflight.get(key);const started=Date.now();const previous=document.getElementById('cartel-load-notice');if(previous)previous.remove();const promise=Promise.resolve().then(work).then(value=>{record(label,'ok',Date.now()-started);return value;},error=>{fail(error,()=>run(label,work));record(label,error&&error.code==='timeout'?'timeout':'failed',Date.now()-started);return undefined;}).finally(()=>inflight.delete(key));inflight.set(key,promise);return promise;}
 function required(result){if(!result||result.error){const error=failure('read_failed');if(result&&result.error&&['42703','42P01','42501','PGRST116','PGRST301','PGRST302'].includes(result.error.code))error.safeCode=result.error.code;throw error;}return result;}
 async function read(label,factory,{optional=false}={}){const controller=new AbortController();record(label,'start',0);try{const result=required(await deadline(()=>{const query=factory();return query&&typeof query.abortSignal==='function'?query.abortSignal(controller.signal):query;},LIMITS.readMs));record(label,'ok',0);return result;}catch(error){record(label,error&&error.safeCode||(error&&error.code==='timeout'?'timeout':'read_failed'),0);if(!optional)throw error;return {data:null,error:{code:'secondary_unavailable'},unavailable:true};}finally{controller.abort();}}
 async function publicRead(label,factory){return deadline(async()=>{const response=await factory();if(!response.ok)throw failure('read_failed');const body=await response.arrayBuffer();return new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});},LIMITS.readMs);}
 function retryable(status){return [408,425,429,500,502,503,504,520,521,522,523,524].includes(status);}
 async function guardedFetch(input,init={}) {
  const request=input instanceof Request?input:null, method=String(init.method||(request&&request.method)||'GET').toUpperCase();
  // Writes/auth/RPC are never retried or aborted by this transport.
  if(!['GET','HEAD'].includes(method)){let shown=null;const reminder=setTimeout(()=>{shown=notice('La operación sigue pendiente de confirmación. No repitas el envío ni cierres la pantalla hasta conocer el resultado.');},25000);try{return await nativeFetch(input,init);}finally{clearTimeout(reminder);if(shown&&shown.isConnected&&shown.textContent==='La operación sigue pendiente de confirmación. No repitas el envío ni cierres la pantalla hasta conocer el resultado.')shown.remove();}}
  record('transport','start',0);const address=typeof input==='string'?input:(request&&request.url)||'';let documentRead=false,permissionRead=false;try{const path=new URL(address,root.location.href).pathname;documentRead=path.startsWith('/storage/v1/object/');permissionRead=path==='/rest/v1/rpc/system_has_permission';}catch(_){}
  const budget=documentRead?LIMITS.documentMs:permissionRead?60000:LIMITS.readMs;const retryLimit=permissionRead?2:LIMITS.retries;const start=Date.now(),external=init.signal||(request&&request.signal);let attempt=0;
  while(true){const remaining=budget-(Date.now()-start);if(remaining<=0)throw failure('timeout');const controller=new AbortController();const abort=()=>controller.abort();if(external&&external.aborted)throw failure('cancelled');if(external)external.addEventListener('abort',abort,{once:true});const attemptMs=permissionRead?Math.min(20000,remaining):remaining;const timer=setTimeout(abort,attemptMs);
   let response;
   try {
    response=await deadline(async()=>{const result=await nativeFetch(input,{...init,signal:controller.signal});record('transport','headers',Date.now()-start);if(result.status===204||result.status===205||result.status===304||method==='HEAD')return result;const body=await result.arrayBuffer();record('transport','body',Date.now()-start);return new Response(body,{status:result.status,statusText:result.statusText,headers:result.headers});},attemptMs);
    if(!retryable(response.status)||attempt>=retryLimit)return response;
   }catch(error){if(external&&external.aborted)throw failure('cancelled');if(Date.now()-start>=budget)throw failure('timeout');if(attempt>=retryLimit)throw failure(root.navigator.onLine===false?'offline':'read_failed');}
   finally{clearTimeout(timer);if(external)external.removeEventListener('abort',abort);}
   if(response&&response.status===429){const raw=response.headers.get('Retry-After');const seconds=Number(raw);const delay=raw?(Number.isFinite(seconds)?seconds*1000:Date.parse(raw)-Date.now()):0;if(delay>0){if(delay>=budget-(Date.now()-start))return response;await new Promise(resolve=>setTimeout(resolve,delay));}}
   attempt++;const pause=Math.min(LIMITS.backoffMs*(2**(attempt-1))+Math.floor(Math.random()*150),Math.max(0,budget-(Date.now()-start)));await new Promise(resolve=>setTimeout(resolve,pause));
  }
 }
 function session(client,name,method,args){if(args.length)return deadline(()=>method.apply(client.auth,args),LIMITS.sessionMs).then(required);let flights=authFlights.get(client.auth);if(!flights){flights=new Map();authFlights.set(client.auth,flights);}if(flights.has(name))return flights.get(name);const promise=deadline(()=>method.apply(client.auth,args),LIMITS.sessionMs).then(required).finally(()=>flights.delete(name));flights.set(name,promise);return promise;}
 function wrap(client){for(const name of ['getSession','getUser']){const original=client.auth[name];if(typeof original!=='function')continue;client.auth[name]=function(...args){return session(client,name,original,args);};}return client;}
 function createClient(url,key,options={}){if(!root.supabase||!root.supabase.createClient)throw failure('sdk_unavailable');const config={...options,global:{...(options.global||{}),fetch:guardedFetch}};const client=wrap(root.supabase.createClient(url,key,config));installSession(client);return client;}

 let readonly=false;root.addEventListener('click',event=>{const button=event.target.closest&&event.target.closest('button');if(readonly&&button&&!button.classList.contains('tab')&&!button.closest('#cartel-load-notice')&&button.id!=='cartel-sign-out'&&!button.closest('#cartel-logout-modal')&&!/^(cerrar sesi[oó]n|salir)$/i.test(button.textContent.trim())){event.preventDefault();event.stopImmediatePropagation();notice('La información complementaria no está completa. La edición está temporalmente deshabilitada.',()=>root.location.reload());}},true);root.addEventListener('submit',event=>{if(readonly){event.preventDefault();event.stopImmediatePropagation();}},true);

 function blockPartialEdit(event){if(!readonly)return;const target=event.target;if(target.closest&&(target.closest('#cartel-load-notice')||target.closest('#cartel-sign-out')||target.closest('#cartel-logout-modal')))return;if(target.matches&&target.matches('input,select,textarea,[contenteditable="true"]')){event.preventDefault();event.stopImmediatePropagation();}}
 for(const type of ['beforeinput','input','change','click'])root.addEventListener(type,blockPartialEdit,true);
 function resizeFrame(frame){try{const body=frame.contentDocument&&frame.contentDocument.body;if(!body)return false;const height=Math.ceil(Math.max(body.scrollHeight,body.offsetHeight,body.getBoundingClientRect().height));if(height<=0)return false;const target=(height+8)+'px';if(frame.style.height!==target)frame.style.height=target;return true;}catch(_){return false;}}
 root.CartelLoad={resizeFrame,clearNotice:()=>{const bar=document.getElementById('cartel-load-notice');if(bar)bar.remove();},publicRead,setReadOnly:value=>{readonly=!!value;},createClient,wrap,fetch:guardedFetch,run,read,required,deadline,fail,notice,limits:LIMITS,diagnostics:()=>diagnostics.map(x=>({...x}))};
 root.addEventListener('unhandledrejection',()=>fail(failure('load_failed')));
 root.addEventListener('error',event=>{if(['ResizeObserver loop completed with undelivered notifications.','ResizeObserver loop limit exceeded'].includes(event.message)){record('layout','observer_deferred',0);return;}if(event.target&&event.target.tagName==='SCRIPT'||event instanceof ErrorEvent)fail(failure('load_failed'));},true);
 // Session controls are independent of module permissions and never write business data.
 const privatePages=new Set(['dashboard.html','rrhh.html','rrhh-20261101.html','recursos-humanos.html','usuarios-permisos.html','inventario-insumos.html','contratacion.html','contratados.html','cv-admin.html','entrevistas.html','nomencladores.html','plazas.html','plaza-ficha.html','trabajador-ficha.html','bajas.html','gestionar-cierre-prueba.html']);
 let sessionClient=null,signingOut=false,leavingSession=false;
 const privatePage=privatePages.has(root.location.pathname.split('/').pop());
 function concealSession(){document.documentElement.setAttribute('data-session-pending','');}
 function revealSession(){document.documentElement.removeAttribute('data-session-pending');}
 function leaveSession(localOnly=false){
  if(leavingSession)return;leavingSession=true;concealSession();
  // Discard in-memory views by replacing the document. Persistent user data stays intact.
  root.location.replace('/rrhh-login.html?next=%2Fdashboard.html'+(localOnly?'&logout=local-only':''));
 }
 async function checkSession(){
  if(!sessionClient||leavingSession)return;
  concealSession();
  try{const {data,error}=await sessionClient.auth.getSession();if(error)throw error;if(!data.session)return leaveSession();updateAccount(data.session.user);revealSession();}
  catch(_){notice('No se pudo comprobar la sesión. Reintenta para continuar.',checkSession);}
 }

 // A native dialog provides top-layer isolation, keyboard focus containment and inert background.
 let logoutPrompt=null;
 function confirmSessionExit(){
  if(logoutPrompt)return logoutPrompt;
  const previous=document.activeElement,dialog=document.createElement('dialog');dialog.id='cartel-logout-modal';
  dialog.setAttribute('aria-labelledby','cartel-logout-title');dialog.setAttribute('aria-describedby','cartel-logout-description');dialog.setAttribute('aria-modal','true');
  dialog.innerHTML='<button type="button" class="logout-x" aria-label="Cerrar confirmación">×</button><div class="logout-power"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v10M6.3 5.7a9 9 0 1 0 11.4 0"/></svg></div><h2 id="cartel-logout-title">¿Cerrar sesión?</h2><p id="cartel-logout-description">Tu cuenta se desconectará de este navegador y volverás a la pantalla de acceso.</p><div class="logout-actions"><button type="button" class="logout-cancel">Cancelar</button><button type="button" class="logout-confirm"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5H4v14h5M14 8l4 4-4 4M8 12h13"/></svg>Cerrar sesión</button></div>';
  document.body.append(dialog);
  const overflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';
  logoutPrompt=new Promise(resolve=>{
   let done=false;
   function finish(confirmed){if(done)return;done=true;dialog.close();dialog.remove();document.documentElement.style.overflow=overflow;logoutPrompt=null;if(previous?.isConnected)previous.focus({preventScroll:true});resolve(confirmed);}
   dialog.querySelector('.logout-x').onclick=()=>finish(false);
   dialog.querySelector('.logout-cancel').onclick=()=>finish(false);
   dialog.querySelector('.logout-confirm').onclick=()=>finish(true);
   dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
   dialog.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const buttons=[...dialog.querySelectorAll('button')],first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});
   let outside=false;
   const isOutside=event=>{const r=dialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;};
   dialog.addEventListener('pointerdown',event=>{outside=event.target===dialog&&isOutside(event);});
   dialog.addEventListener('click',event=>{if(outside&&event.target===dialog&&isOutside(event))finish(false);outside=false;});
   dialog.showModal();dialog.querySelector('.logout-cancel').focus();
  });return logoutPrompt;
 }

 async function closeSession(){
  if(signingOut||!sessionClient)return;
  if(!await confirmSessionExit())return;
  if(signingOut||leavingSession)return;
  signingOut=true;const button=document.getElementById('cartel-sign-out');if(button){button.disabled=true;button.querySelector('span').textContent='Cerrando sesión…';}
  try{
   const {error}=await sessionClient.auth.signOut({scope:'local'});
   authFlights.delete(sessionClient.auth);
   const result=await sessionClient.auth.getSession();
   if(result.error||result.data.session)throw error||result.error||new Error('session_remaining');
   leaveSession(!!error);
  }catch(_){notice('No se pudo completar el cierre de sesión. Comprueba la conexión y vuelve a intentarlo.',closeSession);}
  finally{signingOut=false;if(button){button.disabled=false;button.querySelector('span').textContent='Cerrar sesión';}}
 }
 function updateAccount(user){
  const email=document.getElementById('cartel-account-email');if(email)email.textContent=user?.email||'Cuenta conectada';
 }
 function mountAccount(){
  if(root.top!==root.self||document.getElementById('cartel-account'))return;
  const account=document.createElement('section');account.id='cartel-account';account.setAttribute('aria-label','Mi cuenta');
  account.innerHTML='<div class="cartel-account-info"><svg class="cartel-account-avatar" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg><div class="cartel-account-copy"><strong>Mi cuenta</strong><span id="cartel-account-email">Cuenta conectada</span></div></div><button id="cartel-sign-out" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5H4v14h5M14 8l4 4-4 4M8 12h13"/></svg><span>Cerrar sesión</span></button>';
  account.querySelector('button').addEventListener('click',closeSession);
  const foot=document.querySelector('.app > aside .foot');
  if(foot){foot.replaceChildren(account);foot.classList.add('cartel-account-foot');foot.setAttribute('aria-label','Cuenta y sesión');}
  else{
   const nav=document.createElement('nav');nav.className='cartel-account-navigation';nav.setAttribute('aria-label','Navegación y cuenta');
   const home=document.createElement('a');home.href='/dashboard.html';home.textContent='← Inicio';nav.append(home,account);document.body.prepend(nav);
  }
 }
 function installSession(client){
  if(!privatePage||sessionClient)return;sessionClient=client;
  client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'&&!signingOut)leaveSession();});
  const mount=()=>{
   mountAccount();
   void checkSession();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
 }
 if(privatePage){
  // Suppress stale module unload prompts only after an authenticated exit is committed.
  root.addEventListener('beforeunload',event=>{if(leavingSession){root.onbeforeunload=null;event.stopImmediatePropagation();}},true);
  concealSession();
  const modalStyle=document.createElement('style');modalStyle.textContent=`#cartel-logout-modal{box-sizing:border-box;width:min(420px,calc(100% - 28px));max-height:calc(100dvh - 28px);overflow:auto;margin:auto;padding:28px 24px 24px;border:1px solid #FFDA03;border-radius:18px;background:linear-gradient(145deg,#151615,#090a0b);color:#f5f5f5;text-align:center;font:14px/1.45 system-ui;box-shadow:0 22px 80px #000a}#cartel-logout-modal::backdrop{background:#000b;backdrop-filter:blur(2px)}#cartel-logout-modal .logout-x{position:absolute;right:8px;top:6px;width:44px;height:44px;padding:0;border:0;background:transparent;color:#aaa;font:28px system-ui;cursor:pointer}#cartel-logout-modal .logout-power{display:grid;place-items:center;width:60px;height:60px;margin:0 auto 12px;border:1px solid #FFDA03;border-radius:50%;color:#FFDA03;box-shadow:0 0 24px #ffda0330,inset 0 0 14px #ffda0315}#cartel-logout-modal svg{width:25px;height:25px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}#cartel-logout-modal h2{margin:0 0 8px;font-size:24px;line-height:1.2;color:#fff}#cartel-logout-modal p{margin:0 auto 24px;max-width:330px;color:#bfc0c3;font-size:13px}#cartel-logout-modal .logout-actions{display:flex;gap:12px}#cartel-logout-modal .logout-actions button{display:flex;align-items:center;justify-content:center;gap:8px;flex:1;min-width:0;min-height:44px;padding:10px 8px;border-radius:11px;font:700 13px system-ui;cursor:pointer;transition:transform .12s,filter .12s}#cartel-logout-modal .logout-cancel{background:linear-gradient(#202124,#101113);border:1px solid #737780;color:#f5f5f5;box-shadow:0 3px 0 #050505,inset 0 1px 0 #ffffff18}#cartel-logout-modal .logout-confirm{background:linear-gradient(#ffe957,#FFDA03);border:1px solid #ffe766;color:#151500;box-shadow:0 3px 0 #8a7500,inset 0 1px 0 #fff8}#cartel-logout-modal .logout-confirm svg{width:19px;height:19px;flex-shrink:0}#cartel-logout-modal button:focus-visible{outline:3px solid #FFDA03;outline-offset:4px}#cartel-logout-modal .logout-actions button:hover{filter:brightness(1.12)}#cartel-logout-modal .logout-actions button:active{transform:translateY(2px)}@media(max-width:359px){#cartel-logout-modal{padding:25px 16px 20px}#cartel-logout-modal h2{font-size:22px}#cartel-logout-modal .logout-actions{gap:8px}#cartel-logout-modal .logout-actions button{font-size:12px}}@media(prefers-reduced-motion:reduce){#cartel-logout-modal button{transition:none!important}}`;document.head.append(modalStyle);
  const style=document.createElement('style');style.textContent="html[data-session-pending] body{visibility:hidden!important}html[data-session-pending] #cartel-load-notice{visibility:visible!important}\n.app>aside .cartel-account-foot{display:block;margin-top:auto;padding:16px 6px 0;min-width:0}\n#cartel-account{box-sizing:border-box;min-width:0;width:100%;color:#eee;font:13px/1.4 system-ui;text-align:left}\n.cartel-account-info{display:flex;align-items:center;gap:10px;min-width:0;margin-bottom:10px}\n#cartel-account svg{fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}\n#cartel-account .cartel-account-avatar{width:34px;height:34px;padding:7px;box-sizing:border-box;border-radius:50%;background:#2b2b26;color:#FFDA03}\n.cartel-account-copy{min-width:0;flex:1}.cartel-account-copy strong{display:block;font-size:13px;color:#f5f5f5}\n#cartel-account-email{display:block;font-size:11px;color:#aaa;overflow-wrap:anywhere}\n#cartel-sign-out{position:static;box-sizing:border-box;display:flex;align-items:center;justify-content:flex-start;gap:9px;width:100%;min-height:44px;padding:10px 12px;border:1px solid #51491e;border-radius:9px;background:#20201b;color:#FFDA03;font:600 13px system-ui;cursor:pointer;box-shadow:none}\n#cartel-sign-out svg{width:18px;height:18px}#cartel-sign-out:hover{background:#302d19;border-color:#FFDA03}#cartel-sign-out:focus-visible{outline:3px solid #FFDA03;outline-offset:3px}#cartel-sign-out:disabled{opacity:.7;cursor:wait}\n.cartel-account-navigation{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:20px;background:#151515;padding:14px 20px;width:100%;border-bottom:1px solid #333}.cartel-account-navigation>a{color:#FFDA03;text-decoration:none;font:600 14px system-ui;flex-shrink:0}.cartel-account-navigation #cartel-account{max-width:280px}\n@media(max-width:900px){.app>aside .cartel-account-foot{padding:12px 6px 3px;margin-top:8px}#cartel-account{display:flex;align-items:center;gap:12px}.cartel-account-info{flex:1;margin:0;min-width:0}#cartel-sign-out{width:auto;flex-shrink:0}.cartel-account-navigation{flex-wrap:wrap;padding:12px 14px;gap:12px}.cartel-account-navigation #cartel-account{max-width:none}}\n@media(max-width:359px){#cartel-account{flex-wrap:wrap}#cartel-sign-out{width:100%}}\n@media print{#cartel-account,.cartel-account-navigation{display:none!important}}";document.head.append(style);
  root.addEventListener('pagehide',concealSession);
  root.addEventListener('pageshow',()=>{void checkSession();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void checkSession();});
  // Existing module exit buttons use the same confirmed flow, including embedded modules.
  root.addEventListener('click',event=>{const control=event.target.closest?.('button,a');if(control&&control.id!=='cartel-sign-out'&&!control.closest('#cartel-logout-modal')&&/^(cerrar sesi[oó]n|salir)$/i.test(control.textContent.trim())){event.preventDefault();event.stopImmediatePropagation();void closeSession();}},true);
 }

})(window);
