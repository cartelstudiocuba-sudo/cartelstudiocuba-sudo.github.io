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
  chart:'<circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/>',
  tools:'<path d="m4 20 8-8m-2-7 9 9m-4 0 5 5m-8-7 6-6m2 0-2-2"/>',
  supplies:'<path d="m3 7 9-4 9 4-9 4-9-4v10l9 4 9-4V7m-9 4v10"/>'
 };
 const icon=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[name]+'</svg>';
 const make=(tag,text='',className='')=>Object.assign(document.createElement(tag),{textContent:text,className});
 function mount({home,rate,client,userId,area,openBudget}){
  home.classList.add('area-chief-home');
  const panel=make('section','','area-chief-panel');
  panel.setAttribute('aria-label','Resumen de solicitudes de presupuesto');
  panel.innerHTML='<div class="area-chief-metrics"></div><div class="area-chief-columns"><section class="area-chief-card"><h2>'+icon('checklist')+'Solicitudes pendientes</h2><div class="area-chief-list" aria-live="polite"></div></section><section class="area-chief-card"><h2>'+icon('chart')+'Estado de solicitudes</h2><div class="area-chief-graph"></div></section></div>';
  rate.after(panel);
  const metrics=panel.querySelector('.area-chief-metrics'),list=panel.querySelector('.area-chief-list'),graph=panel.querySelector('.area-chief-graph');
  const values=stages.map(([,label,color,symbol])=>{
   const card=make('div','','area-chief-metric');card.style.setProperty('--area-accent',color);
   card.innerHTML=icon(symbol)+'<div><span>'+label+'</span><strong>—</strong></div>';metrics.append(card);
   return card.querySelector('strong');
  });
  let running=false,queued=false;
  function render(counts,pending){
   stages.forEach(([key],index)=>{values[index].textContent=counts[key];});
   list.replaceChildren();
   if(!pending.length)list.append(make('p','No hay solicitudes pendientes de aprobación.','area-chief-message'));
   else{
    const titles=make('div','','area-chief-row area-chief-row-head');titles.setAttribute('aria-hidden','true');
    for(const title of ['Solicitud','Solicitante','Fecha','Estado',''])titles.append(make('span',title));
    list.append(titles);
    for(const request of pending){
     const row=make('article','','area-chief-row'),name=make('div','','area-chief-request');
     const symbol=make('span','','area-chief-request-icon');symbol.innerHTML=icon(/reparaci[oó]n|mantenimiento|herramienta/i.test(request.kind||request.product)?'tools':'supplies');
     name.append(symbol,make('strong',request.product||request.kind||'Solicitud de presupuesto'));
     const date=make('time',new Date(request.created_at).toLocaleDateString('es-CU'));date.dateTime=request.created_at;
     const review=make('button','Revisar solicitud','area-chief-review');review.type='button';review.onclick=()=>openBudget(request.id);
     row.append(name,make('span',request.requester_name||'—'),date,make('span','En revisión','area-chief-state'),review);list.append(row);
    }
   }
   if(counts.chief_pending>pending.length){
    const all=make('button','Ver todas las solicitudes','area-chief-review');all.type='button';all.onclick=()=>openBudget();list.append(all);
   }
   const total=stages.reduce((sum,[key])=>sum+counts[key],0);
   const ring=make('div','','area-chief-ring');
   let cursor=0;
   if(total)ring.style.setProperty('--area-ring','conic-gradient('+stages.filter(([key])=>counts[key]).map(([key,,color])=>{const start=cursor;cursor+=counts[key]/total*100;return color+' '+start+'% '+cursor+'%';}).join(',')+')');
   const center=make('div');center.append(make('strong',String(total)),make('span',total===1?'Solicitud':'Solicitudes'));ring.append(center);
   ring.setAttribute('role','img');ring.setAttribute('aria-label',stages.map(([key,label])=>label+' '+counts[key]).join(', '));graph.replaceChildren(ring);
  }
  async function refresh(){
   if(running){queued=true;return;}
   running=true;
   try{
    const counts=Object.fromEntries(stages.map(([key])=>[key,0])),pending=[];
    const base=()=>client.from('purchase_budget_requests');
    const scope=query=>query.eq('area',area).neq('requester',userId);
    const jobs=stages.map(([key])=>scope(base().select('id',{head:true,count:'exact'})).eq('status',key));
    const rows=scope(base().select('id,product,kind,requester_name,created_at')).eq('status','chief_pending').order('created_at',{ascending:false}).order('id').limit(8);
    const results=await Promise.all([...jobs,rows]);
    if(results.some(result=>result.error))throw new Error('read_failed');
    stages.forEach(([key],index)=>{counts[key]=results[index].count||0;});
    pending.push(...results[stages.length].data);
    render(counts,pending);
   }catch{
    const retry=make('button','Reintentar','area-chief-review');retry.type='button';retry.onclick=refresh;
    list.replaceChildren(make('p','No se pudieron consultar las solicitudes.','area-chief-message'),retry);
   }finally{running=false;if(queued){queued=false;setTimeout(refresh,300);}}
  }
  list.append(make('p','Consultando solicitudes…','area-chief-message'));
  setTimeout(refresh,500);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(refresh,500);});
  window.addEventListener('message',event=>{
   if(event.origin===location.origin&&event.source===document.getElementById('frame')?.contentWindow&&event.data?.type==='purchase-budget-changed')void refresh();
  });
 }
 window.CartelAreaChiefHome={mount};
})();
