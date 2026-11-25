(() => {
 'use strict';
 const stages=[
  ['chief_pending','Por aprobar','#ffda03','checklist'],
  ['manager_pending','En trámite','#4baeff','refresh'],
  ['approved','Aprobadas','#54df8b','check'],
  ['rejected','No aprobadas','#ff707d','cross']
 ];
 const paths={
  checklist:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="m8 12 2 2 5-5m-7 8h8"/>',
  refresh:'<path d="M20 8a8 8 0 0 0-14-2L3 9m0-5v5h5m-4 7a8 8 0 0 0 14 2l3-3m0 5v-5h-5"/>',
  check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  cross:'<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>'
 };
 const icon=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[name]+'</svg>';
 const make=(tag,text='',className='')=>Object.assign(document.createElement(tag),{textContent:text,className});
 function renderSummary({container,requests}){
  const panel=make('section','','area-chief-panel');
  panel.setAttribute('aria-label','Resumen de solicitudes de presupuesto');
  panel.innerHTML='<div class="area-chief-metrics"></div>';
  container.replaceChildren(panel);
  const metrics=panel.querySelector('.area-chief-metrics');
  const values=stages.map(([key,label,color,symbol])=>{
   const card=make('div','','area-chief-metric');card.style.setProperty('--area-accent',color);
   card.innerHTML=icon(symbol)+'<div><span>'+label+'</span><strong>—</strong></div>';metrics.append(card);
   return card.querySelector('strong');
  });
  const counts=Object.fromEntries(stages.map(([key])=>[key,requests.filter(request=>request.status===key).length]));
  stages.forEach(([key],index)=>{values[index].textContent=counts[key];});

 }
 window.CartelBudgetSummary={renderSummary};
})();
