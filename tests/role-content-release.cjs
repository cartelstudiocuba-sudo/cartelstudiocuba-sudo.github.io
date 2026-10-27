const https=require('https'),fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const get=url=>new Promise((resolve,reject)=>https.get(url,{headers:{'User-Agent':'Cartel-pagination-verification','Cache-Control':'no-cache'}},r=>{r.setEncoding('utf8');let body='';r.on('data',c=>body+=c);r.on('end',()=>resolve({status:r.statusCode,body}));}).on('error',reject));
(async()=>{
 const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 const runs=await get('https://api.github.com/repos/cartelstudiocuba-sudo/cartelstudiocuba-sudo.github.io/actions/runs?head_sha='+sha);
 console.log(JSON.stringify({sha,runs:JSON.parse(runs.body).workflow_runs?.map(r=>({status:r.status,conclusion:r.conclusion,url:r.html_url}))}));
 for(const file of ['plaza-ficha.html','assets/role-content-layout.js','assets/training-content-public.js','assets/training-content-public.css']){
  const result=await get('https://gestion.elcartelstudio.com/'+file+'?release='+sha+'&t='+Date.now());
  const exact=result.body.replace(/\r/g,'')===fs.readFileSync(path.join(root,file),'utf8').replace(/\r/g,'');
  console.log(JSON.stringify({file,http:result.status,exact}));if(result.status!==200||!exact)process.exitCode=1;
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
