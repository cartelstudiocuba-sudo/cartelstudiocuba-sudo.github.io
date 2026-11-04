'use strict';
const onboardingActivationMarker='[Enlace seguro de activación]';
function onboardingRouteActions(id,h){return '<button type="button" class="candidate-flow-action" onclick="openSystemOnboarding(\''+hiringEsc(id)+'\')">Configurar acceso al sistema →</button>';}
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
async function onboardingCall(id,action,payload={}){return hiringRpc('system_onboarding',{p_candidate:id,p_action:action,p_payload:payload});}
async function onboardingEdge(id,action){const {data,error}=await sb.functions.invoke('hr-onboarding',{body:{candidate_id:id,action}});if(error||data?.error)throw Error(data?.error||'No se pudo preparar la activación. Reintenta para comprobar el estado.');return data;}
async function openSystemOnboarding(id){
 const candidate=candidates.find(c=>String(c.id)===String(id));if(!candidate)return;
 const {overlay,dialog}=hiringNotificationDialog('12 · Inserción en sistema');
 dialog.classList.add('onboarding-dialog');
 const style=document.createElement('style');style.textContent='.onboarding-dialog label{display:block;margin:14px 0 6px}.onboarding-dialog input,.onboarding-dialog select{display:block;width:100%;min-height:46px;padding:12px;border:1px solid #646970;border-radius:10px;background:#0d1012;color:#fff;font:inherit}.onboarding-dialog ol{padding-left:26px}.onboarding-dialog li{padding:6px}.onboarding-dialog .onboarding-actions{display:flex;gap:10px;flex-wrap:wrap}.onboarding-dialog .onboarding-section{border-top:1px solid #41474c;margin-top:18px;padding-top:12px}.onboarding-dialog a{color:#ffda03}.onboarding-dialog [hidden]{display:none!important}';dialog.append(style);
 const info=document.createElement('p');info.setAttribute('role','status');info.textContent='Consultando el progreso guardado…';dialog.append(info);
 const content=document.createElement('div');dialog.append(content);
 let state,activation='',opened=false,dirty=false;
 const manage=()=>{const a=document.createElement('a');a.className='btn';a.href='/usuarios-permisos.html?section=users&employee='+encodeURIComponent(state.employee_id||'');a.textContent='Gestionar acceso';return a;};
 const update=async()=>{
  state=await onboardingCall(id,'read');if(!overlay.isConnected)return;
  const rolesResult=await sb.from('system_access_roles').select('id,title,code,is_active').eq('is_active',true).order('title');if(rolesResult.error)throw rolesResult.error;
  const roleList=rolesResult.data||[];
  content.replaceChildren();
  info.textContent='Estado laboral: '+(state.labor_status==='hired'?'Contratados':'Contratación en trámite')+' · Expediente: '+(state.document_verified?'Validado':'Pendiente')+' · Contrato firmado: '+(state.contract_signed?'Validado':'Pendiente')+' · Formalización documental: '+(state.formalized?'Completada':'Pendiente')+'.';
  if(state.labor_status&&state.labor_status!=='hired'){const resume=document.createElement('button');resume.textContent='Abrir WhatsApp del paso 11 para continuar';resume.onclick=()=>{overlay.remove();openHiringPreparationNotification(id);};content.append(resume);return;}
  const stages=document.createElement('ol');stages.setAttribute('aria-label','Tres subpasos del acceso');
  for(const [title,done] of [['Configurar acceso',state.configured_at],['Crear cuenta y preparar notificación',state.created_at],['Notificar por WhatsApp',state.whatsapp_opened_at]]){const li=document.createElement('li');li.textContent=title+' · '+(done?'Completado':'Pendiente');stages.append(li);}content.append(stages);
  if(state.protected){content.append('Este trabajador ya tiene un acceso. Sus permisos se conservan. ',manage());return;}
  if(state.created_at)content.append(manage());
  const section=document.createElement('section');section.className='onboarding-section';content.append(section);
  if(!state.created_at){
   const form=document.createElement('form');form.innerHTML='<h4>1 · Configurar acceso</h4><label for="onboardingUsername">Nombre de usuario único</label><input id="onboardingUsername" name="username" autocomplete="off" required minlength="3" maxlength="80" pattern="[a-z0-9._-]{3,80}"><label for="onboardingEmail">Correo electrónico individual</label><input id="onboardingEmail" name="email" type="email" autocomplete="off" required maxlength="254"><label for="onboardingRole">Rol del usuario</label><select id="onboardingRole" name="role_id" required><option value="">Selecciona un rol…</option></select><p>Las vistas y los permisos se heredan de la plantilla guardada del rol. El trabajador verificará este correo para activar su acceso.</p><p id="onboardingRoleSummary"></p><button type="submit">Guardar configuración</button>';
   form.elements.username.value=state.username||'';form.elements.email.value=state.email||'';
   const select=form.elements.role_id;for(const r of roleList)select.add(new Option(r.title,r.id));select.value=state.role_id||'';
   select.onchange=async()=>{const value=select.value,summary=form.querySelector('#onboardingRoleSummary');summary.textContent='Consultando plantilla…';try{if(!value){summary.textContent='Selecciona un rol.';return;}const t=await hiringRpc('system_role_template',{p_role:value});if(select.value!==value)return;summary.textContent='Plantilla versión '+t.revision+' · Inventario: '+(t.can_write?'lectura y escritura':t.can_read?'solo lectura':'sin acceso')+' · Vistas: '+(t.views.map(v=>v.code==='inventory_admin'?'Inventario Insumos':v.code).join(', ')||'ninguna autorizada')+'.';}catch(e){summary.textContent=e.message;}};
   form.onsubmit=async ev=>{ev.preventDefault();const b=form.querySelector('button');b.disabled=true;try{await onboardingCall(id,'configure',Object.fromEntries(new FormData(form)));await update();}catch(e){info.textContent='No se guardó la configuración: '+e.message;b.disabled=false;}};
   section.append(form);if(select.value)select.onchange();
   const create=document.createElement('button');create.type='button';create.textContent='2 · Crear cuenta y preparar notificación';create.disabled=!state.configured_at;create.onclick=async()=>{create.disabled=true;info.textContent='Verificando la identidad y preparando la cuenta…';try{const result=await onboardingEdge(id,'provision');activation=result.activation_url;await update();}catch(e){info.textContent=e.message;create.disabled=false;}};section.append(create);return;
  }
  const status=document.createElement('p');status.textContent=state.activated_at?(state.enabled?'Acceso activo · correo verificado.':'Acceso deshabilitado. Gestiona la cuenta para revisarlo.'):'Cuenta creada · activación y verificación de correo pendientes.';section.append(status);
  if(state.activated_at)return;
  const expired=Date.parse(state.expires_at)<=Date.now();
  if(!activation&&!expired){try{activation=(await onboardingEdge(id,'preview')).activation_url;}catch(e){info.textContent=e.message;}}
  const expiry=document.createElement('p');expiry.textContent='Enlace de un uso · vence: '+new Date(state.expires_at).toLocaleString('es')+'. Abrir WhatsApp no confirma el envío.';section.append(expiry);
  const editor=document.createElement('textarea');editor.className='hiring-message';editor.setAttribute('aria-label','Mensaje de acceso para WhatsApp (editable)');editor.maxLength=12000;
  const guide='https://gestion.elcartelstudio.com/guia-acceso-movil.html';
  editor.value=(state.message||onboardingMessage(hiringGreetingName(candidate),state.username,state.email,onboardingActivationMarker,guide)).split(onboardingActivationMarker).join(activation||onboardingActivationMarker);editor.oninput=()=>{dirty=true;};section.append(editor);
  const save=async()=>{const text=editor.value.split(activation||onboardingActivationMarker).join(onboardingActivationMarker);await onboardingCall(id,'message',{message:text});dirty=false;};
  const actions=document.createElement('div');actions.className='onboarding-actions';section.append(actions);
  const saveButton=document.createElement('button');saveButton.type='button';saveButton.textContent='Guardar mensaje';saveButton.onclick=async()=>{saveButton.disabled=true;try{await save();info.textContent='Mensaje guardado.';}catch(e){info.textContent=e.message;}finally{saveButton.disabled=false;}};
  const send=document.createElement('button');send.type='button';send.className='hiring-whatsapp';send.textContent='3 · Abrir WhatsApp';send.disabled=expired||!activation;
  send.onclick=async()=>{
   if(send.disabled)return;const phone=candidatePhone(candidate);if(phone.length<8){info.textContent='Falta un WhatsApp válido.';return;}if(!editor.value.trim()){info.textContent='Escribe un mensaje.';return;}
   if(Date.parse(state.expires_at)<=Date.now()){send.disabled=true;info.textContent='El enlace venció. Renueva la activación.';return;}
   // Reserve during the click; a blocked window must not complete the substep.
   let tab;if(!opened){tab=window.open('about:blank','_blank');if(!tab){info.textContent='El navegador bloqueó WhatsApp. Permite las ventanas emergentes y reintenta.';return;}}
   send.disabled=true;
   try{
    await save();
    if(!opened){try{tab.opener=null;tab.location.replace('https://wa.me/'+phone+'?text='+encodeURIComponent(editor.value));opened=true;}catch(e){tab.close();throw e;}}
    await onboardingCall(id,'opened');editor.readOnly=true;info.textContent='WhatsApp abierto. El envío no está confirmado. El progreso quedó guardado.';
    send.textContent='WhatsApp abierto';
   }catch(e){if(!opened)tab?.close();info.textContent=(opened?'WhatsApp abierto; falta guardar el progreso. ':'')+e.message;send.textContent=opened?'Reintentar guardar apertura':'3 · Abrir WhatsApp';send.disabled=false;}
  };
  const renew=document.createElement('button');renew.type='button';renew.textContent='Renovar activación';renew.onclick=async()=>{if(!confirm('¿Invalidar el enlace anterior y preparar uno nuevo?'))return;renew.disabled=true;try{if(dirty)await save();activation=(await onboardingEdge(id,'renew')).activation_url;await update();}catch(e){info.textContent=e.message;renew.disabled=false;}};
  actions.append(saveButton,send,renew);
 };
 try{await update();}catch(e){info.textContent='No se pudo cargar el acceso: '+e.message;const retry=document.createElement('button');retry.textContent='Reintentar';retry.onclick=()=>{overlay.remove();openSystemOnboarding(id);};content.append(retry);}
}
