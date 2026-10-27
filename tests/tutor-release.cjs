const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..'),repo='cartelstudiocuba-sudo/cartelstudiocuba-sudo.github.io';
(async()=>{
 const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 const runs=await(await fetch('https://api.github.com/repos/'+repo+'/actions/runs?head_sha='+sha)).json();console.log(JSON.stringify({sha,runs:runs.workflow_runs?.map(r=>({status:r.status,conclusion:r.conclusion,url:r.html_url}))}));
 for(const file of ['rrhh.html','plaza-ficha.html','presentacion-tutor.html','assets/tutor-presentation.js','assets/tutor-presentation-view.js']){
  const r=await fetch('https://gestion.elcartelstudio.com/'+file+'?release='+sha,{cache:'no-store'});assert.equal(r.status,200,file);
  assert.equal((await r.text()).replace(/\r/g,''),fs.readFileSync(path.join(root,file),'utf8').replace(/\r/g,''),file+' deployment mismatch');console.log('MATCH',file);
 }
 const endpoint='https://jhumvctocphyiwhszeaz.supabase.co/functions/v1/hr-tutor-presentation';
 for(const action of ['info','read','download']){const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,token:'0'.repeat(64)})});assert.equal(r.status,404);assert.equal(r.headers.get('cache-control'),'no-store, private');assert(!JSON.stringify(await r.json()).includes('storage'));}
 const form=new FormData();form.append('trial_id','00000000-0000-4000-8000-000000000000');form.append('file',new Blob(['%PDF-1.7 fixture']),'test.pdf');assert.equal((await fetch(endpoint,{method:'POST',body:form})).status,401);
 console.log('PASS deployed exact assets; live invalid info/read/download and unauthenticated publication rejected; no messages sent');
})().catch(e=>{console.error(e);process.exitCode=1});
