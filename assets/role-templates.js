'use strict';
// Template edits never write employee assignments or the role's authorization ceiling.
const showRoleBeforeTemplates=showRole;
showRole=function(i){
 showRoleBeforeTemplates(i);
 const role=roles[i],panel=el('role-detail'),old=panel.querySelector('#permission-form');
 const box=document.createElement('div');old.replaceWith(box);box.textContent='Cargando plantilla persistente…';
 (async()=>{
  try{
   const {data:t,error}=await sb.rpc('system_role_template',{p_role:role.id});if(error)throw error;
   if(!box.isConnected)return;
   const ceiling=permissions.find(p=>p.access_role_id===role.id&&p.module_code==='inventario_insumos')||{};
   box.innerHTML='<h3>Plantilla para nuevas cuentas</h3><p>Versión '+t.revision+'. Cambiar esta plantilla no modifica los accesos de ningún trabajador existente.</p><form><fieldset><legend>Inventario Insumos</legend><label><input type="checkbox" name="read"> Lectura</label><label><input type="checkbox" name="write"> Escritura</label><label><input type="checkbox" name="view"> Vista de Inventario Insumos como inicio</label></fieldset><p>Recursos Humanos y Usuarios y Accesos: solo propietario. La plantilla no puede superar los permisos autorizados del rol.</p><button type="submit" class="btn">Guardar plantilla</button><p role="status"></p></form>';
   const form=box.querySelector('form'),status=box.querySelector('[role=status]');
   form.elements.read.checked=t.can_read;form.elements.write.checked=t.can_write;form.elements.view.checked=t.views.some(v=>v.code==='inventory_admin');
   form.elements.read.disabled=!ceiling.can_read;form.elements.write.disabled=!ceiling.can_write;
   const controls=()=>{if(!form.elements.read.checked){form.elements.write.checked=false;form.elements.view.checked=false;}form.elements.view.disabled=!form.elements.read.checked;};
   form.elements.read.onchange=controls;form.elements.write.onchange=()=>{if(form.elements.write.checked)form.elements.read.checked=true;controls();};controls();
   form.onsubmit=async event=>{event.preventDefault();const b=form.querySelector('button');b.disabled=true;try{const {data,error}=await sb.rpc('system_role_template',{p_role:role.id,p_action:'save',p_payload:{revision:t.revision,can_read:form.elements.read.checked,can_write:form.elements.write.checked,views:form.elements.view.checked?[{code:'inventory_admin',is_default:true}]:[]}});if(error)throw error;t.revision=data.revision;status.textContent='Plantilla guardada. Los accesos existentes se conservan.';}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};
  }catch(e){box.textContent='No se pudo cargar la plantilla: '+e.message;}
 })();
};
// Open the permanent account action directly from a candidate's sheet.
const originalLoadAccounts=loadAccounts;
loadAccounts=async function(){
 await originalLoadAccounts();
 document.querySelectorAll('#account-list > .card').forEach((card,i)=>{
  const account=accounts[i];if(account.is_owner||!account.employee_id||!account.roles?.length)return;
  const box=document.createElement('div'),label=document.createElement('label'),select=document.createElement('select'),button=document.createElement('button'),status=document.createElement('p');
  label.textContent='Aplicación administrativa de plantilla';select.setAttribute('aria-label','Rol de la plantilla a aplicar');
  for(const role of account.roles){const entry=roles.find(r=>r.code===role.code);if(entry)select.add(new Option(entry.title,entry.id));}
  button.type='button';button.className='btn';button.textContent='Aplicar plantilla a este trabajador';status.setAttribute('role','status');
  button.onclick=async()=>{if(!select.value||!confirm('¿Reemplazar las vistas y los permisos efectivos de '+(account.full_name||account.username)+' por la plantilla de '+select.selectedOptions[0].text+'? Esta acción explícita solo afecta a este trabajador.'))return;button.disabled=true;try{const {error}=await sb.rpc('system_apply_role_template',{p_employee:account.employee_id,p_role:select.value});if(error)throw error;status.textContent='Plantilla aplicada a este trabajador y registrada en auditoría.';}catch(e){status.textContent=e.message;}finally{button.disabled=false;}};
  box.append(label,select,button,status);card.append(box);
 });
 const employee=new URLSearchParams(location.search).get('employee');if(employee){const index=accounts.findIndex(u=>u.employee_id===employee);if(index>=0)document.querySelectorAll('#account-list > .account-item')[index]?.click();}
};
const templateNotice=document.createElement('p');templateNotice.className='notice';templateNotice.textContent='Las plantillas permanentes de acceso se administran en Roles. El editor visual conserva únicamente borradores de diseño; no concede permisos.';document.getElementById('views')?.prepend(templateNotice);
let accountTemplateToolsReady=false;
function initializeAccountTemplateTools(){if(accountTemplateToolsReady)return;accountTemplateToolsReady=true;CartelLoad.run('account_template_tools',()=>loadAccounts());}
document.addEventListener('cartel-access-ready',initializeAccountTemplateTools,{once:true});
if(!el('app').classList.contains('hidden'))initializeAccountTemplateTools();
