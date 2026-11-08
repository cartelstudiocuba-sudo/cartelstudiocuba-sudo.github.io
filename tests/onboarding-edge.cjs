const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const source=fs.readFileSync(require('path').join(__dirname,'../supabase/functions/hr-onboarding/index.ts'),'utf8').replace(/\r\n/g,'\n').replace(/^import .*\n/,'');
const owner='6418ad20-d0e8-49c0-8d9a-e1da3daf71b6',candidate='20000000-0000-4000-8000-000000000001',uid='10000000-0000-4000-8000-000000000002';
const messageContext={};vm.createContext(messageContext);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../assets/onboarding.js'),'utf8'),messageContext);
assert.equal(messageContext.onboardingMessage('[Nombre]','[Nombre de usuario]','[Correo registrado]','[Enlace seguro de activación]','[Enlace a la guía para Android y iPhone]').replace(/\*/g,''),fs.readFileSync(require('path').join(__dirname,'fixtures/onboarding-message.txt'),'utf8').replace(/\r\n/g,'\n').trimEnd());
function harness(){
 const state={authId:null,users:[],createCalls:0,mails:0,lease:null,cipher:null,expires:null,bindFail:false,lookupFail:false,other:false,roles:[],busy:false};let handler;
 const admin={auth:{getUser:async token=>({data:{user:token==='owner'?{id:owner}:token==='other'?{id:uid}:null},error:null}),admin:{listUsers:async()=>state.lookupFail?{error:{message:'unavailable'}}:{data:{users:state.users}},createUser:async input=>{state.createCalls++;assert.equal(input.email_confirm,false);assert.equal(input.password,undefined);const user={id:uid,email:input.email};state.users.push(user);return {data:{user}};}}},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:state.other?{id:'other'}:null,error:null})})})}),rpc:async(name,args)=>{
  if(args.p_action==='email'){state.emailHash=args.p_payload.hash;return {data:{email:'persona@example.invalid'}};}
  if(args.p_action==='bind'){if(state.bindFail)return {error:{message:'Vínculo pendiente; reintenta'}};state.authId=args.p_payload.auth_id;state.cipher=args.p_payload.cipher;state.hash=args.p_payload.hash;state.expires=new Date(Date.now()+86400000).toISOString();state.lease=null;return {data:{expires_at:state.expires}};}
  throw Error('unexpected service call');
 }};
 const client={rpc:async(name,args)=>{if(args.p_action==='acquire'){if(state.lease)return {error:{message:'Operación en curso'}};state.lease='lease';return {data:{lease:'lease',employee_id:'employee',email:'persona@example.invalid',auth_id:state.authId,created_at:state.authId?'now':null,cipher:state.cipher,expires_at:state.expires}};}if(args.p_action==='release'){state.lease=null;return {data:{}};}throw Error('unexpected owner call');}};
 const createClient=(_url,key,options)=>key==='server-secret'?admin:options?.global?client:{auth:{signInWithOtp:async input=>{state.mails++;assert.equal(input.options.shouldCreateUser,false);assert.equal(input.options.emailRedirectTo,'https://gestion.elcartelstudio.com/reset-password.html');return {error:null};}}};
 vm.runInNewContext(source,{createClient,crypto:webcrypto,TextEncoder,TextDecoder,Request,Response,URL,Set,JSON,Date,Uint8Array,Error,Deno:{env:{get:name=>({SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'server-secret'})[name]},serve:fn=>handler=fn}});
 const call=async(body,token='owner',origin='https://gestion.elcartelstudio.com',method='POST')=>{const response=await handler(new Request('https://example.invalid',{method,headers:{origin,authorization:'Bearer '+token},...(method==='POST'?{body:JSON.stringify(body)}:{})}));return {status:response.status,data:response.status===204?null:await response.json(),headers:response.headers};};
 return {state,call};
}
(async()=>{
 const {state,call}=harness();
 assert.equal((await call({action:'provision',candidate_id:candidate},'other')).status,403);assert.equal(state.createCalls,0);
 assert.equal((await call({action:'provision',candidate_id:candidate},'owner','https://evil.invalid')).status,403);
 assert.equal((await call({},'owner','https://gestion.elcartelstudio.com','OPTIONS')).status,204);
 state.lookupFail=true;assert.equal((await call({action:'provision',candidate_id:candidate})).status,400);assert.equal(state.createCalls,0);assert.equal(state.lease,null);state.lookupFail=false;
 state.bindFail=true;assert.equal((await call({action:'provision',candidate_id:candidate})).status,400);assert.equal(state.createCalls,1);assert.equal(state.mails,0);assert.equal(state.lease,null);state.bindFail=false;
 const provision=await call({action:'provision',candidate_id:candidate});assert.equal(provision.status,200);assert.equal(state.createCalls,1);assert.equal(state.mails,0);
 const raw=provision.data.activation_url.split('=')[1];assert.match(raw,/^[a-f0-9]{64}$/);assert(!state.cipher.includes(raw));assert(!JSON.stringify(state).includes(provision.data.activation_url));
 assert.equal((await call({action:'preview',candidate_id:candidate})).data.activation_url,provision.data.activation_url);assert.equal(state.createCalls,1);
 const renewed=await call({action:'renew',candidate_id:candidate});assert.equal(renewed.status,200);assert.notEqual(renewed.data.activation_url,provision.data.activation_url);assert.equal(state.createCalls,1);
 const mail=await call({action:'activation_email',token:renewed.data.activation_url.split('=')[1]},'');assert.equal(mail.status,200);assert.equal(state.mails,1);assert(!JSON.stringify(mail.data).includes('persona@example.invalid'));
 const other=harness();other.state.users=[{id:uid,email:'persona@example.invalid'}];other.state.other=true;assert.equal((await other.call({action:'provision',candidate_id:candidate})).status,400);assert.equal(other.state.createCalls,0);
 state.expires='2000-01-01';assert.equal((await call({action:'preview',candidate_id:candidate})).status,400);assert.equal(state.lease,null);
 console.log('PASS: Edge authorization, origin, preflight, Auth failure, partial bind recovery, no duplicate account, no provisioning email/password, encrypted resumable capability, renewal, cross-employee rejection, email verification request and expiry. All services simulated.');
})().catch(e=>{console.error(e);process.exitCode=1});
