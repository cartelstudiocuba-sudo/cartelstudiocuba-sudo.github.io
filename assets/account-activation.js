'use strict';
const activationClient=CartelLoad.createClient('https://jhumvctocphyiwhszeaz.supabase.co','sb_publishable_ZHV-5dlsjfamQpfUOsgumg_G-vN84Gn',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const activationStatus=document.getElementById('activationStatus'),emailButton=document.getElementById('verifyEmail'),passwordForm=document.getElementById('activationPassword'),checkButton=document.getElementById('checkEmail');
let activationToken='';
async function activationCheck(){
 passwordForm.hidden=true;
 const {data:{user},error}=await activationClient.auth.getUser();
 if(error||!user)return false;
 const {data,error:checkError}=await activationClient.rpc('system_onboarding_activation_ready',{p_token:activationToken});
 if(checkError)throw Error('No se pudo comprobar la activación. Reintenta.');
 if(data){passwordForm.hidden=false;emailButton.hidden=true;checkButton.hidden=true;activationStatus.textContent='Correo verificado. Establece tu contraseña para activar el acceso.';return true;}
 return false;
}
async function initAccountActivation(){
 const params=new URLSearchParams(location.hash.slice(1)),incoming=params.get('activation');
 if(/^[a-f0-9]{64}$/.test(incoming||'')){activationToken=incoming;try{sessionStorage.setItem('cartel-onboarding-capability',incoming);}catch{}}
 else try{activationToken=sessionStorage.getItem('cartel-onboarding-capability')||'';}catch{}
 // Supabase consumes its email callback before the fragment is removed.
 const {error}=await activationClient.auth.getSession();if(error)throw error;
 history.replaceState(null,'',location.pathname);
 if(!/^[a-f0-9]{64}$/.test(activationToken)){emailButton.hidden=true;checkButton.hidden=true;activationStatus.textContent='Abre el enlace personal que recibiste por WhatsApp. Si verificaste el correo en otro navegador, vuelve a abrir allí el enlace de WhatsApp.';return;}
 if(!await activationCheck())activationStatus.textContent='Verifica tu correo registrado. Recibirás un enlace por correo; ábrelo y después regresa aquí. Si usas otro navegador, vuelve a abrir también el enlace de WhatsApp en ese navegador.';
}
emailButton.onclick=async()=>{emailButton.disabled=true;try{const {data,error}=await activationClient.functions.invoke('hr-onboarding',{body:{action:'activation_email',token:activationToken}});if(error||data?.error)throw Error(data?.error||'No se pudo solicitar el correo. Reintenta en un minuto.');activationStatus.textContent=data.message;}catch(e){activationStatus.textContent=e.message;}finally{emailButton.disabled=false;}};
checkButton.onclick=async()=>{checkButton.disabled=true;try{if(!await activationCheck())activationStatus.textContent='El correo aún no está verificado para este acceso, o el enlace venció o ya fue utilizado. Abre el correo más reciente o solicita una nueva activación a RRHH.';}catch(e){activationStatus.textContent=e.message;}finally{checkButton.disabled=false;}};
passwordForm.onsubmit=async event=>{
 event.preventDefault();const button=passwordForm.querySelector('button');button.disabled=true;
 try{
  if(passwordForm.elements.password.value!==passwordForm.elements.confirm.value)throw Error('Las contraseñas no coinciden.');
  if(passwordForm.elements.password.value.length<12)throw Error('Utiliza al menos 12 caracteres.');
  if(!await activationCheck())throw Error('Verifica primero el correo de esta cuenta.');
  const {error}=await activationClient.auth.updateUser({password:passwordForm.elements.password.value});if(error)throw Error('No se pudo guardar la contraseña: '+error.message);
  const {error:finishError}=await activationClient.rpc('system_activate_onboarding',{p_token:activationToken});if(finishError)throw Error('La contraseña se guardó, pero la activación no se completó. Reintenta o solicita un enlace vigente a RRHH.');
  passwordForm.reset();passwordForm.hidden=true;activationToken='';try{sessionStorage.removeItem('cartel-onboarding-capability');}catch{}
  activationStatus.textContent='Cuenta activada y correo verificado. Ya puedes acceder a tus funciones autorizadas.';document.getElementById('activationLogin').hidden=false;
 }catch(e){activationStatus.textContent=e.message;}finally{button.disabled=false;}
};
CartelLoad.run('activation',()=>initAccountActivation().catch(e=>{activationStatus.textContent='No se pudo comprobar el enlace. '+e.message;}));
