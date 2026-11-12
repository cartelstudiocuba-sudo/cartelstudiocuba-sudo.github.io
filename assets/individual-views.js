'use strict';
window.CartelIndividualViews={async mount(host,user,client){
 if(!user.employee_id)return;
 const section=document.createElement('section');section.className='profile-panel individual-views';section.setAttribute('aria-label','Rol y vistas del trabajador');host.append(section);
 const catalog=[{code:'inventory_admin',title:'Inventario · Administrador',levels:['read','write']},{code:'inventory_graphics_read',title:'Consulta de insumos · Gráfica',levels:['read']}];
 const label=code=>catalog.find(v=>v.code===code)?.title||code;
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let state=null;
 async function load(){section.textContent='Consultando rol y vistas…';try{const r=await client.rpc('system_employee_view_access',{p_employee:user.employee_id});if(r.error)throw r.error;if(!section.isConnected)return;state=r.data;render();}catch(error){section.textContent='No se pudieron consultar las vistas: '+error.message;const retry=document.createElement('button');retry.className='btn';retry.textContent='Reintentar';retry.onclick=load;section.append(retry);}}
 function render(){
  const inherited=state.inherited||[],legacy=state.legacy||[],additional=state.additional||[];
  section.innerHTML='<h3>Rol y vistas</h3><p><strong>'+escape((state.roles||[]).map(r=>r.title).join(', ')||'Sin rol asignado')+'</strong></p><h4>Vistas heredadas del rol</h4><p>Se administran desde el rol y no se pueden retirar desde esta ficha.</p>'+(inherited.length?'<ul>'+inherited.map(v=>'<li>'+escape(label(v.code))+' · '+(state.role_permission?.write?'Lectura y operaciones':'Solo lectura')+' · Heredada</li>').join('')+'</ul>':'<p>Sin vistas heredadas registradas.</p>')+(legacy.length?'<h4>Accesos existentes conservados</h4><ul>'+legacy.map(v=>'<li>'+escape(label(v.view_code))+' · Asignación existente</li>').join('')+'</ul><p>Se conservan durante la transición.</p>':'')+'<h4>Vistas adicionales individuales</h4><p>Solo afectan a este trabajador. No cambian su rol ni las vistas heredadas.</p><div class="individual-view-options"></div><p class="individual-view-message" role="status"></p><details><summary>Historial de vistas adicionales</summary><ol>'+((state.history||[]).map(h=>'<li>'+escape(new Date(h.created_at).toLocaleString('es-ES'))+' · '+escape(h.kind==='individual_view_removed'?'Vista retirada':'Vista asignada o actualizada')+' · '+escape(label(h.after_data?.view_code))+' · '+escape(h.after_data?.permission_level==='write'?'Lectura y operaciones':'Solo lectura')+'</li>').join('')||'<li>Sin cambios registrados.</li>')+'</ol></details>';
  const options=section.querySelector('.individual-view-options');
  for(const item of catalog){
   if(inherited.some(v=>v.code===item.code)||legacy.some(v=>v.view_code===item.code))continue;
   const grant=additional.find(v=>v.view_code===item.code),row=document.createElement('form');row.className='individual-view-row';
   row.innerHTML='<strong>'+escape(item.title)+'</strong><label><input type="checkbox" name="enabled" '+(grant?.enabled?'checked':'')+'> Asignar vista</label><label>Nivel de permiso <select name="permission_level">'+item.levels.map(level=>'<option value="'+level+'">'+(level==='write'?'Lectura y operaciones':'Solo lectura')+'</option>').join('')+'</select></label><button class="btn" type="submit">Guardar vista</button>';
   if(grant)row.elements.permission_level.value=grant.permission_level;
   if(user.is_owner){row.querySelectorAll('input,select,button').forEach(n=>n.disabled=true);}
   row.onsubmit=async event=>{event.preventDefault();const button=row.querySelector('button'),status=section.querySelector('[role=status]');button.disabled=true;status.textContent='Guardando…';try{const r=await client.rpc('system_employee_view_access',{p_employee:user.employee_id,p_action:'save',p_payload:{code:item.code,permission_level:row.elements.permission_level.value,enabled:row.elements.enabled.checked,revision:grant?.revision||0}});if(r.error)throw r.error;if(!section.isConnected)return;state=r.data;render();section.querySelector('[role=status]').textContent='Cambio guardado y registrado en el historial.';}catch(error){status.textContent='No se guardó: '+error.message;button.disabled=false;}};
   options.append(row);
  }
  if(!options.children.length)options.textContent='No hay otras vistas publicadas disponibles.';
 }
 await load();
}};
