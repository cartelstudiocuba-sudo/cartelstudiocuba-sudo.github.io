const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const root=path.join(__dirname,'..');
const helper=fs.readFileSync(path.join(root,'assets/trial-closure-document.js'),'utf8');
const script=fs.readFileSync(path.join(root,'assets/trial-closure.js'),'utf8');
for(const file of ['rrhh.html','plaza-ficha.html','cierre-periodo-prueba.html','gestionar-cierre-prueba.html','actualizar-expediente.html']){
 const html=fs.readFileSync(path.join(root,file),'utf8');
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))if(m[1].trim())new vm.Script(m[1]);
}
(async()=>{
 const doc=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/closure-public.json'),'utf8'));
 doc.candidate_id='candidate-exact';doc.representative={observations:'Ninguna'};
 const nodes={closure:{innerHTML:''},actClose:{},actPrint:{},actDownload:{},actLogo:{}};
 const context={URL,URLSearchParams,Intl,Date,console,setTimeout,location:{hash:'#token='+'a'.repeat(64),origin:'https://gestion.elcartelstudio.com',replace:url=>context.destination=url},window:{close:()=>{throw Error('Must return to candidate')}},document:{getElementById:id=>nodes[id]},sb:{rpc:async()=>({data:doc})},CartelLoad:{createClient:()=>({storage:{from:()=>({createSignedUrl:async()=>{throw Error('Storage unavailable')}})}})}};
 vm.createContext(context);vm.runInContext(helper+'\n'+script,context);
 await vm.runInContext('initClosurePublic(true)',context);
 assert(!/Resumen de asuntos|Ninguna/i.test(nodes.closure.innerHTML));
 assert(nodes.closure.innerHTML.includes('OCTAVA – Asuntos pendientes u observaciones'));
 assert(nodes.closure.innerHTML.includes('Este espacio se utilizará'));
 assert(nodes.closure.innerHTML.includes('Declaración final y firmas'));
 assert(nodes.closure.innerHTML.includes('cláusula «Asuntos pendientes'));
 assert(!nodes.closure.innerHTML.includes('id="actClose"'));
 // Legacy snapshots and the template/PDF renderer use the same non-mutating cleaner.
 assert(doc.template.blocks.some(b=>b.id==='tcl10'));
 const cleaned=vm.runInContext('cleanTrialClosureTemplate',context)(doc.template);
 assert(cleaned.blocks.some(b=>b.id==='tcl10'));
 assert(!cleaned.blocks.find(b=>b.id==='tcl10').text.includes('Resumen de asuntos'));
 assert(doc.template.blocks.find(b=>b.id==='tcl10').text.includes('Resumen de asuntos'));
 const plaza=fs.readFileSync(path.join(root,'plaza-ficha.html'),'utf8');
 assert(plaza.includes('f.documents=f.documents.map(cleanTrialClosureTemplate)'));
 assert(/function contractPreviewUnits\(doc\)\{\s+doc=cleanTrialClosureTemplate\(doc\);/.test(plaza));
 console.log('PASS: legacy summary field cleaned, clauses and signatures retained, removed close button absent with failed logo, inline scripts parse.');
})().catch(e=>{console.error(e);process.exitCode=1});
