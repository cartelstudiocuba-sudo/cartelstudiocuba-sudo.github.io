(()=>{'use strict';
const root=document.documentElement;
let userId=null,dialog,button,badge,list,deviceButton,status,loading=false,ready=false,mounting=false,registration=null;
const bindingKey='cartel-management-push-user';
const allowed=new Set(['/inventario-presupuesto.html','/inventario-aprobaciones.html','/inventario-solicitud.html','/cuadre-nevera.html','/tesoreria.html','/inventario-insumos.html','/inventario-pedidos.html','/dashboard.html']);
const el=(tag,text='',cls='')=>{const node=document.createElement(tag);node.textContent=text;if(cls)node.className=cls;return node;};
async function rpc(name,args={}){const {data,error}=await sb.rpc(name,args);if(error)throw error;return data;}
async function currentUser(){const {data,error}=await sb.auth.getUser();if(error||!data.user||data.user.id!==userId)throw Error('La sesión cambió');return data.user;}
async function refresh(){
 if(!ready||loading||document.hidden)return;loading=true;
 try{
  await currentUser();
  const [records,count]=await Promise.all([sb.from('management_notifications').select('id,title,body,route,created_at,read_at').order('created_at',{ascending:false}).limit(100),sb.from('management_notifications').select('id',{count:'exact',head:true}).is('read_at',null)]);
  if(records.error||count.error)throw records.error||count.error;
  const n=count.count||0;badge.textContent=n>99?'99+':String(n);badge.hidden=!n;button.setAttribute('aria-label','Notificaciones: '+n+' sin leer');
  if(navigator.setAppBadge){try{await navigator.setAppBadge(n);}catch{}}
  list.replaceChildren();
  for(const item of records.data||[]){
   const row=el('button','','management-notice-row');row.type='button';row.classList.toggle('unread',!item.read_at);
   row.append(el('strong',item.title),el('span',item.body),el('small',new Date(item.created_at).toLocaleString('es-CU',{timeZone:'America/Havana'})));row.onclick=()=>void openNotice(item);list.append(row);
  }
  if(!list.children.length)list.append(el('p','No tienes notificaciones.'));
 }catch{if(dialog?.open)list.replaceChildren(el('p','No se pudo consultar las notificaciones. Reintenta en unos segundos.'));}
 finally{loading=false;}
}
async function openNotice(item){
 try{
  await currentUser();const url=new URL(item.route,location.origin);if(url.origin!==location.origin||!allowed.has(url.pathname))throw Error('Destino no disponible');
  await rpc('management_notifications_read',{p_id:item.id});dialog.close();void refresh();
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
 finally{localStorage.removeItem(bindingKey);if(deviceButton)deviceButton.textContent='Activar notificaciones en este dispositivo';}
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
  localStorage.setItem(bindingKey,userId);deviceButton.textContent='Desactivar notificaciones en este dispositivo';status.textContent='Notificaciones activadas en este dispositivo.';
 }catch(e){status.textContent=e.message||'No se pudieron activar las notificaciones.';}
 finally{deviceButton.disabled=false;}
}
async function mount(){
 if(ready||mounting||root.dataset.dashboardPending||!window.cartelPersonalNavigationReady)return;
 mounting=true;let result;try{result=await sb.auth.getUser();}catch{return;}finally{mounting=false;}const {data,error}=result;if(error||!data.user)return;userId=data.user.id;ready=true;
 button=el('button','🔔','management-notice-bell');button.type='button';button.setAttribute('aria-label','Notificaciones');badge=el('span','','management-notice-count');badge.hidden=true;button.append(badge);document.querySelector('.app').append(button);
 dialog=el('dialog','','management-notice-dialog');dialog.setAttribute('aria-label','Notificaciones');const header=el('header'),close=el('button','×');close.type='button';close.setAttribute('aria-label','Cerrar');close.onclick=()=>dialog.close();header.append(el('h2','Notificaciones'),close);
 deviceButton=el('button','Activar notificaciones en este dispositivo','management-notice-enable');deviceButton.type='button';deviceButton.onclick=()=>void(localStorage.getItem(bindingKey)===userId?disable():enable());
 status=el('p','','management-notice-status');status.setAttribute('role','status');const all=el('button','Marcar todas como leídas','management-notice-read');all.type='button';all.onclick=async()=>{try{await rpc('management_notifications_read',{p_id:null});await refresh();}catch{status.textContent='No se pudo marcar como leído.';}};
 list=el('div','','management-notice-list');dialog.append(header,deviceButton,status,all,list);document.body.append(dialog);
 button.onclick=()=>{dialog.showModal();void refresh();};
 if(supported()){
  try{const reg=await getRegistration(),sub=await reg.pushManager.getSubscription();if(sub&&localStorage.getItem(bindingKey)===userId&&Notification.permission==='granted'){const json=sub.toJSON();await rpc('management_push_subscribe',{p_endpoint:sub.endpoint,p_p256dh:json.keys.p256dh,p_auth:json.keys.auth});deviceButton.textContent='Desactivar notificaciones en este dispositivo';}else if(sub){await sub.unsubscribe();localStorage.removeItem(bindingKey);}}catch{}
 }
 void refresh();
 const requested=new URLSearchParams(location.search).get('notice');if(requested&&/^[0-9a-f-]{36}$/i.test(requested)){const {data:item,error}=await sb.from('management_notifications').select('id,route').eq('id',requested).maybeSingle();if(!error&&item){const clean=new URL(location.href);clean.searchParams.delete('notice');history.replaceState(null,'',clean.href);await openNotice(item);}}
}
window.addEventListener('cartel-navigation-ready',()=>setTimeout(mount,100));new MutationObserver(()=>{if(!root.dataset.dashboardPending)void mount();}).observe(root,{attributes:true,attributeFilter:['data-dashboard-pending']});
window.addEventListener('focus',refresh);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh);setInterval(refresh,15000);void mount();
})();
