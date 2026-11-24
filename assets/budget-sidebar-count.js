/* Read pending approvals without modifying navigation structure. */
(()=>{
'use strict';
let running=false;
const selector='.personal-nav-group a[href="/inventario-presupuesto.html"]';
async function refresh(){
 const context=window.cartelBudgetNoticeContext;
 const link=document.querySelector(selector);
 if(running||document.hidden||!context||!link)return;
 running=true;
 try{
  const {userId,caps}=context;
  const areas=[];
  if(caps.audiovisual)areas.push('Audiovisual');
  if(caps.graphics)areas.push('Gráfica');
  const pending=status=>sb.from('purchase_budget_requests').select('id',{head:true,count:'exact'}).eq('status',status).neq('requester',userId);
  const queries=[];
  if(areas.length)queries.push(pending('chief_pending').in('area',areas));
  if(caps.manager)queries.push(pending('manager_pending').or('chief_by.is.null,chief_by.neq.'+userId));
  const results=await Promise.all(queries);
  if(results.some(result=>result.error))return;
  const count=results.reduce((sum,result)=>sum+(result.count||0),0);
  const value=count>99?'99+':String(count);
  if(count&&link.dataset.budgetCount!==value)link.dataset.budgetCount=value;
  else if(!count&&link.hasAttribute('data-budget-count'))link.removeAttribute('data-budget-count');
  const label=count?'Solicitud de presupuesto, '+count+' pendientes de aprobación':'Solicitud de presupuesto';
  if(link.getAttribute('aria-label')!==label)link.setAttribute('aria-label',label);
 }catch(error){console.warn('Contador de presupuesto no disponible',error.code||error.message);}
 finally{running=false;}
}
window.addEventListener('cartel-navigation-ready',()=>setTimeout(refresh,1500));
if(window.cartelPersonalNavigationReady)setTimeout(refresh,1500);
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===document.getElementById('frame')?.contentWindow&&e.data?.type==='purchase-budget-changed')setTimeout(refresh,500);});
setInterval(refresh,30000);
})();
