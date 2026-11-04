import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const url=Deno.env.get('SUPABASE_URL');
const key=Deno.env.get('SUPABASE_ANON_KEY');
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const owner='6418ad20-d0e8-49c0-8d9a-e1da3daf71b6';
const site='https://gestion.elcartelstudio.com';
const origins=new Set([site,'https://cartelstudiocuba-sudo.github.io']);
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url,secret,options);
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const digest=async text=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))));
// Recover the same unexpired link on retry without storing a plaintext bearer token.
async function cryptKey(){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret+':cartel-onboarding-v1')),{name:'AES-GCM'},false,['encrypt','decrypt']);}
async function seal(token,candidate){const iv=crypto.getRandomValues(new Uint8Array(12));const body=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(candidate)},await cryptKey(),new TextEncoder().encode(token)));return hex(iv)+hex(body);}
async function unseal(cipher,candidate){if(!/^[a-f0-9]+$/.test(cipher||'')||cipher.length<56)throw Error('Renueva el enlace de activación');const bytes=Uint8Array.from(cipher.match(/../g),x=>parseInt(x,16));return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12),additionalData:new TextEncoder().encode(candidate)},await cryptKey(),bytes.slice(12)));}
async function rpc(client,name,args){const {data,error}=await client.rpc(name,args);if(error)throw Error(error.message);return data;}
async function findUser(email){
 for(let page=1;page<=100;page++){
  const {data,error}=await admin.auth.admin.listUsers({page,perPage:100});
  if(error)throw Error('No se pudo comprobar Auth; reintenta');
  const user=data.users.find(u=>u.email?.toLowerCase()===email.toLowerCase());
  if(user)return user;if(data.users.length<100)return null;
 }
 throw Error('Auth requiere revisión administrativa');
}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Access-Control-Allow-Origin':origins.has(origin)?origin:site,'Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Método no permitido'},405);
 if(origin&&!origins.has(origin))return reply({error:'Origen no permitido'},403);
 let client,lease,candidate;
 try{
  if(Number(req.headers.get('content-length')||0)>16000)return reply({error:'Solicitud demasiado grande'},413);
  const raw=await req.text();if(raw.length>16000)return reply({error:'Solicitud demasiado grande'},413);
  const body=JSON.parse(raw);
  if(body.action==='activation_email'){
   if(!/^[a-f0-9]{64}$/.test(body.token||''))return reply({error:'Enlace no válido, vencido o ya utilizado'},400);
   const data=await rpc(admin,'system_onboarding_service',{p_candidate:null,p_action:'email',p_payload:{hash:await digest(body.token)}});
   const mail=createClient(url,key,options);
   // Reuse the redirect already used by system-account; no Auth-wide URL change.
   const {error}=await mail.auth.signInWithOtp({email:data.email,options:{shouldCreateUser:false,emailRedirectTo:site+'/reset-password.html'}});
   if(error)throw Error('No se pudo enviar la verificación al correo registrado. Espera un minuto y reintenta.');
   return reply({message:'Revisa tu correo y abre el enlace de verificación. Después regresa a esta pantalla para establecer tu contraseña.'});
  }
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  const {data:{user},error}=await admin.auth.getUser(token);
  if(error||user?.id!==owner)return reply({error:'Solo el propietario puede preparar accesos'},403);
  if(!['provision','preview','renew'].includes(body.action))return reply({error:'Acción no permitida'},400);
  candidate=String(body.candidate_id||'');
  if(!/^[a-f0-9-]{36}$/.test(candidate))return reply({error:'Candidatura no válida'},400);
  client=createClient(url,key,{...options,global:{headers:{Authorization:'Bearer '+token}}});
  const prepared=await rpc(client,'system_onboarding',{p_candidate:candidate,p_action:'acquire',p_payload:{}});lease=prepared.lease;
  if(prepared.cipher&&Date.parse(prepared.expires_at)>Date.now()&&body.action!=='renew'){
   const activation=await unseal(prepared.cipher,candidate);
   await rpc(client,'system_onboarding',{p_candidate:candidate,p_action:'release',p_payload:{lease}});lease=null;
   return reply({activation_url:site+'/activar-cuenta.html#activation='+activation,expires_at:prepared.expires_at});
  }
  if(body.action==='preview')throw Error('El enlace venció. Utiliza Renovar activación.');
  let target=await findUser(prepared.email);
  if(prepared.auth_id&&target?.id!==prepared.auth_id)throw Error('El vínculo Auth requiere revisión; no se modificó la cuenta');
  if(!target){
   // No permanent password and no email is sent during provisioning.
   const {data,error}=await admin.auth.admin.createUser({email:prepared.email,email_confirm:false});
   if(error){target=await findUser(prepared.email);if(!target)throw Error('No se pudo crear Auth. Reintenta; se comprobará la identidad antes de crear otra cuenta.');}
   else target=data.user;
  }
  if(!target||target.id===owner)throw Error('Identidad protegida');
  // Never attach a pre-existing account belonging to another employee.
  const {data:bound,error:lookupError}=await admin.from('hr_employees').select('id').eq('system_auth_user_id',target.id).maybeSingle();
  if(lookupError||bound&&bound.id!==prepared.employee_id)throw Error('Cuenta vinculada a otro trabajador; requiere revisión');
  const activation=hex(crypto.getRandomValues(new Uint8Array(32)));
  const result=await rpc(admin,'system_onboarding_service',{p_candidate:candidate,p_action:'bind',p_payload:{lease,auth_id:target.id,hash:await digest(activation),cipher:await seal(activation,candidate)}});lease=null;
  return reply({activation_url:site+'/activar-cuenta.html#activation='+activation,expires_at:result.expires_at});
 }catch(e){
  // Error messages never include passwords, Auth tokens or capability links.
  const message=e instanceof Error?e.message:'No se pudo completar la operación';
  return reply({error:message.length<300?message:'No se pudo completar la operación; reintenta'},400);
 }finally{
  if(lease&&client)try{await rpc(client,'system_onboarding',{p_candidate:candidate,p_action:'release',p_payload:{lease}});}catch{/* Lease expires; retries cannot duplicate an Auth identity. */}
 }
});
