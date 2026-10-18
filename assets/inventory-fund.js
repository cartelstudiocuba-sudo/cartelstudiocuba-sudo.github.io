/* CUP-only operation. Historic currencies remain in storage, never converted. */
byId('move-currency').innerHTML='<option>CUP</option>';
byId('currency-filter').innerHTML='<option value="CUP">CUP</option>';
const fundBaseLoad=loadInventory;
let fundLedger=[], fundReimbursements=[], fundClosures=[], fundEvents=[], fundOwner=false, fundPreview=null;
const cup=n=>money(n,'CUP'), total=rows=>rows.reduce((s,r)=>s+Number(r.amount),0);
const todayCuba=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Havana',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const addDays=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
const input=(id,label,type='text',extra='')=>'<div class="field"><label for="'+id+'">'+label+'</label><input id="'+id+'" type="'+type+'" required '+extra+'></div>';
const economy=byId('economy');
// Keep original report controls in the DOM for existing listeners; present the working fund below.
Array.from(economy.children).forEach(n=>n.hidden=true);
const fund=document.createElement('section');fund.id='fund';
fund.innerHTML=`<div class="heading"><div><div class="kicker">FONDO DE INSUMOS · CUP</div><h2>Caja y recuperación</h2><p class="sub">Compras desde el fondo; consumos a proyectos o Gastos fijos.</p></div><button class="btn" id="fund-refresh">Actualizar</button></div>
<p id="fund-message" class="form-warning" role="status"></p><div id="fund-metrics" class="econ-grid"></div>
<p class="form-help">El saldo inicial es el dinero disponible después de las compras históricas. La compra del Mouse por 25 CUP permanece en compras y no se descuenta otra vez. Los movimientos nuevos de caja siguen el orden de fecha; las correcciones se registran con motivo.</p>
<form id="fund-form"><h3 id="fund-form-title">Registrar movimiento de caja</h3><div class="form-grid"><div class="field"><label for="fund-kind">Operación</label><select id="fund-kind"><option value="opening">Saldo inicial disponible</option><option value="reimbursement">Reintegro</option><option value="adjustment">Aporte / corrección del fondo · propietario</option><option value="reversal">Anular reintegro o ajuste · propietario</option></select></div>${input('fund-date','Fecha','date')}
<div class="field" id="fund-debt-field"><label for="fund-debt">Consumo a reintegrar</label><select id="fund-debt"></select></div><div class="field" id="fund-reverse-field"><label for="fund-reverse">Movimiento a anular</label><select id="fund-reverse"></select></div>
${input('fund-amount','Importe CUP','number','step="0.01"')}${input('fund-delivered','Entregado por')}${input('fund-received','Recibido por')}${input('fund-reference','Referencia / comprobante')}
<div class="field"><label for="fund-method">Medio de pago</label><select id="fund-method" required><option value="">Seleccionar</option><option>Efectivo</option><option>Transferencia</option><option>Otro</option></select></div>${input('fund-reason','Motivo / observaciones')}</div>
<p id="fund-baseline" class="form-help">Confirma el dinero real disponible al iniciar. No se propone ningún importe. Las compras históricas ya están contempladas en ese saldo.</p><button class="btn primary" id="fund-save">Guardar movimiento de caja</button></form>
<h3>Cuentas por reintegrar</h3><div id="fund-debts"></div><h3>Movimientos del fondo</h3><div class="table-wrap" style="overflow:auto"><table><thead><tr><th>Fecha</th><th>Operación</th><th>Importe CUP</th><th>Responsable</th><th>Referencia y medio</th><th>Motivo</th></tr></thead><tbody id="fund-ledger"></tbody></table></div>
<h3>Cierre semanal · CUP</h3><div class="form-grid">${input('fund-start','Desde','date')}${input('fund-end','Hasta · siete días','date')}${input('fund-close-reason','Motivo de la versión / corrección')}</div>
<div class="econ-actions"><button class="btn" id="fund-preview">Vista previa</button><button class="btn" id="fund-draft">Guardar borrador</button><button class="btn primary" id="fund-approve">Aprobar · propietario</button><button class="btn" id="fund-reopen">Reabrir · propietario</button><button class="btn" id="fund-pdf">Exportar PDF</button></div><div id="fund-report"></div><h3>Historial de cierres y correcciones</h3><div id="fund-closures"></div>`;
economy.append(fund);
const fundStyle=document.createElement('style');fundStyle.textContent='#economy>[hidden],#fund [hidden]{display:none!important}#fund input,#fund select{max-width:100%;min-width:0}#fund p{overflow-wrap:anywhere}#fund table{min-width:640px}#fund-report{margin-top:20px}#fund-form{padding:16px;border:1px solid #49515b;border-radius:16px;margin:18px 0}';document.head.append(fundStyle);
['weekly-report','reimbursements','replenishment'].forEach(id=>{byId(id).onclick=()=>fund.scrollIntoView({behavior:'smooth'});});
const reportLabel=e=>e.allocation_type==='project'?'Proyecto: '+e.project_reference:'Gastos fijos: '+e.receiving_area;
function debtPaid(id,at='9999-12-31'){
 const ids=new Set(fundReimbursements.filter(r=>r.economic_movement_id===id).map(r=>r.id));
 return total(fundLedger.filter(l=>l.occurred_on<=at&&(ids.has(l.reimbursement_id)||ids.has(fundLedger.find(o=>o.id===l.reverses_id)?.reimbursement_id))));
}
function syncFundForm(){
 const k=byId('fund-kind').value;
 byId('fund-debt-field').hidden=k!=='reimbursement';byId('fund-debt').required=k==='reimbursement';
 byId('fund-reverse-field').hidden=k!=='reversal';byId('fund-reverse').required=k==='reversal';
 byId('fund-amount').closest('.field').hidden=k==='reversal';byId('fund-amount').required=k!=='reversal';
 byId('fund-amount').min=k==='adjustment'?'':k==='opening'?'0':'0.01';
 ['fund-delivered','fund-received'].forEach(id=>{byId(id).closest('.field').hidden=k!=='reimbursement';byId(id).required=k==='reimbursement';});
 byId('fund-baseline').hidden=k!=='opening';
}
byId('fund-kind').onchange=syncFundForm;byId('fund-date').value=todayCuba();byId('fund-end').value=todayCuba();byId('fund-start').value=addDays(todayCuba(),-6);
byId('fund-start').onchange=()=>{byId('fund-end').value=addDays(byId('fund-start').value,6);fundPreview=null;};byId('fund-end').onchange=()=>{byId('fund-start').value=addDays(byId('fund-end').value,-6);fundPreview=null;};
async function loadFund(){
 const values=await Promise.all([allRows('inventory_fund_ledger','created_at'),allRows('inventory_cash_reimbursements','created_at'),allRows('inventory_weekly_closures','week_start'),allRows('inventory_closure_events','created_at'),sb.rpc('inventory_fund_can_approve')]);
 if(values[4].error)throw values[4].error;
 [fundLedger,fundReimbursements,fundClosures,fundEvents]=values;fundOwner=values[4].data;
 const opened=fundLedger.some(l=>l.kind==='opening'), consumed=inventoryEconomic.reduce((s,e)=>s+Number(e.quantity)*Number(e.unit_cost),0),paid=inventoryEconomic.reduce((s,e)=>s+debtPaid(e.id),0);
 byId('fund-metrics').innerHTML=[['Saldo disponible',opened?cup(total(fundLedger)):'Sin saldo inicial'],['Consumos / reintegrado',cup(consumed)+' / '+cup(paid)],['Pendiente por reintegrar',cup(consumed-paid)]].map(([label,value])=>'<div class="econ-metric"><small>'+label+'</small><strong>'+esc(value)+'</strong></div>').join('');
 const debts=inventoryEconomic.map(e=>({...e,pending:Number(e.quantity)*Number(e.unit_cost)-debtPaid(e.id)}));
 byId('fund-debts').innerHTML=debts.map(e=>'<article class="econ-out"><b>'+esc(reportLabel(e))+'</b><p>'+esc(e.product_name)+' · '+esc(e.occurred_on)+' · Consumo '+esc(cup(Number(e.quantity)*Number(e.unit_cost)))+' · Reintegrado '+esc(cup(debtPaid(e.id)))+' · Pendiente <b>'+esc(cup(e.pending))+'</b></p><small>'+esc(e.id)+'</small></article>').join('')||'<p>Sin cuentas por reintegrar.</p>';
 byId('fund-debt').innerHTML='<option value="">Seleccionar consumo</option>'+debts.filter(e=>e.pending>0).map(e=>'<option value="'+esc(e.id)+'">'+esc(reportLabel(e)+' · '+e.product_name+' · '+cup(e.pending))+'</option>').join('');
 const names={opening:'Saldo inicial',purchase:'Compra',reimbursement:'Reintegro',reversal:'Anulación',adjustment:'Aporte / corrección'};
 byId('fund-ledger').innerHTML=[...fundLedger].reverse().map(l=>'<tr><td>'+esc(l.occurred_on)+'</td><td>'+names[l.kind]+'</td><td>'+esc(cup(l.amount))+'</td><td>'+esc(l.actor_name)+'</td><td>'+esc(l.reference)+' · '+esc(l.payment_method)+'</td><td>'+esc(l.reason)+'</td></tr>').join('')||'<tr><td colspan="6">Caja sin iniciar.</td></tr>';
 byId('fund-reverse').innerHTML='<option value="">Seleccionar movimiento</option>'+fundLedger.filter(l=>['reimbursement','adjustment'].includes(l.kind)&&!fundLedger.some(r=>r.reverses_id===l.id)).map(l=>'<option value="'+esc(l.id)+'">'+esc(l.occurred_on+' · '+names[l.kind]+' · '+cup(l.amount)+' · '+l.reference)+'</option>').join('');
 [...byId('fund-kind').options].forEach(o=>{o.disabled=o.value==='opening'?opened:!opened||(['adjustment','reversal'].includes(o.value)&&!fundOwner);});
 if(byId('fund-kind').selectedOptions[0]?.disabled)byId('fund-kind').value=opened?'reimbursement':'opening';
 byId('fund-form').hidden=!inventoryCanWrite;byId('fund-draft').disabled=!inventoryCanWrite;byId('fund-approve').disabled=byId('fund-reopen').disabled=!fundOwner;
 byId('fund-closures').innerHTML=fundClosures.map(c=>'<article class="econ-out"><b>'+esc(c.week_start+' — '+c.week_end+' · '+(c.status==='approved'?'Aprobado':'Borrador'))+'</b>'+fundEvents.filter(e=>e.closure_id===c.id).map(e=>'<p>'+esc(new Date(e.created_at).toLocaleString('es-CU'))+' · '+esc(e.action)+' · '+esc(e.actor_name)+' · '+esc(e.reason)+' <button class="btn" data-fund-version="'+esc(e.id)+'">Ver versión</button></p>').join('')+'</article>').join('')||'<p>Sin cierres guardados.</p>';
 document.querySelectorAll('[data-fund-version]').forEach(b=>b.onclick=()=>{const e=fundEvents.find(e=>e.id===b.dataset.fundVersion);fundPreview={snapshot:e.snapshot,label:'Versión guardada · '+e.action+' · '+e.actor_name+' · '+e.created_at};renderFundReport();});syncFundForm();
}
loadInventory=async function(){await fundBaseLoad();inventoryProducts=inventoryProducts.filter(p=>p.currency==='CUP');inventoryEconomic=inventoryEconomic.filter(e=>e.currency==='CUP');productSelect.innerHTML='<option value="">Seleccionar producto CUP</option>'+inventoryProducts.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name+' · '+p.stock+' '+p.unit)+'</option>').join('');renderInventory();await loadFund();document.querySelector('.notice').textContent='Operaciones solo en CUP. Último costo de compra y salidas con costo histórico. '+(inventoryCanWrite?'Lectura y escritura.':'Solo lectura.');};
// A recovery key is scoped to the signed-in user. Every retry retains the exact UUID and payload.
async function fundSubmit(rpc,payload){
 const {data:{user},error}=await sb.auth.getUser();if(error||!user)throw Error('Inicia sesión de nuevo');
 const key='cartel.fund.pending.'+user.id;const saved=JSON.parse(sessionStorage.getItem(key)||'null');
 if(saved&&(saved.rpc!==rpc||JSON.stringify(saved.payload)!==JSON.stringify(payload)))throw Error('Hay una operación sin confirmar. Usa «Reintentar operación pendiente» antes de enviar otra.');
 const op=saved||{rpc,payload,id:crypto.randomUUID()};sessionStorage.setItem(key,JSON.stringify(op));
 const r=await sb.rpc(op.rpc,{request_id:op.id,payload:op.payload});
 if(r.error){if(r.error.code&&/^(P000|22|23|42)/.test(r.error.code))sessionStorage.removeItem(key);throw r.error;}
 sessionStorage.removeItem(key);return r.data;
}
async function fundAction(fn){const buttons=[...fund.querySelectorAll('button')],disabled=buttons.map(b=>b.disabled);buttons.forEach(b=>b.disabled=true);try{await fn();byId('fund-message').textContent='Operación confirmada.';}catch(e){byId('fund-message').textContent=e.message;}finally{buttons.forEach((b,i)=>b.disabled=disabled[i]);}}
byId('fund-form').onsubmit=e=>{e.preventDefault();if(!e.target.reportValidity())return;fundAction(async()=>{const payload={kind:byId('fund-kind').value,currency:'CUP',occurred_on:byId('fund-date').value,amount:byId('fund-amount').value,economic_movement_id:byId('fund-debt').value||null,reverses_id:byId('fund-reverse').value||null,delivered_by:byId('fund-delivered').value,received_by:byId('fund-received').value,reference:byId('fund-reference').value,payment_method:byId('fund-method').value,reason:byId('fund-reason').value,baseline:'available_after_historical_purchases'};await fundSubmit('inventory_fund_record',payload);e.target.reset();byId('fund-date').value=todayCuba();fundPreview=null;await loadInventory();});};
async function previewFund(){const r=await sb.rpc('inventory_fund_report',{start_date:byId('fund-start').value,end_date:byId('fund-end').value});if(r.error)throw r.error;fundPreview={snapshot:r.data,label:'Vista previa actual · sin aprobar'};renderFundReport();}
function reportHTML(s,label){
 const purchases=s.purchases.reduce((n,m)=>n+Number(m.quantity)*Number(m.unit_cost),0),consumed=s.consumption.reduce((n,m)=>n+Number(m.quantity)*Number(m.unit_cost),0),pending=s.receivables.reduce((n,m)=>n+Number(m.pending),0),payments=total(s.ledger.filter(l=>['reimbursement','reversal'].includes(l.kind)));
 const groups=new Map();s.consumption.forEach(e=>{const key=reportLabel(e);groups.set(key,(groups.get(key)||0)+Number(e.quantity)*Number(e.unit_cost));});
 return '<h2>El Cartel Studio · Insumos · CUP</h2><p>'+esc(s.start+' — '+s.end)+'<br>'+esc(label)+'</p><p>Saldo al inicio del período: '+esc(cup(s.balance_before))+'<br>Saldo al final: '+esc(cup(s.balance_end))+'<br>Compras: '+esc(cup(purchases))+' · Consumos: '+esc(cup(consumed))+'<br>Reintegros netos / anulaciones: '+esc(cup(payments))+'<br>Pendiente acumulado al cierre: '+esc(cup(pending))+'</p><h3>Desglose de consumos</h3>'+[...groups].map(([g,n])=>'<p>'+esc(g)+' · '+esc(cup(n))+'</p>').join('')+'<h3>Compras del período</h3>'+s.purchases.map(m=>'<p>'+esc(m.occurred_on+' · '+(m.product_name||inventoryProducts.find(p=>p.id===m.product_id)?.name||m.product_id)+' · '+cup(Number(m.quantity)*Number(m.unit_cost)))+' · '+(s.ledger.some(l=>l.movement_id===m.id)?'Pagada desde el fondo':'Histórica · incluida antes del saldo inicial')+'</p>').join('')+'<h3>Caja del período</h3>'+s.ledger.map(l=>'<p>'+esc(l.occurred_on+' · '+l.kind+' · '+cup(l.amount)+' · '+l.actor_name+' · '+l.reference+' · '+l.payment_method+' · '+l.reason+(l.kind==='reimbursement'?' · Entrega: '+l.request_payload.delivered_by+' · Recibe: '+l.request_payload.received_by:''))+'</p>').join('')+'<h3>Pendientes al cierre</h3>'+s.receivables.map(e=>'<p>'+esc(reportLabel(e)+' · '+e.product_name+' · '+cup(e.pending))+'</p>').join('');
}
function renderFundReport(){byId('fund-report').innerHTML=reportHTML(fundPreview.snapshot,fundPreview.label);}
byId('fund-preview').onclick=()=>fundAction(previewFund);
for(const [id,action] of [['fund-draft','draft'],['fund-approve','approve'],['fund-reopen','reopen']])byId(id).onclick=()=>fundAction(async()=>{if(!byId('fund-close-reason').reportValidity())return;if(!fundPreview||fundPreview.snapshot.start!==byId('fund-start').value||fundPreview.snapshot.end!==byId('fund-end').value)throw Error('Actualiza la vista previa antes de continuar');await fundSubmit('inventory_close_week',{start:byId('fund-start').value,end:byId('fund-end').value,currency:'CUP',action,reason:byId('fund-close-reason').value,snapshot:fundPreview.snapshot});await loadFund();await previewFund();});
byId('fund-pdf').onclick=()=>{if(!fundPreview){byId('fund-message').textContent='Genera o abre una vista previa para exportar.';return;}const w=window.open('','_blank');if(!w){byId('fund-message').textContent='Permite la ventana de impresión para guardar el PDF.';return;}w.document.write('<!doctype html><html lang="es"><head><title>Cierre de Insumos CUP</title><style>body{font:12px Arial;margin:24px;color:#111}h2{font-size:20px}h3{border-bottom:1px solid #bbb;padding-top:12px}p{overflow-wrap:anywhere;break-inside:avoid}@page{size:A4;margin:15mm}</style></head><body>'+reportHTML(fundPreview.snapshot,fundPreview.label)+'<p>Exportado: '+esc(new Date().toLocaleString('es-CU',{timeZone:'America/Havana'}))+'</p></body></html>');w.document.close();w.focus();w.print();};
byId('fund-refresh').onclick=()=>fundAction(async()=>{await loadInventory();fundPreview=null;byId('fund-report').replaceChildren();});
const retry=document.createElement('button');retry.className='btn';retry.textContent='Reintentar operación pendiente';retry.onclick=()=>fundAction(async()=>{const {data:{user}}=await sb.auth.getUser();const op=JSON.parse(sessionStorage.getItem('cartel.fund.pending.'+user.id)||'null');if(!op)throw Error('No hay operaciones pendientes de confirmar');await fundSubmit(op.rpc,op.payload);await loadInventory();});byId('fund-message').after(retry);
syncFundForm();
// The catalogue's initial load may finish before this deferred file arrives.
(async()=>{try{const {data:{session}}=await sb.auth.getSession();if(session)await loadInventory();}catch(e){byId('fund-message').textContent='No se pudo cargar la caja: '+e.message;}})();
