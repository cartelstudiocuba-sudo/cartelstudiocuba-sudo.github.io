import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const owner = '6418ad20-d0e8-49c0-8d9a-e1da3daf71b6';
const url = Deno.env.get('SUPABASE_URL')!;
const publicKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {auth:{persistSession:false,autoRefreshToken:false}});
const allowedOrigins = new Set(['https://gestion.elcartelstudio.com','https://cartelstudiocuba-sudo.github.io']);

Deno.serve(async req => {
 const origin = req.headers.get('origin') || '';
 const headers = {'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':allowedOrigins.has(origin)?origin:'https://gestion.elcartelstudio.com','Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
 const reply = (body:unknown,status=200) => new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS') return new Response(null,{status:204,headers});
 if(req.method!=='POST') return reply({error:'Método no permitido'},405);
 if(origin && !allowedOrigins.has(origin)) return reply({error:'Origen no permitido'},403);
 try {
  const body = await req.json();
  if(body.action==='login') {
   const username = String(body.username||'').trim().toLowerCase();
   const password = typeof body.password==='string'?body.password:'';
   if(!/^[a-z0-9._-]{3,80}$/.test(username)||!password||password.length>1024) return reply({error:'Usuario o contraseña incorrectos'},401);
   const {data:e,error} = await admin.from('hr_employees').select('email,system_auth_user_id,system_access_enabled,status').eq('system_username',username).maybeSingle();
   if(error || !e?.email || !e.system_auth_user_id || !e.system_access_enabled || e.status==='terminated') return reply({error:'Usuario o contraseña incorrectos'},401);
   const client=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data,error:authError}=await client.auth.signInWithPassword({email:e.email,password});
   if(authError||data.user?.id!==e.system_auth_user_id||!data.session) return reply({error:'Usuario o contraseña incorrectos'},401);
   return reply({session:{access_token:data.session.access_token,refresh_token:data.session.refresh_token}});
  }
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  const {data:{user},error:authError}=await admin.auth.getUser(token);
  if(authError||user?.id!==owner) return reply({error:'Solo el propietario puede invitar usuarios'},403);
  if(body.action!=='invite') return reply({error:'Acción no permitida'},400);
  const client=createClient(url,publicKey,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:employee,error:prepareError}=await client.rpc('system_prepare_invitation',{employee:body.employee_id,account_email:body.email});
  if(prepareError) return reply({error:prepareError.message},400);
  // Check every page of Auth before creating an identity. Never change a password here.
  let existing=null,completed=false;
  for(let page=1;page<=100;page++) {
   const {data,error}=await admin.auth.admin.listUsers({page,perPage:100});
   if(error) throw Error('No se pudo verificar Auth; no se creó ninguna cuenta');
   existing=data.users.find(u=>u.email?.toLowerCase()===employee.email)||null;
   if(existing||data.users.length<100){completed=true;break;}
  }
  if(!completed) throw Error('Se requiere revisar Auth antes de continuar');
  if(employee.auth_id && existing?.id!==employee.auth_id) throw Error('El vínculo Auth requiere revisión');
  let invited=false;
  if(!existing) {
   const {data,error}=await admin.auth.admin.inviteUserByEmail(employee.email,{redirectTo:'https://gestion.elcartelstudio.com/reset-password.html'});
   if(error||!data.user) throw Error('No se pudo enviar la invitación. Revise la configuración de correo de Auth y reintente; la cuenta no se duplicará.');
   existing=data.user;invited=true;
  }
  const {error:bindError}=await client.rpc('system_bind_account',{employee:employee.employee_id,target_user:existing.id});
  if(bindError) throw Error('Auth verificado, pero no se pudo vincular el expediente. Reintente; no se creará otra cuenta.');
  return reply({invited,confirmed:!!existing.email_confirmed_at,message:invited?'Invitación enviada. El trabajador establecerá su contraseña.':existing.email_confirmed_at?'Cuenta Auth existente vinculada sin duplicarla.':'Cuenta Auth existente vinculada; confirmación de correo pendiente.'});
 } catch {
  return reply({error:'No se pudo completar la operación. Revise Auth y el correo individual del expediente antes de reintentar.'},400);
 }
});
