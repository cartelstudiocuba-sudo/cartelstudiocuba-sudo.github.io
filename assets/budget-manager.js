/* Manager General analytics. All amounts use the exchange rate saved on each request. */
(()=>{'use strict';
 // Explicit year/month extraction avoids locale-dependent ordering.
 function monthOf(date){const parts=new Intl.DateTimeFormat('es-CU',{timeZone:'America/Havana',year:'numeric',month:'2-digit'}).formatToParts(new Date(date));return parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;}
 const state={month:monthOf(Date.now()),area:'',category:'',priority:'',currency:'USD',breakdown:'area'};
 const kinds={'Abastecimiento de Nevera Audiovisual':'Abastecimiento de nevera','Compra de herramientas':'Equipos y herramientas','Equipos y accesorios':'Equipos y herramientas','Materiales de mantenimiento':'Materiales e insumos','Materias primas e insumos':'Materiales e insumos','Repuestos y componentes':'Mantenimiento y reparación','Reparaciones y servicios técnicos':'Mantenimiento y reparación'};
 const category=r=>kinds[r.kind]||r.kind||'Otros gastos';
 const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
 const money=(value)=>new Intl.NumberFormat('es-CU',{style:'currency',currency:state.currency,currencyDisplay:'code'}).format(value);
 function amount(r,totals){const t=totals(r),own=Number(t[state.currency]||0),other=Number(t[state.currency==='USD'?'CUP':'USD']||0),rate=Number(r.details?.exchange_rate);return other&&!(rate>0&&Number.isFinite(rate))?null:own+(other?(state.currency==='USD'?other/rate:other*rate):0);}
 function sum(rows,totals){return rows.reduce((a,r)=>{const v=amount(r,totals);if(v===null)a.missing++;else a.value+=v;return a;},{value:0,missing:0});}
 function filtered(rows){return rows.filter(r=>monthOf(r.created_at)===state.month&&(!state.area||r.area===state.area)&&(!state.category||category(r)===state.category)&&(!state.priority||r.priority===state.priority));}
 function select(label,values,current,change){const wrap=el('label',label),input=el('select');for(const [value,title] of values){const o=el('option',title);o.value=value;input.append(o);}input.value=current;input.onchange=()=>change(input.value);wrap.append(input);return wrap;}
 const shift=(key,n)=>{const [y,m]=key.split('-').map(Number),d=new Date(Date.UTC(y,m-1+n,1));return d.toISOString().slice(0,7);};
 const labelMonth=key=>new Intl.DateTimeFormat('es',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(key+'-01T12:00:00Z'));
 function render({container,requests,totals,selected,selectFilter,onChange}){
  const change=(key,value)=>{state[key]=value;onChange();};
  const months=[...new Set([state.month,monthOf(Date.now()),...requests.map(r=>monthOf(r.created_at))])].sort().reverse();
  const areas=[...new Set(requests.map(r=>r.area).filter(Boolean))].sort();
  const categories=[...new Set(requests.map(category))].sort();
  const toolbar=el('div','','manager-controls');
  toolbar.append(select('Período',months.map(m=>[m,labelMonth(m)]),state.month,v=>change('month',v)),select('Área',[['','Todas las áreas'],...areas.map(v=>[v,v])],state.area,v=>change('area',v)),select('Categoría',[['','Todas las categorías'],...categories.map(v=>[v,v])],state.category,v=>change('category',v)),select('Prioridad',[['','Todas'],...['Normal','Urgente','Crítica'].map(v=>[v,v])],state.priority,v=>change('priority',v)),select('Moneda',[['USD','USD'],['CUP','CUP']],state.currency,v=>change('currency',v)));
  const rows=filtered(requests),cards=el('div','','manager-kpis');
  for(const [key,title,icon,color] of [['all','Solicitado','▤','#ffda03'],['pending','Por aprobar','◷','#70b8ff'],['approved','Aprobado','✓','#52df85'],['rejected','No aprobado','×','#ff7474']]){
   const list=rows.filter(r=>key==='all'||r.status===key||(key==='pending'&&['chief_pending','manager_pending'].includes(r.status))),value=sum(list,totals);
   const b=el('button','','manager-kpi');b.type='button';b.style.setProperty('--metric',color);b.setAttribute('aria-pressed',String(selected===key));b.onclick=()=>selectFilter(key);
   const copy=el('span');copy.append(el('small',title),el('strong',money(value.value)),el('small',list.length+' solicitudes'+(key==='pending'?' · '+list.filter(r=>r.status==='manager_pending').length+' para el Manager':'')+(value.missing?' · '+value.missing+' sin tasa':'')));b.append(el('span',icon,'manager-kpi-icon'),copy);cards.append(b);
  }
  const panels=el('div','','manager-analytics'),trend=el('section','','manager-panel'),breakdown=el('section','','manager-panel');
  trend.append(el('h3','Evolución mensual del solicitado'));
  const keys=Array.from({length:6},(_,i)=>shift(state.month,i-5));
  const series=keys.map(key=>sum(requests.filter(r=>monthOf(r.created_at)===key&&(!state.area||r.area===state.area)&&(!state.category||category(r)===state.category)&&(!state.priority||r.priority===state.priority)),totals));
  const top=Math.max(1,...series.map(v=>v.value)),chart=el('div','','manager-trend');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 600 150');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
  const points=series.map((v,i)=>[50+i*100,140-v.value/top*125]);
  const line=document.createElementNS(svg.namespaceURI,'polyline');line.setAttribute('points',points.map(p=>p.join(',')).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#ffda03');line.setAttribute('stroke-width','3');line.setAttribute('vector-effect','non-scaling-stroke');svg.append(line);
  for(const [x,y] of points){const dot=document.createElementNS(svg.namespaceURI,'circle');dot.setAttribute('cx',x);dot.setAttribute('cy',y);dot.setAttribute('r','4');dot.setAttribute('fill','#ffda03');svg.append(dot);}
  chart.append(svg);
  keys.forEach((key,i)=>{const col=el('button','','manager-trend-col');col.type='button';col.title=labelMonth(key)+' · '+money(series[i].value)+(series[i].missing?' · '+series[i].missing+' sin tasa':'');col.onclick=()=>change('month',key);col.setAttribute('aria-pressed',String(key===state.month));col.append(el('strong',money(series[i].value)+(series[i].missing?' *':'')),el('span','','manager-trend-track'),el('small',labelMonth(key)));chart.append(col);});
  trend.append(chart);const prev=series[4],current=series[5];trend.append(el('small',prev.value&&!prev.missing&&!current.missing?'Variación vs. mes anterior: '+((current.value-prev.value)/prev.value*100).toFixed(1)+'%':'Comparación mensual · '+labelMonth(keys[4])+' / '+labelMonth(keys[5]),'manager-comparison'));
  if(series.some(v=>v.missing))trend.append(el('small','* Importe parcial por solicitudes sin tasa registrada.','manager-comparison'));
  const tabs=el('div','','manager-breakdown-tabs');for(const [key,title] of [['area','Por área'],['category','Por categorías']]){const b=el('button',title,'secondary');b.type='button';b.setAttribute('aria-pressed',String(state.breakdown===key));b.onclick=()=>change('breakdown',key);tabs.append(b);}breakdown.append(tabs);
  const breakdownKey=state.breakdown,groups=new Map();for(const r of rows){const key=breakdownKey==='area'?r.area:category(r);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
  const ranked=[...groups].map(([key,list])=>({key,...sum(list,totals)})).sort((a,b)=>b.value-a.value),total=sum(rows,totals).value;
  for(const row of ranked){const b=el('button','','manager-breakdown-row');b.type='button';b.onclick=()=>change(breakdownKey,state[breakdownKey]===row.key?'':row.key);const line=el('span','','manager-breakdown-line');line.append(el('span',row.key),el('strong',money(row.value)));const track=el('span','','manager-breakdown-track'),bar=el('span');bar.style.width=(total?row.value/total*100:0)+'%';track.append(bar);b.append(line,track,el('small',(total?Math.round(row.value/total*100):0)+'% del importe convertible'+(row.missing?' · '+row.missing+' sin tasa':'')));breakdown.append(b);}
  if(!ranked.length)breakdown.append(el('p','Sin solicitudes en este período.','empty'));
  panels.append(trend,breakdown);const note=el('p','Importes equivalentes según la tasa registrada en cada solicitud. '+(sum(rows,totals).missing?'Las solicitudes sin tasa se conservan en la lista; su importe equivalente queda excluido.':''),'manager-note');
  container.replaceChildren(toolbar,cards,panels,note);
 }
 window.CartelBudgetManager={render,filtered};
})();
