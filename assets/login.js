const sb=CartelLoad.createClient('https://jhumvctocphyiwhszeaz.supabase.co','sb_publishable_ZHV-5dlsjfamQpfUOsgumg_G-vN84Gn',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const form=document.getElementById('loginForm'),btn=document.getElementById('btn'),err=document.getElementById('error');
function showError(message){err.textContent=message;err.style.display='block';}
form.addEventListener('submit',async event=>{
 event.preventDefault();err.style.display='none';btn.disabled=true;btn.textContent='Entrando…';
 const username=document.getElementById('email').value.trim().toLowerCase(),password=document.getElementById('password').value;
 try{
  let result;
  if(username.includes('@'))result=await sb.auth.signInWithPassword({email:username,password});
  else{
   const r=await sb.functions.invoke('system-account',{body:{action:'login',username,password}});
   if(r.error||r.data?.error||!r.data?.session)throw Error('Usuario o contraseña incorrectos.');
   result=await sb.auth.setSession(r.data.session);
  }
  if(result.error||!result.data?.session)throw Error('Usuario o contraseña incorrectos, o correo sin confirmar.');
  const access=await sb.rpc('system_has_permission',{module:'rrhh',operation:'read'});
  if(access.error)throw Error('No se pudieron comprobar tus permisos. Inténtalo nuevamente.');
  const next=new URLSearchParams(location.search).get('next');
  const destination=next?new URL(next,location.origin):null;
  location.replace(access.data&&destination?.origin===location.origin?destination.href:'/dashboard.html');
 }catch(e){showError(e.message||'No se pudo iniciar sesión. Inténtalo nuevamente.');}
 finally{document.getElementById('password').value='';btn.disabled=false;btn.textContent='Entrar →';}
});
