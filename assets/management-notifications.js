(()=>{'use strict';
const root=document.documentElement;
let userId=null,dialog,button,badge,list,deviceButton,status,loading=false,ready=false,mounting=false,registration=null;
let tab='new',records=[],unread=0,historyPage=0,hasMore=false,tabs,headerCount,all,more,deviceState,refreshAgain=false;
const bindingKey='cartel-management-push-user';
const allowed=new Set(['/inventario-presupuesto.html','/inventario-aprobaciones.html','/inventario-solicitud.html','/cuadre-nevera.html','/tesoreria.html','/inventario-insumos.html','/inventario-pedidos.html','/dashboard.html']);
const el=(tag,text='',cls='')=>{const node=document.createElement(tag);node.textContent=text;if(cls)node.className=cls;return node;};
async function rpc(name,args={}){const {data,error}=await sb.rpc(name,args);if(error)throw error;return data;}
async function currentUser(){const {data,error}=await sb.auth.getUser();if(error||!data.user||data.user.id!==userId)throw Error('La sesión cambió');return data.user;}
const icons={
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
 check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
 budget:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
 calculator:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M7 7h10M8 12h1m6 0h1m-8 4h1m6 0h1"/>',
 box:'<path d="m12 3 9 5v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v8"/>',
 phone:'<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>'
};
function icon(name,cls=''){const node=el('span','',cls);node.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[name]+'</svg>';return node;}
function category(item){const title=(item.title||'').toLowerCase();if(/presupuesto/.test(title))return 'budget';if(/contrataci|cierre de prueba|expediente/.test(title))return 'budget';if(/cuadre|nevera|cierre/.test(title))return 'calculator';if(/insumo|pedido|inventario/.test(title))return 'box';return 'bell';}
const dayFormat=new Intl.DateTimeFormat('es-CU',{timeZone:'America/Havana',dateStyle:'medium'});
const timeFormat=new Intl.DateTimeFormat('es-CU',{timeZone:'America/Havana',hour:'2-digit',minute:'2-digit'});
function render(){
 headerCount.textContent=unread;headerCount.hidden=!unread;
 tabs[0].textContent='Nuevas ('+unread+')';tabs[1].textContent='Historial';
 tabs.forEach((node,index)=>node.setAttribute('aria-pressed',String(index===(tab==='new'?0:1))));
 all.hidden=tab!=='new'||!unread;
 list.replaceChildren();
 let previous='';
 for(const item of records){
  const date=new Date(item.created_at),validDate=Number.isFinite(date.getTime()),day=validDate?dayFormat.format(date):'Fecha no disponible';
  if(day!==previous){const today=dayFormat.format(new Date()),yesterday=dayFormat.format(new Date(Date.now()-86400000));list.append(el('div',day===today?'Hoy':day===yesterday?'Ayer':day,'management-notice-day'));previous=day;}
  const row=el('div','','management-notice-row '+(item.read_at?'read':'unread'));
  const open=el('button','','management-notice-open');open.type='button';
  const kind=category(item),content=el('span','','management-notice-content'),title=el('strong',item.title);
  content.append(title,el('span',item.body,'management-notice-body'));
  open.append(icon(kind,'management-notice-icon '+kind),content);open.onclick=()=>void openNotice(item);
  const actions=el('div','','management-notice-actions');actions.append(el('time',validDate?timeFormat.format(date):'—'));
  if(!item.read_at){const read=el('button','','management-notice-check');read.type='button';read.setAttribute('aria-label','Marcar como leída: '+item.title);read.append(icon('check'));read.onclick=()=>void markRead(item.id,read);actions.append(read);}else actions.append(icon('check','management-notice-read-icon'));
  row.append(open,actions);list.append(row);
 }
 if(!records.length){const empty=el('div','','management-notice-empty');empty.append(icon(tab==='new'?'check':'bell'),el('strong',tab==='new'?(unread?'Consultando avisos…':'Estás al día'):'Sin notificaciones leídas'),el('span',tab==='new'?'Los nuevos avisos aparecerán aquí.':'Aquí encontrarás los avisos que hayas consultado.'));list.append(empty);}
 more.hidden=!hasMore;
}
function selectTab(value){if(tab!==value){tab=value;historyPage=0;records=[];hasMore=false;}render();status.textContent='Consultando avisos…';void refresh();}
async function refresh(){
 if(!ready||document.hidden)return;if(loading){refreshAgain=true;return;}loading=true;
 const requestedTab=tab,requestedPage=historyPage;
 try{
  await currentUser();
  let query=sb.from('management_notifications').select('id,title,body,route,created_at,read_at').order('created_at',{ascending:false}).order('id',{ascending:false});
  query=requestedTab==='new'?query.is('read_at',null):query.not('read_at','is',null);
  const [result,count]=await Promise.all([query.range(0,(requestedPage+1)*50),sb.from('management_notifications').select('id',{count:'exact',head:true}).is('read_at',null)]);
  if(result.error||count.error)throw result.error||count.error;
  unread=count.count||0;badge.textContent=unread>99?'99+':String(unread);badge.hidden=!unread;button.setAttribute('aria-label','Notificaciones: '+unread+' sin leer');
  // The device badge is independent of rendering the in-app list.
  if(navigator.setAppBadge){try{Promise.resolve(navigator.setAppBadge(unread)).catch(()=>{});}catch{}}
  if(tab===requestedTab&&historyPage===requestedPage){hasMore=result.data.length>(requestedPage+1)*50;records=result.data.slice(0,(requestedPage+1)*50);render();if(status.textContent==='Consultando avisos…'||status.textContent.startsWith('No se pudieron consultar'))status.textContent='';}
 }catch{status.textContent='No se pudieron consultar los avisos. Reintenta en unos segundos.';}
 finally{loading=false;if(refreshAgain){refreshAgain=false;void refresh();}}
}
async function markRead(id,control){
 control.disabled=true;
 try{await currentUser();await rpc('management_notifications_read',{p_id:id});if(tab==='new'){records=id?records.filter(item=>item.id!==id):[];unread=id?Math.max(0,unread-1):0;render();}await refresh();}
 catch{status.textContent='No se pudo marcar como leído.';}
 finally{control.disabled=false;}
}
function setDevice(active){if(deviceButton){deviceButton.setAttribute('aria-checked',String(active));deviceState.textContent=active?'Activas':'Desactivadas';}}
async function openNotice(item){
 try{
  await currentUser();const url=new URL(item.route,location.origin);if(url.origin!==location.origin||!allowed.has(url.pathname))throw Error('Destino no disponible');
  await rpc('management_notifications_read',{p_id:item.id});if(dialog.open)dialog.close();void refresh();
  if(url.pathname==='/dashboard.html'){if(url.search)location.assign(url.href);else document.querySelector('[data-home]')?.click();return;}
  // The module verifies its own permissions and record access.
  const link=[...document.querySelectorAll('.nav a')].find(a=>new URL(a.href,location.origin).pathname===url.pathname);
  if(url.pathname==='/cuadre-nevera.html'&&window.cartelFridgeOperatorAccess===true){location.assign(url.href);return;}
  if(link&&typeof showModule==='function')showModule(url.pathname+url.search,link);else location.assign(url.href);
 }catch(e){status.textContent=e.message||'No se pudo abrir la notificación.';}
}
function supported(){return 'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;}
async function getRegistration(){if(!registration)registration=await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});await navigator.serviceWorker.ready;return registration;}
async function disable(){
 try{if(!supported())return;const reg=registration||await navigator.serviceWorker.getRegistration('/');const sub=await reg?.pushManager.getSubscription();if(sub){try{await CartelLoad.deadline(()=>rpc('management_push_unsubscribe',{p_endpoint:sub.endpoint}),3000);}catch{}await sub.unsubscribe();}}
 finally{localStorage.removeItem(bindingKey);setDevice(false);}
}
window.CartelNotifications={disable};
async function enable(){
 if(!supported()){status.textContent='Este navegador no admite notificaciones push. En iPhone abre Gestión desde su icono instalado.';return;}
 deviceButton.disabled=true;
 try{
  const permission=await Notification.requestPermission();await currentUser();if(permission!=='granted')throw Error('Permite las notificaciones en los ajustes del dispositivo.');
  const key=await rpc('management_push_public_key');if(!key)throw Error('Servicio de notificaciones aún no disponible.');
  const reg=await getRegistration();let sub=await reg.pushManager.getSubscription();
  if(sub&&localStorage.getItem(bindingKey)!==userId){await sub.unsubscribe();sub=null;}
  if(!sub){const bytes=Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-key.length%4)%4)),c=>c.charCodeAt(0));sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});}
  const json=sub.toJSON();await rpc('management_push_subscribe',{p_endpoint:sub.endpoint,p_p256dh:json.keys.p256dh,p_auth:json.keys.auth});
  localStorage.setItem(bindingKey,userId);setDevice(true);status.textContent='Notificaciones activadas en este dispositivo.';
 }catch(e){status.textContent=e.message||'No se pudieron activar las notificaciones.';}
 finally{deviceButton.disabled=false;}
}
async function mount(){
 if(ready||mounting||root.dataset.dashboardPending||!window.cartelPersonalNavigationReady)return;
 mounting=true;let result;try{result=await sb.auth.getUser();}catch{return;}finally{mounting=false;}const {data,error}=result;if(error||!data.user)return;userId=data.user.id;ready=true;
 button=el('button','','management-notice-bell');button.type='button';button.setAttribute('aria-label','Notificaciones');badge=el('span','','management-notice-count');badge.hidden=true;button.append(icon('bell'),badge);document.querySelector('.app').append(button);
 dialog=el('dialog','','management-notice-dialog');dialog.setAttribute('aria-label','Notificaciones');
 const header=el('header'),heading=el('div','','management-notice-heading'),close=el('button','×','management-notice-close'),settings=el('button','','management-notice-settings');
 headerCount=el('span','','management-notice-header-count');headerCount.hidden=true;heading.append(icon('bell'),el('h2','Notificaciones'),headerCount);
 close.type=settings.type='button';close.setAttribute('aria-label','Cerrar');close.onclick=()=>dialog.close();settings.setAttribute('aria-label','Ajustes de notificaciones');settings.append(icon('settings'));settings.onclick=()=>{deviceButton.focus();};header.append(heading,settings,close);
 const tabBar=el('div','','management-notice-tabs');tabs=['Nuevas (0)','Historial'].map((label,index)=>{const node=el('button',label);node.type='button';node.onclick=()=>selectTab(index?'history':'new');tabBar.append(node);return node;});
 all=el('button','✓✓ Marcar todas como leídas','management-notice-read');all.type='button';all.onclick=()=>void markRead(null,all);
 const scroll=el('div','','management-notice-scroll');list=el('div','','management-notice-list');more=el('button','Ver más','management-notice-more');more.type='button';more.onclick=()=>{historyPage++;void refresh();};scroll.append(list,more);
 const footer=el('div','','management-notice-footer'),label=el('span','Avisos en este dispositivo','management-notice-device-label');deviceState=el('span','Desactivadas','management-notice-device-state');
 deviceButton=el('button','','management-notice-enable');deviceButton.type='button';deviceButton.setAttribute('role','switch');deviceButton.setAttribute('aria-label','Avisos en este dispositivo');deviceButton.setAttribute('aria-checked','false');deviceButton.onclick=async()=>{deviceButton.disabled=true;try{if(deviceButton.getAttribute('aria-checked')==='true')await disable();else await enable();}catch{status.textContent='No se pudo cambiar el estado de las notificaciones.';}finally{deviceButton.disabled=false;}};
 footer.append(icon('phone'),label,deviceState,deviceButton);
 status=el('p','','management-notice-status');status.setAttribute('role','status');dialog.append(header,tabBar,all,scroll,footer,status);document.body.append(dialog);render();
 button.onclick=()=>{dialog.showModal();selectTab('new');};
 if(supported()){
  deviceButton.disabled=true;
  try{const reg=await getRegistration(),sub=await reg.pushManager.getSubscription();if(sub&&localStorage.getItem(bindingKey)===userId&&Notification.permission==='granted'){const json=sub.toJSON();await rpc('management_push_subscribe',{p_endpoint:sub.endpoint,p_p256dh:json.keys.p256dh,p_auth:json.keys.auth});setDevice(true);}else if(sub){await sub.unsubscribe();localStorage.removeItem(bindingKey);}}catch{}finally{deviceButton.disabled=false;}
 }
 void refresh();
 const requested=new URLSearchParams(location.search).get('notice');if(requested&&/^[0-9a-f-]{36}$/i.test(requested)){const {data:item,error}=await sb.from('management_notifications').select('id,route').eq('id',requested).maybeSingle();if(!error&&item){const clean=new URL(location.href);clean.searchParams.delete('notice');history.replaceState(null,'',clean.href);await openNotice(item);}}
}
window.addEventListener('cartel-navigation-ready',()=>setTimeout(mount,100));new MutationObserver(()=>{if(!root.dataset.dashboardPending)void mount();}).observe(root,{attributes:true,attributeFilter:['data-dashboard-pending']});
window.addEventListener('focus',refresh);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh);setInterval(refresh,15000);void mount();
})();
