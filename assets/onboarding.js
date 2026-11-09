'use strict';
const onboardingActivationMarker='[Enlace seguro de activación]';
let employmentClosures={};
async function loadEmploymentClosures(){const{data,error}=await sb.rpc('hr_offboarding',{p_employee:null,p_action:'list',p_payload:{}});if(error)throw Error('No se pudo comprobar el estado de las bajas. '+error.message);employmentClosures=Object.fromEntries((data||[]).filter(c=>c.candidate_id).map(c=>[String(c.candidate_id),c]));}
function onboardingRouteActions(id,h){if(window.CartelEvolution?.onboarded(id))return '<a class="candidate-flow-action" href="/bajas.html?candidate='+encodeURIComponent(id)+'">13 · Efectuar baja →</a>';const state=window.CartelEvolution?.onboardingState?.(id),label=state?(state.configured_at?'Continuar inserción en sistema →':'Configurar acceso al sistema →'):'Comprobar inserción en sistema →';return '<button type="button" class="candidate-flow-action" onclick="openSystemOnboarding(\''+hiringEsc(id)+'\')">'+label+'</button>';}
function onboardingMessage(name,username,email,activation,guide){return `Hola, ${name}. Tu cuenta de acceso a *nuestra Plataforma Automatizada* ha sido creada como parte de tu incorporación oficial a El Cartel Studio.

*DATOS DE ACCESO*

Usuario: ${username}
Correo electrónico: ${email}

Acceso desde tu ordenador:
https://gestion.elcartelstudio.com

*ACTIVACIÓN DE TU CUENTA: *Para establecer tu contraseña y activar el acceso, utiliza el siguiente enlace personal:

${activation}

*ACCESO DESDE TU CELULAR: *Puedes instalar un acceso directo a la plataforma en la pantalla de inicio de tu celular para utilizarla como una aplicación.

Instrucciones de instalación:
${guide}

*IMPORTANTE — INFORMACIÓN CONFIDENCIAL*

Este mensaje contiene información de acceso personal y confidencial. No compartas tu usuario, enlace de activación ni contraseña con otras personas. Una vez completada la activación, podrás acceder a las funciones autorizadas según tu cargo y los permisos asignados. Bienvenido a nuestra plataforma automatizada.`;}
async function onboardingCall(id,action,payload={}){const state=await hiringRpc('system_onboarding',{p_candidate:id,p_action:action,p_payload:payload});window.dispatchEvent(new CustomEvent('cartel-onboarding-updated',{detail:{id,state}}));return state;}
async function onboardingEdge(id,action){const {data,error}=await sb.functions.invoke('hr-onboarding',{body:{candidate_id:id,action}});if(error||data?.error)throw Error(data?.error||'No se pudo preparar la activación. Reintenta para comprobar el estado.');return data;}
async function openSystemOnboarding(id){
 const candidate=candidates.find(c=>String(c.id)===String(id));if(!candidate)return;
 const {overlay,dialog}=hiringNotificationDialog('12 · Inserción en sistema');
 dialog.classList.add('onboarding-dialog');
 if(!document.getElementById('onboardingVisualStyles')){const style=document.createElement('link');style.id='onboardingVisualStyles';style.rel='stylesheet';style.href='/assets/onboarding.css?v=20261104-guided';document.head.append(style);}
 const info=document.createElement('p');info.className='onboarding-status';info.setAttribute('role','status');info.textContent='Consultando el progreso guardado…';dialog.append(info);
 const content=document.createElement('div');dialog.append(content);
 let state,activation='',opened=false,editingConfiguration=false;
 const manage=()=>{const a=document.createElement('a');a.className='btn';a.href='/rrhh.html?employee='+encodeURIComponent(state.employee_id||'')+'&person-tab=access';a.onclick=e=>{if(window.CartelEvolution){e.preventDefault();overlay.remove();CartelEvolution.open('access');}};a.textContent='Gestionar acceso';return a;};
 const update=async()=>{
  state=await onboardingCall(id,'read');if(!overlay.isConnected)return;
  const rolesResult=await sb.from('system_access_roles').select('id,title,code,is_active').eq('is_active',true).order('title');if(rolesResult.error)throw rolesResult.error;
  const roleList=rolesResult.data||[];
  content.replaceChildren();
  info.textContent='Estado laboral: '+(state.labor_status==='hired'?'Contratados':'Contratación en trámite')+' · Expediente: '+(state.document_verified?'Validado':'Pendiente')+' · Contrato firmado: '+(state.contract_signed?'Validado':'Pendiente')+' · Formalización documental: '+(state.formalized?'Completada':'Pendiente')+'.';
  if(state.labor_status&&state.labor_status!=='hired'){const resume=document.createElement('button');resume.textContent='Abrir WhatsApp del paso 11 para continuar';resume.onclick=()=>{overlay.remove();openHiringPreparationNotification(id);};content.append(resume);return;}
  const stages=document.createElement('ol');stages.className='onboarding-stages';stages.setAttribute('aria-label','Tres subpasos del acceso');
  const stageData=[['Configurar acceso',state.configured_at,'<path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1"/><circle cx="12" cy="12" r="4"/>'],['Crear cuenta y preparar notificación',state.created_at,'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m3-13v6m-3-3h6"/>'],['Notificar por WhatsApp',state.whatsapp_opened_at,'<path d="M20 11.5a8 8 0 0 1-12 7L3 20l1.5-5A8 8 0 1 1 20 11.5Z"/><path d="M8 8c0 4 2 6 6 6l1-2-2-1-1 1-2-2 1-1-1-2Z"/>']];
  const currentStage=stageData.findIndex(([,done])=>!done);
  stageData.forEach(([title,done,icon],index)=>{const li=document.createElement('li');li.className=done?'is-complete':index===currentStage?'is-current':'is-pending';if(index===currentStage)li.setAttribute('aria-current','step');const symbol=document.createElement('span');symbol.className='onboarding-stage-icon';symbol.setAttribute('aria-hidden','true');symbol.innerHTML='<svg viewBox="0 0 24 24">'+(done?'<path d="m5 12 4 4L19 6"/>':icon)+'</svg>';const label=document.createElement('span');label.className='onboarding-stage-title';label.textContent=title;const status=document.createElement('span');status.className='onboarding-stage-state';status.textContent=done?'Completado':index===currentStage?'En curso':'Pendiente';li.append(symbol,label,status);stages.append(li);});content.append(stages);
  if(state.protected){content.append('Este trabajador ya tiene un acceso. Sus permisos se conservan. ',manage());return;}
  if(state.configured_at){
   const summary=document.createElement('div');summary.className='onboarding-config-summary';
   const heading=document.createElement('div');heading.className='onboarding-config-heading';
   const title=document.createElement('strong');title.textContent='✓ 1 · Configurar acceso · Completado';
   heading.append(title);
   if(!state.created_at&&!state.protected){const edit=document.createElement('button');edit.type='button';edit.className='onboarding-edit';edit.textContent=editingConfiguration?'Cerrar edición':'Editar';edit.onclick=()=>{editingConfiguration=!editingConfiguration;update();};heading.append(edit);}
   summary.append(heading);
   const details=document.createElement('p');details.textContent=[state.username,state.email,roleList.find(r=>String(r.id)===String(state.role_id))?.title].filter(Boolean).join(' · ');summary.append(details);
   content.append(summary);
  }
  if(state.created_at)content.append(manage());
  const section=document.createElement('section');section.className='onboarding-section';content.append(section);
  if(!state.created_at){
   if(!state.configured_at||editingConfiguration){const form=document.createElement('form');form.innerHTML='<h4>1 · Configurar acceso</h4><div class="onboarding-fields"><div class="onboarding-field"><label for="onboardingUsername">Nombre de usuario único</label><input id="onboardingUsername" name="username" autocomplete="off" required minlength="3" maxlength="80" pattern="[a-z0-9._-]{3,80}"></div><div class="onboarding-field"><label for="onboardingEmail">Correo electrónico individual</label><input id="onboardingEmail" name="email" type="email" autocomplete="off" required maxlength="254"></div><div class="onboarding-field onboarding-field-role"><label for="onboardingRole">Rol del usuario</label><select id="onboardingRole" name="role_id" required><option value="">Selecciona un rol…</option></select></div></div><p class="onboarding-notice">Los permisos se toman del rol. Las vistas requieren asignación individual o aplicación explícita de plantilla; no se heredan automáticamente. El trabajador verificará este correo para activar su acceso.</p><p id="onboardingRoleSummary"></p><button type="submit" class="onboarding-save">Guardar configuración</button>';
   form.elements.username.value=state.username||'';form.elements.email.value=state.email||'';
   const select=form.elements.role_id;for(const r of roleList)select.add(new Option(r.title,r.id));select.value=state.role_id||'';
   select.onchange=async()=>{const value=select.value,summary=form.querySelector('#onboardingRoleSummary');summary.textContent='Consultando plantilla…';try{if(!value){summary.textContent='Selecciona un rol.';return;}const t=await hiringRpc('system_role_template',{p_role:value});if(select.value!==value)return;summary.textContent='Plantilla versión '+t.revision+' · Inventario: '+(t.can_write?'lectura y escritura':t.can_read?'solo lectura':'sin acceso')+' · Vistas de plantilla, disponibles para aplicación explícita: '+(t.views.map(v=>v.code==='inventory_admin'?'Inventario Insumos':v.code).join(', ')||'ninguna autorizada')+'.';}catch(e){summary.textContent=e.message;}};
   form.onsubmit=async ev=>{ev.preventDefault();const b=form.querySelector('button');b.disabled=true;try{await onboardingCall(id,'configure',Object.fromEntries(new FormData(form)));editingConfiguration=false;await update();}catch(e){info.textContent='No se guardó la configuración: '+e.message;b.disabled=false;}};
   section.append(form);if(select.value)select.onchange();}
   if(state.configured_at&&!editingConfiguration){const heading=document.createElement('h4');heading.textContent='2 · Crear cuenta y preparar notificación';section.append(heading);const hint=document.createElement('p');hint.className='onboarding-step-hint';hint.textContent='La configuración está guardada. Continúa creando la cuenta y preparando el enlace de activación.';section.append(hint);}
   const create=document.createElement('button');create.type='button';create.className='onboarding-create';create.textContent='2 · Crear cuenta y preparar notificación';create.disabled=!state.configured_at||editingConfiguration;create.onclick=async()=>{create.disabled=true;info.textContent='Verificando la identidad y preparando la cuenta…';try{const result=await onboardingEdge(id,'provision');activation=result.activation_url;await update();}catch(e){info.textContent=e.message;create.disabled=false;}};if(state.configured_at&&!editingConfiguration)section.append(create);return;
  }
  const heading=document.createElement('h4');heading.textContent=state.whatsapp_opened_at?'3 · WhatsApp abierto':'3 · Notificar por WhatsApp';section.append(heading);
  const status=document.createElement('p');status.textContent=state.activated_at?(state.enabled?'Acceso activo · correo verificado.':'Acceso deshabilitado. Gestiona la cuenta para revisarlo.'):'Cuenta creada · activación y verificación de correo pendientes.';section.append(status);
  if(state.activated_at)return;
  const expired=Date.parse(state.expires_at)<=Date.now();
  if(!activation&&!expired){try{activation=(await onboardingEdge(id,'preview')).activation_url;}catch(e){info.textContent=e.message;}}
  const expiry=document.createElement('p');expiry.textContent='Enlace de un uso · vence: '+new Date(state.expires_at).toLocaleString('es')+'. Abrir WhatsApp no confirma el envío.';section.append(expiry);
  const editor=document.createElement('textarea');editor.className='hiring-message';editor.setAttribute('aria-label','Mensaje de acceso para WhatsApp (editable)');editor.maxLength=12000;
  const guide='https://gestion.elcartelstudio.com/guia-acceso-movil.html';
  editor.value=(state.message||onboardingMessage(hiringGreetingName(candidate),state.username,state.email,onboardingActivationMarker,guide)).split(onboardingActivationMarker).join(activation||onboardingActivationMarker);section.append(editor);
  const actions=document.createElement('div');actions.className='onboarding-actions';section.append(actions);
  const persistEditor=async()=>{const text=activation?editor.value.split(activation).join(onboardingActivationMarker):editor.value;await onboardingCall(id,'message',{message:text});};
  const save=document.createElement('button');save.type='button';save.textContent='Guardar mensaje';save.onclick=async()=>{save.disabled=true;try{await persistEditor();info.textContent='Mensaje guardado.';}catch(e){info.textContent='No se guardó el mensaje: '+e.message;}finally{save.disabled=editor.readOnly;}};
  const send=document.createElement('button');send.type='button';send.className='hiring-whatsapp';send.textContent='Notificar vía WhatsApp';send.disabled=expired||!activation;
  send.onclick=async()=>{
   if(send.disabled)return;const phone=candidatePhone(candidate);if(phone.length<8){info.textContent='Falta un WhatsApp válido.';return;}if(!editor.value.trim()){info.textContent='Escribe un mensaje.';return;}
   if(Date.parse(state.expires_at)<=Date.now()){send.disabled=true;info.textContent='El enlace venció. Renueva la activación.';return;}
   // Reserve during the click; a blocked window must not complete the substep.
   let tab;if(!opened){tab=window.open('about:blank','_blank');if(!tab){info.textContent='El navegador bloqueó WhatsApp. Permite las ventanas emergentes y reintenta.';return;}}
   send.disabled=true;
   try{
    await persistEditor();
    if(!opened){try{tab.opener=null;tab.location.replace('https://wa.me/'+phone+'?text='+encodeURIComponent(editor.value));opened=true;editor.readOnly=true;save.disabled=true;}catch(e){tab.close();throw e;}}
    state=await onboardingCall(id,'opened');[state.configured_at,state.created_at,state.whatsapp_opened_at].forEach((done,index)=>{if(!done)return;const li=stages.children[index];li.className='is-complete';li.removeAttribute('aria-current');li.querySelector('.onboarding-stage-state').textContent='Completado';li.querySelector('.onboarding-stage-icon').innerHTML='<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>';});heading.textContent='3 · WhatsApp abierto';editor.readOnly=true;info.textContent='WhatsApp abierto. El envío no está confirmado. El progreso quedó guardado.';
    send.textContent='WhatsApp abierto';
   }catch(e){if(!opened)tab?.close();info.textContent=(opened?'WhatsApp abierto; falta guardar el progreso. ':'')+e.message;send.textContent=opened?'Reintentar registrar apertura':'Notificar vía WhatsApp';send.disabled=false;}
  };
  const renew=document.createElement('button');renew.type='button';renew.textContent='Renovar activación';renew.onclick=async()=>{if(!confirm('¿Invalidar el enlace anterior y preparar uno nuevo?'))return;renew.disabled=true;try{activation=(await onboardingEdge(id,'renew')).activation_url;await update();}catch(e){info.textContent=e.message;renew.disabled=false;}};
  actions.append(save,send,renew);
 };
 try{await update();}catch(e){info.textContent='No se pudo cargar el acceso: '+e.message;const retry=document.createElement('button');retry.textContent='Reintentar';retry.onclick=()=>{overlay.remove();openSystemOnboarding(id);};content.append(retry);}
}
