'use strict';
const activationClient=CartelLoad.createClient('https://jhumvctocphyiwhszeaz.supabase.co','sb_publishable_ZHV-5dlsjfamQpfUOsgumg_G-vN84Gn',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const activationStatus=document.getElementById('activationStatus'),emailButton=document.getElementById('verifyEmail'),passwordForm=document.getElementById('activationPassword'),checkButton=document.getElementById('checkEmail'),activationLogin=document.getElementById('activationLogin');
let activationToken='',passwordCheckpoint=null,activationBusy=false;
function passwordStage(pending){for(const input of [passwordForm.elements.password,passwordForm.elements.confirm]){input.disabled=pending;input.hidden=pending;const label=document.querySelector('label[for="'+input.id+'"]');if(label)label.hidden=pending;}passwordForm.querySelector('button').textContent=pending?'Reintentar activación':'Establecer contraseña y activar';}
function uncertainActivation(){activationStatus.textContent='La contraseña se guardó, pero no se pudo confirmar el estado del acceso. Comprueba si puedes entrar a Cartel Gestión. Si no puedes, solicita a RRHH que revise el estado o la vigencia del enlace.';activationLogin.textContent='Comprobar acceso en Cartel Gestión →';activationLogin.hidden=false;}
async function activationReadiness(){const {data:{user},error}=await activationClient.auth.getUser();if(error)throw Error('No se pudo verificar la sesión. Comprueba la conexión y vuelve a intentar.');if(!user)return {user:null,ready:false};const {data,error:checkError}=await activationClient.rpc('system_onboarding_activation_ready',{p_token:activationToken});if(checkError)throw Error('No se pudo comprobar la activación. Reintenta.');return {user,ready:data===true};}
async function activationCheck(){const state=await activationReadiness();if(passwordCheckpoint&&state.user?.id!==passwordCheckpoint.userId){passwordCheckpoint=null;passwordForm.reset();passwordStage(false);passwordForm.hidden=true;throw Error('La sesión cambió. Vuelve a abrir el enlace con la cuenta correcta.');}if(state.ready){passwordForm.hidden=false;emailButton.hidden=true;checkButton.hidden=true;passwordStage(!!passwordCheckpoint);activationStatus.textContent=passwordCheckpoint?'La contraseña ya se guardó. Reintenta únicamente la confirmación del acceso.':'Correo verificado. Establece tu contraseña para activar el acceso.';return true;}passwordForm.hidden=!passwordCheckpoint;if(passwordCheckpoint)uncertainActivation();return false;}
async function initAccountActivation(){
 const params=new URLSearchParams(location.hash.slice(1)),incoming=params.get('activation');
 if(/^[a-f0-9]{64}$/.test(incoming||'')){activationToken=incoming;try{sessionStorage.setItem('cartel-onboarding-capability',incoming);}catch{}}
 else try{activationToken=sessionStorage.getItem('cartel-onboarding-capability')||'';}catch{}
 const {error}=await activationClient.auth.getSession();if(error)throw error;
 history.replaceState(null,'',location.pathname);
 if(!/^[a-f0-9]{64}$/.test(activationToken)){emailButton.hidden=true;checkButton.hidden=true;activationStatus.textContent='Abre el enlace personal que recibiste por WhatsApp. Si verificaste el correo en otro navegador, vuelve a abrir allí el enlace de WhatsApp.';return;}
 if(!await activationCheck())activationStatus.textContent='Verifica tu correo registrado. Recibirás un enlace por correo; ábrelo y después regresa aquí. Si usas otro navegador, vuelve a abrir también el enlace de WhatsApp en ese navegador.';
}
emailButton.onclick=async()=>{if(emailButton.disabled)return;emailButton.disabled=true;try{const {data,error}=await activationClient.functions.invoke('hr-onboarding',{body:{action:'activation_email',token:activationToken}});if(error||data?.error)throw Error(data?.error||'No se pudo solicitar el correo. Reintenta en un minuto.');activationStatus.textContent=data.message||'Solicitud aceptada por el servicio de correo. Revisa tu bandeja; la entrega no está confirmada desde esta pantalla.';}catch(e){activationStatus.textContent=e.message;}finally{emailButton.disabled=false;}};
checkButton.onclick=async()=>{if(checkButton.disabled)return;checkButton.disabled=true;try{if(!await activationCheck())activationStatus.textContent='El correo aún no está verificado para este acceso, o el enlace venció o ya fue utilizado. Abre el correo más reciente o solicita una nueva activación a RRHH.';}catch(e){activationStatus.textContent=e.message;}finally{checkButton.disabled=false;}};
passwordForm.onsubmit=async event=>{
 event.preventDefault();if(activationBusy)return;activationBusy=true;const button=passwordForm.querySelector('button');button.disabled=true;
 try{
  if(!passwordCheckpoint){
   if(passwordForm.elements.password.value!==passwordForm.elements.confirm.value)throw Error('Las contraseñas no coinciden.');
   if(passwordForm.elements.password.value.length<12)throw Error('Utiliza al menos 12 caracteres.');
   const state=await activationReadiness();if(!state.ready||!state.user)throw Error('Verifica primero el correo de esta cuenta.');
   const {error}=await activationClient.auth.updateUser({password:passwordForm.elements.password.value});if(error)throw Error('No se pudo confirmar el guardado de la contraseña: '+error.message);
   // Only an acknowledged password update creates this in-memory checkpoint.
   // No password or password hash is retained, and a reload does not trust a stored flag.
   passwordCheckpoint={userId:state.user.id,token:activationToken};passwordForm.reset();passwordStage(true);
  }
  const state=await activationReadiness();
  if(state.user?.id!==passwordCheckpoint.userId||passwordCheckpoint.token!==activationToken){passwordCheckpoint=null;passwordForm.reset();passwordStage(false);passwordForm.hidden=true;activationLogin.hidden=true;throw Error('La sesión cambió. Vuelve a abrir el enlace con la cuenta correcta.');}
  if(!state.ready){uncertainActivation();return;}
  const {error:finishError}=await activationClient.rpc('system_activate_onboarding',{p_token:activationToken});
  if(finishError)throw Error('La contraseña se guardó, pero no se pudo confirmar la activación. Reintenta la confirmación; no necesitas volver a cambiar la contraseña en esta pestaña.');
  passwordCheckpoint=null;passwordForm.reset();passwordForm.hidden=true;activationToken='';try{sessionStorage.removeItem('cartel-onboarding-capability');}catch{}
  activationStatus.textContent='Cuenta activada y correo verificado. Ya puedes acceder a tus funciones autorizadas.';activationLogin.textContent='Entrar a Cartel Gestión →';activationLogin.hidden=false;
 }catch(e){activationStatus.textContent=e.message;}finally{activationBusy=false;button.disabled=false;}
};
window.addEventListener('hashchange',()=>{const incoming=new URLSearchParams(location.hash.slice(1)).get('activation');if(!/^[a-f0-9]{64}$/.test(incoming||''))return;if(activationBusy){activationStatus.textContent='Hay una operación pendiente. Cuando termine, recarga para abrir el nuevo enlace.';return;}passwordCheckpoint=null;passwordForm.reset();passwordStage(false);passwordForm.hidden=true;activationLogin.hidden=true;emailButton.hidden=false;checkButton.hidden=false;CartelLoad.run('activation_link',()=>initAccountActivation().catch(e=>{activationStatus.textContent='No se pudo comprobar el enlace. '+e.message;}));});
CartelLoad.run('activation',()=>initAccountActivation().catch(e=>{activationStatus.textContent='No se pudo comprobar el enlace. '+e.message;}));
