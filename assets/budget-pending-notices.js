/* Pending budget decisions for the signed-in approver. */
(()=>{'use strict';
const selector='.nav a[href="/inventario-presupuesto.html"]';
let count=0,running=false,again=false;
function decorate(){
 for(const link of document.querySelectorAll(selector+', [data-budget-notice]')){
  if(link.tagName==='A'&&!link.dataset.navigationLabel)link.dataset.navigationLabel=link.textContent.trim();
  let badge=link.querySelector(':scope > [data-budget-badge]');
  if(!count){badge?.remove();continue;}
  if(!badge){badge=document.createElement('small');badge.className='inventory-notice-badge';badge.dataset.budgetBadge='true';badge.setAttribute('role','status');link.append(badge);}
  const value=count>99?'99+':String(count);
  const label=`${count} solicitudes de presupuesto pendientes de aprobación`;
  if(badge.textContent!==value)badge.textContent=value;
  if(badge.getAttribute('aria-label')!==label)badge.setAttribute('aria-label',label);
 }
}
async function refresh(){
 if(document.hidden||!window.cartelPersonalNavigationReady||!document.querySelector(selector))return;
 if(running){again=true;return;}running=true;
 try{
  const {data:{user},error:authError}=await sb.auth.getUser();if(authError)throw authError;if(!user)return;
  const {data:caps,error}=await sb.rpc('purchase_budget_capabilities');if(error)throw error;
  const areas=[];if(caps.audiovisual)areas.push('Audiovisual');if(caps.graphics)areas.push('Gráfica');
  const pending=status=>sb.from('purchase_budget_requests').select('id',{count:'exact',head:true}).eq('status',status).neq('requester',user.id);
  const queries=[];
  if(areas.length)queries.push(pending('chief_pending').in('area',areas));
  if(caps.manager)queries.push(pending('manager_pending').or(`chief_by.is.null,chief_by.neq.${user.id}`));
  const results=await Promise.all(queries);
  for(const result of results)if(result.error)throw result.error;
  count=results.reduce((sum,result)=>sum+(result.count||0),0);decorate();
 }catch(error){console.warn('No se pudo actualizar el contador de presupuestos',error.code||error.message);}
 finally{running=false;if(again){again=false;void refresh();}}
}
window.CartelBudgetNotices={decorate,refresh};
window.addEventListener('cartel-navigation-ready',refresh);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh);
window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===document.getElementById('frame')?.contentWindow&&event.data?.type==='purchase-budget-changed')void refresh();});
setInterval(refresh,30000);if(window.cartelPersonalNavigationReady)void refresh();
})();
