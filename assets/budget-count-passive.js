/* Pending budget decisions for the signed-in approver. */
(()=>{'use strict';
const selector='.nav a[href="/inventario-presupuesto.html"]';
let count=0,running=false,again=false;
function decorate(){
 const value=count>99?'99+':String(count);
 for(const link of document.querySelectorAll(selector+', [data-budget-notice]')){
  if(!count){if(link.hasAttribute('data-budget-count'))link.removeAttribute('data-budget-count');continue;}
  if(link.getAttribute('data-budget-count')!==value)link.setAttribute('data-budget-count',value);
 }
}
async function refresh(){
 if(document.hidden||!window.cartelPersonalNavigationReady||!document.querySelector(selector))return;
 if(running){again=true;return;}running=true;
 try{
  const context=window.cartelBudgetNoticeContext;if(!context)return;
  const {userId,caps}=context;
  const areas=[];if(caps.audiovisual)areas.push('Audiovisual');if(caps.graphics)areas.push('Gráfica');
  const pending=status=>sb.from('purchase_budget_requests').select('id',{count:'exact',head:true}).eq('status',status).neq('requester',userId);
  const queries=[];
  if(areas.length)queries.push(pending('chief_pending').in('area',areas));
  if(caps.manager)queries.push(pending('manager_pending').or(`chief_by.is.null,chief_by.neq.${userId}`));
  const results=await Promise.all(queries);
  for(const result of results)if(result.error)throw result.error;
  count=results.reduce((sum,result)=>sum+(result.count||0),0);decorate();
 }catch(error){console.warn('No se pudo actualizar el contador de presupuestos',error.code||error.message);}
 finally{running=false;if(again){again=false;void refresh();}}
}
window.CartelBudgetNotices={decorate,refresh};
window.addEventListener('cartel-navigation-ready',()=>setTimeout(refresh,1000));window.addEventListener('focus',refresh);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh);
window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===document.getElementById('frame')?.contentWindow&&event.data?.type==='purchase-budget-changed')void refresh();});
setInterval(refresh,30000);if(window.cartelPersonalNavigationReady)setTimeout(refresh,1000);
})();
