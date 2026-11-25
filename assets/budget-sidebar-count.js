/* Read pending approvals without modifying navigation structure. */
(()=>{
'use strict';
let running=false,again=false;
const selector='.personal-nav-group a[href="/inventario-presupuesto.html"]';
async function refresh(){
 const context=window.cartelBudgetNoticeContext;
 const link=document.querySelector(selector);
 if(document.hidden||!context||!link)return;
 if(running){again=true;return;}
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
  const label=count?'Solicitud de presupuesto, '+count+' pendientes de aprobación':'Solicitud de presupuesto';
  for(const target of [link,...document.querySelectorAll('#worker-mobile-sheet-content [data-budget-notice]')]){
   if(count&&target.dataset.budgetCount!==value)target.dataset.budgetCount=value;
   else if(!count&&target.hasAttribute('data-budget-count'))target.removeAttribute('data-budget-count');
   const badge=target.querySelector?.('.budget-mobile-count');
   if(badge){badge.hidden=!count;badge.textContent=count?value:'';}
   if(target.getAttribute('aria-label')!==label)target.setAttribute('aria-label',label);
  }
 }catch(error){console.warn('Contador de presupuesto no disponible',error.code||error.message);}
 finally{running=false;if(again){again=false;void refresh();}}
}
window.CartelBudgetNotices={refresh};
window.addEventListener('focus',refresh);
document.addEventListener('visibilitychange',refresh);
window.addEventListener('cartel-navigation-ready',()=>setTimeout(refresh,1500));
if(window.cartelPersonalNavigationReady)setTimeout(refresh,1500);
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===document.getElementById('frame')?.contentWindow&&e.data?.type==='purchase-budget-changed')setTimeout(refresh,500);});
setInterval(refresh,30000);
})();
