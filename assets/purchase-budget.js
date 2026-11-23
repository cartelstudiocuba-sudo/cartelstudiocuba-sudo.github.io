(() => {
 'use strict';
 const client = CartelLoad.createClient('https://jhumvctocphyiwhszeaz.supabase.co', 'sb_publishable_ZHV-5dlsjfamQpfUOsgumg_G-vN84Gn', {auth:{persistSession:true,autoRefreshToken:true,storage:localStorage}});
 const $ = id => document.getElementById(id);
 const form = $('budget-form');
 const status = {chief_pending:'Pendiente del jefe de área', manager_pending:'Pendiente del Manager General', approved:'Aprobada', rejected:'No aprobada'};
 const report = text => { $('budget-message').textContent = text; };
 const formatAmount = (value, currency) => new Intl.NumberFormat('es-CU', {style:'currency', currency, currencyDisplay:'code'}).format(value);
 let caps, user, attempt, offset = 0, busy = false;
 const pageSize = 25;

 function element(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
 }

 async function run(action) {
  if (busy) return;
  busy = true;
  report('');
  try { await action(); }
  catch (error) { report(error.message || 'Ocurrió un error. Vuelve a intentarlo.'); }
  finally { busy = false; }
 }

 async function rpc(name, args) {
  const {data, error} = await client.rpc(name, args);
  if (error) throw error;
  return data;
 }

 function render(request) {
  const card = element('article', '', 'ecs-info');
  card.append(
   element('h3', request.product),
   element('p', [status[request.status], request.area, request.requester_name].join(' · ')),
   element('p', 'Cantidad ' + request.quantity + ' · Total estimado ' + formatAmount(request.amount, request.currency)),
   element('p', request.reason)
  );
  if (request.chief_note) card.append(element('p', 'Observación del jefe de área — ' + request.chief_note));
  if (request.manager_note) card.append(element('p', 'Observación del Manager General — ' + request.manager_note));
  const chief = request.status === 'chief_pending' && (request.area === 'Audiovisual' ? caps.audiovisual : caps.graphics);
  const manager = request.status === 'manager_pending' && caps.manager && request.chief_by !== user.id;
  if (request.requester !== user.id && (chief || manager)) {
   const decision = document.createElement('form');
   const label = element('label', 'Observación (obligatoria para rechazar)');
   const note = document.createElement('textarea');
   note.rows = 2;
   note.maxLength = 1500;
   label.append(note);
   const actions = element('div', '', 'ecs-actions');
   const approve = element('button', chief ? 'Aprobar y pasar al Manager General' : 'Aprobar presupuesto', 'ecs-primary');
   const reject = element('button', 'Rechazar', 'ecs-secondary');
   actions.append(reject, approve);
   decision.append(label, actions);
   decision.onsubmit = event => {
    event.preventDefault();
    const approved = event.submitter !== reject;
    if (!approved && !note.value.trim()) { report('Escribe el motivo del rechazo.'); note.focus(); return; }
    run(async () => {
     await rpc('purchase_budget_decide', {p_id:request.id,p_stage:request.status,p_approve:approved,p_note:note.value});
     report(chief && approved ? 'Solicitud enviada al Manager General.' : 'Decisión guardada.');
     await load();
    });
   };
   card.append(decision);
  }
  return card;
 }

 async function load(append = false) {
  const start = append ? offset : 0;
  const {data, error} = await client.from('purchase_budget_requests').select('*')
   .order('created_at', {ascending:false}).order('id').range(start, start + pageSize);
  if (error) throw error;
  const list = $('budget-requests');
  if (!append) list.replaceChildren();
  if (!append && !data.length) list.append(element('p', 'Todavía no hay solicitudes para mostrar.'));
  list.append(...data.slice(0, pageSize).map(render));
  offset = start + Math.min(pageSize, data.length);
  $('budget-more').hidden = data.length <= pageSize;
 }

 form.onsubmit = event => {
  event.preventDefault();
  run(async () => {
   const values = Object.fromEntries(new FormData(form));
   const fingerprint = JSON.stringify(values);
   if (attempt?.fingerprint !== fingerprint) attempt = {fingerprint,id:crypto.randomUUID()};
   await rpc('purchase_budget_submit', {
    p_id:attempt.id,p_area:values.area,p_product:values.product,p_quantity:values.quantity,
    p_amount:values.amount,p_currency:values.currency,p_reason:values.reason
   });
   attempt = null;
   form.reset();
   report('Solicitud enviada al jefe de área.');
   await load();
  });
 };
 $('budget-refresh').onclick = () => run(() => load());
 $('budget-more').onclick = () => run(() => load(true));
 run(async () => {
  const result = await client.auth.getUser();
  user = result.data.user;
  if (!user) { location.href = '/'; return; }
  caps = await rpc('purchase_budget_capabilities');
  if (!Object.values(caps).some(Boolean)) { report('Tu rol no tiene acceso a las solicitudes de presupuesto.'); return; }
  form.hidden = !caps.request;
  $('budget-list').hidden = false;
  await load();
 });
})();
