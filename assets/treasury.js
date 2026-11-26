(()=>{'use strict';
 const $=id=>document.getElementById(id),client=CartelLoad.createClient('https://jhumvctocphyiwhszeaz.supabase.co','sb_publishable_ZHV-5dlsjfamQpfUOsgumg_G-vN84Gn',{auth:{persistSession:true,autoRefreshToken:true,storage:localStorage}});
 const el=(tag,t='',c='')=>{const n=document.createElement(tag);n.textContent=t;if(c)n.className=c;return n;};
 const numberFormatter=new Intl.NumberFormat('es-CU',{minimumFractionDigits:2,maximumFractionDigits:2}),currencyFormatters=new Map();
 const numberAmount=amount=>numberFormatter.format(Number(amount||0));
 const money=(amount,c)=>{if(!currencyFormatters.has(c))currencyFormatters.set(c,new Intl.NumberFormat('es-CU',{style:'currency',currency:c,currencyDisplay:'code'}));return currencyFormatters.get(c).format(Number(amount||0));};
 // Presentation only. Each counter keeps its exact final formatted value.
 const motionValues=new WeakMap(),motionRuns=new Map();
 const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
 function motionValue(node,formatter){motionValues.set(node,formatter);return node;}
 function stopMotion(root){motionRuns.get(root)?.finish();}
 function animateDashboard(root,{entrance=false}={}){
  stopMotion(root);
  if(motionPreference.matches||document.hidden)return;
  const counters=[...root.querySelectorAll('[data-treasury-counter]')].map(node=>({node,format:motionValues.get(node),final:node.textContent,label:node.getAttribute('aria-label')})).filter(v=>v.format);
  const bars=[...root.querySelectorAll('.flow-bar,.distribution-track span,.fund-month-track span,.fund-stat-track span')];
  const animations=[];
  for(const v of counters){v.node.setAttribute('aria-label',v.final);v.node.textContent=v.format(0);}
  function animate(node,frames,options){if(typeof node.animate==='function')animations.push(node.animate(frames,options));}
  bars.forEach((bar,index)=>{
   const vertical=bar.classList.contains('flow-bar')||bar.parentElement?.classList.contains('fund-month-track');
   animate(bar,[{transform:vertical?'scaleY(0)':'scaleX(0)',transformOrigin:vertical?'bottom':'left'},{transform:'scale(1)',transformOrigin:vertical?'bottom':'left'}],{duration:850,delay:Math.min(index*36,180),easing:'cubic-bezier(.22,.7,.25,1)',fill:'backwards'});
  });
  for(const rail of root.querySelectorAll('.fund-proportion-fill'))animate(rail,[{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0 0 0)'}],{duration:850,easing:'cubic-bezier(.22,.7,.25,1)',fill:'backwards'});
  for(const arc of root.querySelectorAll('.fund-gauge-progress')){
   animate(arc,[{strokeDashoffset:'100'},{strokeDashoffset:arc.getAttribute('stroke-dashoffset')}],{duration:850,easing:'cubic-bezier(.22,.7,.25,1)',fill:'backwards'});
  }
  if(entrance){
   [...root.querySelectorAll('.treasury-card,.treasury-summary,.fund-main-banner,.treasury-heading,.fund-month-section,.fund-average-card')].forEach((node,index)=>animate(node,[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:500,delay:Math.min(index*45,225),easing:'cubic-bezier(.22,.7,.25,1)',fill:'backwards'}));
  }
  let frame=0,start=null;
  const finish=()=>{
   cancelAnimationFrame(frame);
   for(const v of counters){v.node.textContent=v.final;if(v.label===null)v.node.removeAttribute('aria-label');else v.node.setAttribute('aria-label',v.label);}
   for(const animation of animations)animation.cancel();
   motionRuns.delete(root);
  };
  motionRuns.set(root,{finish});
  const tick=now=>{
   if(document.hidden||motionPreference.matches||!root.isConnected){finish();return;}
   if(start===null)start=now;
   const time=Math.min(1,(now-start)/1030),progress=1-Math.pow(1-Math.min(1,(now-start)/850),3);
   for(const v of counters)v.node.textContent=v.format(progress);
   if(time===1)finish();else frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);
 }
 function counter(tag,formatter,cls=''){const node=el(tag,formatter(1),cls);node.dataset.treasuryCounter='';return motionValue(node,formatter);}
 function amountCounter(tag,value,currency,cls=''){return counter(tag,p=>money(value*p,currency),cls);}
 function stopDashboardMotion(){for(const root of [...motionRuns.keys()])stopMotion(root);}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopDashboardMotion();});
 motionPreference.addEventListener?.('change',e=>{if(e.matches)stopDashboardMotion();});

 let state,selected=null,rate=null,rateDate=null,offset=0,busy=false,action=null,requestId=null;
 const workers=new URLSearchParams(location.search).get('tab')==='workers';
 if(workers)$('treasury-title').textContent='Pagos a trabajadores';
 const colors={fixed:'#ffda03',investment:'#ff9e83',supplies:'#4fc4ff',stimulus:'#bba3ff',profit:'#58e0a0',surplus:'#68d9d5',workers:'#ffda03'};
 const chartMonth=$('chart-month'),chartYear=$('chart-year'),chartCurrency=$('chart-currency');
 const todayParts=new Intl.DateTimeFormat('en',{timeZone:'America/Havana',year:'numeric',month:'numeric'}).formatToParts(new Date());
 const currentYear=Number(todayParts.find(p=>p.type==='year').value),currentMonth=Number(todayParts.find(p=>p.type==='month').value);
 for(let month=1;month<=12;month++){const option=el('option',new Intl.DateTimeFormat('es',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2020,month-1,1))));option.value=String(month);chartMonth.append(option);}
 for(let year=currentYear+1;year>=1900;year--){const option=el('option',String(year));option.value=String(year);chartYear.append(option);}
 function period(){return chartYear.value+'-'+chartMonth.value.padStart(2,'0');}
 function setPeriod(year,month){chartYear.value=String(year);chartMonth.value=String(month);$('chart-prev').disabled=year===1900&&month===1;$('chart-next').disabled=year===currentYear+1&&month===12;}
 setPeriod(currentYear,currentMonth);
 $('treasury-overview').hidden=workers;
 const icons={fixed:'▤',investment:'↗',supplies:'◇',stimulus:'★',profit:'$',surplus:'＋',workers:'♙'};
 async function rpc(name,args={}){const {data,error}=await client.rpc(name,args);if(error)throw error;return data;}
 async function run(fn){if(busy)return;busy=true;$('treasury-save').disabled=true;try{await fn();}catch(e){$( $('treasury-dialog').open?'treasury-error':'treasury-message').textContent=e.message||'No se pudo completar';}finally{busy=false;$('treasury-save').disabled=false;}}
 function fundGlyph(code){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
 const paths={fixed:'M3 6c0-2 4-3 9-3s9 1 9 3-4 3-9 3-9-1-9-3Zm0 0v5c0 2 4 3 9 3s9-1 9-3V6M3 11v5c0 2 4 3 9 3s9-1 9-3v-5',investment:'M4 20v-6m5 6V9m5 11V5m5 15V2',profit:'m3 17 6-6 4 4 8-10m-6 0h6v6',stimulus:'M3 10h18v11H3zM2 6h20v4H2zM12 6v15M12 6C6 6 5 2 8 2c2 0 4 4 4 4Zm0 0c6 0 7-4 4-4-2 0-4 4-4 4Z',supplies:'m12 2 9 5v10l-9 5-9-5V7l9-5Zm0 10v10M3 7l9 5 9-5',surplus:'m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5',workers:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21v-3a8 8 0 0 1 16 0v3'};
 const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',paths[code]||paths.fixed);svg.append(path);return svg;
 }
 function render(){
 stopDashboardMotion();
 const cards=$('treasury-funds');cards.replaceChildren();
 const funds=state.funds.filter(f=>Boolean(f.worker)===workers);
 for(const f of funds){
 const cup=Number(f.CUP),usd=Number(f.USD),converted=rate>0?usd+cup/rate:null,negative=converted===null?cup<0||usd<0:converted<0;
 const b=el('button','','treasury-card');b.type='button';
 b.style.setProperty('--fund-color',negative?'#ff727d':colors[f.code]);
 b.setAttribute('aria-pressed',String(selected===f.code));
 const icon=el('span','','compact-fund-icon');
 icon.append(fundGlyph(f.code));icon.setAttribute('aria-hidden','true');
 const body=el('div','','compact-fund-body');body.append(el('strong',f.label,'compact-fund-title'));
 if(converted!==null)body.append(amountCounter('span',cup+usd*rate,'CUP',negative?'negative':''));else for(const c of ['CUP','USD'])body.append(amountCounter('span',Number(f[c]),c,Number(f[c])<0?'negative':''));
 if(negative&&f.code==='investment')body.append(el('small','Capital pendiente del CEO','compact-fund-debt'));
 const equivalent=el('div','','compact-fund-equivalent');
 equivalent.append(el('small','Saldo USD'),converted===null?el('strong','—'):counter('strong',p=>numberAmount(converted*p),converted<0?'negative':''));
 equivalent.title=rate>0?'Tasa del día · '+rateDate:'Tasa del día no disponible';
 const arrow=el('span','›','compact-fund-arrow');arrow.setAttribute('aria-hidden','true');
 b.append(icon,body,equivalent,arrow);
 b.onclick=()=>run(()=>openFundDetail(f.code));
 cards.append(b);
 }
 const f=funds.find(f=>f.code===selected);if(!workers)renderOverview(funds);if(!f)return;$('fund-title').textContent=f.label;renderFundBalance(f);$('fund-dispatch').hidden=f.code!=='profit'||state.owner;$('treasury-dispatches').hidden=f.code!=='profit';renderDispatches();}
 async function openFundDetail(code){
 selected=code;summaryData=null;lastSummaryRender=null;resetHistoryFilters();render();
 const detail=$('treasury-detail');detail.showModal();
 animateDashboard(detail.querySelector('.fund-main-banner'),{entrance:false});
 if(!motionPreference.matches&&!document.hidden&&typeof detail.animate==='function')detail.animate([{opacity:0,transform:'translateY(10px) scale(.985)'},{opacity:1,transform:'none'}],{duration:340,easing:'cubic-bezier(.22,.7,.25,1)'});
 await Promise.all([history(),loadFundStatistics(code)]);
 }
 function renderDispatches(){const target=$('treasury-dispatches');target.replaceChildren();if(selected!=='profit')return;target.append(el('h3','Cuadres con el CEO'));for(const d of state.dispatches){const row=el('div','','treasury-dispatch');row.append(el('strong',money(d.cup,'CUP')+' + '+money(d.usd,'USD')),el('p',new Date(d.created_at).toLocaleString('es-CU')+' · '+(d.status==='pending'?'Pendiente de recibido':'Recibido confirmado')),el('p',d.note));if(state.owner&&d.status==='pending'){const b=el('button','Confirmar recibido','primary');b.onclick=()=>{open('Confirmar recibido del CEO',()=>rpc('treasury_confirm_dispatch',{p_id:d.id}),[el('p','Confirmas haber recibido '+money(d.cup,'CUP')+' y '+money(d.usd,'USD')+'.')]);};row.append(b);}if(d.status==='confirmed'){const b=el('button','Imprimir comprobante','secondary');b.onclick=()=>printDispatch(d);row.append(b);}target.append(row);}if(!state.dispatches.length)target.append(el('p','Todavía no hay cuadres.'));}
 function printDispatch(d){const w=window.open('','_blank');if(!w){$('treasury-message').textContent='Permite la ventana emergente para imprimir.';return;}const doc=w.document;doc.title='Comprobante de utilidad';const style=doc.createElement('style');style.textContent='@page{size:80mm auto;margin:4mm}body{font:12px Arial;width:72mm;margin:0}h2{text-align:center}p{overflow-wrap:anywhere}';doc.head.append(style);for(const t of ['EL CARTEL STUDIO','Comprobante de utilidad','Recibido confirmado',money(d.cup,'CUP'),money(d.usd,'USD'),new Date(d.confirmed_at).toLocaleString('es-CU'),d.note||'','Firma del CEO: __________________']){const p=doc.createElement('p');p.textContent=t;doc.body.append(p);}w.print();}
 const historyMonth=$('history-month'),historyYear=$('history-year'),historyCurrency=$('history-currency');
 const historyKinds=[...$('history-kinds').querySelectorAll('button')];
 let historyKind='all',historyRequest=0,auditPreviousPeriod=null;
 for(const option of chartMonth.options)historyMonth.append(option.cloneNode(true));
 for(const option of chartYear.options)historyYear.append(option.cloneNode(true));
 function resetHistoryFilters(){
 offset=0;historyKind='all';auditPreviousPeriod=null;historyMonth.setAttribute('aria-label','Mes de movimientos');historyMonth.value=String(currentMonth);historyYear.value=String(currentYear);historyYear.disabled=false;historyCurrency.value='all';$('history-search').value='';$('history-area').replaceChildren(new Option('Todas las áreas',''));
 for(const button of historyKinds)button.setAttribute('aria-pressed',String(button.dataset.kind==='all'));
 }
 function combinedAmount(cup,usd){
 const block=el('div','','combined-amount');
 const total=rate>0?usd+cup/rate:null;
 block.append(total===null?el('strong','—'):amountCounter('strong',total,'USD'),rate>0?counter('small',p=>'('+money((cup+usd*rate)*p,'CUP')+')'):counter('small',p=>'CUP '+numberAmount(cup*p)+' · USD '+numberAmount(usd*p)));
 return block;
 }
 function renderFundBalance(f){
 const target=$('fund-balance'),banner=target.closest('.fund-main-banner');stopMotion(banner);target.replaceChildren();
 const art=banner.querySelector('.fund-wallet-art');art.dataset.fund=f.code;art.replaceChildren();if(f.code!=='fixed')art.append(fundGlyph(f.code));
 const body=el('div','','fund-balance-main'),amount=combinedAmount(Number(f.CUP),Number(f.USD));
 body.append(el('small','Saldo actual · equivalente USD'),amount);target.append(body);
 $('fund-wallet-rate').textContent=rate>0?'1 USD = '+rate+' CUP · '+rateDate:'Tasa de referencia no disponible';
 }
 const sourceLabels={excel:'Histórico Excel',bar:'Cuadre de nevera',manual:'Manual',budget:'Solicitud de presupuesto',ceo_dispatch:'Cuadre CEO',transfer:'Traspaso entre fondos'};
 function movementDisplay(amount,currency){
  const sign=amount>0?'+':amount<0?'−':'',absolute=Math.abs(amount);
  const validRate=Number.isFinite(rate)&&rate>0;
  const usd=currency==='USD'?absolute:validRate?absolute/rate:null;
  const cup=currency==='CUP'?absolute:validRate?absolute*rate:null;
  return {principal:usd===null?'USD —':sign+money(usd,'USD'),equivalent:cup===null?'(CUP — · tasa no disponible)':'('+sign+money(cup,'CUP')+')'};
 }
 function updateHistoryEquivalents(){
  for(const value of document.querySelectorAll('.history-equivalent')){
   const display=movementDisplay(Number(value.dataset.amount),value.dataset.currency);
   value.textContent=display.equivalent;
   value.parentElement.querySelector('.history-amount').textContent=display.principal;
  }
 }
 function movementCard(r,global=false){
 const amount=Number(r.amount),type=r.source==='transfer'?'transfer':amount>0?'income':amount<0?'expense':'neutral';
 const row=el('article','','history-movement '+type),info=el('div','','history-movement-info');
 const title=el('strong',r.concept);
 const detail=[r.area,sourceLabels[r.source]||r.source].filter(Boolean);
 if(global){
 const badge=el('span',r.fund_label,'activity-fund');badge.style.setProperty('--fund-color',colors[r.fund]||'#a8bdcc');
 const meta=el('div','','activity-meta');meta.append(badge,el('small',detail.join(' · ')));info.append(title,meta);
 const date=r.source==='excel'?dateLabel(r.occurred_on):new Date(r.created_at).toLocaleString('es-CU',{timeZone:'America/Havana',dateStyle:'medium',timeStyle:'short'});
 info.append(el('small',[date,r.actor_name||(r.source==='excel'?'Importación histórica':'Usuario sin nombre registrado')].join(' · ')));
 }else{
 if(r.category&&!['Ingreso','Egreso'].includes(r.category))detail.push(r.category);if(r.declared_rate)detail.push('Tasa declarada '+r.declared_rate+' CUP/USD');
 info.append(title,el('small',detail.join(' · ')));
 if(r.has_receipt){const button=el('button','Ver comprobante','secondary history-receipt');button.type='button';button.onclick=()=>run(async()=>{const data=await rpc('treasury_receipt',{p_id:r.id});if(!data)throw Error('Comprobante no disponible.');const bytes=Uint8Array.from(atob(data.content),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:data.mime})),a=el('a');a.href=url;a.download=data.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);});info.append(button);}
 }
 const display=movementDisplay(amount,r.currency),amounts=el('div','','history-amounts'),reference=el('small',display.equivalent,'history-equivalent');
 reference.dataset.amount=String(amount);reference.dataset.currency=r.currency;
 amounts.append(el('strong',display.principal,'history-amount'),reference);
 if(!global){const arrow=el('span',type==='income'?'↓':type==='expense'?'↑':type==='transfer'?'⇄':'·','history-direction');arrow.setAttribute('aria-hidden','true');row.append(arrow);}row.append(info,amounts);
 if(!global&&['manual','excel'].includes(r.source)){
  const actions=el('div','','history-correction-actions'),edit=el('button','✎','history-edit'),remove=el('button','×','history-delete');
  edit.type=remove.type='button';edit.title='Editar movimiento';remove.title='Eliminar movimiento';
  edit.setAttribute('aria-label','Editar '+r.concept);remove.setAttribute('aria-label','Eliminar '+r.concept);
  edit.onclick=()=>editMovement(r);remove.onclick=()=>deleteMovement(r);actions.append(edit,remove);row.classList.add('has-corrections');row.append(actions);
 }
 return row;
 }
 function dateLabel(date){return date?new Intl.DateTimeFormat('es-CU',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z')):'Sin fecha';}
 let summaryData=null,summaryFund=null,summaryRequest=0,lastSummaryRender=null;
 const histMonth=()=>historyMonth.value==='all'?null:historyYear.value+'-'+historyMonth.value.padStart(2,'0')+'-01';
 function historyArgs(fund,page){return {p_fund:fund,p_offset:page,p_month:histMonth(),p_kind:historyKind,p_currency:historyCurrency.value,p_search:$('history-search').value.trim(),p_area:$('history-area').value};}
 function monthIndex(date){return Number(date.slice(0,4))*12+Number(date.slice(5,7))-1;}
 function renderFundStatistics(){
 const target=$('fund-statistics'),month=historyKind==='audit'&&auditPreviousPeriod?(auditPreviousPeriod.month==='all'?null:auditPreviousPeriod.year+'-'+auditPreviousPeriod.month.padStart(2,'0')+'-01'):histMonth(),label=$('fund-period-label');
 label.textContent=month?new Intl.DateTimeFormat('es-CU',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'T00:00:00Z')):'Todo el histórico';
 if(!summaryData||summaryFund!==selected){stopMotion(target);lastSummaryRender=null;target.textContent='Consultando resumen…';return;}
 if(lastSummaryRender?.data===summaryData&&lastSummaryRender.month===month&&lastSummaryRender.rate===rate&&lastSummaryRender.fund===selected)return;
 stopMotion(target);lastSummaryRender={data:summaryData,month,rate,fund:selected};target.replaceChildren();
 const now=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Havana',year:'numeric',month:'2-digit'}).formatToParts(new Date()),year=Number(now.find(p=>p.type==='year').value),m=Number(now.find(p=>p.type==='month').value),end=year*12+m-1;
 const historicalOutlier=selected==='fixed'&&summaryData.first_date&&summaryData.first_date<'2023-01-01';
 const first=historicalOutlier?'2023-01-06':summaryData.first_date,start=first?monthIndex(first)+(first.slice(8,10)==='01'?0:1):end,months=Math.max(0,end-start);
 const rows=summaryData.months||[],periodRows=rows.filter(r=>!month||r.month===month),past=rows.filter(r=>monthIndex(r.month)>=start&&monthIndex(r.month)<end);
 function totals(list,key,divisor=1){return ['CUP','USD'].map(c=>list.filter(r=>r.currency===c).reduce((n,r)=>n+Number(r[key]),0)/divisor);}
 const income=totals(periodRows,'income'),expense=totals(periodRows,'expense'),avgIn=months?totals(past,'income',months):null,avgOut=months?totals(past,'expense',months):null;
 const inUsd=a=>rate>0?a[1]+a[0]/rate:null;
 function netBlock(label,income,expense){const row=el('div','','fund-result'),net=income&&expense?[income[0]-expense[0],income[1]-expense[1]]:null;const value=net?inUsd(net):null;row.dataset.tone=value===null||value===0?'neutral':value>0?'positive':'negative';row.append(el('span',label),net?combinedAmount(...net):el('strong','—'));return row;}
 const panel=el('article','','fund-month-proportional'),metrics=el('div','','fund-month-metrics');
 const incomeUsd=inUsd(income),expenseUsd=inUsd(expense),totalUsd=incomeUsd===null||expenseUsd===null?null:incomeUsd+expenseUsd;
 const incomeShare=totalUsd>0?100*incomeUsd/totalUsd:0,expenseShare=totalUsd>0?100-incomeShare:0;
 const rail=el('div','','fund-proportion-rail'),fill=el('div','','fund-proportion-fill');
 for(const [name,amount,kind,share] of [['Ingresos',income,'income',incomeShare],['Egresos',expense,'expense',expenseShare]]){
  const metric=el('div','','fund-month-metric '+kind),title=el('div','','fund-month-column-title');
  title.append(el('span',kind==='income'?'↓':'↑','fund-direction'),el('span',name));
  metric.append(title,combinedAmount(...amount));
  if(totalUsd>0){
   const segment=el('div','','fund-proportion-segment '+kind);segment.style.width=share+'%';
   const percentage=counter('span',p=>(share*p).toFixed(1)+'%','fund-proportion-percent');
   if(share>=18)segment.append(percentage);else metric.append(percentage);
   fill.append(segment);
  }
  metrics.append(metric);
 }
 panel.append(metrics);
 if(totalUsd>0){rail.append(fill);panel.append(rail);}
 else panel.append(el('div',totalUsd===null?'Tasa de referencia no disponible':'Sin movimientos en el período','fund-proportion-empty'));
 const monthly=el('section','','fund-month-section'),monthHeading=el('div','','fund-month-heading');
 monthHeading.append(fundGlyph('fixed'),el('h3',month?'Ingresos y egresos del mes':'Ingresos y egresos del histórico','fund-period-heading'));
 const monthNet=netBlock('Resultado neto',income,expense);monthNet.classList.add('fund-month-net');
 monthly.append(monthHeading,panel,monthNet);target.append(monthly);
 const historical=el('section','','fund-average-card'),heading=el('div','','fund-average-header');
 heading.append(el('strong','Promedio mensual histórico'));historical.append(heading);
 const avgGrid=el('div','','fund-average-grid');
 // A common rounded scale gives both semicircles the same reference.
 const maxAverage=Math.max(0,avgIn?inUsd(avgIn)||0:0,avgOut?inUsd(avgOut)||0:0);
 const magnitude=maxAverage>0?10**Math.floor(Math.log10(maxAverage)):1;
 const gaugeMax=maxAverage>0?Math.ceil(maxAverage*2/magnitude)*magnitude:0;
 for(const [name,amount,kind] of [['Ingreso promedio',avgIn,'income'],['Gasto promedio',avgOut,'expense']]){
  const item=el('div','','fund-average-metric '+kind),gauge=el('div','','fund-gauge'),value=el('div','','fund-gauge-value');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 240 132');svg.setAttribute('aria-hidden','true');
  const usd=amount?inUsd(amount):null;
  const percent=usd!==null&&gaugeMax>0?Math.max(0,Math.min(100,100*usd/gaugeMax)):0;
  for(const className of ['fund-gauge-track','fund-gauge-progress']){
   if(className==='fund-gauge-progress'&&percent===0)continue;
   const arc=document.createElementNS('http://www.w3.org/2000/svg','path');
   arc.setAttribute('class',className);arc.setAttribute('d','M 15 120 A 105 105 0 0 1 225 120');arc.setAttribute('pathLength','100');
   if(className==='fund-gauge-progress'){arc.setAttribute('stroke-dasharray','100');arc.setAttribute('stroke-dashoffset',String(100-percent));}
   svg.append(arc);
  }
  value.append(el('span','USD'),usd===null?el('strong','—'):counter('strong',p=>numberAmount(usd*p)));
  if(usd!==null)value.append(counter('small',p=>money((amount[0]+amount[1]*rate)*p,'CUP')));
  else if(amount)value.append(counter('small',p=>money(amount[0]*p,'CUP')+' · '+money(amount[1]*p,'USD')));
  gauge.append(svg,value);item.append(gauge,el('span',name,'fund-gauge-label'));avgGrid.append(item);
 }
 const avgNet=netBlock('Promedio neto',avgIn,avgOut);avgNet.classList.add('fund-average-net');
 avgNet.append(el('span',months?months+' meses completos':'Sin meses completos','fund-average-months'));
 historical.append(avgGrid,avgNet);target.append(historical);
 if(gaugeMax>0)historical.append(el('small','Escala común de los indicadores · '+money(0,'USD')+' – '+money(gaugeMax,'USD'),'chart-caption'));
 historical.append(el('small','Equivalentes calculados a la tasa de referencia del día. El resumen incluye ambas monedas; los filtros inferiores se aplican al historial. Los promedios incluyen meses sin actividad y excluyen el actual y el inicial si es parcial.','chart-caption'));
 if(historicalOutlier)historical.append(el('small','Promedios desde febrero de 2023. Dos registros aislados de 2004 se mantienen en el historial y quedan fuera del promedio.','chart-caption'));
 if(summaryData.undated)historical.append(el('small','Movimientos sin fecha excluidos del resumen: '+summaryData.undated,'chart-caption'));
 if($('treasury-detail').open)animateDashboard(target,{entrance:true});
 }
 async function loadFundStatistics(fund){
 const request=++summaryRequest;summaryData=null;summaryFund=fund;renderFundStatistics();
 try{const data=await rpc('treasury_fund_summary',{p_fund:fund});if(request!==summaryRequest||selected!==fund)return;summaryData=data;const select=$('history-area'),value=select.value;select.replaceChildren(new Option('Todas las áreas',''));for(const area of data.areas||[])select.append(new Option(area,area));select.value=value;if(select.selectedIndex<0)select.selectedIndex=0;renderFundStatistics();}
 catch(e){if(request===summaryRequest&&selected===fund)$('fund-statistics').textContent='No se pudo consultar el resumen. '+e.message;}
 }
 function shiftFundPeriod(delta){if(historyKind==='audit'&&auditPreviousPeriod){const date=new Date(Date.UTC(Number(auditPreviousPeriod.year),Number(auditPreviousPeriod.month==='all'?currentMonth:auditPreviousPeriod.month)-1+delta,1));auditPreviousPeriod={year:String(date.getUTCFullYear()),month:String(date.getUTCMonth()+1)};renderFundStatistics();return;}const date=new Date(Date.UTC(Number(historyYear.value),Number(historyMonth.value==='all'?currentMonth:historyMonth.value)-1+delta,1));historyYear.value=String(date.getUTCFullYear());historyMonth.value=String(date.getUTCMonth()+1);changeHistoryFilter();}
 $('fund-period-prev').onclick=()=>shiftFundPeriod(-1);$('fund-period-next').onclick=()=>shiftFundPeriod(1);
 $('history-area').onchange=()=>{offset=0;history();};let searchTimer;$('history-search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{offset=0;history();},250);};
 function auditArgs(fund,page){const {p_kind,...args}=historyArgs(fund,page);return args;}
 const auditLabels={created:'Registrado',edited:'Editado',deleted:'Eliminado'};
 function auditCard(event){
 const row=el('article','','audit-movement '+event.action),head=el('div','','audit-movement-head'),entry=event.after||event.before;
 const badge=el('span',auditLabels[event.action]||event.action,'audit-badge');
 const actor=event.actor_name||(entry.source==='excel'&&event.action==='created'?'Importación histórica':'Usuario sin nombre registrado');
 head.append(badge,el('small',new Date(event.event_at).toLocaleTimeString('es-CU',{timeZone:'America/Havana',hour:'2-digit',minute:'2-digit'})+' · '+actor));row.append(head);
 const snapshots=el('div','','audit-snapshots');
 for(const [label,value] of [[event.action==='deleted'?'Movimiento eliminado':'Antes',event.before],[event.action==='edited'?'Después':'Movimiento registrado',event.after]]){
  if(!value)continue;
  const card=el('div','','audit-snapshot'),display=movementDisplay(Number(value.amount),value.currency),amounts=el('div','','history-amounts');
  const reference=el('small',display.equivalent,'history-equivalent');reference.dataset.amount=String(value.amount);reference.dataset.currency=value.currency;
  amounts.append(el('strong',display.principal,'history-amount'),reference);
  card.append(el('small',label,'audit-snapshot-label'),el('strong',value.concept),amounts,el('small',[dateLabel(value.date),value.area,sourceLabels[value.source]||value.source,value.rate?'Tasa '+value.rate+' CUP/USD':null].filter(Boolean).join(' · ')));
  snapshots.append(card);
 }
 row.append(snapshots);return row;
 }
 $('history-export').onclick=()=>run(async()=>{
 const fund=selected,audit=historyKind==='audit',args=audit?auditArgs(fund,0):historyArgs(fund,0),rows=[];
 for(let page=0;;page+=100){const batch=await rpc(audit?'treasury_movement_history':'treasury_history_search',{...args,p_offset:page});rows.push(...batch.slice(0,100));if(batch.length<=100)break;}
 const csv=v=>'"'+String(v??'').replace(/^[=+@-](?![0-9])/,"'$&").replace(/"/g,'""')+'"';
 const data=audit?[['Fecha de registro o corrección','Acción','Usuario','Concepto anterior','Importe anterior','Moneda anterior','Área anterior','Fecha anterior','Concepto posterior','Importe posterior','Moneda posterior','Área posterior','Fecha posterior'],...rows.map(r=>[r.event_at,auditLabels[r.action],r.actor_name,r.before?.concept,r.before?.amount,r.before?.currency,r.before?.area,r.before?.date,r.after?.concept,r.after?.amount,r.after?.currency,r.after?.area,r.after?.date])]:[['Fecha','Concepto','Área','Importe','Moneda','Origen'],...rows.map(r=>[r.occurred_on,r.concept,r.area,r.amount,r.currency,sourceLabels[r.source]||r.source])];
 const url=URL.createObjectURL(new Blob(['\uFEFF'+data.map(r=>r.map(csv).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const link=el('a');link.href=url;link.download=(audit?'historial-':'movimientos-')+fund+'-'+(args.p_month||'historico')+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 async function history(){
 if(!selected)return;
 const fund=selected,request=++historyRequest,body=$('treasury-history'),audit=historyKind==='audit';
 body.replaceChildren(el('p',audit?'Consultando historial…':'Consultando movimientos…','history-empty'));
 $('history-prev').disabled=$('history-next').disabled=true;
 renderFundStatistics();
 try{
 const rows=await rpc(audit?'treasury_movement_history':'treasury_history_search',audit?auditArgs(fund,offset):historyArgs(fund,offset));
 if(request!==historyRequest||selected!==fund)return;
 body.replaceChildren();if(audit)body.append(el('p','Historial de registros, ediciones y eliminaciones · ordenado por fecha de operación','audit-history-note'));let lastDate,group;
 for(const r of rows.slice(0,100)){
 const day=audit?r.event_day:r.occurred_on;
 if(!group||day!==lastDate){lastDate=day;group=el('section','','history-day');group.append(el('h4',dateLabel(lastDate),'history-date'));body.append(group);}
 group.append(audit?auditCard(r):movementCard(r));
 }
 if(!rows.length)body.append(el('p',audit?'Sin registros de historial para este filtro.':'Sin movimientos para este filtro.','history-empty'));
 $('history-prev').disabled=offset===0;$('history-next').disabled=rows.length<=100;
 }catch(e){if(request===historyRequest&&selected===fund){body.replaceChildren(el('p',e.message||'No se pudieron consultar los movimientos.','history-empty'));$('history-prev').disabled=offset===0;}}
 }
 function changeHistoryFilter(){offset=0;historyYear.disabled=historyMonth.value==='all';history();}
 for(const button of historyKinds)button.onclick=()=>{
 const next=button.dataset.kind;
 if(next==='audit'&&historyKind!=='audit'){auditPreviousPeriod={month:historyMonth.value,year:historyYear.value};historyMonth.value='all';historyCurrency.value='all';$('history-search').value='';$('history-area').value='';}
 if(next!=='audit'&&historyKind==='audit'&&auditPreviousPeriod){historyMonth.value=auditPreviousPeriod.month;historyYear.value=auditPreviousPeriod.year;auditPreviousPeriod=null;}
 historyKind=next;historyMonth.setAttribute('aria-label',next==='audit'?'Mes de registro o corrección':'Mes de movimientos');for(const item of historyKinds)item.setAttribute('aria-pressed',String(item===button));changeHistoryFilter();
 };
 historyMonth.onchange=historyYear.onchange=historyCurrency.onchange=changeHistoryFilter;
 resetHistoryFilters();
 const activityDialog=$('activity-dialog'),activityMonth=$('activity-month'),activityYear=$('activity-year');
 let activityOffset=0,activityRequest=0,recentRequest=0,recentLoading=false,recentSignature='';
 $('treasury-activity').hidden=workers;
 for(const option of chartMonth.options)activityMonth.append(option.cloneNode(true));
 for(const option of chartYear.options)activityYear.append(option.cloneNode(true));
 activityYear.value=String(currentYear);activityYear.disabled=true;
 function populateActivityFunds(){
 const select=$('activity-fund');if(select.options.length>1)return;
 for(const fund of state.funds){const option=el('option',fund.label);option.value=fund.code;select.append(option);}
 }
 function activityArgs(offset,limit,filtered){
 return {p_offset:offset,p_limit:limit,p_fund:filtered?$('activity-fund').value||null:null,p_kind:filtered?$('activity-kind').value:'all',p_currency:filtered?$('activity-currency').value:'all',p_month:filtered&&activityMonth.value!=='all'?activityYear.value+'-'+activityMonth.value.padStart(2,'0')+'-01':null};
 }
 function renderActivity(target,rows){target.replaceChildren();for(const r of rows)target.append(movementCard(r,true));if(!rows.length)target.append(el('p','Sin movimientos para este filtro.','history-empty'));}
 async function refreshActivity(){
 if(workers||recentLoading)return;
 recentLoading=true;const request=++recentRequest;
 try{
 const rows=await rpc('treasury_activity',activityArgs(0,10,false));
 if(request!==recentRequest)return;
 const signature=JSON.stringify(rows);
 if(signature!==recentSignature){recentSignature=signature;renderActivity($('activity-recent'),rows);}
 $('activity-status').textContent='● Actualizado · '+new Date().toLocaleTimeString('es-CU',{timeZone:'America/Havana',hour:'2-digit',minute:'2-digit'});
 }catch(e){$('activity-status').textContent='Actualización pendiente · reintentando';if(!recentSignature)$('activity-recent').textContent=e.message||'No se pudo cargar la actividad.';}finally{recentLoading=false;}
 }
 async function loadActivityHistory(){
 const request=++activityRequest,target=$('activity-history');target.textContent='Consultando movimientos…';
 $('activity-prev').disabled=$('activity-next').disabled=true;
 try{const rows=await rpc('treasury_activity',activityArgs(activityOffset,51,true));if(request!==activityRequest||!activityDialog.open)return;renderActivity(target,rows.slice(0,50));$('activity-prev').disabled=activityOffset===0;$('activity-next').disabled=rows.length<=50;}
 catch(e){if(request===activityRequest){target.textContent=e.message||'No se pudo cargar el historial.';$('activity-prev').disabled=activityOffset===0;}}
 }
 $('activity-open').onclick=()=>{populateActivityFunds();activityOffset=0;activityDialog.showModal();loadActivityHistory();};
 $('activity-close').onclick=()=>activityDialog.close();
 activityDialog.addEventListener('close',()=>{activityRequest++;});
 for(const id of ['activity-fund','activity-kind','activity-currency','activity-month','activity-year'])$(id).onchange=()=>{activityYear.disabled=activityMonth.value==='all';activityOffset=0;loadActivityHistory();};
 $('activity-prev').onclick=()=>{activityOffset=Math.max(0,activityOffset-50);loadActivityHistory();};
 $('activity-next').onclick=()=>{activityOffset+=50;loadActivityHistory();};
 function startActivityUpdates(){if(workers)return;setInterval(()=>{if(!document.hidden)refreshActivity();},5000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshActivity();});}
 async function refresh(){
 state=await rpc('treasury_state');await refreshRate();render();
 if(!workers&&!selected){animateDashboard($('treasury-funds'),{entrance:true});animateDashboard($('treasury-kpis'),{entrance:true});animateDashboard($('treasury-distribution'));}
 updateHistoryEquivalents();
 await Promise.all([history(),selected?loadFundStatistics(selected):Promise.resolve()]);
 if(!workers){await loadFlow(!selected);await refreshActivity();}
 }
 async function refreshRate(){try{const ref=await CartelExchangeRates.read(client);rate=Number(ref.value);rateDate=ref.source_date||new Date(ref.fetched_at).toLocaleDateString('es-CU');$('treasury-rate').textContent='Referencia del día · 1 USD = '+rate+' CUP · '+CartelExchangeRates.label(ref);}catch{rate=null;rateDate=null;$('treasury-rate').textContent='Tasa del día no disponible.';}}

 function renderOverview(funds){
 stopMotion($('treasury-kpis'));stopMotion($('treasury-distribution'));
 const target=$('treasury-kpis');target.replaceChildren();
 const balanceFor=(f,c,available=false)=>{
 const prefix=available?'available_':'';
 if(!(rate>0))return Number(f[prefix+c]);
 const cup=Number(f[prefix+'CUP']),usd=Number(f[prefix+'USD']);
 return c==='USD'?usd+cup/rate:cup+usd*rate;
 };
 const sum=(c,fn)=>funds.reduce((total,f)=>total+fn(balanceFor(f,c),balanceFor(f,c,true),f),0);
 const positive=c=>sum(c,b=>Math.max(0,b));
 const available=c=>sum(c,(_,a)=>Math.max(0,a));
 const committed=c=>sum(c,(b,a)=>Math.max(0,b-a));
 const debt=c=>sum(c,(b,_,f)=>f.code==='investment'?Math.max(0,-b):0);
 const summary=el('div','','treasury-summary');
 const primary=el('div','','summary-primary');
 primary.append(el('small',rate>0?'Saldo disponible total':'Saldo disponible en CUP'),amountCounter('strong',rate>0?available('USD'):available('CUP'),rate>0?'USD':'CUP'),el('span',rate>0?'Equivalente en USD · '+rateDate:'Tasa de referencia no disponible','summary-reference'));
 const balances=el('div','','summary-balances');balances.append(amountCounter('span',available('CUP'),'CUP'),amountCounter('span',available('USD'),'USD'));primary.append(balances);
 const secondary=el('div','','summary-secondary');
 for(const [label,color,fn] of [['Saldo total de fondos positivos','#d5dfe8',positive],['Comprometido','#65c9ff',committed],['Capital pendiente del CEO','#ff9292',debt]]){
 const row=el('div','','summary-line'),info=el('div'),value=el('div','','summary-value'),cup=fn('CUP'),usd=fn('USD');
 info.append(el('small',label));value.append(amountCounter('strong',rate>0?usd:cup,rate>0?'USD':'CUP'),counter('small',p=>money(cup*p,'CUP')+' · '+money(usd*p,'USD')));value.style.color=color;row.append(info,value);secondary.append(row);}
 summary.append(primary,secondary);target.append(summary);
 const c=chartCurrency.value,distribution=$('treasury-distribution');distribution.replaceChildren();
 const total=sum(c,b=>Math.max(0,b));for(const f of funds){const amount=Math.max(0,balanceFor(f,c)),pct=total?amount/total*100:0;const row=el('div','','distribution-row'),track=el('div','','distribution-track'),bar=el('span');bar.style.width=pct+'%';bar.style.background=colors[f.code];track.append(bar);row.append(el('span',f.label),counter('strong',p=>(pct*p).toFixed(1)+'% · '+money(amount*p,c)),track);distribution.append(row);}
 distribution.append(el('p','Saldos positivos por fondo · '+c,'chart-caption'));
 }
 let monthly=[],flowMonth=null,flowRequest=0;
 async function loadFlow(animate=true){stopMotion($('treasury-flow'));const month=period(),request=++flowRequest;const target=$('treasury-flow');target.textContent='Consultando movimientos…';try{const rows=await rpc('treasury_monthly',{p_month:month+'-01',p_workers:false});if(request!==flowRequest)return;monthly=rows;flowMonth=month;renderFlow();if(animate)animateDashboard(target);}catch(e){if(request===flowRequest)target.textContent='No se pudieron consultar los movimientos del período. '+e.message;}}
 function renderFlow(){
 const c=chartCurrency.value,target=$('treasury-flow');stopMotion(target);target.replaceChildren();if(flowMonth!==period()){target.textContent='Consultando movimientos…';return;}
 const days=new Date(Number(flowMonth.slice(0,4)),Number(flowMonth.slice(5)),0).getDate(),groups=Array.from({length:Math.ceil(days/7)},()=>({income:0,expense:0}));for(const row of monthly){if(row.currency!==c)continue;const g=groups[Math.min(4,Math.floor((Number(row.day.slice(-2))-1)/7))];g.income+=Number(row.income);g.expense+=Number(row.expense);}
 const totals=el('div','','flow-totals');for(const [key,label,color] of [['income','Ingresos','#58e0a0'],['expense','Egresos','#ff9292']]){const item=el('div',label),total=groups.reduce((n,g)=>n+g[key],0),value=amountCounter('strong',total,c);value.style.color=color;item.append(value);if(c==='CUP')item.append(rate>0?counter('small',p=>'≈ '+money(total/rate*p,'USD')+' · tasa '+rateDate,'flow-equivalent'):el('small','Equivalente USD no disponible','flow-equivalent'));totals.append(item);}target.append(totals);
 const max=Math.max(1,...groups.flatMap(g=>[g.income,g.expense])),chart=el('div','','flow-chart'),labels=el('div','','flow-labels');chart.style.gridTemplateColumns=labels.style.gridTemplateColumns='repeat('+groups.length+',minmax(0,1fr))';
 groups.forEach((g,i)=>{const group=el('div','','flow-group');for(const [key,color,label] of [['income','#58e0a0','Ingresos'],['expense','#ff9292','Egresos']]){const bar=el('div','','flow-bar');bar.style.height=(g[key]/max*100)+'%';bar.style.background=color;bar.title=label+' · '+money(g[key],c);group.append(bar);}chart.append(group);labels.append(el('span',(i*7+1)+'–'+Math.min(days,i*7+7)));});target.append(chart,labels,el('p','Movimientos por semana · excluye traspasos internos','chart-caption'));
 }
  function periodChanged(){setPeriod(Number(chartYear.value),Number(chartMonth.value));loadFlow();}
 chartMonth.onchange=chartYear.onchange=periodChanged;
 function shiftPeriod(delta){const next=new Date(Date.UTC(Number(chartYear.value),Number(chartMonth.value)-1+delta,1));setPeriod(next.getUTCFullYear(),next.getUTCMonth()+1);loadFlow();}
 $('chart-prev').onclick=()=>shiftPeriod(-1);$('chart-next').onclick=()=>shiftPeriod(1);$('chart-today').onclick=()=>{setPeriod(currentYear,currentMonth);loadFlow();};
 chartCurrency.onchange=()=>{if(state)renderOverview(state.funds.filter(f=>!f.worker));renderFlow();animateDashboard($('treasury-distribution'));animateDashboard($('treasury-flow'));};
 $('fund-close').onclick=()=>$('treasury-detail').close();
 $('treasury-detail').addEventListener('close',()=>{stopDashboardMotion();lastSummaryRender=null;selected=null;offset=0;if(state)render();});
 function correctionExpected(r){return {concept:r.concept,date:r.occurred_on??null,area:r.area??null,currency:r.currency,amount:Number(r.amount),rate:r.declared_rate==null?null:String(r.declared_rate)};}
 function editMovement(r){
 const concept=el('label','Concepto'),description=el('textarea');description.name='concept';description.required=true;description.maxLength=500;description.rows=3;description.value=r.concept;concept.append(description);
 const date=input('Fecha','date','date');date.querySelector('input').value=r.occurred_on||'';date.querySelector('input').required=Boolean(r.occurred_on);
 const areas=[['AUDIOVISUALES','Audiovisuales'],['GRAFICA','Gráficas'],['GENERAL','Gerencia']];if(!r.area)areas.unshift(['','Sin área']);
 if(r.area&&!areas.some(([code])=>code===r.area))areas.push([r.area,r.area+' (histórica)']);
 const area=selectField('Área','area',areas);area.querySelector('select').required=Boolean(r.area);area.querySelector('select').value=r.area||'';
 const currency=selectField('Moneda original','currency',[['CUP','CUP'],['USD','USD']]);currency.querySelector('select').value=r.currency;
 const amount=input('Importe original (+ ingreso / − egreso)','number','amount',{required:'',step:'0.01',inputmode:'decimal'});amount.querySelector('input').value=Number(r.amount);
 const exchange=input('Tasa declarada (CUP/USD)','number','rate',{min:'0.01',max:'1000000',step:'any',inputmode:'decimal'});exchange.querySelector('input').value=r.declared_rate||'';
 const fields=el('div','','correction-grid');fields.append(date,area,currency,amount,exchange);
 open('Editar movimiento',data=>rpc('treasury_correct_movement',{p_operation:requestId,p_id:r.id,p_expected:correctionExpected(r),p_delete:false,p_concept:data.get('concept'),p_date:data.get('date')||null,p_area:data.get('area')||(r.area??null),p_currency:data.get('currency'),p_amount:Number(data.get('amount')),p_rate:data.get('rate')?Number(data.get('rate')):null}),[concept,fields,el('small','Los saldos y estadísticas se actualizarán al guardar. El comprobante existente se conserva.','chart-caption')]);
 $('treasury-save').textContent='Guardar cambios';$('treasury-dialog').dataset.correction='edit';
 }
 function deleteMovement(r){
 const summary=el('div','','correction-delete-summary'),display=movementDisplay(Number(r.amount),r.currency);
 summary.append(el('strong',r.concept),el('p',display.principal+' '+display.equivalent),el('small',dateLabel(r.occurred_on)));
 open('Eliminar movimiento',()=>rpc('treasury_correct_movement',{p_operation:requestId,p_id:r.id,p_expected:correctionExpected(r),p_delete:true,p_concept:null,p_date:null,p_area:null,p_currency:null,p_amount:null,p_rate:null}),[summary,el('p','¿Confirmas eliminar este movimiento? Se actualizarán los saldos y estadísticas. La corrección quedará registrada en el historial de auditoría.')]);
 $('treasury-save').textContent='Eliminar movimiento';$('treasury-dialog').dataset.correction='delete';
 }
 function input(label,type,name,opts={}){const l=el('label',label),n=el('input');n.type=type;n.name=name;for(const [k,v] of Object.entries(opts))n.setAttribute(k,v);l.append(n);return l;}
 function open(title,fn,fields,{movement,summary}={}){
 const dialog=$('treasury-dialog'),footer=dialog.querySelector('.modal-footer');
 dialog.removeAttribute('data-move');dialog.removeAttribute('data-correction');footer.querySelector('.move-balance')?.remove();$('treasury-save').textContent='Confirmar';
 if(movement){dialog.dataset.move=movement;$('treasury-save').textContent=movement==='income'?'Confirmar ingreso':'Confirmar egreso';footer.prepend(summary);}
 requestId=crypto.randomUUID();action=fn;$('treasury-form').reset();$('treasury-dialog-title').textContent=title;$('treasury-fields').replaceChildren(...fields);$('treasury-error').textContent='';dialog.showModal();
 if(movement&&!motionPreference.matches&&!document.hidden&&typeof dialog.animate==='function')dialog.animate([{opacity:0,transform:'translateY(9px) scale(.985)'},{opacity:1,transform:'none'}],{duration:280,easing:'cubic-bezier(.22,.7,.25,1)'});
 }
 function selectField(label,name,choices){
 const field=el('label',label),select=el('select');select.name=name;select.required=true;
 for(const [value,title] of choices){const option=el('option',title);option.value=value;select.append(option);}field.append(select);return field;
 }
 function movementAreaField(){
 const field=el('div','','move-area-field'),caption=el('span','Área','move-area-label');
 const select=el('select'),trigger=el('button','Seleccionar área','move-area-trigger'),menu=el('div','','move-area-options'),error=el('small','','move-area-error');
 select.name='area';select.required=true;select.tabIndex=-1;select.className='move-area-native';select.setAttribute('aria-label','Área');
 const choices=[['','Seleccionar área'],['AUDIOVISUALES','Audiovisuales'],['GRAFICA','Gráficas'],['GENERAL','Gerencia']];
 trigger.type='button';trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label','Área: Seleccionar área');menu.hidden=true;error.hidden=true;
 const setOpen=open=>{menu.hidden=!open;trigger.setAttribute('aria-expanded',String(open));};
 for(const [value,title] of choices){
  const option=el('option',title);option.value=value;select.append(option);if(!value)continue;
  const button=el('button',title,'move-area-option');button.type='button';button.setAttribute('aria-pressed','false');
  button.onclick=()=>{select.value=value;trigger.textContent=title;trigger.setAttribute('aria-label','Área: '+title);for(const item of menu.children)item.setAttribute('aria-pressed',String(item===button));error.hidden=true;setOpen(false);trigger.focus();};
  menu.append(button);
 }
 trigger.onclick=()=>setOpen(menu.hidden);
 field.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){event.preventDefault();event.stopPropagation();setOpen(false);trigger.focus();}else if(event.key==='ArrowDown'&&event.target===trigger){event.preventDefault();setOpen(true);menu.firstElementChild?.focus();}});
 field.addEventListener('focusout',event=>{if(event.relatedTarget&&!field.contains(event.relatedTarget))setOpen(false);});
 select.addEventListener('invalid',event=>{event.preventDefault();error.textContent='Selecciona un área.';error.hidden=false;setOpen(true);trigger.focus();});
 field.append(caption,select,trigger,menu,error);return field;
 }
 function readReceipt(file){return new Promise((resolve,reject)=>{if(!file||!file.size){resolve(null);return;}if(file.size>2000000||!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)){reject(Error('Selecciona una imagen o PDF de hasta 2 MB.'));return;}const reader=new FileReader();reader.onload=()=>resolve({name:file.name,mime:file.type,content:String(reader.result).split(',')[1]});reader.onerror=()=>reject(Error('No se pudo leer el comprobante.'));reader.readAsDataURL(file);});}
 function move(direction){
 const f=selected,fund=state.funds.find(x=>x.code===f),income=direction>0;
 const details=el('section','','move-details'),grid=el('div','','move-details-fields'),conceptPanel=el('div','','move-concept-panel');
 const date=input('Fecha','date','date',{required:''});date.querySelector('input').value=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Havana',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const area=movementAreaField();
 const concept=el('label','Concepto'),description=el('textarea');description.name='concept';description.required=true;description.maxLength=500;description.rows=3;description.placeholder='Describe el movimiento';description.autofocus=true;concept.append(description);
 conceptPanel.append(concept);grid.append(date,area);details.append(conceptPanel,grid);
 let kind,destination;
 if(!income&&!workers){kind=selectField('Destino del retiro','kind',[['expense','Gasto / retiro'],['transfer','Traspaso a otro fondo']]);destination=selectField('Fondo de destino','destination',state.funds.filter(x=>!x.worker&&x.code!==f).map(x=>[x.code,x.label]));destination.hidden=true;destination.querySelector('select').disabled=true;grid.append(kind,destination);kind.querySelector('select').onchange=()=>{const transfer=kind.querySelector('select').value==='transfer';destination.hidden=!transfer;destination.querySelector('select').disabled=!transfer;};}
 const conversion=el('section','','move-wallet-hero'),visual=el('div','','move-conversion'),original=el('strong','CUP 0.00'),result=el('strong','USD 0.00');visual.setAttribute('aria-label','Conversión de moneda');visual.append(original,el('span','→'),result);
 const fields=el('div','','move-wallet-fields'),currency=el('fieldset','','move-currencies');currency.append(el('legend','Moneda original'));
 for(const c of ['CUP','USD']){const label=el('label',c),radio=el('input');radio.type='radio';radio.name='currency';radio.value=c;radio.checked=c==='CUP';label.prepend(radio);currency.append(label);}
 const amount=input('Monto original','number','amount',{required:'',min:'0.01',step:'0.01',inputmode:'decimal',placeholder:'0.00'}),exchange=input('Tasa de cambio · CUP / USD','number','rate',{min:'0.01',max:'1000000',step:'any',inputmode:'decimal'});if(rate>0)exchange.querySelector('input').value=rate;
 amount.classList.add('move-amount-field');exchange.classList.add('move-rate-field');fields.append(amount,currency,exchange);conversion.append(fields,visual);
 const note=el('small','El saldo del fondo se calcula en USD y su equivalente en CUP. Se conserva la moneda original del movimiento.','move-note');conversion.append(note);
 const proof=el('section','','move-proof'),proofIcon=el('span','↥','move-proof-icon'),proofText=el('div','','move-proof-text');
 proofIcon.setAttribute('aria-hidden','true');proofText.append(el('strong','Comprobante opcional'),el('small','Adjuntar imagen o PDF, hasta 2 MB'));
 const file=el('label','','move-proof-control'),fileInput=el('input'),fileLabel=el('span','Adjuntar archivo','move-proof-button'),fileName=el('small','','move-proof-name');
 fileInput.type='file';fileInput.name='receipt';fileInput.accept='image/jpeg,image/png,image/webp,application/pdf';fileInput.setAttribute('aria-label','Adjuntar comprobante opcional');
 fileInput.addEventListener('change',()=>{fileName.textContent=fileInput.files[0]?.name||'';});file.append(fileInput,fileLabel,fileName);proof.append(proofIcon,proofText,file);
 const summary=el('div','','move-balance'),before=el('strong'),after=el('strong'),beforeCup=el('small','','move-balance-equivalent'),afterCup=el('small','','move-balance-equivalent');const one=el('div'),two=el('div');one.append(el('small','Saldo actual'),before,beforeCup);two.append(el('small','Saldo resultante'),after,afterCup);summary.append(one,two);
 const update=()=>{
 const c=currency.querySelector('input:checked').value,n=Number(amount.querySelector('input').value)||0,r=Number(exchange.querySelector('input').value),validRate=Number.isFinite(r)&&r>0&&r<=1000000;
 exchange.querySelector('input').required=true;original.textContent=money(n,c);result.textContent=validRate?money(c==='CUP'?n/r:n*r,c==='CUP'?'USD':'CUP'):'—';
 if(!validRate){before.textContent=after.textContent='USD —';beforeCup.textContent=afterCup.textContent='Tasa de cambio necesaria';return;}
 const balance=Number(fund.USD)+Number(fund.CUP)/r,delta=c==='CUP'?n/r:n,next=balance+direction*delta;
 before.textContent=money(balance,'USD');beforeCup.textContent='('+money(Number(fund.CUP)+Number(fund.USD)*r,'CUP')+')';
 after.textContent=money(next,'USD');afterCup.textContent='('+money(Number(fund.CUP)+Number(fund.USD)*r+direction*(c==='CUP'?n:n*r),'CUP')+')';
 };
 conversion.addEventListener('input',update);
 open((income?'Registrar ingreso':'Registrar egreso')+' · '+fund.label,async data=>rpc('treasury_register_movement',{p_id:requestId,p_fund:f,p_currency:data.get('currency'),p_amount:direction*Number(data.get('amount')),p_concept:data.get('concept'),p_date:data.get('date'),p_area:data.get('area'),p_category:data.get('kind')==='transfer'?'Traspaso entre fondos':income?'Ingreso':'Egreso',p_rate:Number(data.get('rate'))||null,p_destination:data.get('kind')==='transfer'?data.get('destination'):null,p_receipt:await readReceipt(data.get('receipt'))}),[conversion,details,proof],{movement:income?'income':'expense',summary});
 update();
 }
 $('fund-in').onclick=()=>move(1);$('fund-out').onclick=()=>move(-1);$('fund-dispatch').onclick=()=>open('Preparar cuadre con el CEO',d=>rpc('treasury_dispatch',{p_id:requestId,p_cup:Number(d.get('cup')||0),p_usd:Number(d.get('usd')||0),p_note:d.get('note')}),[input('Importe CUP','number','cup',{min:'0',step:'0.01',value:'0'}),input('Importe USD','number','usd',{min:'0',step:'0.01',value:'0'}),input('Observación','text','note',{maxlength:'500'})]);
 $('treasury-form').onsubmit=e=>{e.preventDefault();run(async()=>{await action(new FormData(e.target));const correction=$('treasury-dialog').dataset.correction;$('treasury-dialog').close();$('treasury-message').textContent=correction==='delete'?'Movimiento eliminado.':correction==='edit'?'Movimiento actualizado.':'Movimiento registrado.';await refresh();});};$('treasury-close').onclick=$('treasury-cancel').onclick=()=>{if(!busy)$('treasury-dialog').close();};$('treasury-dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});$('treasury-refresh').onclick=()=>run(refresh);$('history-next').onclick=()=>run(async()=>{offset+=100;await history();});$('history-prev').onclick=()=>run(async()=>{offset=Math.max(0,offset-100);await history();});
 run(async()=>{const {data}=await client.auth.getUser();if(!data.user){location.href='/';return;}await refresh();startActivityUpdates();if(workers)await openFundDetail('workers');});
})();
