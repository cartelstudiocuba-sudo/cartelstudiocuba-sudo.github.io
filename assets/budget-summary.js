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
  cross:'<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>',
  chart:'<circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/>'
 };
 const icon=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[name]+'</svg>';
 const make=(tag,text='',className='')=>Object.assign(document.createElement(tag),{textContent:text,className});
 function renderSummary({container,graphContainer,requests,selectFilter,selected}){
  const panel=make('section','','area-chief-panel');
  panel.setAttribute('aria-label','Resumen de solicitudes de presupuesto');
  panel.innerHTML='<div class="area-chief-metrics"></div>';
  graphContainer.innerHTML='<h2>'+icon('chart')+'Estado de solicitudes</h2><div class="area-chief-graph"></div>';
  container.replaceChildren(panel);
  const metrics=panel.querySelector('.area-chief-metrics'),graph=graphContainer.querySelector('.area-chief-graph');
  const values=stages.map(([key,label,color,symbol])=>{
   const card=make('button','','area-chief-metric');card.type='button';card.setAttribute('aria-pressed',String(selected===key));card.onclick=()=>selectFilter(key);card.style.setProperty('--area-accent',color);
   card.innerHTML=icon(symbol)+'<div><span>'+label+'</span><strong>—</strong></div>';metrics.append(card);
   return card.querySelector('strong');
  });
  const counts=Object.fromEntries(stages.map(([key])=>[key,requests.filter(request=>request.status===key).length]));
  stages.forEach(([key],index)=>{values[index].textContent=counts[key];});
   const total=stages.reduce((sum,[key])=>sum+counts[key],0);
   const ring=make('div','','area-chief-ring');
   let cursor=0;
   if(total)ring.style.setProperty('--area-ring','conic-gradient('+stages.filter(([key])=>counts[key]).map(([key,,color])=>{const start=cursor;cursor+=counts[key]/total*100;return color+' '+start+'% '+cursor+'%';}).join(',')+')');
   const center=make('div');center.append(make('strong',String(total)),make('span',total===1?'Solicitud':'Solicitudes'));ring.append(center);
   ring.setAttribute('role','img');ring.setAttribute('aria-label',stages.map(([key,label])=>label+' '+counts[key]).join(', '));graph.replaceChildren(ring);
 }
 window.CartelBudgetSummary={renderSummary};
})();
