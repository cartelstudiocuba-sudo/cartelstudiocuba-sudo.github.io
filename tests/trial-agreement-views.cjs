const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../acuerdo-periodo-prueba.html','utf8');
for(const file of ['acuerdo-periodo-prueba.html','rrhh.html','periodo-prueba.html']){
 for(const m of fs.readFileSync(__dirname+'/../'+file,'utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(m[1],{filename:file});
}
const data={role_title:'Plaza <prueba>',duration_days:7,start_date:'2026-10-30',schedule:'9–5',location:'Estudio',compensation:'100',hr_candidates:{full_name:'Candidato prueba',whatsapp:'5350000000'},representative:{name:'Representante prueba',ci:'12345678901',address:'Dirección prueba'}};
async function run(token,allowed=true){
 const calls=[],bar={style:{display:'none'}},doc={textContent:'',innerHTML:''};let init;
 const client={rpc:async(name,args)=>{calls.push({name,args});return allowed?{data:structuredClone(data)}:{error:{code:'42501'}}}};
 const ctx={URLSearchParams,location:{hash:token?'#token='+ 'a'.repeat(64):'',search:'?candidate=other-id'},localStorage:{getItem:()=>'{"name":"WRONG LOCAL REPRESENTATIVE"}'},document:{getElementById:()=>bar},doc,console,alert:()=>{},window:{print:()=>calls.push('print'),open:()=>calls.push('open')},CartelLoad:{createClient:()=>client,run:(k,f)=>init=f}};
 vm.createContext(ctx);vm.runInContext([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].at(-1)[1],ctx);await init();
 return {ctx,calls,bar,doc};
}
(async()=>{
 const candidate=await run(true);assert.equal(candidate.calls[0].name,'hr_read_trial_agreement');assert.equal(candidate.bar.style.display,'none');
 assert(candidate.doc.innerHTML.includes('Representante prueba'));assert(!candidate.doc.innerHTML.includes('WRONG LOCAL'));
 assert(candidate.doc.innerHTML.includes('Plaza &lt;prueba&gt;'));assert.equal((candidate.doc.innerHTML.match(/<h2>/g)||[]).length,14);
 await candidate.ctx.sendWhatsApp();await candidate.ctx.savePDF();assert.equal(candidate.calls.length,1);
 const admin=await run(false);assert.equal(admin.calls[0].name,'hr_trial_agreement_preview');assert.equal(admin.bar.style.display,'flex');await admin.ctx.savePDF();assert(admin.calls.includes('print'));
 const denied=await run(false,false);assert.equal(denied.bar.style.display,'none');assert(!denied.doc.innerHTML);assert(denied.doc.textContent.includes('autorizada'));
 console.log('PASS candidate isolation, no admin actions, admin preview/PDF authorization, denied access, escaping and complete contract.');
})().catch(e=>{console.error(e);process.exitCode=1});
