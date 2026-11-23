'use strict';
const onboardingActivationMarker='[Enlace seguro de activación]';
let employmentClosures={};
async function loadEmploymentClosures(){const{data,error}=await sb.rpc('hr_offboarding',{p_employee:null,p_action:'list',p_payload:{}});if(error)throw Error('No se pudo comprobar el estado de las bajas. '+error.message);employmentClosures=Object.fromEntries((data||[]).filter(c=>c.candidate_id).map(c=>[String(c.candidate_id),c]));}
function onboardingRouteActions(id,h){if(window.CartelEvolution?.onboarded(id))return '<a class="candidate-flow-action" href="/bajas.html?candidate='+encodeURIComponent(id)+'">13 · Efectuar baja →</a>';const state=window.CartelEvolution?.onboardingState?.(id),label=state?(state.configured_at?'Continuar inserción en sistema →':'Configurar acceso al sistema →'):'Comprobar inserción en sistema →';return '<button type="button" class="candidate-flow-action" onclick="openSystemOnboarding(\''+hiringEsc(id)+'\')">'+label+'</button>';}
const onboardingMobileInstructions=`*ACCESO DESDE TU CELULAR*

Abre https://gestion.elcartelstudio.com y agrega Gestión a tu pantalla de inicio para abrirla como una aplicación.

• *iPhone:* abre el enlace en Safari, toca Compartir → Agregar a la pantalla de inicio y pulsa Agregar. Si aparece «Abrir como app web», déjalo activado.
• *Android:* abre el enlace en Chrome, toca los tres puntos ⋮ → Agregar a la pantalla de inicio y elige Instalar o Agregar, según lo que te aparezca.

Después, toca el ícono de Gestión en tu pantalla de inicio y entra con tu usuario o correo y la contraseña que configuraste.`;
const onboardingPreviousMobileInstructions=`*ACCESO DESDE TU CELULAR: *Puedes instalar un acceso directo a la plataforma en la pantalla de inicio de tu celular para utilizarla como una aplicación.

Instrucciones de instalación:
https://gestion.elcartelstudio.com/guia-acceso-movil.html`;
function onboardingMessage(name,username,email,activation){return `Hola, ${name}. Tu cuenta de acceso a *nuestra Plataforma Automatizada* ha sido creada como parte de tu incorporación oficial a El Cartel Studio.

*DATOS DE ACCESO*

Usuario: ${username}
Correo electrónico: ${email}

Acceso desde tu ordenador:
https://gestion.elcartelstudio.com

*ACTIVACIÓN DE TU CUENTA: *Para establecer tu contraseña y activar el acceso, utiliza el siguiente enlace personal:

${activation}

${onboardingMobileInstructions}

*IMPORTANTE — INFORMACIÓN CONFIDENCIAL*

Este mensaje contiene información de acceso personal y confidencial. No compartas tu usuario, enlace de activación ni contraseña con otras personas. Una vez completada la activación, podrás acceder a las funciones autorizadas según tu cargo y los permisos asignados. Bienvenido a nuestra plataforma automatizada.`;}
async function onboardingCall(id,action,payload={}){const state=await hiringRpc('system_onboarding',{p_candidate:id,p_action:action,p_payload:payload});window.dispatchEvent(new CustomEvent('cartel-onboarding-updated',{detail:{id,state}}));return state;}
async function onboardingEdge(id,action){const {data,error}=await sb.functions.invoke('hr-onboarding',{body:{candidate_id:id,action}});if(error||data?.error)throw Error(data?.error||'No se pudo preparar la activación. Reintenta para comprobar el estado.');return data;}
function onboardingHasAccount(state){return !!(state.existing_account||state.auth_user_id||state.protected||state.created_at);}
async function onboardingConfigurationForm(state,roleList,save,back,options={}){
 const form=document.createElement('form');form.className='onboarding-configuration-form';
 form.innerHTML='<div class="onboarding-credential-card"><div class="onboarding-fields"><div class="onboarding-field"><label for="onboardingUsername">Usuario</label><input id="onboardingUsername" name="username" autocomplete="off" required minlength="3" maxlength="80" pattern="[a-z0-9._-]{3,80}" aria-describedby="onboardingUsernameHelp"><small id="onboardingUsernameHelp">Entre 3 y 80 caracteres: letras minúsculas, números, punto, guion o guion bajo.</small></div><div class="onboarding-field"><label for="onboardingEmail">Correo electrónico individual</label><input id="onboardingEmail" name="email" type="email" autocomplete="off" required maxlength="254" aria-describedby="onboardingEmailHelp"><small id="onboardingEmailHelp"></small></div><div class="onboarding-field onboarding-field-role"><label for="onboardingRole">Seleccionar rol</label><select id="onboardingRole" name="role_id" required><option value="">Selecciona un rol…</option></select></div></div><details class="onboarding-permission-preview"><summary>Consultar permisos del rol</summary><div id="onboardingPermissionSummary" aria-live="polite"></div></details></div><p class="onboarding-config-error" role="alert"></p><div class="onboarding-config-actions"><button type="button" class="onboarding-config-back">Volver a la ficha</button><button type="submit" class="onboarding-save" disabled>Guardar y continuar</button></div>';
 const draft=options.editing===true;
 form.dataset.mode=draft?'edit_draft':'new_configuration';
 form.elements.username.value=(draft?state.username:state.suggested_username)||'';form.elements.email.value=(draft||onboardingHasAccount(state)?state.email:state.hiring_email||state.email)||'';
 form.querySelector('#onboardingEmailHelp').textContent='Se usará para verificar la identidad y activar una cuenta nueva.';
 const select=form.elements.role_id;for(const r of roleList.filter(r=>r.is_catalog_role!==false))select.add(new Option(r.title,r.id));select.value=draft?(state.role_id||''):'';
 const submit=form.querySelector('[type=submit]'),summary=form.querySelector('#onboardingPermissionSummary'),error=form.querySelector('[role=alert]');
 submit.prepend(hiringReviewIcon('confirm'));
 const preview=summary.closest('details');preview.hidden=true;
 let revision=null,version=0,busy=false;
 const validate=()=>{submit.disabled=busy||revision===null||!form.checkValidity();};
 form.addEventListener('input',validate);
 select.onchange=async()=>{const request=++version;revision=null;submit.disabled=true;error.textContent='';preview.hidden=!select.value;summary.textContent='Consultando permisos…';try{if(!select.value){summary.textContent='Selecciona un rol para consultar sus permisos.';return;}const template=await hiringRpc('system_role_template',{p_role:select.value});if(request!==version||!select.value)return;revision=template.revision;summary.replaceChildren();const list=document.createElement('dl');for(const [label,value] of [['Inventario de insumos',template.can_write?'Lectura y operaciones':template.can_read?'Solo lectura':'Sin acceso'],['Recursos Humanos','Sin acceso'],['Administración de usuarios','Sin acceso']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;list.append(dt,dd);}const note=document.createElement('p');note.textContent='Las vistas y los permisos predeterminados de este rol se heredan automáticamente. Las vistas adicionales se gestionan después desde la ficha del trabajador.';summary.append(list,note);validate();}catch(e){if(request!==version)return;summary.textContent='No se pudieron consultar los permisos. Vuelve a seleccionar el rol para reintentar.';error.textContent=e.message;}};
 form.querySelector('.onboarding-config-back').onclick=()=>{if(!busy)back();};

 form.onsubmit=async event=>{event.preventDefault();if(busy||revision===null)return;error.textContent='';if(!form.reportValidity())return;busy=true;for(const input of form.querySelectorAll('input,select,button'))input.disabled=true;const payload={username:form.elements.username.value.trim().toLowerCase(),email:form.elements.email.value.trim().toLowerCase(),role_id:select.value,template_revision:revision,expected_config:state.config_revision};try{if(onboardingHasAccount(state))throw Error('Este trabajador ya tiene una cuenta vinculada. No se puede crear otra cuenta ni modificar su usuario, correo o permisos desde este formulario.');await save('save',payload);}catch(e){error.textContent='No se guardaron los cambios: '+e.message;busy=false;for(const input of form.querySelectorAll('input,select,button'))input.disabled=false;validate();}};
 select.onchange();return form;
}

async function openSystemOnboarding(id){
 const candidate=candidates.find(c=>String(c.id)===String(id));if(!candidate)return;
 const {overlay,dialog}=hiringNotificationDialog('12 · Inserción en sistema');
 dialog.classList.add('onboarding-dialog','onboarding-credential-dialog');
 dialog.querySelector('header').classList.add('onboarding-credential-heading');
 dialog.querySelector('h3').prepend(hiringReviewIcon('confirm'));
 if(!document.getElementById('onboardingVisualStyles')){const style=document.createElement('link');style.id='onboardingVisualStyles';style.rel='stylesheet';style.href='/assets/onboarding.css?v=20261123-worker-credential';document.head.append(style);}
 const info=document.createElement('p');info.className='onboarding-status';info.setAttribute('role','status');info.textContent='Consultando el progreso guardado…';dialog.append(info);

 const content=document.createElement('div');dialog.append(content);
 let state,activation='',opened=false,editingConfiguration=false;
 const manage=()=>{const a=document.createElement('a');a.className='btn';a.href='/rrhh.html?employee='+encodeURIComponent(state.employee_id||'')+'&person-tab=access';a.onclick=e=>{if(window.CartelEvolution){e.preventDefault();overlay.remove();CartelEvolution.open('access');}};a.textContent='Gestionar acceso';return a;};
 const update=async()=>{
  state=await onboardingCall(id,'read');if(!overlay.isConnected)return;
  const rolesResult=await sb.from('system_access_roles').select('id,title,code,is_active,is_catalog_role').eq('is_active',true).order('title');if(rolesResult.error)throw rolesResult.error;
  const roleList=rolesResult.data||[];
  content.replaceChildren();
  info.textContent='';
  if(state.labor_status&&state.labor_status!=='hired'){const resume=document.createElement('button');resume.textContent='Abrir WhatsApp del paso 11 para continuar';resume.onclick=()=>{overlay.remove();openHiringPreparationNotification(id);};content.append(resume);return;}
  const banner=document.createElement('div');
  banner.className='onboarding-credential-banner';
  const identity=document.createElement('div');
  const title=document.createElement('strong');
  title.textContent='Credencial del trabajador';
  const person=document.createElement('span');
  person.textContent=candidate.full_name||'Trabajador';
  identity.append(title,person);
  const progress=document.createElement('div');
  progress.className='onboarding-credential-progress';
  const step=document.createElement('span');
  step.setAttribute('aria-live','polite');
  const bars=document.createElement('div');
  bars.className='onboarding-credential-bars';
  bars.setAttribute('aria-hidden','true');
  const stepLabels=['Configurar acceso','Crear cuenta','Notificar por WhatsApp'];
  for(const label of stepLabels)bars.append(document.createElement('span'));
  const renderProgress=()=>{
   const completed=[state.configured_at||state.created_at,state.created_at,state.whatsapp_opened_at];
   const current=completed.findIndex(done=>!done);
   step.textContent=current<0?'3 de 3 · Completado':(current+1)+' de 3 · '+stepLabels[current];
   [...bars.children].forEach((bar,index)=>{
    bar.classList.toggle('is-complete',Boolean(completed[index]));
    bar.classList.toggle('is-current',index===current);
   });
  };
  renderProgress();
  progress.append(step,bars);
  banner.append(hiringReviewIcon('credential'),identity,progress);
  content.append(banner);
  if(onboardingHasAccount(state)&&!state.created_at){
   progress.hidden=true;
   info.textContent='Este trabajador ya tiene una cuenta vinculada. Puedes consultarla en Gestionar acceso.';
   content.append(manage());
   return;
  }
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
   if(!state.configured_at||editingConfiguration){
    section.append(await onboardingConfigurationForm(state,roleList,async(_mode,payload)=>{
     const latest=await onboardingCall(id,'read');
     if(onboardingHasAccount(latest))throw Error('Este trabajador ya tiene una cuenta vinculada. No se puede crear otra ni modificar la cuenta actual.');
     await onboardingCall(id,'configure',payload);
     editingConfiguration=false;
     await update();
    },()=>overlay.remove(),{editing:editingConfiguration}));
   }
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
  editor.value=(state.message||onboardingMessage(hiringGreetingName(candidate),state.username,state.email,onboardingActivationMarker)).replace(onboardingPreviousMobileInstructions,onboardingMobileInstructions).split(onboardingActivationMarker).join(activation||onboardingActivationMarker);section.append(editor);
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
    state=await onboardingCall(id,'opened');renderProgress();heading.textContent='3 · WhatsApp abierto';editor.readOnly=true;info.textContent='WhatsApp abierto. El envío no está confirmado. El progreso quedó guardado.';
    send.textContent='WhatsApp abierto';
   }catch(e){if(!opened)tab?.close();info.textContent=(opened?'WhatsApp abierto; falta guardar el progreso. ':'')+e.message;send.textContent=opened?'Reintentar registrar apertura':'Notificar vía WhatsApp';send.disabled=false;}
  };
  const renew=document.createElement('button');renew.type='button';renew.textContent='Renovar activación';renew.onclick=async()=>{if(!confirm('¿Invalidar el enlace anterior y preparar uno nuevo?'))return;renew.disabled=true;try{activation=(await onboardingEdge(id,'renew')).activation_url;await update();}catch(e){info.textContent=e.message;renew.disabled=false;}};
  actions.append(save,send,renew);
 };
 try{await update();}catch(e){info.textContent='No se pudo cargar el acceso: '+e.message;const retry=document.createElement('button');retry.textContent='Reintentar';retry.onclick=()=>{overlay.remove();openSystemOnboarding(id);};content.append(retry);}
}

async function continueHiringRoute(id){try{await onboardingCall(id,'hiring_continue');preserveCandidateSheet(id);window.CartelEvolution?.refresh();}catch(error){alert(error.message);}}
