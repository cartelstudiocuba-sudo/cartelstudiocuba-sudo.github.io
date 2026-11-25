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
 function equivalent(cup,usd){
 const line=el('div','','treasury-equivalent');
 line.append(el('small','Equivalente total en USD'),el('strong',rate>0?money(usd+cup/rate,'USD'):'—'),el('small',rate>0?'Tasa del día · '+rateDate:'Tasa del día no disponible'));return line;
 }
 $('treasury-overview').hidden=workers;
 const icons={fixed:'▤',investment:'↗',supplies:'◇',stimulus:'★',profit:'$',surplus:'＋',workers:'♙'};
 async function rpc(name,args={}){const {data,error}=await client.rpc(name,args);if(error)throw error;return data;}
 async function run(fn){if(busy)return;busy=true;$('treasury-save').disabled=true;try{await fn();}catch(e){$( $('treasury-dialog').open?'treasury-error':'treasury-message').textContent=e.message||'No se pudo completar';}finally{busy=false;$('treasury-save').disabled=false;}}
 function render(){
 const cards=$('treasury-funds');cards.replaceChildren();
 const funds=state.funds.filter(f=>Boolean(f.worker)===workers);
 for(const f of funds){
 const cup=Number(f.CUP),usd=Number(f.USD),negative=cup<0||usd<0;
 const b=el('button','','treasury-card');b.type='button';
 b.style.setProperty('--fund-color',negative?'#ff727d':colors[f.code]);
 b.setAttribute('aria-pressed',String(selected===f.code));
 const title=el('div','','treasury-card-title');
 title.append(el('span',icons[f.code]),el('strong',f.label));
 const amounts=el('div','','treasury-card-amounts');
 for(const c of ['CUP','USD']){
 const value=el('div','','fund-currency');
 value.append(el('small',c==='USD'?'USD (saldo)':'CUP'),el('strong',numberAmount(f[c]),Number(f[c])<0?'negative':''));
 const available=el('small','','fund-available');
 available.append(el('span','Disponible'),el('b',money(Math.max(0,Number(f['available_'+c])),c)));
 value.append(available);amounts.append(value);
 }
 const body=el('div','','fund-card-body');body.append(amounts);
 if(negative&&f.code==='investment')body.append(el('small','Capital pendiente del CEO','fund-debt'));
 const footer=el('div','','fund-equivalent');
 footer.append(el('span','Equivalente total'),el('strong',rate>0?money(usd+cup/rate,'USD'):'—'),el('small',rate>0?'Tasa del día · '+rateDate:'Tasa del día no disponible'));
 b.append(title,body,footer);
 b.onclick=()=>run(async()=>{selected=f.code;offset=0;render();$('treasury-detail').showModal();await history();});
 cards.append(b);
 }
 const f=funds.find(f=>f.code===selected);if(!workers)renderOverview(funds);if(!f)return;$('fund-title').textContent=f.label;$('fund-balance').textContent='Disponible · '+money(f.available_CUP,'CUP')+' · '+money(f.available_USD,'USD');$('fund-dispatch').hidden=f.code!=='profit'||state.owner;$('treasury-dispatches').hidden=f.code!=='profit';renderDispatches();}
 function renderDispatches(){const target=$('treasury-dispatches');target.replaceChildren();if(selected!=='profit')return;target.append(el('h3','Cuadres con el CEO'));for(const d of state.dispatches){const row=el('div','','treasury-dispatch');row.append(el('strong',money(d.cup,'CUP')+' + '+money(d.usd,'USD')),el('p',new Date(d.created_at).toLocaleString('es-CU')+' · '+(d.status==='pending'?'Pendiente de recibido':'Recibido confirmado')),el('p',d.note));if(state.owner&&d.status==='pending'){const b=el('button','Confirmar recibido','primary');b.onclick=()=>{open('Confirmar recibido del CEO',()=>rpc('treasury_confirm_dispatch',{p_id:d.id}),[el('p','Confirmas haber recibido '+money(d.cup,'CUP')+' y '+money(d.usd,'USD')+'.')]);};row.append(b);}if(d.status==='confirmed'){const b=el('button','Imprimir comprobante','secondary');b.onclick=()=>printDispatch(d);row.append(b);}target.append(row);}if(!state.dispatches.length)target.append(el('p','Todavía no hay cuadres.'));}
 function printDispatch(d){const w=window.open('','_blank');if(!w){$('treasury-message').textContent='Permite la ventana emergente para imprimir.';return;}const doc=w.document;doc.title='Comprobante de utilidad';const style=doc.createElement('style');style.textContent='@page{size:80mm auto;margin:4mm}body{font:12px Arial;width:72mm;margin:0}h2{text-align:center}p{overflow-wrap:anywhere}';doc.head.append(style);for(const t of ['EL CARTEL STUDIO','Comprobante de utilidad','Recibido confirmado',money(d.cup,'CUP'),money(d.usd,'USD'),new Date(d.confirmed_at).toLocaleString('es-CU'),d.note||'','Firma del CEO: __________________']){const p=doc.createElement('p');p.textContent=t;doc.body.append(p);}w.print();}
 async function history(){if(!selected)return;const fund=selected,rows=await rpc('treasury_history',{p_fund:fund,p_offset:offset});if(selected!==fund)return;const body=$('treasury-history');body.replaceChildren();for(const r of rows){const tr=el('tr'),amount=Number(r.amount);for(const v of [r.occurred_on||'Sin fecha',r.concept,r.area||'—',amount>0?money(amount,r.currency):'—',amount<0?money(-amount,r.currency):'—',({excel:'Histórico Excel',bar:'Cuadre de nevera',manual:'Manual',budget:'Solicitud de presupuesto',ceo_dispatch:'Cuadre CEO',transfer:'Traspaso entre fondos'}[r.source]||r.source)])tr.append(el('td',v));body.append(tr);}if(!rows.length){const tr=el('tr'),td=el('td','Sin movimientos.');td.colSpan=6;tr.append(td);body.append(tr);}$('history-prev').disabled=offset===0;$('history-next').disabled=rows.length<100;}
 async function refresh(){state=await rpc('treasury_state');render();await history();if(!workers)await loadFlow();await refreshRate();}
 async function refreshRate(){try{const ref=await CartelExchangeRates.read(client);rate=Number(ref.value);rateDate=ref.source_date||new Date(ref.fetched_at).toLocaleDateString('es-CU');$('treasury-rate').textContent='Referencia del día · 1 USD = '+rate+' CUP · '+CartelExchangeRates.label(ref);}catch{rate=null;rateDate=null;$('treasury-rate').textContent='Tasa del día no disponible.';}render();if(!workers&&flowMonth===period())renderFlow();}

 function renderOverview(funds){
 const target=$('treasury-kpis');target.replaceChildren();
 const sum=(c,fn)=>funds.reduce((total,f)=>total+fn(Number(f[c]),Number(f['available_'+c]),f),0);
 for(const [label,color,fn] of [
 ['Saldos positivos','#ffda03',(balance)=>Math.max(0,balance)],
 ['Disponible','#58e0a0',(_,available)=>Math.max(0,available)],
 ['Comprometido','#65c9ff',(balance,available)=>Math.max(0,balance-available)],
 ['Capital pendiente del CEO','#ff9292',(balance,_,f)=>f.code==='investment'?Math.max(0,-balance):0]]){
 const card=el('article','','treasury-kpi');card.style.setProperty('--accent',color);
 const cup=sum('CUP',fn),usd=sum('USD',fn);card.append(el('small',label),el('strong',money(cup,'CUP')),equivalent(cup,usd),el('small','Saldo registrado en USD · '+money(usd,'USD')));target.append(card);}
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
 function open(title,fn,fields){requestId=crypto.randomUUID();action=fn;$('treasury-form').reset();$('treasury-dialog-title').textContent=title;$('treasury-fields').replaceChildren(...fields);$('treasury-error').textContent='';$('treasury-dialog').showModal();}
 function move(direction){
 const f=selected,l=el('label','Moneda'),s=el('select');s.name='currency';for(const c of ['CUP','USD']){const o=el('option',c);o.value=c;s.append(o);}l.append(s);
 const fields=[l,input('Importe','number','amount',{required:'',min:'0.01',step:'0.01'}),input('Concepto','text','concept',{required:'',maxlength:'500'})];
 if(direction<0&&!workers){const kind=el('label','Destino del retiro'),select=el('select');select.name='kind';for(const [v,t] of [['expense','Gasto / retiro'],['transfer','Traspaso a otro fondo']]){const o=el('option',t);o.value=v;select.append(o);}kind.append(select);const destination=el('label','Fondo de destino'),dest=el('select');dest.name='destination';for(const fund of state.funds.filter(x=>!x.worker&&x.code!==f)){const o=el('option',fund.label);o.value=fund.code;dest.append(o);}destination.append(dest);destination.hidden=true;dest.disabled=true;select.onchange=()=>{destination.hidden=select.value!=='transfer';dest.disabled=destination.hidden;};fields.unshift(kind,destination);}
 open(direction>0?'Registrar ingreso':'Registrar retiro',data=>data.get('kind')==='transfer'?rpc('treasury_transfer',{p_id:requestId,p_from:f,p_to:data.get('destination'),p_currency:data.get('currency'),p_amount:Number(data.get('amount')),p_concept:data.get('concept')}):rpc('treasury_move',{p_id:requestId,p_fund:f,p_currency:data.get('currency'),p_amount:direction*Number(data.get('amount')),p_concept:data.get('concept')}),fields);
 }
 $('fund-in').onclick=()=>move(1);$('fund-out').onclick=()=>move(-1);$('fund-dispatch').onclick=()=>open('Preparar cuadre con el CEO',d=>rpc('treasury_dispatch',{p_id:requestId,p_cup:Number(d.get('cup')||0),p_usd:Number(d.get('usd')||0),p_note:d.get('note')}),[input('Importe CUP','number','cup',{min:'0',step:'0.01',value:'0'}),input('Importe USD','number','usd',{min:'0',step:'0.01',value:'0'}),input('Observación','text','note',{maxlength:'500'})]);
 $('treasury-form').onsubmit=e=>{e.preventDefault();run(async()=>{await action(new FormData(e.target));$('treasury-dialog').close();$('treasury-message').textContent='Movimiento registrado.';await refresh();});};$('treasury-close').onclick=$('treasury-cancel').onclick=()=>{if(!busy)$('treasury-dialog').close();};$('treasury-dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});$('treasury-refresh').onclick=()=>run(refresh);$('history-next').onclick=()=>run(async()=>{offset+=100;await history();});$('history-prev').onclick=()=>run(async()=>{offset=Math.max(0,offset-100);await history();});
 run(async()=>{const {data}=await client.auth.getUser();if(!data.user){location.href='/';return;}await refresh();if(workers){selected='workers';render();$('treasury-detail').showModal();await history();}});
})();
