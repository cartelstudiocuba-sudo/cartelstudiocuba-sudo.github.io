(() => {
 'use strict';
 const client = CartelLoad.createClient('https://jhumvctocphyiwhszeaz.supabase.co', 'sb_publishable_ZHV-5dlsjfamQpfUOsgumg_G-vN84Gn', {auth:{persistSession:true,autoRefreshToken:true,storage:localStorage}});
 const $ = id => document.getElementById(id);
 const form = $('budget-form'), dialog = $('budget-dialog'), detailDialog=$('budget-detail-dialog');
 const statuses = {
  chief_pending:{label:'En revisión',color:'#ffd65b',icon:'⌛',detail:'Pendiente del jefe de área'},
  manager_pending:{label:'En trámite',color:'#70b8ff',icon:'↻',detail:'Pendiente del Manager General'},
  approved:{label:'Aprobadas',color:'#52df85',icon:'✓',detail:'Aprobada'},
  rejected:{label:'No aprobadas',color:'#ff7474',icon:'×',detail:'No aprobada'}
 };
 let rateGeneration=0,rateSource='manual',rateDate=null;
 let caps, user, requests=[], filter='all', limit=25, step=0, unlocked=0, busy=false, attempt=null, catalog=null;
 const direct = () => ['Administrador','Jefe de Área'].includes(caps.request_role_title);
 const canSubmit = () => caps.request || direct();
 const recipient = () => direct() ? 'Manager General' : 'Jefe de área';
 const format = (value,currency) => new Intl.NumberFormat('es-CU',{style:'currency',currency,currencyDisplay:'code'}).format(value);
 const report = text => { $(dialog.open?'budget-form-message':detailDialog.open?'budget-detail-message':'budget-message').textContent = text; };
 const field = name => form.elements.namedItem(name);
 const normalize = value => String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 function node(tag,value='',className='') {
  const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;return el;
 }
 function button(label,className,action) {
  const el=node('button',label,className);el.type='button';el.onclick=action;return el;
 }
 async function rpc(name,args={}) {const {data,error}=await client.rpc(name,args);if(error)throw error;return data;}
 async function run(action) {
  if(busy)return;busy=true;report('');
  try{await action();}catch(error){report(error.message||'Ocurrió un error. Vuelve a intentarlo.');}
  finally{busy=false;}
 }
 function requestTotals(request) {
  return request.totals || {[request.currency]:Number(request.amount)};
 }
 function moneyText(totals) {
  return ['CUP','USD'].filter(currency=>Number(totals[currency])>0).map(currency=>format(totals[currency],currency)).join(' · ');
 }
 function isChiefBudgetView(){return !!(caps.audiovisual||caps.graphics)&&!caps.manager&&!caps.owner;}
 function updateStats() {
  const stats=$('budget-stats'),filters=$('budget-filters');stats.replaceChildren();filters.replaceChildren();
  const chief=isChiefBudgetView();
  $('budget-chief-summary').hidden=!chief;stats.hidden=chief;
  document.documentElement.classList.toggle('budget-chief-view',chief);
  if(chief){
   window.CartelBudgetSummary.renderSummary({container:$('budget-chief-summary'),requests,totals:requestTotals,selected:filter,selectFilter:key=>setFilter(filter===key?'all':key)});
   return;
  }

  const all=button('Todas','',()=>setFilter('all'));all.setAttribute('aria-pressed',String(filter==='all'));filters.append(all);
  for(const [key,value] of Object.entries(statuses)){
   const count=requests.filter(request=>request.status===key).length;
   const tile=button('','stat',()=>setFilter(key));tile.style.setProperty('--state',value.color);tile.setAttribute('aria-pressed',String(filter===key));
   const icon=node('span',value.icon,'stat-icon');icon.setAttribute('aria-hidden','true');
   const caption=node('span',value.label);caption.append(node('strong',String(count)));tile.append(icon,caption);stats.append(tile);
   const tab=button(value.label,'',()=>setFilter(key));tab.setAttribute('aria-pressed',String(filter===key));filters.append(tab);
  }
 }
 function setFilter(next){filter=next;limit=25;updateStats();renderList();}
 function renderList() {
  const chief=isChiefBudgetView();
  const query=normalize($('budget-search').value);
  const visible=requests.filter(r=>(filter==='all'||r.status===filter)&&normalize([r.product,r.area,r.requester_name,requesterRole(r),r.reason,moneyText(requestTotals(r)),...(r.items||[]).map(item=>item.name)].join(' ')).includes(query));
  if(chief){
   const order=$('budget-sort').value;
   const newest=(a,b)=>new Date(b.created_at)-new Date(a.created_at);
   if(order==='oldest')visible.sort((a,b)=>-newest(a,b));
   else if(order==='urgent')visible.sort((a,b)=>(b.priority==='Urgente')-(a.priority==='Urgente')||newest(a,b));
   else visible.sort(newest);
  }
  $('budget-count').textContent=visible.length+(visible.length===1?' solicitud':' solicitudes');
  const target=$('budget-requests');target.replaceChildren();
  if(chief){
   document.querySelector('.list-heading h2').textContent=filter==='all'?'Todas las solicitudes':(filter==='chief_pending'?'Por aprobar':statuses[filter].label);
   target.append(...visible.slice(0,limit).map(renderRequest));
   if(!visible.length)target.append(node('p',query?'No se encontraron solicitudes.':filter==='all'?'No hay solicitudes registradas.':'No hay solicitudes en este estado.','empty'));
   $('budget-more').hidden=visible.length<=limit;
   return;
  }
  const own=visible.filter(request=>request.requester===user.id),incoming=visible.filter(request=>request.requester!==user.id);
  const groups=[];
  if(caps.audiovisual||caps.graphics||caps.manager||caps.owner||incoming.length)groups.push(['Solicitudes de subordinados',incoming]);
  groups.push(['Solicitudes propias',own]);
  for(const [title,rows] of groups){
   const section=node('section','','request-group'),heading=node('h3','','request-group-heading');
   heading.append(node('span',title),node('small',String(rows.length),'request-group-count'));section.append(heading);
   if(rows.length)section.append(...rows.slice(0,limit).map(renderRequest));
   else section.append(node('p','No hay solicitudes en este grupo.','empty'));
   target.append(section);
  }
  $('budget-more').hidden=groups.every(([,rows])=>rows.length<=limit);
 }
 function detailSections(body,request,state) {
  const details=request.details||{};
  const info=node('section','','confirmation-section budget-detail-info'),grid=node('div','','confirmation-grid');
  const status=confirmationField('Estado',state.detail,'destination');
  status.querySelector('strong').style.color=state.color;
  grid.append(confirmationField('Solicitante',request.requester_name||'—','person'),
   confirmationField('Área',request.area||'—','area'),
   confirmationField('Fecha',new Date(request.created_at).toLocaleDateString('es-CU'),'calendar'),
   status,confirmationField('Prioridad',request.priority||'—',null,true));
  for(const [label,value] of [['Proveedor',details.supplier],['Fecha requerida',details.needed_on],['Observaciones',details.observations],['Referencia',details.reference],['Observación jefe de área',request.chief_note],['Observación Manager General',request.manager_note]]){
   if(value){const field=confirmationField(label,value,'note');field.classList.add('budget-detail-wide');grid.append(field);}
  }
  info.append(confirmationHeading('Información de la solicitud','person'),grid);
  const products=node('section','','confirmation-section'),table=node('table','','budget-detail-table');
  const head=node('thead'),heading=node('tr');
  for(const label of ['Producto o servicio','Cantidad','Precio unitario','Importe']){const th=node('th',label);th.scope='col';heading.append(th);}
  head.append(heading);table.append(head);
  const rows=node('tbody');
  const items=request.items?.length?request.items:[{name:request.product,quantity:request.quantity,currency:request.currency,subtotal:request.amount}];
  for(const item of items){
   const row=node('tr');
   const unitPrice=item.unit_price??(Number(item.quantity)>0?Number(item.subtotal)/Number(item.quantity):null);
   const values=[item.name,String(item.quantity??'—')+(item.unit&&item.unit!=='unidad'?' '+item.unit:''),unitPrice!=null?format(unitPrice,item.currency):'—',format(item.subtotal,item.currency)];
   for(const [index,value] of values.entries()){const cell=node('td',value);cell.dataset.label=heading.children[index].textContent;row.append(cell);}
   rows.append(row);
  }
  table.append(rows);
  const reason=node('p','','budget-detail-justification'),reasonText=node('span');
  reasonText.append(node('strong','Justificación. '),document.createTextNode(request.reason||'—'));
  reason.append(confirmationIcon('note'),reasonText);
  products.append(confirmationHeading('Productos y servicios','cart'),table,reason);
  const cost=node('section','','confirmation-section confirmation-finance'),columns=node('div','','confirmation-totals');
  const original=node('div','','confirmation-original'),equivalent=node('div','','confirmation-equivalent');
  const totals=requestTotals(request),rate=Number(details.exchange_rate),converted=equivalents(totals,rate);
  original.append(node('small','Importes originales'),node('strong',format(totals.CUP||0,'CUP')+' + '+format(totals.USD||0,'USD')));
  equivalent.append(node('small','Totales equivalentes'),node('strong',converted?format(converted.CUP,'CUP'):'—'));
  if(converted)equivalent.append(node('strong','o '+format(converted.USD,'USD')));
  columns.append(original,equivalent);
  const rateLine=node('div','','confirmation-rate');
  rateLine.append(confirmationIcon('rate'),document.createTextNode(converted?'Tasa utilizada · 1 USD = '+rate+' CUP':'Tasa de cambio no registrada'));
  cost.append(confirmationHeading('Resumen de inversión','calculator'),columns,rateLine);
  body.append(info,products,cost);
 }
 function requesterRole(request) {
  if(request.direct_to_manager)return request.area==='Generales'?'Administrador':'Jefe de Área';
  return 'Gestor Técnico';
 }
 function renderRequest(request) {
  const card=node('article','','request'),header=node('button'),state=statuses[request.status];header.type='button';header.setAttribute('aria-haspopup','dialog');
  header.className='request-visual-row';
  const category=node('span','','request-category'),icon=node('span','','request-category-icon'),title=node('span',request.product,'request-title');
  const legacyKinds={'Abastecimiento de Nevera Audiovisual':'Abastecimiento de nevera','Compra de herramientas':'Equipos y herramientas','Equipos y accesorios':'Equipos y herramientas','Materiales de mantenimiento':'Materiales e insumos','Materias primas e insumos':'Materiales e insumos','Repuestos y componentes':'Mantenimiento y reparación','Reparaciones y servicios técnicos':'Mantenimiento y reparación'};
  const kind=legacyKinds[request.kind]||request.kind;
  icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 24 24">'+(expenseIcons[kind]||confirmationIcons.type)+'</svg>';
  if(request.kind==='Otros gastos'&&request.product!=='Otros gastos')title.append(node('small','Otros gastos','request-meta'));
  category.append(icon,title);
  const requester=node('span','','request-person request-column');requester.append(node('small','Solicitante','request-label'),node('strong',request.requester_name||'—'),node('small',request.area||'','request-meta'));
  const date=node('span','','request-date request-column');date.append(node('small','Fecha','request-label'),node('strong',new Date(request.created_at).toLocaleDateString('es-CU')));
  const priority=node('span',request.priority||'Sin prioridad','request-priority');priority.dataset.priority=request.priority||'';
  const badge=node('span',request.status==='chief_pending'?'En revisión':request.status==='manager_pending'?'En trámite':state.detail,'badge request-status');badge.style.setProperty('--state',state.color);badge.title=state.detail;
  const amounts=node('span','','request-amount request-column');const totals=requestTotals(request);const original=['CUP','USD'].filter(currency=>Number(totals[currency])>0).map(currency=>format(totals[currency],currency)).join(' + ');
  amounts.append(node('small','Importe original','request-label'),node('strong',original||'—'));
  if(isChiefBudgetView()){
   card.classList.add('budget-review-card');
   const reviewIcon=node('span','','budget-review-icon');
   reviewIcon.setAttribute('aria-hidden','true');reviewIcon.innerHTML=icon.innerHTML;
   const reviewCopy=node('span','','budget-review-copy'),meta=node('span','','budget-review-meta');
   const person=node('span','','budget-review-person');
   const personIcon=confirmationIcon('person');personIcon.className='budget-review-calendar';
   const personCopy=node('span','','budget-review-person-copy');
   personCopy.append(node('strong',request.requester_name||'—'),node('small',requesterRole(request),'budget-review-role'));
   person.append(personIcon,personCopy);
   const reviewDate=node('time','','budget-review-date');reviewDate.dateTime=request.created_at;
   const calendar=node('span','','budget-review-calendar');calendar.setAttribute('aria-hidden','true');calendar.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-14 4h2m3 0h2m3 0h2"/></svg>';
   reviewDate.append(calendar,document.createTextNode(new Date(request.created_at).toLocaleDateString('es-CU')));
   meta.append(person,reviewDate);
   const age=Math.floor(Math.max(0,Date.now()-new Date(request.created_at).getTime())/86400000);
   const tags=node('span','','budget-review-tags');
   if(request.priority==='Urgente')tags.append(node('span','Urgente','budget-urgent-tag'));
   if(Number.isFinite(age))tags.append(node('span',age===0?'Hoy':age===1?'Hace 1 día':'Hace '+age+' días','budget-age-tag'));
   reviewCopy.append(node('strong',request.product||request.kind||'Solicitud de presupuesto','budget-review-title'),meta,tags);

   const reviewStatus=node('span',badge.textContent,'budget-review-state');reviewStatus.style.setProperty('--state',state.color);reviewStatus.dataset.status=request.status;
   const reviewActions=node('span','','budget-review-actions');
   const action=node('span','Ver solicitud','budget-review-action');action.append(node('span','›','budget-review-chevron'));
   reviewActions.append(reviewStatus,action);header.append(reviewIcon,reviewCopy,reviewActions);
  }else header.append(category,requester,date,priority,badge,amounts);
  card.append(header);
  const body=node('div','','request-body');
  if(isChiefBudgetView())body.append(window.CartelBudgetSummary.renderTimeline(request));
  detailSections(body,request,state);
  const chief=request.status==='chief_pending'&&(request.area==='Audiovisual'?caps.audiovisual:caps.graphics);
  const manager=request.status==='manager_pending'&&caps.manager&&request.chief_by!==user.id;
  if(request.requester!==user.id&&(chief||manager)){
   const decision=node('form','','decision'),note=node('textarea');note.rows=2;note.maxLength=1500;note.placeholder='Observación (obligatoria para rechazar)';note.setAttribute('aria-label','Observación de la decisión');
   const actions=node('div','','decision-actions');
   const approve=node('button',chief?'Aprobar y pasar al Manager General':'Aprobar presupuesto','success'),reject=node('button','Rechazar','secondary');
   actions.append(reject,approve);decision.append(note,actions);
   decision.onsubmit=event=>{event.preventDefault();const approved=event.submitter!==reject;if(!approved&&!note.value.trim()){note.focus();report('Escribe el motivo del rechazo.');return;}run(async()=>{await rpc('purchase_budget_decide',{p_id:request.id,p_stage:request.status,p_approve:approved,p_note:note.value});detailDialog.close();await load();report('Decisión guardada.');});};
   body.append(decision);
  }
  card.dataset.requestId=request.id;
  header.onclick=()=>{ $('budget-detail-title').textContent=request.product;$('budget-detail-body').replaceChildren(body);$('budget-detail-message').textContent='';detailDialog.showModal(); };return card;
 }
 async function load() {
  const rows=[];const size=250;
  for(let offset=0;;offset+=size){
   const {data,error}=await client.from('purchase_budget_requests').select('*').order('created_at',{ascending:false}).order('id').range(offset,offset+size-1);
   if(error)throw error;rows.push(...data);if(data.length<size)break;
  }
  requests=rows;updateStats();renderList();if(window.parent!==window)window.parent.postMessage({type:'purchase-budget-changed'},location.origin);
 }
 function itemInput(label,name,type,value,attrs={}) {
  const wrap=node('label',label),input=node('input');input.name=name;input.type=type;input.value=value;
  for(const [key,val] of Object.entries(attrs))input.setAttribute(key,val);
  wrap.append(input);return wrap;
 }
 function addItem(product) {
  const container=$('budget-items');
  if(product&&container.children.length===1&&!container.querySelector('[name=item_name]').value.trim()&&!container.querySelector('[name=item_price]').value)container.replaceChildren();
  if(container.children.length>=100)return;
  const item=node('div','','item'),header=node('div','','item-head');
  const remove=button('×','item-remove',()=>{item.remove();updateTotals();});remove.setAttribute('aria-label','Quitar artículo');
  const name=itemInput('Nombre','item_name','text',product?.name||'',{required:'',maxlength:'160'});
  const fields=node('div','','item-fields');
  const currencyLabel=node('label','Moneda'),currency=node('select');currency.name='item_currency';for(const code of ['USD','CUP'])currency.append(node('option',code));currencyLabel.append(currency);
  fields.append(itemInput('Cantidad','item_quantity','number','1',{required:'',min:'0.001',max:'999999',step:'0.001'}),itemInput('Precio unitario','item_price','number',product?.cost??'',{required:'',min:'0.01',step:'0.01',max:'99999999999'}),currencyLabel);
  header.append(name,remove);item.append(header,fields,node('p','','item-subtotal'));container.append(item);updateTotals();
 }
 function collectItems() {
  return [...$('budget-items').children].map(row=>{
   const get=name=>row.querySelector('[name='+name+']').value;
   const quantity=Number(get('item_quantity')),unit_price=Number(get('item_price'));
   return {name:get('item_name').trim(),unit:'unidad',quantity,unit_price,currency:get('item_currency'),subtotal:Math.round(quantity*unit_price*100)/100};
  });
 }
 function calculate(items) {
  const totals={CUP:0,USD:0};for(const item of items)totals[item.currency]+=Number.isFinite(item.subtotal)?item.subtotal:0;return totals;
 }
 function validRate(value){return Number.isFinite(value)&&value>0&&value<=1000000;}
 function equivalents(totals,rate){
  if(!validRate(rate))return null;
  const cup=Number(totals.CUP||0),usd=Number(totals.USD||0);
  return {CUP:cup+usd*rate,USD:usd+cup/rate};
 }
 function totalsView(target,totals,rate){
  const original=node('div','','budget-original');original.append(node('span','Importes originales'),node('strong',format(totals.CUP||0,'CUP')+' + '+format(totals.USD||0,'USD')));
  const converted=equivalents(totals,rate);
  target.replaceChildren(original,...['CUP','USD'].map(currency=>{
   const card=node('div','','budget-equivalent');card.append(node('span','Equivalente en '+currency),node('strong',converted?format(converted[currency],currency):'—'));return card;
  }));
 }
 async function fetchRate(force=false){
  const generation=++rateGeneration,input=$('budget-exchange-rate'),status=$('budget-rate-status');
  const refresh=$('budget-rate-refresh');refresh.disabled=true;status.textContent='Consultando referencia del día…';
  try{
   const reference=await window.CartelExchangeRates.read(client,{force});
   if(generation!==rateGeneration||!dialog.open)return;
   input.value=String(reference.value);rateSource='reference';rateDate=reference.source_date||reference.fetched_at;status.textContent=window.CartelExchangeRates.label(reference);updateTotals();
  }catch{if(generation===rateGeneration&&dialog.open)status.textContent='Referencia no disponible. Puedes introducir la tasa manualmente.';}
  finally{if(generation===rateGeneration)refresh.disabled=false;}
 }
 function manualRate(){
  rateGeneration++;rateSource='manual-edited';rateDate=null;$('budget-rate-refresh').disabled=false;$('budget-rate-status').textContent='Tasa declarada manualmente · editable';updateTotals();
 }
 function updateTotals() {
  const items=collectItems();[...$('budget-items').children].forEach((row,index)=>{row.querySelector('.item-subtotal').textContent='Subtotal · '+format(items[index].subtotal||0,items[index].currency);});
  totalsView($('budget-totals'),calculate(items),Number(field('exchange_rate').value));
 }
 function payload() {
  return {area:field('area').value,kind:field('kind').value,priority:field('priority').value,reason:field('reason').value.trim(),items:collectItems(),
   details:{concept:field('concept').value.trim(),exchange_rate:Number(field('exchange_rate').value),exchange_rate_source:rateSource==='reference'?'reference':'manual',exchange_rate_date:rateDate}};
 }
 const confirmationIcons={
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-14 4h2m3 0h2m3 0h2"/>',
  person:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2Z"/>',
  area:'<path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
  type:'<path d="M3 12 12 3h8v8l-9 9Z"/><circle cx="16.5" cy="6.5" r="1"/>',
  destination:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m12 12 8-8"/>',
  note:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  cart:'<path d="M2 3h3l3 13h11l3-10H6M10 20h.01M18 20h.01"/>',
  calculator:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8v4H8zM8 14h1m6 0h1m-8 4h1m6 0h1"/>',
  rate:'<path d="M3 7h18l-5-5M21 17H3l5 5"/>',
  send:'<path d="m22 2-7 20-4-9-9-4Zm-11 11L22 2"/>'
 };
 function confirmationIcon(name){
  const icon=node('span','','confirmation-icon');icon.setAttribute('aria-hidden','true');
  icon.innerHTML='<svg viewBox="0 0 24 24">'+confirmationIcons[name]+'</svg>';return icon;
 }
 function confirmationHeading(title,icon){
  const heading=node('h3','','confirmation-heading');heading.append(confirmationIcon(icon),document.createTextNode(title));return heading;
 }
 function confirmationField(title,value,icon,priority){
  const card=node('div','','confirmation-field');
  if(priority){const dot=node('span','','confirmation-priority priority-dot');dot.dataset.priority=value;dot.setAttribute('aria-hidden','true');card.append(dot);}
  else card.append(confirmationIcon(icon));
  const copy=node('div');copy.append(node('small',title),node('strong',value));card.append(copy);return card;
 }
 function displaySummary() {
  const values=payload(),summary=$('budget-summary');summary.replaceChildren();
  const data=node('section','','confirmation-section'),grid=node('div','','confirmation-grid');
  grid.append(confirmationField('Solicitante',caps.request_role_title||'Solicitante','person'),confirmationField('Área',values.area,'area'),
   confirmationField('Tipo de gasto',values.details.concept?values.kind+' · '+values.details.concept:values.kind,'type'),confirmationField('Destino',recipient(),'destination'),
   confirmationField('Justificación',values.reason,'note'),confirmationField('Prioridad',values.priority,null,true));
  data.append(confirmationHeading('Ficha de solicitud','note'),grid);
  const articles=node('section','','confirmation-section'),list=node('div','','confirmation-receipt');
  articles.append(confirmationHeading('Artículos solicitados','cart'));
  for(const item of values.items){
   const row=node('div','','confirmation-receipt-row');row.append(node('strong',item.name),node('span','Cant. '+item.quantity,'confirmation-quantity'),node('strong',format(item.subtotal,item.currency),'confirmation-cost'));list.append(row);
  }
  articles.append(list);
  const converted=equivalents(calculate(values.items),values.details.exchange_rate),totals=calculate(values.items);
  const cost=node('section','','confirmation-section confirmation-finance'),columns=node('div','','confirmation-totals'),original=node('div','','confirmation-original'),equivalent=node('div','','confirmation-equivalent');
  original.append(node('small','Importes originales'),node('strong',format(totals.CUP||0,'CUP')+' + '+format(totals.USD||0,'USD')));
  equivalent.append(node('small','Totales equivalentes'),node('strong',converted?format(converted.CUP,'CUP'):'—'),node('strong',converted?'o '+format(converted.USD,'USD'):'—'));
  columns.append(original,equivalent);
  const rate=node('div','','confirmation-rate');rate.append(confirmationIcon('rate'),document.createTextNode('Tasa utilizada · 1 USD = '+values.details.exchange_rate+' CUP'));
  cost.append(confirmationHeading('Resumen de totales','calculator'),columns,rate);
  summary.append(data,articles,cost);
 }
 function validPanel(index) {
  const panel=form.querySelector('[data-panel="'+index+'"]');
  if(index===1&&!$('budget-items').children.length){report('Agrega al menos un artículo o servicio.');return false;}
  for(const input of panel.querySelectorAll('input,select,textarea'))if(!input.closest('[hidden]')&&(!input.checkValidity()||(input.required&&!input.value.trim()))){input.reportValidity();return false;}
  if(index===0&&field('kind').value==='Abastecimiento de nevera'&&field('area').value!=='Audiovisual'){report('El abastecimiento de nevera corresponde al área Audiovisual.');return false;}
  if(index===1&&!validRate(Number(field('exchange_rate').value))){report('Introduce una tasa de cambio válida.');return false;}
  if(index===1&&collectItems().some(item=>item.subtotal<=0)){report('El subtotal debe ser mayor que cero.');return false;}
  return true;
 }
 function move(next) {
  step=next;unlocked=Math.max(unlocked,next);report('');
  form.querySelectorAll('[data-panel]').forEach(panel=>panel.hidden=Number(panel.dataset.panel)!==step);
  form.querySelectorAll('[data-step]').forEach(button=>{const index=Number(button.dataset.step);button.disabled=index>unlocked;button.classList.toggle('completed',index<step);if(index===step)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});
  $('budget-back').textContent=step?'← Regresar':'Cancelar';$('budget-next').hidden=step===2;$('budget-send').hidden=step!==2;
  $('budget-send').replaceChildren(confirmationIcon('send'),document.createTextNode('Enviar al '+recipient()));if(step===2)displaySummary();
  if(step===1){if(!field('exchange_rate').value&&rateSource!=='manual-edited')void fetchRate();$('budget-catalog').hidden=field('kind').value!=='Abastecimiento de nevera';if(!$('budget-catalog').hidden)void loadCatalog();}
 }
 function configureArea() {
  field('area').value=caps.request_area||'';
  $('budget-area-label').textContent=caps.request_area||'Sin área asignada';
  $('budget-role-label').textContent=caps.request_role_title||'Solicitante';
  const kind=field('kind');
  const fridge=[...kind.options].find(option=>option.value==='Abastecimiento de nevera');
  if(fridge)fridge.remove();
  if(field('area').value==='Audiovisual')kind.add(new Option('Abastecimiento de nevera','Abastecimiento de nevera'),1);
  kind.value='';
 }
 const expenseIcons={
  'Inversión':'<path d="M3 20h18M5 17v-5m5 5V9m5 8V6m5 11V3M4 9l6-4 5 1 5-4"/>',
  'Abastecimiento de nevera':'<path d="M3 10h18l-2 11H5L3 10ZM8 10l4-7 4 7M9 14v4m6-4v4"/>',
  'Materiales e insumos':'<path d="m12 3 9 5-9 5-9-5Zm-9 5v11l9 5 9-5V8M12 13v11"/>',
  'Equipos y herramientas':'<rect x="3" y="5" width="18" height="13" rx="2"/><path d="M8 22h8m-4-4v4"/>',
  'Mantenimiento y reparación':'<path d="M14 6 18 2l4 4-4 4-4-4ZM6 18l8-8 4 4-8 8-4-4ZM2 2l7 7m-7 4 4-4"/>'
 };
 function typeChanged() {
  const kind=field('kind').value,other=kind==='Otros gastos';$('concept-wrap').hidden=!other;field('concept').required=other;if(!other)field('concept').value='';
  $('expense-icon').innerHTML=expenseIcons[kind]||'<path d="M3 12 12 3h8v8l-9 9Z"/><circle cx="16.5" cy="6.5" r="1"/>';
 }
 function priorityChanged(){$('priority-dot').dataset.priority=field('priority').value;}
 async function loadCatalog() {
  if(catalog){renderCatalog();return;}
  try{const data=await rpc('fridge_state');catalog=data.products.filter(product=>product.active);renderCatalog();}
  catch{ $('catalog-results').textContent='Catálogo no disponible. Puedes agregar artículos manualmente.';}
 }
 function renderCatalog(){
  if(!catalog)return;const query=normalize($('catalog-search').value),results=$('catalog-results');results.className='catalog-results';results.replaceChildren();
  if(!query)return;
  for(const product of catalog.filter(product=>normalize(product.name).includes(query)).slice(0,12))results.append(button(product.name+' · '+product.stock+' disponibles','catalog-choice',()=>{addItem(product);$('catalog-search').value='';results.replaceChildren();}));
 }
 function openForm(){
  form.reset();rateGeneration++;rateSource='manual';rateDate=null;$('budget-rate-refresh').disabled=false;$('budget-rate-status').textContent='Consultando referencia…';attempt=null;unlocked=0;$('budget-items').replaceChildren();$('catalog-results').replaceChildren();configureArea();typeChanged();priorityChanged();addItem();dialog.showModal();move(0);
 }
 const discard=$('budget-discard');
 function cancel(){if(busy||discard.open)return;discard.showModal();}
 $('discard-keep').onclick=()=>discard.close();
 $('discard-confirm').onclick=()=>{discard.close();dialog.close();};
 discard.addEventListener('cancel',event=>{event.preventDefault();discard.close();});
 $('budget-new').onclick=openForm;$('budget-close').onclick=cancel;dialog.addEventListener('cancel',event=>{event.preventDefault();cancel();});
 $('budget-back').onclick=()=>step?move(step-1):cancel();
 $('budget-next').onclick=()=>{if(validPanel(step))move(step+1);};
 form.querySelectorAll('[data-step]').forEach(button=>button.onclick=()=>{const next=Number(button.dataset.step);if(next<=step)move(next);else if(next===step+1&&validPanel(step))move(next);});
 $('budget-rate-refresh').onclick=()=>void fetchRate(true);field('exchange_rate').addEventListener('input',manualRate);
 $('budget-add').onclick=()=>addItem();$('budget-items').addEventListener('input',updateTotals);$('budget-items').addEventListener('change',updateTotals);
 field('kind').onchange=typeChanged;field('priority').onchange=priorityChanged;$('catalog-search').oninput=renderCatalog;
 form.addEventListener('input',()=>{unlocked=step;});
 form.noValidate=true;
 form.onsubmit=event=>{event.preventDefault();if(step!==2)return;run(async()=>{
  const values=payload(),fingerprint=JSON.stringify(values);
  if(attempt?.fingerprint!==fingerprint)attempt={fingerprint,id:crypto.randomUUID()};
  $('budget-send').disabled=true;
  try{await rpc('purchase_budget_submit_form',{p_id:attempt.id,p_form:values});attempt=null;dialog.close();await load();report('Solicitud enviada al '+recipient()+'.');}
  finally{$('budget-send').disabled=false;}
 });};
 $('budget-detail-close').onclick=()=>{if(!busy)detailDialog.close();};detailDialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 $('budget-search').oninput=()=>{limit=25;renderList();};$('budget-sort').onchange=()=>{limit=25;renderList();};$('budget-refresh').onclick=()=>run(load);$('budget-more').onclick=()=>{limit+=25;renderList();};
 run(async()=>{
  const result=await client.auth.getUser();user=result.data.user;if(!user){location.href='/';return;}
  caps=await rpc('purchase_budget_capabilities');
  if(!Object.values(caps).some(Boolean)){report('Tu rol no tiene acceso a las solicitudes de presupuesto.');return;}
  if(isChiefBudgetView())$('budget-count').after($('budget-refresh'));
  $('budget-new').hidden=!canSubmit();$('budget-list').hidden=false;await load();
  const requestedId=new URLSearchParams(location.search).get('request');
  const requested=requests.find(request=>request.id===requestedId);
  if(requested){
   const row=Array.from($('budget-requests').querySelectorAll('[data-request-id]')).find(card=>card.dataset.requestId===requested.id)||renderRequest(requested);
   row.querySelector('.request-visual-row').click();
  }
 });
})();
