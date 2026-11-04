const assert=require('node:assert/strict');
const base='https://jhumvctocphyiwhszeaz.supabase.co',publicKey='sb_publishable_ZHV-5dlsjfamQpfUOsgumg_G-vN84Gn';
(async()=>{
 const endpoint=base+'/functions/v1/hr-onboarding';
 let r=await fetch(endpoint);assert.equal(r.status,405);
 r=await fetch(endpoint,{method:'OPTIONS',headers:{origin:'https://gestion.elcartelstudio.com'}});assert.equal(r.status,204);
 for(const body of [{action:'provision',candidate_id:'00000000-0000-4000-8000-000000000000'},{action:'activation_email',token:'invalid'}]){
  r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',apikey:publicKey},body:JSON.stringify(body)});assert.equal(r.status,body.action==='provision'?403:400);const b=await r.json();assert(b.error);assert(!b.activation_url);
 }
 r=await fetch(base+'/rest/v1/rpc/system_onboarding',{method:'POST',headers:{apikey:publicKey,'content-type':'application/json'},body:JSON.stringify({p_candidate:'00000000-0000-4000-8000-000000000000'})});assert([401,403].includes(r.status));
 console.log('PASS: live Edge 405/204, unauthorized provisioning rejected, malformed activation rejected, anonymous RPC rejected. No identities created, candidates changed or messages sent.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
