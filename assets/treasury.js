(()=>{'use strict';
 const $=id=>document.getElementById(id),client=CartelLoad.createClient('https://jhumvctocphyiwhszeaz.supabase.co','sb_publishable_ZHV-5dlsjfamQpfUOsgumg_G-vN84Gn',{auth:{persistSession:true,autoRefreshToken:true,storage:localStorage}});
 const el=(tag,t='',c='')=>{const n=document.createElement(tag);n.textContent=t;if(c)n.className=c;return n;};
 const numberAmount=amount=>new Intl.NumberFormat('es-CU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(amount||0));
 const money=(amount,c)=>new Intl.NumberFormat('es-CU',{style:'currency',currency:c,currencyDisplay:'code'}).format(Number(amount||0));
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
 const cards=$('treasury-funds');cards.replaceChildren();
 const funds=state.funds.filter(f=>Boolean(f.worker)===workers);
 for(const f of funds){
 const cup=Number(f.CUP),usd=Number(f.USD),negative=cup<0||usd<0;
 const b=el('button','','treasury-card');b.type='button';
 b.style.setProperty('--fund-color',negative?'#ff727d':colors[f.code]);
 b.setAttribute('aria-pressed',String(selected===f.code));
 const icon=el('span','','compact-fund-icon');
 icon.append(fundGlyph(f.code));icon.setAttribute('aria-hidden','true');
 const body=el('div','','compact-fund-body');body.append(el('strong',f.label,'compact-fund-title'));
 for(const c of ['CUP','USD'])body.append(el('span',money(f[c],c),Number(f[c])<0?'negative':''));
 if(negative&&f.code==='investment')body.append(el('small','Capital pendiente del CEO','compact-fund-debt'));
 const converted=rate>0?usd+cup/rate:null;
 const equivalent=el('div','','compact-fund-equivalent');
 equivalent.append(el('small','Equiv. USD'),el('strong',converted===null?'—':numberAmount(converted),converted!==null&&converted<0?'negative':''));
 equivalent.title=rate>0?'Tasa del día · '+rateDate:'Tasa del día no disponible';
 const arrow=el('span','›','compact-fund-arrow');arrow.setAttribute('aria-hidden','true');
 b.append(icon,body,equivalent,arrow);
 b.onclick=()=>run(async()=>{selected=f.code;resetHistoryFilters();render();$('treasury-detail').showModal();await Promise.all([history(),loadFundStatistics(selected)]);});
 cards.append(b);
 }
 const f=funds.find(f=>f.code===selected);if(!workers)renderOverview(funds);if(!f)return;$('fund-title').textContent=f.label;renderFundBalance(f);$('fund-dispatch').hidden=f.code!=='profit'||state.owner;$('treasury-dispatches').hidden=f.code!=='profit';renderDispatches();}
 function renderDispatches(){const target=$('treasury-dispatches');target.replaceChildren();if(selected!=='profit')return;target.append(el('h3','Cuadres con el CEO'));for(const d of state.dispatches){const row=el('div','','treasury-dispatch');row.append(el('strong',money(d.cup,'CUP')+' + '+money(d.usd,'USD')),el('p',new Date(d.created_at).toLocaleString('es-CU')+' · '+(d.status==='pending'?'Pendiente de recibido':'Recibido confirmado')),el('p',d.note));if(state.owner&&d.status==='pending'){const b=el('button','Confirmar recibido','primary');b.onclick=()=>{open('Confirmar recibido del CEO',()=>rpc('treasury_confirm_dispatch',{p_id:d.id}),[el('p','Confirmas haber recibido '+money(d.cup,'CUP')+' y '+money(d.usd,'USD')+'.')]);};row.append(b);}if(d.status==='confirmed'){const b=el('button','Imprimir comprobante','secondary');b.onclick=()=>printDispatch(d);row.append(b);}target.append(row);}if(!state.dispatches.length)target.append(el('p','Todavía no hay cuadres.'));}
 function printDispatch(d){const w=window.open('','_blank');if(!w){$('treasury-message').textContent='Permite la ventana emergente para imprimir.';return;}const doc=w.document;doc.title='Comprobante de utilidad';const style=doc.createElement('style');style.textContent='@page{size:80mm auto;margin:4mm}body{font:12px Arial;width:72mm;margin:0}h2{text-align:center}p{overflow-wrap:anywhere}';doc.head.append(style);for(const t of ['EL CARTEL STUDIO','Comprobante de utilidad','Recibido confirmado',money(d.cup,'CUP'),money(d.usd,'USD'),new Date(d.confirmed_at).toLocaleString('es-CU'),d.note||'','Firma del CEO: __________________']){const p=doc.createElement('p');p.textContent=t;doc.body.append(p);}w.print();}
 const historyMonth=$('history-month'),historyYear=$('history-year'),historyCurrency=$('history-currency');
 const historyKinds=[...$('history-kinds').querySelectorAll('button')];
 let historyKind='all',historyRequest=0;
 for(const option of chartMonth.options)historyMonth.append(option.cloneNode(true));
 for(const option of chartYear.options)historyYear.append(option.cloneNode(true));
 function resetHistoryFilters(){
 offset=0;historyKind='all';historyMonth.value=String(currentMonth);historyYear.value=String(currentYear);historyYear.disabled=false;historyCurrency.value='all';$('history-search').value='';$('history-area').replaceChildren(new Option('Todas las áreas',''));
 for(const button of historyKinds)button.setAttribute('aria-pressed',String(button.dataset.kind==='all'));
 }
 function renderFundBalance(f){
 const target=$('fund-balance');target.replaceChildren();target.style.setProperty('--fund-color',colors[f.code]);
 const icon=el('span',icons[f.code],'fund-modal-icon');icon.setAttribute('aria-hidden','true');
 const balances=el('div','','fund-modal-currencies');
 for(const c of ['CUP','USD']){const item=el('div');item.append(el('small','Saldo '+c),el('strong',money(f[c],c),Number(f[c])<0?'negative':''));balances.append(item);}
 const eq=el('div','','fund-modal-equivalent');eq.append(el('span',rate>0?'Equivalente · '+money(Number(f.USD)+Number(f.CUP)/rate,'USD'):'Equivalente no disponible'),el('small',rate>0?'Tasa · '+rateDate:''));
 target.append(icon,balances,eq);
 }
 const sourceLabels={excel:'Histórico Excel',bar:'Cuadre de nevera',manual:'Manual',budget:'Solicitud de presupuesto',ceo_dispatch:'Cuadre CEO',transfer:'Traspaso entre fondos'};
 function movementEquivalent(amount,currency){
 if(!(rate>0))return '(Tasa no disponible)';
 const sign=amount>0?'+':amount<0?'−':'';
 return '('+sign+money(currency==='CUP'?Math.abs(amount)/rate:Math.abs(amount)*rate,currency==='CUP'?'USD':'CUP')+')';
 }
 function updateHistoryEquivalents(){
 for(const value of document.querySelectorAll('.history-equivalent')){
 value.textContent=movementEquivalent(Number(value.dataset.amount),value.dataset.currency);
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
 if(r.category)detail.push(r.category);if(r.declared_rate)detail.push('Tasa declarada '+r.declared_rate+' CUP/USD');
 info.append(title,el('small',detail.join(' · ')));
 if(r.has_receipt){const button=el('button','Ver comprobante','secondary history-receipt');button.type='button';button.onclick=()=>run(async()=>{const data=await rpc('treasury_receipt',{p_id:r.id});if(!data)throw Error('Comprobante no disponible.');const bytes=Uint8Array.from(atob(data.content),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:data.mime})),a=el('a');a.href=url;a.download=data.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);});info.append(button);}
 }
 const amounts=el('div','','history-amounts'),reference=el('small',movementEquivalent(amount,r.currency),'history-equivalent');
 reference.dataset.amount=String(amount);reference.dataset.currency=r.currency;
 amounts.append(el('strong',(amount>0?'+':amount<0?'−':'')+money(Math.abs(amount),r.currency),'history-amount'),reference);
 row.append(info,amounts);return row;
 }
 function dateLabel(date){return date?new Intl.DateTimeFormat('es-CU',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z')):'Sin fecha';}
 let summaryData=null,summaryFund=null,summaryRequest=0;
 const histMonth=()=>historyMonth.value==='all'?null:historyYear.value+'-'+historyMonth.value.padStart(2,'0')+'-01';
 function historyArgs(fund,page){return {p_fund:fund,p_offset:page,p_month:histMonth(),p_kind:historyKind,p_currency:historyCurrency.value,p_search:$('history-search').value.trim(),p_area:$('history-area').value};}
 function monthIndex(date){return Number(date.slice(0,4))*12+Number(date.slice(5,7))-1;}
 function renderFundStatistics(){
 const target=$('fund-statistics'),month=histMonth(),label=$('fund-period-label');
 label.textContent=month?new Intl.DateTimeFormat('es-CU',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'T00:00:00Z')):'Todo el histórico';
 if(!summaryData||summaryFund!==selected){target.textContent='Consultando resumen…';return;}
 target.replaceChildren();
 const now=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Havana',year:'numeric',month:'2-digit'}).formatToParts(new Date()),year=Number(now.find(p=>p.type==='year').value),m=Number(now.find(p=>p.type==='month').value),end=year*12+m-1;
 const historicalOutlier=selected==='fixed'&&summaryData.first_date&&summaryData.first_date<'2023-01-01';
 const first=historicalOutlier?'2023-01-06':summaryData.first_date,start=first?monthIndex(first)+(first.slice(8,10)==='01'?0:1):end,months=Math.max(0,end-start);
 const rows=summaryData.months||[],currencies=historyCurrency.value==='all'?['CUP','USD']:[historyCurrency.value];
 const sum=(list,key)=>list.reduce((n,r)=>n+Number(r[key]),0);
 const group=el('div','','fund-summary-grid');
 for(const c of currencies){
 const all=rows.filter(r=>r.currency===c),periodRows=all.filter(r=>!month||r.month===month),past=all.filter(r=>monthIndex(r.month)>=start&&monthIndex(r.month)<end);
 const income=sum(periodRows,'income'),expense=sum(periodRows,'expense'),avgIn=months?sum(past,'income')/months:null,avgOut=months?sum(past,'expense')/months:null;
 const panel=el('article','','fund-summary-currency');panel.append(el('h4',c));
 const max=Math.max(1,income,expense,avgIn||0,avgOut||0);
 function bar(name,value,color){const row=el('div','','fund-stat-row'),track=el('div','','fund-stat-track'),fill=el('span');fill.style.width=(value===null?0:value/max*100)+'%';fill.style.background=color;track.append(fill);row.append(el('span',name),track,el('strong',value===null?'—':money(value,c)));return row;}
 panel.append(bar('Ingresos',income,'#58e0a0'),bar('Gastos',expense,'#ff9292'));
 const net=el('div','','fund-stat-net');net.append(el('span','Resultado neto'),el('strong',money(income-expense,c),income-expense<0?'negative':''));panel.append(net);
 panel.append(el('h4','Promedio mensual histórico','fund-average-heading'),bar('Ingresos',avgIn,'#58e0a0'),bar('Gastos',avgOut,'#ff9292'));
 const avg=el('div','','fund-stat-net');avg.append(el('span','Neto promedio'),el('strong',months?money(avgIn-avgOut,c):'—',months&&avgIn-avgOut<0?'negative':''));panel.append(avg);group.append(panel);}
 target.append(group,el('small',months?months+' meses completos · incluye meses sin actividad · excluye mes actual y mes inicial si es parcial.':'Aún no hay meses completos para calcular el promedio.','chart-caption'));
 if(historicalOutlier)target.append(el('small','Promedios desde febrero de 2023. Dos registros aislados de 2004 se mantienen en el historial y quedan fuera del promedio.','chart-caption'));
 if(summaryData.undated)target.append(el('small','Movimientos sin fecha excluidos del resumen: '+summaryData.undated,'chart-caption'));
 }
 async function loadFundStatistics(fund){
 const request=++summaryRequest;summaryData=null;summaryFund=fund;renderFundStatistics();
 try{const data=await rpc('treasury_fund_summary',{p_fund:fund});if(request!==summaryRequest||selected!==fund)return;summaryData=data;const select=$('history-area'),value=select.value;select.replaceChildren(new Option('Todas las áreas',''));for(const area of data.areas||[])select.append(new Option(area,area));select.value=value;if(select.selectedIndex<0)select.selectedIndex=0;renderFundStatistics();}
 catch(e){if(request===summaryRequest&&selected===fund)$('fund-statistics').textContent='No se pudo consultar el resumen. '+e.message;}
 }
 function shiftFundPeriod(delta){const date=new Date(Date.UTC(Number(historyYear.value),Number(historyMonth.value==='all'?currentMonth:historyMonth.value)-1+delta,1));historyYear.value=String(date.getUTCFullYear());historyMonth.value=String(date.getUTCMonth()+1);changeHistoryFilter();}
 $('fund-period-prev').onclick=()=>shiftFundPeriod(-1);$('fund-period-next').onclick=()=>shiftFundPeriod(1);
 $('history-area').onchange=()=>{offset=0;history();};let searchTimer;$('history-search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{offset=0;history();},250);};
 $('history-export').onclick=()=>run(async()=>{const fund=selected,args=historyArgs(fund,0),rows=[];for(let page=0;;page+=100){const batch=await rpc('treasury_history_search',{...args,p_offset:page});rows.push(...batch.slice(0,100));if(batch.length<=100)break;}const csv=v=>'"'+String(v??'').replace(/^[=+@-](?![0-9])/,"'$&").replace(/"/g,'""')+'"';const data=[['Fecha','Concepto','Área','Importe','Moneda','Origen'],...rows.map(r=>[r.occurred_on,r.concept,r.area,r.amount,r.currency,sourceLabels[r.source]||r.source])].map(r=>r.map(csv).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob(['\uFEFF'+data],{type:'text/csv;charset=utf-8'}));const link=el('a');link.href=url;link.download='movimientos-'+fund+'-'+(args.p_month||'historico')+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 async function history(){
 if(!selected)return;
 const fund=selected,request=++historyRequest,body=$('treasury-history');
 body.replaceChildren(el('p','Consultando movimientos…','history-empty'));
 $('history-prev').disabled=$('history-next').disabled=true;
 renderFundStatistics();
 try{
 const rows=await rpc('treasury_history_search',historyArgs(fund,offset));
 if(request!==historyRequest||selected!==fund)return;
 body.replaceChildren();let lastDate,group;
 for(const r of rows.slice(0,100)){
 if(!group||r.occurred_on!==lastDate){lastDate=r.occurred_on;group=el('section','','history-day');group.append(el('h4',dateLabel(lastDate),'history-date'));body.append(group);}
 group.append(movementCard(r));
 }
 if(!rows.length)body.append(el('p','Sin movimientos para este filtro.','history-empty'));
 $('history-prev').disabled=offset===0;$('history-next').disabled=rows.length<=100;
 }catch(e){if(request===historyRequest&&selected===fund){body.replaceChildren(el('p',e.message||'No se pudieron consultar los movimientos.','history-empty'));$('history-prev').disabled=offset===0;}}
 }
 function changeHistoryFilter(){offset=0;historyYear.disabled=historyMonth.value==='all';history();}
 for(const button of historyKinds)button.onclick=()=>{historyKind=button.dataset.kind;for(const item of historyKinds)item.setAttribute('aria-pressed',String(item===button));changeHistoryFilter();};
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
 async function refresh(){state=await rpc('treasury_state');render();await Promise.all([history(),selected?loadFundStatistics(selected):Promise.resolve()]);if(!workers){await loadFlow();await refreshActivity();}await refreshRate();}
 async function refreshRate(){try{const ref=await CartelExchangeRates.read(client);rate=Number(ref.value);rateDate=ref.source_date||new Date(ref.fetched_at).toLocaleDateString('es-CU');$('treasury-rate').textContent='Referencia del día · 1 USD = '+rate+' CUP · '+CartelExchangeRates.label(ref);}catch{rate=null;rateDate=null;$('treasury-rate').textContent='Tasa del día no disponible.';}render();updateHistoryEquivalents();if(!workers&&flowMonth===period())renderFlow();}

 function renderOverview(funds){
 const target=$('treasury-kpis');target.replaceChildren();
 const sum=(c,fn)=>funds.reduce((total,f)=>total+fn(Number(f[c]),Number(f['available_'+c]),f),0);
 const positive=c=>sum(c,b=>Math.max(0,b));
 const available=c=>sum(c,(_,a)=>Math.max(0,a));
 const committed=c=>sum(c,(b,a)=>Math.max(0,b-a));
 const debt=c=>sum(c,(b,_,f)=>f.code==='investment'?Math.max(0,-b):0);
 const summary=el('div','','treasury-summary');
 const primary=el('div','','summary-primary');
 primary.append(el('small',rate>0?'Saldo disponible total':'Saldo disponible en CUP'),el('strong',rate>0?money(available('USD')+available('CUP')/rate,'USD'):money(available('CUP'),'CUP')),el('span',rate>0?'Equivalente en USD · '+rateDate:'Tasa de referencia no disponible','summary-reference'));
 const balances=el('div','','summary-balances');balances.append(el('span',money(available('CUP'),'CUP')),el('span',money(available('USD'),'USD')));primary.append(balances);
 const secondary=el('div','','summary-secondary');
 for(const [label,color,fn] of [['Saldo total de fondos positivos','#d5dfe8',positive],['Comprometido','#65c9ff',committed],['Capital pendiente del CEO','#ff9292',debt]]){
 const row=el('div','','summary-line'),info=el('div'),value=el('div','','summary-value');
 info.append(el('small',label));value.append(el('strong',rate>0?money(fn('USD')+fn('CUP')/rate,'USD'):money(fn('CUP'),'CUP')),el('small',money(fn('CUP'),'CUP')+' · '+money(fn('USD'),'USD')));value.style.color=color;row.append(info,value);secondary.append(row);}
 summary.append(primary,secondary);target.append(summary);
 const c=chartCurrency.value,distribution=$('treasury-distribution');distribution.replaceChildren();
 const total=sum(c,b=>Math.max(0,b));for(const f of funds){const amount=Math.max(0,Number(f[c])),pct=total?amount/total*100:0;const row=el('div','','distribution-row'),track=el('div','','distribution-track'),bar=el('span');bar.style.width=pct+'%';bar.style.background=colors[f.code];track.append(bar);row.append(el('span',f.label),el('strong',pct.toFixed(1)+'% · '+money(amount,c)),track);distribution.append(row);}
 distribution.append(el('p','Saldos positivos por fondo · '+c,'chart-caption'));
 }
 let monthly=[],flowMonth=null,flowRequest=0;
 async function loadFlow(){const month=period(),request=++flowRequest;const target=$('treasury-flow');target.textContent='Consultando movimientos…';try{const rows=await rpc('treasury_monthly',{p_month:month+'-01',p_workers:false});if(request!==flowRequest)return;monthly=rows;flowMonth=month;renderFlow();}catch(e){if(request===flowRequest)target.textContent='No se pudieron consultar los movimientos del período. '+e.message;}}
 function renderFlow(){
 const c=chartCurrency.value,target=$('treasury-flow');target.replaceChildren();if(flowMonth!==period()){target.textContent='Consultando movimientos…';return;}
 const days=new Date(Number(flowMonth.slice(0,4)),Number(flowMonth.slice(5)),0).getDate(),groups=Array.from({length:Math.ceil(days/7)},()=>({income:0,expense:0}));for(const row of monthly){if(row.currency!==c)continue;const g=groups[Math.min(4,Math.floor((Number(row.day.slice(-2))-1)/7))];g.income+=Number(row.income);g.expense+=Number(row.expense);}
 const totals=el('div','','flow-totals');for(const [key,label,color] of [['income','Ingresos','#58e0a0'],['expense','Egresos','#ff9292']]){const item=el('div',label),value=el('strong',money(groups.reduce((n,g)=>n+g[key],0),c));value.style.color=color;item.append(value);if(c==='CUP')item.append(el('small',rate>0?'≈ '+money(groups.reduce((n,g)=>n+g[key],0)/rate,'USD')+' · tasa '+rateDate:'Equivalente USD no disponible','flow-equivalent'));totals.append(item);}target.append(totals);
 const max=Math.max(1,...groups.flatMap(g=>[g.income,g.expense])),chart=el('div','','flow-chart'),labels=el('div','','flow-labels');chart.style.gridTemplateColumns=labels.style.gridTemplateColumns='repeat('+groups.length+',minmax(0,1fr))';
 groups.forEach((g,i)=>{const group=el('div','','flow-group');for(const [key,color,label] of [['income','#58e0a0','Ingresos'],['expense','#ff9292','Egresos']]){const bar=el('div','','flow-bar');bar.style.height=(g[key]/max*100)+'%';bar.style.background=color;bar.title=label+' · '+money(g[key],c);group.append(bar);}chart.append(group);labels.append(el('span',(i*7+1)+'–'+Math.min(days,i*7+7)));});target.append(chart,labels,el('p','Movimientos por semana · excluye traspasos internos','chart-caption'));
 }
  function periodChanged(){setPeriod(Number(chartYear.value),Number(chartMonth.value));loadFlow();}
 chartMonth.onchange=chartYear.onchange=periodChanged;
 function shiftPeriod(delta){const next=new Date(Date.UTC(Number(chartYear.value),Number(chartMonth.value)-1+delta,1));setPeriod(next.getUTCFullYear(),next.getUTCMonth()+1);loadFlow();}
 $('chart-prev').onclick=()=>shiftPeriod(-1);$('chart-next').onclick=()=>shiftPeriod(1);$('chart-today').onclick=()=>{setPeriod(currentYear,currentMonth);loadFlow();};
 chartCurrency.onchange=()=>{if(state)renderOverview(state.funds.filter(f=>!f.worker));renderFlow();};
 $('fund-close').onclick=()=>$('treasury-detail').close();
 $('treasury-detail').addEventListener('close',()=>{selected=null;offset=0;if(state)render();});
 function input(label,type,name,opts={}){const l=el('label',label),n=el('input');n.type=type;n.name=name;for(const [k,v] of Object.entries(opts))n.setAttribute(k,v);l.append(n);return l;}
 function open(title,fn,fields){$('treasury-dialog').removeAttribute('data-move');$('treasury-save').textContent='Confirmar';requestId=crypto.randomUUID();action=fn;$('treasury-form').reset();$('treasury-dialog-title').textContent=title;$('treasury-fields').replaceChildren(...fields);$('treasury-error').textContent='';$('treasury-dialog').showModal();}
 const movementTypes={
 fixed:[['Aportes','Reposiciones','Otros ingresos'],['Salarios','Servicios','Alquileres','Mantenimiento','Otros gastos']],
 investment:[['Recuperación de capital','Aportes del CEO','Otros ingresos'],['Equipamiento','Infraestructura','Devolución al CEO','Otros gastos']],
 profit:[['Utilidades generadas','Otros ingresos'],['Entrega al CEO','Otros gastos']],
 stimulus:[['Aportes','Descuentos','Otros ingresos'],['Bonificaciones','Incentivos','Otros gastos']],
 supplies:[['Aportes','Recuperaciones','Otros ingresos'],['Compras de materiales','Consumibles','Otros gastos']],
 surplus:[['Sobrantes de presupuestos','Otros ingresos'],['Gastos autorizados','Otros gastos']],
 workers:[['Aportes','Otros ingresos'],['Pagos a trabajadores','Otros gastos']]
 };
 function selectField(label,name,choices){
 const field=el('label',label),select=el('select');select.name=name;select.required=true;
 for(const [value,title] of choices){const option=el('option',title);option.value=value;select.append(option);}field.append(select);return field;
 }
 function moveBlock(number,title){const block=el('section','','move-block'),head=el('h3','','move-block-title');head.append(el('span',number),el('strong',title));block.append(head);return block;}
 function readReceipt(file){return new Promise((resolve,reject)=>{if(!file||!file.size){resolve(null);return;}if(file.size>2000000||!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)){reject(Error('Selecciona una imagen o PDF de hasta 2 MB.'));return;}const reader=new FileReader();reader.onload=()=>resolve({name:file.name,mime:file.type,content:String(reader.result).split(',')[1]});reader.onerror=()=>reject(Error('No se pudo leer el comprobante.'));reader.readAsDataURL(file);});}
 function move(direction){
 const f=selected,fund=state.funds.find(x=>x.code===f),income=direction>0;
 const details=moveBlock('1','Detalles del movimiento'),grid=el('div','','move-grid');
 const date=input('Fecha','date','date',{required:''});date.querySelector('input').value=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Havana',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const area=selectField('Área','area',[['','Seleccionar área'],...['AUDIOVISUALES','DISEÑO','GRAFICA','OFICINA','GENERAL'].map(x=>[x,x])]);
 const category=selectField('Tipo de movimiento','category',[['','Seleccionar tipo'],...(movementTypes[f]||movementTypes.fixed)[income?0:1].map(x=>[x,x])]);
 const concept=input('Concepto','text','concept',{required:'',maxlength:'500',placeholder:'Describe el movimiento'});
 grid.append(date,area,category,concept);details.append(grid);
 let kind,destination;
 if(!income&&!workers){kind=selectField('Destino del retiro','kind',[['expense','Gasto / retiro'],['transfer','Traspaso a otro fondo']]);destination=selectField('Fondo de destino','destination',state.funds.filter(x=>!x.worker&&x.code!==f).map(x=>[x.code,x.label]));destination.hidden=true;destination.querySelector('select').disabled=true;details.append(kind,destination);kind.querySelector('select').onchange=()=>{const transfer=kind.querySelector('select').value==='transfer';destination.hidden=!transfer;destination.querySelector('select').disabled=!transfer;category.hidden=transfer;category.querySelector('select').disabled=transfer;};}
 const conversion=moveBlock('2','Conversión de moneda'),visual=el('div','','move-conversion'),original=el('strong','CUP 0.00'),result=el('strong','USD 0.00');visual.append(original,el('span','→'),result);conversion.append(visual);
 const fields=el('div','','move-grid'),currency=el('fieldset','','move-currencies');currency.append(el('legend','Moneda del monto original'));
 for(const c of ['CUP','USD']){const label=el('label',c),radio=el('input');radio.type='radio';radio.name='currency';radio.value=c;radio.checked=c==='CUP';label.prepend(radio);currency.append(label);}
 const amount=input('Monto original','number','amount',{required:'',min:'0.01',step:'0.01',inputmode:'decimal'}),exchange=input('Tasa de cambio · CUP / USD','number','rate',{min:'0.01',max:'1000000',step:'any',inputmode:'decimal'});if(rate>0)exchange.querySelector('input').value=rate;
 fields.append(currency,amount,exchange);conversion.append(fields);
 const note=el('small','Equivalencia de referencia. El movimiento se registra en la moneda seleccionada.','move-note');conversion.append(note);
 const proof=moveBlock('3','Comprobante (opcional)'),file=input('Adjuntar comprobante · imagen o PDF, hasta 2 MB','file','receipt',{accept:'image/jpeg,image/png,image/webp,application/pdf'});proof.append(file);
 const summary=el('div','','move-balance'),before=el('strong'),after=el('strong');const one=el('div'),two=el('div');one.append(el('small','Saldo actual'),before);two.append(el('small','Saldo resultante'),after);summary.append(one,two);
 const update=()=>{const c=currency.querySelector('input:checked').value,n=Number(amount.querySelector('input').value)||0,r=Number(exchange.querySelector('input').value),balance=Number(fund[c]);exchange.querySelector('input').required=c==='CUP';original.textContent=money(n,c);result.textContent=r>0?money(c==='CUP'?n/r:n*r,c==='CUP'?'USD':'CUP'):'—';before.textContent=money(balance,c);after.textContent=money(balance+direction*n,c);};
 conversion.addEventListener('input',update);
 open(income?'Registrar ingreso':'Registrar egreso',async data=>rpc('treasury_register_movement',{p_id:requestId,p_fund:f,p_currency:data.get('currency'),p_amount:direction*Number(data.get('amount')),p_concept:data.get('concept'),p_date:data.get('date'),p_area:data.get('area'),p_category:data.get('kind')==='transfer'?'Traspaso entre fondos':data.get('category'),p_rate:Number(data.get('rate'))||null,p_destination:data.get('kind')==='transfer'?data.get('destination'):null,p_receipt:await readReceipt(data.get('receipt'))}),[el('p',fund.label,'move-fund-name'),details,conversion,proof,summary]);
 $('treasury-dialog').dataset.move=income?'income':'expense';$('treasury-save').textContent=income?'Confirmar ingreso':'Confirmar egreso';update();
 }
 $('fund-in').onclick=()=>move(1);$('fund-out').onclick=()=>move(-1);$('fund-dispatch').onclick=()=>open('Preparar cuadre con el CEO',d=>rpc('treasury_dispatch',{p_id:requestId,p_cup:Number(d.get('cup')||0),p_usd:Number(d.get('usd')||0),p_note:d.get('note')}),[input('Importe CUP','number','cup',{min:'0',step:'0.01',value:'0'}),input('Importe USD','number','usd',{min:'0',step:'0.01',value:'0'}),input('Observación','text','note',{maxlength:'500'})]);
 $('treasury-form').onsubmit=e=>{e.preventDefault();run(async()=>{await action(new FormData(e.target));$('treasury-dialog').close();$('treasury-message').textContent='Movimiento registrado.';await refresh();});};$('treasury-close').onclick=$('treasury-cancel').onclick=()=>{if(!busy)$('treasury-dialog').close();};$('treasury-dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});$('treasury-refresh').onclick=()=>run(refresh);$('history-next').onclick=()=>run(async()=>{offset+=100;await history();});$('history-prev').onclick=()=>run(async()=>{offset=Math.max(0,offset-100);await history();});
 run(async()=>{const {data}=await client.auth.getUser();if(!data.user){location.href='/';return;}await refresh();startActivityUpdates();if(workers){selected='workers';resetHistoryFilters();render();$('treasury-detail').showModal();await Promise.all([history(),loadFundStatistics(selected)]);}});
})();
