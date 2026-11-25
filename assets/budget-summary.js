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
 const currencyFormat=(value,currency)=>new Intl.NumberFormat('es-CU',{style:'currency',currency,currencyDisplay:'code'}).format(value);
 const currencies=['CUP','USD'];
 const pendingStatus=r=>['chief_pending','manager_pending'].includes(r.status);
 const sumAmounts=(rows,totals)=>Object.fromEntries(currencies.map(currency=>[currency,rows.reduce((sum,r)=>sum+(Number(totals(r)[currency])||0),0)]));
 function financeCard(title,rows,totals,style){
  const card=make('section','','budget-finance-card '+style);
  card.append(make('h3',title));
  const amounts=make('div','','budget-finance-amounts'),sum=sumAmounts(rows,totals);
  for(const currency of currencies){const item=make('div');item.append(make('span',currency),make('strong',currencyFormat(sum[currency],currency)));amounts.append(item);}
  card.append(amounts);return card;
 }
 function categoryChart(rows,totals){
  const section=make('section','','budget-category-panel');
  section.append(make('h3','Gastos pendientes por categoría'));
  const groups=new Map();
  for(const request of rows){
   const category=request.kind||request.product||'Otros gastos';
   if(!groups.has(category))groups.set(category,[]);
   groups.get(category).push(request);
  }
  const data=[...groups].map(([name,items])=>({name,amounts:sumAmounts(items,totals)}));
  if(!data.length){section.append(make('p','No hay importes pendientes.','budget-summary-empty'));return section;}
  const totalsByCurrency=sumAmounts(rows,totals);
  const columns=make('div','','budget-category-columns');
  for(const currency of currencies){
   const column=make('div','','budget-category-currency');
   column.append(make('strong',currency));
   if(!totalsByCurrency[currency]){column.append(make('p','Sin importes','budget-summary-empty'));columns.append(column);continue;}
   for(const item of data.filter(item=>item.amounts[currency]>0).sort((a,b)=>b.amounts[currency]-a.amounts[currency])){
    const line=make('div','','budget-category-line'),caption=make('div','','budget-category-caption');
    caption.append(make('span',item.name),make('strong',currencyFormat(item.amounts[currency],currency)));
    const track=make('div','','budget-category-track'),bar=make('span');bar.style.width=(item.amounts[currency]/totalsByCurrency[currency]*100)+'%';track.append(bar);line.append(caption,track);column.append(line);
   }
   columns.append(column);
  }
  section.append(columns);return section;
 }
 function dateLabel(value){const d=new Date(value);return value&&Number.isFinite(d.getTime())?d.toLocaleString('es-CU',{dateStyle:'short',timeStyle:'short'}):'';}
 function renderTimeline(request){
  const block=make('section','','budget-timeline');block.append(make('h3','Seguimiento de la solicitud'));
  const steps=make('ol','','budget-timeline-steps');
  const direct=request.direct_to_manager===true;
  const blocked=!direct&&request.status==='rejected'&&!request.manager_at;
  const reviewed=!!request.chief_at||(!direct&&['manager_pending','approved'].includes(request.status));
  const managerDone=!!request.manager_at||request.status==='approved'||(request.status==='rejected'&&!blocked);
  const states=[
   ['Solicitada','Registrada',request.created_at,'done'],
   ['Jefe de Área',direct?'Envío directo':blocked?'No aprobada':reviewed?'Aprobada':request.status==='chief_pending'?'En revisión':'Pendiente',request.chief_at,direct?'skipped':blocked?'rejected':reviewed?'done':request.status==='chief_pending'?'active':'pending'],
   ['Manager General',blocked?'No procede':managerDone?(request.status==='rejected'?'No aprobada':'Aprobada'):request.status==='manager_pending'?'En trámite':'Pendiente',request.manager_at,blocked?'skipped':managerDone?(request.status==='rejected'?'rejected':'done'):request.status==='manager_pending'?'active':'pending'],
   ['Resultado',request.status==='approved'?'Aprobada':request.status==='rejected'?'No aprobada':'Por definir',request.status==='approved'?request.manager_at:request.status==='rejected'?(request.manager_at||request.chief_at):null,request.status==='approved'?'done':request.status==='rejected'?'rejected':'pending']
  ];
  for(const [title,label,date,state] of states){
   const step=make('li','','budget-timeline-step');step.dataset.state=state;
   const marker=make('span',state==='done'?'✓':state==='rejected'?'×':state==='skipped'?'—':'','budget-timeline-marker');marker.setAttribute('aria-hidden','true');
   const copy=make('div');copy.append(make('strong',title),make('span',label));if(dateLabel(date))copy.append(make('small',dateLabel(date)));
   step.append(marker,copy);steps.append(step);
  }
  block.append(steps);return block;
 }
 function renderSummary({container,requests,selected,selectFilter,totals}){
  const panel=make('section','','area-chief-panel');
  panel.setAttribute('aria-label','Resumen de solicitudes de presupuesto');
  panel.innerHTML='<div class="area-chief-metrics"></div>';
  container.replaceChildren(panel);
  const metrics=panel.querySelector('.area-chief-metrics');
  const values=stages.map(([key,label,color,symbol])=>{
   const card=make('button','','area-chief-metric');card.type='button';card.setAttribute('aria-pressed',String(selected===key));card.title=selected===key?'Mostrar todas las solicitudes':'Mostrar '+label.toLowerCase();card.onclick=()=>selectFilter(key);card.style.setProperty('--area-accent',color);
   card.innerHTML=icon(symbol)+'<div><span>'+label+'</span><strong>—</strong></div>';metrics.append(card);
   return card.querySelector('strong');
  });
  const counts=Object.fromEntries(stages.map(([key])=>[key,requests.filter(request=>request.status===key).length]));
  stages.forEach(([key],index)=>{values[index].textContent=counts[key];});
  const pending=requests.filter(pendingStatus),approved=requests.filter(r=>r.status==='approved');
  const finance=make('div','','budget-finance-grid');finance.append(financeCard('Importes pendientes',pending,totals,'pending'),financeCard('Importes aprobados',approved,totals,'approved'));
  panel.append(finance,categoryChart(pending,totals));
  const dates=requests.flatMap(r=>[r.created_at,r.chief_at,r.manager_at]).filter(Boolean).map(d=>new Date(d).getTime()).filter(Number.isFinite);
  if(dates.length){const activity=make('p','Última actividad · '+dateLabel(new Date(dates.reduce((a,b)=>Math.max(a,b),0))),'budget-last-activity');panel.append(activity);}


 }
 window.CartelBudgetSummary={renderSummary,renderTimeline};
})();
