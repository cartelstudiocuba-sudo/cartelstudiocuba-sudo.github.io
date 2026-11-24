(() => {
 'use strict';
 const colors={yellow:'#ffda03',green:'#50dc87',red:'#ff747b',blue:'#71bcff'};
 const number=value=>Number(value||0).toLocaleString('es-CU',{maximumFractionDigits:2});
 const money=value=>Number(value||0).toLocaleString('es-CU',{minimumFractionDigits:2,maximumFractionDigits:2})+' USD';
 function element(tag,text='',className=''){
  const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;
 }
 function metric(label,value,color){
  const card=element('div','','worker-metric');card.style.setProperty('--metric-color',color);
  card.append(element('span',label),element('strong',value));return card;
 }
 function graph(title,rows,formatter=number){
  const panel=element('section','','worker-chart');panel.append(element('h3',title));
  const maximum=Math.max(1,...rows.map(row=>Number(row.value)||0));
  for(const row of rows){
   const group=element('div','','worker-chart-row'),legend=element('div','','worker-chart-label'),track=element('div','','worker-track'),bar=element('div','','worker-bar');
   legend.append(element('span',row.label),element('strong',formatter(row.value)));
   bar.style.width=(Math.max(0,Number(row.value)||0)/maximum*100)+'%';bar.style.background=row.color;
   track.setAttribute('aria-hidden','true');track.append(bar);group.append(legend,track);panel.append(group);
  }
  return panel;
 }
 function stockRows(products){
  const active=products.filter(product=>product.active);
  const empty=active.filter(product=>Number(product.stock)<=0).length;
  const low=active.filter(product=>Number(product.stock)>0&&Number(product.stock)<=Number(product.minimum)).length;
  return [{label:'Agotados',value:empty,color:colors.red},{label:'Pocas unidades',value:low,color:colors.yellow},{label:'En stock',value:active.length-empty-low,color:colors.green}];
 }
 async function budgetRows(client,user){
  const states=[['chief_pending','En revisión',colors.yellow],['manager_pending','En trámite',colors.blue],['approved','Aprobadas',colors.green],['rejected','No aprobadas',colors.red]];
  return Promise.all(states.map(async ([status,label,color])=>{
   const result=await client.from('purchase_budget_requests').select('id',{head:true,count:'exact'}).eq('requester',user.id).eq('status',status);
   if(result.error)throw result.error;return {label,color,value:result.count||0};
  }));
 }
 function mount(home,client,user,technical){
  const panel=element('section','','worker-summary');panel.setAttribute('aria-labelledby','worker-summary-title');
  const heading=element('div','','worker-summary-heading'),title=element('h2',technical?'Resumen de abastecimiento':'Resumen de la operación');title.id='worker-summary-title';
  const refresh=element('button','↻ Actualizar','worker-summary-refresh');refresh.type='button';heading.append(title,refresh);
  const body=element('div','','worker-summary-body');body.setAttribute('aria-live','polite');panel.append(heading,body);
  const rate=home.querySelector('#exchange-mobile-trigger');rate.after(panel);
  let loading=false;
  async function load(){
   if(loading)return;loading=true;refresh.disabled=true;body.setAttribute('aria-busy','true');
   if(!body.children.length)body.append(element('p','Consultando información…','worker-summary-message'));
   try{
    const result=await client.rpc('fridge_state');if(result.error)throw result.error;
    const state=result.data,products=state.products||[],stock=stockRows(products),cards=element('div','','worker-metrics'),charts=element('div','','worker-charts');
    if(technical){
     const active=products.filter(product=>product.active);
     cards.append(metric('Productos activos',number(active.length),colors.blue),metric('Unidades disponibles',number(active.reduce((sum,p)=>sum+Number(p.stock||0),0)),colors.green),metric('Stock bajo',number(stock[1].value),colors.yellow),metric('Agotados',number(stock[0].value),colors.red));
     charts.append(graph('Estado de existencias',stock));
     try{charts.append(graph('Mis solicitudes de presupuesto',await budgetRows(client,user)));}
     catch{charts.append(element('section','No se pudieron consultar las solicitudes de presupuesto.','worker-chart worker-summary-message'));}
    }else{
     const stats=state.stats||{};
     cards.append(metric('Ventas de hoy',money(stats.sales_today),colors.yellow),metric('Cobrado hoy',money(stats.collected_today),colors.green),metric('Por cobrar',money(stats.owed),colors.red),metric('Cuentas abiertas',number(stats.open_accounts),colors.blue));
     charts.append(graph('Movimientos de hoy',[{label:'Ventas',value:stats.sales_today,color:colors.yellow},{label:'Cobros',value:stats.collected_today,color:colors.green}],money),graph('Disponibilidad de productos',stock));
    }
    body.replaceChildren(cards,charts);
   }catch{body.replaceChildren(element('p','No se pudo actualizar el resumen. Pulsa Actualizar para volver a intentarlo.','worker-summary-message'));}
   finally{loading=false;refresh.disabled=false;body.removeAttribute('aria-busy');}
  }
  refresh.onclick=load;document.querySelector('[data-home]')?.addEventListener('click',load);void load();
 }
 window.CartelWorkerHome={mount};
})();
