const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),{stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync(__dirname+'/../supabase/functions/hr-tutor-presentation/index.ts','utf8').replace(/^import .*;\r?\n/,'');
let handler,scenario='ok',uploaded=0,removed=0,reads=0;
const client={auth:{getUser:async()=>({data:{user:scenario==='unauth'?null:{id:'owner'}}})},rpc:async(name)=>{
 if(name==='hr_tutor_context')return scenario==='denied'?{error:{}}:{data:{role_id:'r'}};
 if(name==='hr_publish_tutor')return scenario==='changed'?{error:{}}:{data:{url:'https://gestion.elcartelstudio.com/presentacion-tutor.html#token='+'a'.repeat(64)}};
 if(name==='hr_resolve_tutor'){reads++;return {data:scenario==='expired'||(scenario==='revoke-during-read'&&reads>1)?null:{path:'private-secret.pdf',ext:'pdf',expires_at:'2099-01-01'}};}
},storage:{from:()=>({upload:async()=>{uploaded++;return scenario==='upload-fail'?{error:{}}:{}},remove:async()=>{removed++;return {}},download:async()=>scenario==='missing'?{error:{}}:{data:new Blob(['%PDF-1.7 test'],{type:'application/pdf'})}})}};
vm.runInNewContext(stripTypeScriptTypes(source),{createClient:()=>client,Deno:{env:{get:()=> 'fixture'},serve:f=>handler=f},Response,File,Blob,crypto,Uint8Array,TextDecoder});
const request=(body,origin='https://gestion.elcartelstudio.com')=>handler(new Request('https://service.test',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));
const publish=async(s='ok',bytes='%PDF-1.7 test')=>{scenario=s;const f=new FormData();f.append('trial_id','trial');f.append('version','v');f.append('file',new File([bytes],'presentation.pdf'));return handler(new Request('https://service.test',{method:'POST',headers:{authorization:'Bearer fixture',origin:'https://gestion.elcartelstudio.com'},body:f}));};
(async()=>{
 assert.equal((await request({action:'read',token:'a'.repeat(64)},'https://evil.test')).status,403);
 assert.equal((await request({action:'read',token:'invalid'})).status,404);
 assert.equal((await publish('unauth')).status,401);assert.equal((await publish('denied')).status,403);assert.equal(uploaded,0);
 assert.equal((await publish('ok','evil html')).status,400);assert.equal(uploaded,0);
 assert.equal((await publish('changed')).status,409);assert.equal(removed,1);
 assert.equal((await publish('upload-fail')).status,502);assert.equal((await publish()).status,200);
 scenario='expired';assert.equal((await request({action:'download',token:'a'.repeat(64)})).status,404);
 scenario='revoke-during-read';reads=0;assert.equal((await request({action:'read',token:'a'.repeat(64)})).status,404);
 scenario='missing';assert.equal((await request({action:'read',token:'a'.repeat(64)})).status,404);
 scenario='ok';const info=await request({action:'info',token:'a'.repeat(64)});assert(!JSON.stringify(await info.json()).includes('private-secret'));
 for(const action of ['read','download']){const r=await request({action,token:'a'.repeat(64)});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store, private');assert(r.headers.get('content-disposition').startsWith(action==='read'?'inline':'attachment'));assert((await r.text()).startsWith('%PDF-'));assert(![...r.headers.values()].join().includes('private-secret'));}
 console.log('PASS service: auth, authorization, origin, format, upload failures, cleanup, expiry, mid-read revocation, file absence, preview/download bytes, no internal paths');
})().catch(e=>{console.error(e);process.exitCode=1});
