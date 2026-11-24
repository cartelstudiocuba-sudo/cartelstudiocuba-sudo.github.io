(() => {
 'use strict';
 const client = CartelLoad.createClient('https://jhumvctocphyiwhszeaz.supabase.co', 'sb_publishable_ZHV-5dlsjfamQpfUOsgumg_G-vN84Gn', {auth:{persistSession:true,autoRefreshToken:true,storage:localStorage}});
 const $ = id => document.getElementById(id);
 const form = $('budget-form'), dialog = $('budget-dialog');
 const statuses = {
  chief_pending:{label:'En revisión',color:'#ffd65b',icon:'⌛',detail:'Pendiente del jefe de área'},
  manager_pending:{label:'En trámite',color:'#70b8ff',icon:'↻',detail:'Pendiente del Manager General'},
  approved:{label:'Aprobadas',color:'#52df85',icon:'✓',detail:'Aprobada'},
  rejected:{label:'No aprobadas',color:'#ff7474',icon:'×',detail:'No aprobada'}
 };
 let caps, user, requests=[], filter='all', limit=25, step=0, unlocked=0, busy=false, attempt=null, catalog=null;
 const direct = () => caps.administrator || caps.audiovisual || caps.graphics;
 const canSubmit = () => caps.request || direct();
 const recipient = () => direct() ? 'Manager General' : 'Jefe de área';
 const format = (value,currency) => new Intl.NumberFormat('es-CU',{style:'currency',currency,currencyDisplay:'code'}).format(value);
 const report = text => { $(dialog.open?'budget-form-message':'budget-message').textContent = text; };
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
 function updateStats() {
  const stats=$('budget-stats'),filters=$('budget-filters');stats.replaceChildren();filters.replaceChildren();
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
  const query=normalize($('budget-search').value);
  const visible=requests.filter(r=>(filter==='all'||r.status===filter)&&normalize([r.product,r.area,r.requester_name,r.reason,moneyText(requestTotals(r)),...(r.items||[]).map(item=>item.name)].join(' ')).includes(query));
  $('budget-count').textContent=visible.length+' solicitudes';
  $('budget-requests').replaceChildren(...visible.slice(0,limit).map(renderRequest));
  if(!visible.length)$('budget-requests').append(node('p','No hay solicitudes para mostrar.','empty'));
  $('budget-more').hidden=visible.length<=limit;
 }
 function labeled(parent,label,value) {
  if(!value)return;
  const line=node('p');line.append(node('strong',label+' · '),document.createTextNode(value));parent.append(line);
 }
 function itemSummary(parent,items) {
  const lines=node('div','','summary-lines');
  for(const item of items){
   const row=node('div','','summary-line');row.append(node('strong',format(item.subtotal,item.currency)));
   row.append(document.createTextNode(item.name+' · '+item.quantity+' '+(item.unit||'')));lines.append(row);
  }
  parent.append(lines);
 }
 function renderRequest(request) {
  const card=node('details','','request'),header=node('summary'),state=statuses[request.status];
  const title=node('span',request.product,'request-title');title.append(node('small',request.area+' · '+request.requester_name,'request-meta'));
  const date=node('span',new Date(request.created_at).toLocaleDateString('es-CU'),'date request-meta');
  const badge=node('span',state.detail,'badge');badge.style.setProperty('--state',state.color);
  header.append(title,date,node('span',moneyText(requestTotals(request)),'amount'),badge);card.append(header);
  const body=node('div','','request-body');labeled(body,'Prioridad',request.priority);labeled(body,'Justificación',request.reason);
  if(request.items) itemSummary(body,request.items);
  else labeled(body,'Cantidad',String(request.quantity));
  const details=request.details||{};
  labeled(body,'Proveedor',details.supplier);labeled(body,'Fecha requerida',details.needed_on);labeled(body,'Observaciones',details.observations);labeled(body,'Referencia',details.reference);
  labeled(body,'Observación jefe de área',request.chief_note);labeled(body,'Observación Manager General',request.manager_note);
  const chief=request.status==='chief_pending'&&(request.area==='Audiovisual'?caps.audiovisual:caps.graphics);
  const manager=request.status==='manager_pending'&&caps.manager&&request.chief_by!==user.id;
  if(request.requester!==user.id&&(chief||manager)){
   const decision=node('form','','decision'),note=node('textarea');note.rows=2;note.maxLength=1500;note.placeholder='Observación (obligatoria para rechazar)';note.setAttribute('aria-label','Observación de la decisión');
   const actions=node('div','','decision-actions');
   const approve=node('button',chief?'Aprobar y pasar al Manager General':'Aprobar presupuesto','success'),reject=node('button','Rechazar','secondary');
   actions.append(reject,approve);decision.append(note,actions);
   decision.onsubmit=event=>{event.preventDefault();const approved=event.submitter!==reject;if(!approved&&!note.value.trim()){note.focus();report('Escribe el motivo del rechazo.');return;}run(async()=>{await rpc('purchase_budget_decide',{p_id:request.id,p_stage:request.status,p_approve:approved,p_note:note.value});await load();report('Decisión guardada.');});};
   body.append(decision);
  }
  card.append(body);return card;
 }
 async function load() {
  const rows=[];const size=250;
  for(let offset=0;;offset+=size){
   const {data,error}=await client.from('purchase_budget_requests').select('*').order('created_at',{ascending:false}).order('id').range(offset,offset+size-1);
   if(error)throw error;rows.push(...data);if(data.length<size)break;
  }
  requests=rows;updateStats();renderList();
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
  const item=node('div','','item'),header=node('div','','item-head');header.append(node('strong','Artículo o servicio'),button('Quitar','',()=>{item.remove();updateTotals();}));
  const name=itemInput('Nombre','item_name','text',product?.name||'',{required:'',maxlength:'160'});
  const fields=node('div','','item-fields');
  const currencyLabel=node('label','Moneda'),currency=node('select');currency.name='item_currency';for(const code of ['USD','CUP'])currency.append(node('option',code));currencyLabel.append(currency);
  fields.append(itemInput('Unidad','item_unit','text','unidad',{required:'',maxlength:'40'}),itemInput('Cantidad','item_quantity','number','1',{required:'',min:'0.001',max:'999999',step:'0.001'}),itemInput('Precio unitario','item_price','number',product?.cost??'',{required:'',min:'0.01',step:'0.01',max:'99999999999'}),currencyLabel);
  item.append(header,name,fields,node('p','','item-subtotal'));container.append(item);updateTotals();
 }
 function collectItems() {
  return [...$('budget-items').children].map(row=>{
   const get=name=>row.querySelector('[name='+name+']').value;
   const quantity=Number(get('item_quantity')),unit_price=Number(get('item_price'));
   return {name:get('item_name').trim(),unit:get('item_unit').trim(),quantity,unit_price,currency:get('item_currency'),subtotal:Math.round(quantity*unit_price*100)/100};
  });
 }
 function calculate(items) {
  const totals={CUP:0,USD:0};for(const item of items)totals[item.currency]+=Number.isFinite(item.subtotal)?item.subtotal:0;return totals;
 }
 function totalsView(target,totals) {
  target.replaceChildren(...['CUP','USD'].map(currency=>node('strong',format(totals[currency],currency))));
 }
 function updateTotals() {
  const items=collectItems();[...$('budget-items').children].forEach((row,index)=>{row.querySelector('.item-subtotal').textContent='Subtotal · '+format(items[index].subtotal||0,items[index].currency);});
  totalsView($('budget-totals'),calculate(items));
 }
 function payload() {
  return {area:field('area').value,kind:field('kind').value,priority:field('priority').value,reason:field('reason').value.trim(),items:collectItems(),
   details:{concept:field('concept').value.trim(),supplier:field('supplier').value.trim(),needed_on:field('needed_on').value,observations:field('observations').value.trim(),reference:field('reference').value.trim()}};
 }
 function displaySummary() {
  const values=payload(),summary=$('budget-summary');summary.replaceChildren();
  labeled(summary,'Destino',recipient());labeled(summary,'Área',values.area);labeled(summary,'Tipo',values.kind);labeled(summary,'Concepto',values.details.concept);labeled(summary,'Prioridad',values.priority);labeled(summary,'Justificación',values.reason);
  itemSummary(summary,values.items);const totals=node('div','','totals');totalsView(totals,calculate(values.items));summary.append(totals);
  labeled(summary,'Proveedor',values.details.supplier);labeled(summary,'Fecha requerida',values.details.needed_on);labeled(summary,'Observaciones',values.details.observations);labeled(summary,'Referencia',values.details.reference);
 }
 function validPanel(index) {
  const panel=form.querySelector('[data-panel="'+index+'"]');
  if(index===1&&!$('budget-items').children.length){report('Agrega al menos un artículo o servicio.');return false;}
  for(const input of panel.querySelectorAll('input,select,textarea'))if(!input.closest('[hidden]')&&(!input.checkValidity()||(input.required&&!input.value.trim()))){input.reportValidity();return false;}
  if(index===0&&field('kind').value==='Abastecimiento de Nevera Audiovisual'&&field('area').value!=='Audiovisual'){report('Selecciona el área Audiovisual para el abastecimiento de nevera.');return false;}
  if(index===1&&collectItems().some(item=>item.subtotal<=0)){report('El subtotal debe ser mayor que cero.');return false;}
  return true;
 }
 function move(next) {
  step=next;unlocked=Math.max(unlocked,next);report('');
  form.querySelectorAll('[data-panel]').forEach(panel=>panel.hidden=Number(panel.dataset.panel)!==step);
  form.querySelectorAll('[data-step]').forEach(button=>{const index=Number(button.dataset.step);button.disabled=index>unlocked;button.classList.toggle('completed',index<step);if(index===step)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});
  $('budget-back').textContent=step?'← Regresar':'Cancelar';$('budget-next').hidden=step===3;$('budget-send').hidden=step!==3;
  $('budget-send').textContent='Enviar al '+recipient();if(step===3)displaySummary();
  if(step===1){$('budget-catalog').hidden=field('kind').value!=='Abastecimiento de Nevera Audiovisual';if(!$('budget-catalog').hidden)void loadCatalog();}
 }
 function configureArea() {
  [...field('area').options].forEach(option=>{option.hidden=option.value==='Generales'&&!caps.administrator||direct()&&!caps.administrator&&option.value!==''&&!((option.value==='Audiovisual'&&caps.audiovisual)||(option.value==='Gráfica'&&caps.graphics));option.disabled=option.hidden;});
  if(!caps.administrator&&direct()&&!(caps.audiovisual&&caps.graphics))field('area').value=caps.audiovisual?'Audiovisual':'Gráfica';
 }
 function typeChanged() {
  const other=field('kind').value==='Otros gastos';$('concept-wrap').hidden=!other;field('concept').required=other;if(!other)field('concept').value='';
  if(field('kind').value==='Abastecimiento de Nevera Audiovisual'&&!field('area').options[1].disabled)field('area').value='Audiovisual';
 }
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
  form.reset();attempt=null;unlocked=0;$('budget-items').replaceChildren();$('catalog-results').replaceChildren();configureArea();typeChanged();addItem();dialog.showModal();move(0);
 }
 function cancel(){if(busy)return;if(confirm('¿Cerrar y descartar esta solicitud?'))dialog.close();}
 $('budget-new').onclick=openForm;$('budget-close').onclick=cancel;dialog.addEventListener('cancel',event=>{event.preventDefault();cancel();});
 $('budget-back').onclick=()=>step?move(step-1):cancel();
 $('budget-next').onclick=()=>{if(validPanel(step))move(step+1);};
 form.querySelectorAll('[data-step]').forEach(button=>button.onclick=()=>{const next=Number(button.dataset.step);if(next<=step)move(next);else if(next===step+1&&validPanel(step))move(next);});
 $('budget-add').onclick=()=>addItem();$('budget-items').addEventListener('input',updateTotals);$('budget-items').addEventListener('change',updateTotals);
 field('kind').onchange=typeChanged;$('catalog-search').oninput=renderCatalog;
 form.addEventListener('input',()=>{unlocked=step;});
 form.noValidate=true;
 form.onsubmit=event=>{event.preventDefault();if(step!==3)return;run(async()=>{
  const values=payload(),fingerprint=JSON.stringify(values);
  if(attempt?.fingerprint!==fingerprint)attempt={fingerprint,id:crypto.randomUUID()};
  $('budget-send').disabled=true;
  try{await rpc('purchase_budget_submit_form',{p_id:attempt.id,p_form:values});attempt=null;dialog.close();await load();report('Solicitud enviada al '+recipient()+'.');}
  finally{$('budget-send').disabled=false;}
 });};
 $('budget-search').oninput=()=>{limit=25;renderList();};$('budget-refresh').onclick=()=>run(load);$('budget-more').onclick=()=>{limit+=25;renderList();};
 run(async()=>{
  const result=await client.auth.getUser();user=result.data.user;if(!user){location.href='/';return;}
  caps=await rpc('purchase_budget_capabilities');
  if(!Object.values(caps).some(Boolean)){report('Tu rol no tiene acceso a las solicitudes de presupuesto.');return;}
  $('budget-new').hidden=!canSubmit();$('budget-list').hidden=false;await load();
 });
})();
