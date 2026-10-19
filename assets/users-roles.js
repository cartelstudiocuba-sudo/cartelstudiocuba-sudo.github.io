const sb=CartelLoad.createClient('https://jhumvctocphyiwhszeaz.supabase.co','sb_publishable_ZHV-5dlsjfamQpfUOsgumg_G-vN84Gn');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const el=id=>document.getElementById(id);
let roles=[],accounts=[],permissions=[];
async function loadAccounts(){
 const {data,error}=await sb.rpc('system_list_users');if(error)throw error;accounts=data||[];
 el('account-count').textContent=accounts.filter(u=>u.id).length+' cuentas · '+accounts.filter(u=>u.employee_id&&!u.id).length+' pendientes';
 el('account-list').innerHTML=accounts.map((u,i)=>'<article class="card"><h3>'+esc(u.full_name)+'</h3><p>'+esc(u.username||u.email)+'</p>'+(u.employee_id?'<p>'+esc(u.position||'Sin plaza')+(u.position_linked?'':' · vínculo de plaza pendiente')+'</p>':'')+'<p>'+esc(u.is_owner?'Propietario · acceso protegido':!u.id?'Cuenta Auth pendiente':u.blocked?'Cuenta bloqueada':u.confirmed?(u.enabled?'Cuenta habilitada':'Acceso deshabilitado'):'Confirmación de correo pendiente')+'</p>'+((u.roles||[]).map(r=>'<p><span class="badge">'+esc(r.title)+'</span> '+(!u.is_owner?'<button class="btn" data-revoke="'+i+'" data-code="'+esc(r.code)+'">Retirar rol</button>':'')+'</p>').join('')||'<p class="muted">'+(u.is_owner?'Acceso del propietario':'Sin roles asignados')+'</p>')+(!u.is_owner?'<label for="grant-'+i+'">Añadir rol</label><select id="grant-'+i+'" style="width:100%;padding:12px;margin:10px 0;background:#222;color:#fff;border:1px solid #555;border-radius:10px"><option value="">Seleccionar rol</option>'+roles.filter(r=>r.is_active&&!(u.roles||[]).some(g=>g.code===r.code)).map(r=>'<option value="'+esc(r.code)+'">'+esc(r.title)+'</option>').join('')+'</select><button class="btn" data-grant="'+i+'">Asignar rol</button>'+(!u.id&&u.position_linked?'<form data-invite="'+i+'"><label for="email-'+i+'" style="display:block;margin-top:18px">Correo individual para invitar</label><input id="email-'+i+'" type="email" required autocomplete="off" value="'+esc(u.email||'')+'" style="width:100%;padding:12px;background:#222;color:#fff;border:1px solid #555;border-radius:10px"><button class="btn" type="submit">Verificar Auth e invitar</button></form>':!u.id?'<p class="notice">Vínculo de plaza pendiente. Completa la ficha laboral en <a class="link" href="/plazas.html">Plazas</a> antes de invitar.</p>':''):'')+'</article>').join('');
 el('account-list').querySelectorAll('[data-grant]').forEach(b=>b.onclick=()=>changeRole(Number(b.dataset.grant),el('grant-'+b.dataset.grant).value,true,b));
 el('account-list').querySelectorAll('[data-revoke]').forEach(b=>b.onclick=()=>changeRole(Number(b.dataset.revoke),b.dataset.code,false,b));
 el('account-list').querySelectorAll('[data-invite]').forEach(f=>f.onsubmit=async event=>{
  event.preventDefault();const i=Number(f.dataset.invite),button=f.querySelector('button');button.disabled=true;el('account-message').textContent='Verificando Auth y preparando invitación…';
  try{const {data,error}=await sb.functions.invoke('system-account',{body:{action:'invite',employee_id:accounts[i].employee_id,email:el('email-'+i).value.trim()}});if(error||data?.error)throw Error(data?.error||'No se pudo completar la invitación. Revisa el correo y Auth.');await loadAccounts();el('account-message').textContent=data.message;}
  catch(e){el('account-message').textContent=e.message;button.disabled=false;}
 });
 const list=el('account-list');
 const cards=[...list.querySelectorAll(':scope > .card')];
 cards.forEach((card,i)=>{
  card.style.display='none';
  const u=accounts[i];
  const button=document.createElement('button');
  button.type='button';button.className='account-item';
  const name=u.full_name||u.username||u.email||'Usuario';
  const initials=name.trim().split(/\\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
  button.innerHTML='<span class="account-avatar">'+esc(initials)+'</span><span class="account-copy"><strong>'+esc(name)+'</strong><small>'+esc(u.position||(u.roles||[]).map(r=>r.title).join(', ')||'Sin plaza')+'</small><small>'+esc(u.username||u.email||'')+'</small></span><span class="account-arrow">›</span>';
  list.appendChild(button);
  button.onclick=()=>{
   const root=el('access-modal-root');root.innerHTML='<div class="access-overlay"><section class="access-dialog access-profile-dialog" role="dialog" aria-modal="true" aria-label="Ficha del usuario"><div class="access-dialog-head access-profile-hero"><div class="access-profile-heading"><span class="access-profile-avatar">'+esc(initials)+'</span><div><div class="eyebrow">FICHA DEL USUARIO</div><h2>'+esc(name)+'</h2><p>'+esc(u.username||u.email||'')+'</p></div></div><button class="btn" type="button" id="close-account">✕ Cerrar</button></div><div class="access-profile-tabs" role="tablist"><button class="btn active" type="button" data-profile-tab="record">Expediente</button><button class="btn" type="button" data-profile-tab="position">Plaza</button><button class="btn" type="button" data-profile-tab="access">Acceso</button><button class="btn" type="button" data-profile-tab="roles">Roles y permisos</button><button class="btn" type="button" data-profile-tab="views">Vistas</button><button class="btn" type="button" data-profile-tab="activity">Actividad</button></div><div class="access-profile-summary" id="access-profile-summary"></div><div id="account-detail"></div></section></div>';
   root.querySelector('#account-detail').appendChild(card);card.style.display='block';document.body.style.overflow='hidden';
   const summary=root.querySelector('#access-profile-summary');
   const tabButtons=[...root.querySelectorAll('[data-profile-tab]')];
   const roleActions=card.querySelectorAll('[data-grant],[data-revoke],[data-invite]');
   const renderTab=tab=>{
    tabButtons.forEach(b=>b.classList.toggle('active',b.dataset.profileTab===tab));
    card.style.display=tab==='roles'?'block':'none';
    summary.style.display=tab==='roles'?'none':'block';
    if(tab==='record')summary.innerHTML='<div class="access-info-card"><h3>Expediente de Recursos Humanos</h3><p><strong>'+esc(name)+'</strong></p><p>'+esc(u.position||'Plaza laboral sin vincular')+'</p><p class="muted">El expediente laboral se administra en Recursos Humanos; esta ficha no duplica sus datos.</p>'+(u.employee_id?'<a class="btn access-profile-link" href="/contratados.html">Abrir Recursos Humanos ↗</a>':'<p class="notice">No hay expediente laboral vinculado a esta cuenta.</p>')+'</div>';
    if(tab==='position')summary.innerHTML='<div class="access-info-card"><h3>Plaza laboral</h3><p>Plaza registrada: <strong>'+esc(u.position||'Sin asignar')+'</strong></p><p>Estado del vínculo: '+(u.position_linked?'Vinculado':'Pendiente de vinculación')+'</p><p class="muted">La plaza se modifica desde el expediente de Recursos Humanos. No se alterará aquí sin una operación segura que registre el historial laboral.</p><a class="btn access-profile-link" href="/contratados.html">Gestionar expediente ↗</a></div>';
    if(tab==='access')summary.innerHTML='<div class="access-info-card"><h3>Cuenta y seguridad</h3><p>Usuario: <strong>'+esc(u.username||'Sin nombre de usuario')+'</strong></p><p>Correo: '+esc(u.email||'No registrado')+'</p><p>Estado: '+esc(u.is_owner?'Propietario protegido':!u.id?'Cuenta Auth pendiente':u.blocked?'Cuenta bloqueada':u.confirmed?(u.enabled?'Habilitada':'Deshabilitada'):'Confirmación pendiente')+'</p><p class="muted">Las contraseñas no se muestran ni se almacenan en esta ficha. Las invitaciones disponibles están en Roles y permisos.</p></div>';
    if(tab==='views')summary.innerHTML='<div class="access-info-card"><h3>Vistas del usuario</h3><p>Las vistas se preparan por rol en el Editor de vistas.</p><p class="muted">Los borradores aún no están publicados ni vinculados a cuentas. No se ha asignado ninguna vista nueva desde esta ficha.</p><button class="btn" type="button" id="open-profile-views">Abrir Editor de vistas ↗</button></div>';
    if(tab==='activity')summary.innerHTML='<div class="access-info-card"><h3>Actividad y auditoría</h3><p class="muted">El historial de cambios de esta cuenta estará disponible cuando se conecte el registro de auditoría. No se muestran movimientos ficticios.</p></div>';
    const viewBtn=summary.querySelector('#open-profile-views');if(viewBtn)viewBtn.onclick=()=>{close();document.querySelector('[data-tab="views"]')?.click()};
   };
   tabButtons.forEach(b=>b.onclick=()=>renderTab(b.dataset.profileTab));renderTab('record');
   const close=()=>{card.style.display='none';list.insertBefore(card,list.firstChild);root.innerHTML='';document.body.style.overflow=''};
   root.querySelector('#close-account').onclick=close;
   root.querySelector('.access-overlay').onclick=e=>{if(e.target.classList.contains('access-overlay'))close()};
  };
 });
 const search=el('account-search');
 if(search)search.oninput=()=>{const q=search.value.toLowerCase();list.querySelectorAll('.account-item').forEach(b=>b.style.display=b.textContent.toLowerCase().includes(q)?'flex':'none')};

}
async function changeRole(index,code,enabled,button){
 if(!code){el('account-message').textContent='Selecciona un rol.';return;}
 button.disabled=true;el('account-message').textContent='Guardando rol…';
 try{const {error}=await sb.rpc('system_set_employee_role',{employee:accounts[index].employee_id,requested_role:code,enabled});if(error)throw error;await loadAccounts();el('account-message').textContent='Rol actualizado. Los permisos se comprueban en el servidor en cada operación.';}
 catch(e){el('account-message').textContent='No se pudo guardar: '+e.message;button.disabled=false;}
}
function renderRoles(){
 el('role-count').textContent=roles.length+' registrados';
 el('role-list').innerHTML=roles.map((r,i)=>'<button class="role-item" type="button" data-role="'+i+'"><span class="role-avatar" aria-hidden="true">♙</span><span class="role-copy"><strong>'+esc(r.title)+'</strong><small>'+esc(r.description||'Sin descripción')+'</small></span><span class="role-arrow" aria-hidden="true">›</span></button>').join('');
 el('role-list').querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>openRoleModal(Number(b.dataset.role)));
}
function closeRoleModal(){
 const layer=document.getElementById('role-modal-layer');if(!layer)return;
 const detail=el('role-detail');detail.classList.add('hidden');el('roles').appendChild(detail);layer.remove();document.body.style.overflow='';
}
function openRoleModal(i){
 closeRoleModal();
 const layer=document.createElement('div');layer.className='role-modal-layer';layer.id='role-modal-layer';
 layer.innerHTML='<div class="role-modal-box" role="dialog" aria-modal="true" aria-label="Configuración de permisos del rol"><div id="role-modal-content"></div></div>';
 document.body.appendChild(layer);document.body.style.overflow='hidden';
 layer.onclick=e=>{if(e.target===layer)closeRoleModal()};
 layer.querySelector('#role-modal-content').appendChild(el('role-detail'));
 showRole(i);
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('role-modal-layer'))closeRoleModal()});

