(()=>{
 'use strict';
 const colors={yellow:'#ffda03',red:'#ff707d',green:'#54df8b',blue:'#71bcff'};
 const element=(tag,text='',className='')=>Object.assign(document.createElement(tag),{textContent:text,className});
 const fmt=value=>Number(value).toLocaleString('es-CU',{maximumFractionDigits:2});
 const paths={box:'<path d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4m-9 4v10"/>',alert:'<path d="M12 3 2 20h20L12 3Zm0 6v5m0 3h.01"/>',truck:'<path d="M3 6h11v11H3V6Zm11 4h4l3 4v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',budget:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8m-8 4h8m-8 4h5"/>',history:'<path d="M3 12a9 9 0 1 0 3-7M3 4v8h7m2-5v5l3 2"/>'};
 function icon(name){const n=element('span','','admin-overview-icon');n.setAttribute('aria-hidden','true');n.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+paths[name]+'</svg>';return n;}
 async function products(client){
  const rows=[];
  for(let offset=0;;offset+=500){
   const result=await client.from('inventory_products').select('id,name,stock,minimum_stock,unit').is('deleted_at',null).order('id').range(offset,offset+499);
   if(result.error)throw result.error;
   rows.push(...result.data);
   if(result.data.length<500)return rows;
  }
 }
 async function count(query){const r=await query;if(r.error)throw r.error;return r.count??0;}
 function mount({home,rate,client,userId,openModule,available}){
  if(home.querySelector('.admin-overview'))return;
  const panel=element('section','','admin-overview');
  const header=element('div','','admin-overview-heading'),refresh=element('button','↻ Actualizar','admin-overview-refresh');
  refresh.type='button';header.append(element('h2','Resumen de almacén y abastecimiento'),refresh);
  const grid=element('div','','admin-overview-metrics'),detail=element('div','','admin-overview-details'),actions=element('div','','admin-overview-actions');
  const status=element('p','','admin-overview-message');status.setAttribute('role','status');
  panel.append(header,grid,detail,element('h2','Accesos de trabajo'),actions,status);rate.after(panel);
  const routes=[['Insumos','Entradas, salidas y existencias','/inventario-insumos.html','box'],['Pedidos y entregas','Preparación y entrega de pedidos','/inventario-pedidos.html','truck'],['Solicitud de insumos','Crear y consultar solicitudes','/inventario-solicitud.html','budget'],['Solicitud de presupuesto','Gestionar compras y gastos','/inventario-presupuesto.html','budget']];
  for(const [title,subtitle,route,symbol] of routes.filter(r=>available(r[2]))){
   const action=element('button','','admin-overview-action');action.type='button';
   const copy=element('span');copy.append(element('strong',title),element('small',subtitle));action.append(icon(symbol),copy,element('span','›','admin-overview-chevron'));action.onclick=()=>openModule(route);actions.append(action);
  }
  const metric=(title,value,color,symbol)=>{
   const card=element('article','','admin-overview-metric');card.style.setProperty('--metric',color);
   const copy=element('div');copy.append(element('span',title),element('strong',value===null?'—':fmt(value)));card.append(icon(symbol),copy);grid.append(card);
  };
  const section=title=>{const card=element('section','','admin-overview-card');card.append(element('h3',title));detail.append(card);return card;};
  const row=(card,label,value,color)=>{const line=element('div','','admin-overview-row');const amount=element('strong',value);amount.style.color=color;line.append(element('span',label),amount);card.append(line);};
  let running=false;
  async function load(){
   if(running)return;running=true;refresh.disabled=true;status.textContent='Actualizando…';
   const hasOrders=available('/inventario-pedidos.html'),hasBudget=available('/inventario-presupuesto.html');
   const stockJob=products(client);
   const ordersJob=hasOrders?count(client.from('inventory_orders').select('id',{head:true,count:'exact'}).in('status',['approved','preparing','partial'])):Promise.resolve(null);
   const budgetJob=hasBudget?count(client.from('purchase_budget_requests').select('id',{head:true,count:'exact'}).eq('requester',userId).in('status',['chief_pending','manager_pending'])):Promise.resolve(null);
   try{
    const results=await Promise.allSettled([stockJob,ordersJob,budgetJob]);
    const stock=results[0].status==='fulfilled'?results[0].value:null;
    const orders=results[1].status==='fulfilled'?results[1].value:null;
    const budgets=results[2].status==='fulfilled'?results[2].value:null;
    const empty=stock?.filter(p=>Number(p.stock)<=0),low=stock?.filter(p=>Number(p.stock)>0&&Number(p.stock)<=Number(p.minimum_stock));
    grid.replaceChildren();detail.replaceChildren();
    metric('Insumos registrados',stock?.length??null,colors.blue,'box');
    metric('Agotados',empty?.length??null,colors.red,'alert');
    metric('Pocas unidades',low?.length??null,colors.yellow,'alert');
    if(hasOrders)metric('Pedidos por entregar',orders,colors.green,'truck');
    const chart=section('Disponibilidad de insumos');
    if(stock){
     for(const [label,n,color] of [['En stock',stock.length-empty.length-low.length,colors.green],['Pocas unidades',low.length,colors.yellow],['Agotados',empty.length,colors.red]]){
      row(chart,label,fmt(n),color);
      const track=element('div','','admin-overview-track'),bar=element('span');bar.style.width=(stock.length?n/stock.length*100:0)+'%';bar.style.background=color;track.append(bar);chart.append(track);
     }
    }else chart.append(element('p','No se pudo consultar el inventario.','admin-overview-message'));
    const pending=section('Pendientes de atención');
    if(hasOrders)row(pending,'Pedidos por preparar o entregar',orders===null?'—':fmt(orders),colors.green);
    if(hasBudget)row(pending,'Presupuestos propios en trámite',budgets===null?'—':fmt(budgets),colors.blue);
    if(stock){
     const urgent=[...empty,...low];
     pending.append(element('h4','Insumos que requieren abastecimiento'));
     for(const p of urgent.slice(0,5))row(pending,p.name,fmt(p.stock)+' '+(p.unit||''),Number(p.stock)<=0?colors.red:colors.yellow);
     if(!urgent.length)pending.append(element('p','Sin alertas de existencias.','admin-overview-message'));
     if(urgent.length>5)pending.append(element('p','+'+(urgent.length-5)+' insumos pendientes','admin-overview-message'));
    }
    status.textContent=results.some(r=>r.status==='rejected')?'Algunos datos no están disponibles. Puedes actualizar de nuevo.':'Actualizado · '+new Date().toLocaleTimeString('es-CU',{hour:'2-digit',minute:'2-digit'});
   }finally{running=false;refresh.disabled=false;}
  }
  refresh.onclick=load;setTimeout(load,500);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void load();});
 }
 window.CartelAdministratorOverview={mount};
})();