function showRole(i){
 const r=roles[i],p=permissions.find(p=>p.access_role_id===r.id&&p.module_code==='inventario_insumos')||{};const d=el('role-detail');d.classList.remove('hidden');
 d.innerHTML='<div class="row"><h2>'+esc(r.title)+'</h2><button class="btn" id="close-role">Cerrar</button></div><p>'+esc(r.description)+'</p><form id="permission-form"><table class="matrix"><thead><tr><th>Módulo</th><th>Leer</th><th>Escribir</th></tr></thead><tbody><tr><td>Inventario Insumos</td><td><input type="checkbox" id="allow-read" aria-label="Leer Inventario Insumos" '+(p.can_read?'checked':'')+'></td><td><input type="checkbox" id="allow-write" aria-label="Escribir Inventario Insumos" '+(p.can_write?'checked':'')+'></td></tr><tr><td>Usuarios y Roles</td><td colspan="2">Solo propietario</td></tr><tr><td>Recursos Humanos</td><td colspan="2">Solo propietario</td></tr></tbody></table><p>Escribir permite registrar productos y movimientos; el historial no se modifica. Los roles de una persona acumulan sus permisos. El acceso a RRHH y la gestión de usuarios no se delegan desde esta matriz.</p><button class="btn" type="submit">Guardar permisos</button><p id="permission-message" role="status"></p></form>';
 el('allow-write').onchange=()=>{if(el('allow-write').checked)el('allow-read').checked=true;};el('allow-read').onchange=()=>{if(!el('allow-read').checked)el('allow-write').checked=false;};
 el('permission-form').onsubmit=async event=>{event.preventDefault();const b=event.currentTarget.querySelector('button');b.disabled=true;try{const {error}=await sb.rpc('system_set_role_permission',{role_id:r.id,module:'inventario_insumos',allow_read:el('allow-read').checked,allow_write:el('allow-write').checked});if(error)throw error;await loadPermissions();el('permission-message').textContent='Permisos guardados y vigentes en el servidor.';}catch(e){el('permission-message').textContent='No se pudo guardar: '+e.message;}finally{b.disabled=false;}};
 el('close-role').onclick=closeRoleModal;
}
async function loadPermissions(){const r=await sb.from('system_role_module_permissions').select('*');if(r.error)throw r.error;permissions=r.data||[];}
const viewDefaults={title:'Inventario de insumos',description:'Consulta de existencias y solicitudes',layout:'list',blocks:{search:true,filters:true,stock:true,request:false}};
function viewKey(){return 'cartel-views-draft-v1-'+el('view-role').value}
function viewConfig(){return {title:el('view-title').value,description:el('view-description').value,layout:el('view-layout').value,blocks:Object.fromEntries([...document.querySelectorAll('[data-view-block]')].map(x=>[x.dataset.viewBlock,x.checked]))}}
function readViewDraft(){try{return JSON.parse(localStorage.getItem(viewKey()))}catch{return null}}
function loadViewEditor(){
 const role=roles.find(x=>x.id===el('view-role').value);
 const saved=readViewDraft(),data=saved||{...viewDefaults,title:role?.title==='Gestor Comercial de Gráfica'?'Inventario de Gráfica':viewDefaults.title,blocks:{...viewDefaults.blocks,request:role?.title==='Gestor Comercial de Gráfica'}};
 el('view-title').value=data.title||'';el('view-description').value=data.description||'';el('view-layout').value=data.layout||'list';
 document.querySelectorAll('[data-view-block]').forEach(x=>x.checked=!!data.blocks?.[x.dataset.viewBlock]);el('view-message').textContent=saved?'Borrador guardado en este navegador.':'Configuración inicial sin publicar.';renderViewPreview();
}
function renderViewPreview(){
 const v=viewConfig(),box=el('view-preview');box.classList.toggle('mobile',el('view-device').value==='mobile');
 box.innerHTML='<h3>'+esc(v.title||'Mi vista')+'</h3><p>'+esc(v.description||'')+'</p>'+(v.blocks.search?'<div class="preview-control">⌕ Buscar insumos…</div>':'')+(v.blocks.filters?'<div class="preview-control">☷ Categorías y filtros</div>':'')+'<div class="'+(v.layout==='grid'?'preview-grid':'')+'">'+['Producto de ejemplo A','Producto de ejemplo B'].map((n,i)=>'<div class="preview-control"><strong>'+n+'</strong>'+(v.blocks.stock?'<p>Existencias de muestra: '+(i+2)*4+'</p>':'')+'</div>').join('')+'</div>'+(v.blocks.request?'<div class="preview-control preview-action">＋ Solicitar insumo</div>':'');
}
function initViewEditor(){
 const select=el('view-role');select.innerHTML=roles.filter(r=>r.is_active).map(r=>'<option value="'+esc(r.id)+'">'+esc(r.title)+'</option>').join('');
 select.onchange=loadViewEditor;
 ['view-title','view-description','view-layout','view-device'].forEach(id=>el(id).addEventListener('input',renderViewPreview));
 document.querySelectorAll('[data-view-block]').forEach(x=>x.addEventListener('change',renderViewPreview));
 el('view-save').onclick=()=>{try{localStorage.setItem(viewKey(),JSON.stringify(viewConfig()));el('view-message').textContent='Borrador guardado en este navegador. No publicado.'}catch(e){el('view-message').textContent='No se pudo guardar el borrador: '+e.message}};
 el('view-reset').onclick=()=>{try{localStorage.removeItem(viewKey())}catch{}loadViewEditor()};
 loadViewEditor();
}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));['users','roles','views'].forEach(x=>el(x).classList.toggle('hidden',x!==b.dataset.tab));});
CartelLoad.run('initialization',async()=>{try{const {data:{user},error}=await sb.auth.getUser();if(error||!user){el('gate').textContent='Inicia sesión para consultar Usuarios y Roles.';return;}const r=await sb.from('system_access_roles').select('*').order('title');if(r.error)throw r.error;roles=r.data||[];await loadAccounts();await loadPermissions();renderRoles();initViewEditor();el('gate').classList.add('hidden');el('app').classList.remove('hidden');}catch(e){el('gate').textContent='No se pudo abrir la gestión de usuarios: '+e.message;}});
