const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
for(const file of ['rrhh.html','entrevistas.html','aplicar.html']){
 for(const match of read(file).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(match[1],{filename:file});
}
function extract(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert(a>=0&&b>a);return source.slice(a,b)}
(async()=>{
 const interviews=read('entrevistas.html');
 const pages=[Array.from({length:1000},(_,id)=>({id})),[{id:1000,answer:'recent candidate'}]];
 const ranges=[];
 const ctx={sb:{from:()=>({select:()=>({order:()=>({range:async(a,b)=>{ranges.push([a,b]);return {data:pages[ranges.length-1],error:null}}})})})}};
 vm.createContext(ctx);
 vm.runInContext(extract(interviews,'async function fetchInterviewAnswers()','const Q='),ctx);
 const result=await ctx.fetchInterviewAnswers();
 assert.equal(result.data.length,1001);assert.equal(result.data[1000].answer,'recent candidate');
 assert.deepEqual(ranges,[[0,999],[1000,1999]]);
 ctx.sb.from=()=>({select:()=>({order:()=>({range:async()=>({data:null,error:{message:'denied'}})})})});
 assert.equal((await ctx.fetchInterviewAnswers()).error.message,'denied');
 const roleContext={vacancies:[{id:'operativo',title:'Gestor Operativo'}]};vm.createContext(roleContext);
 vm.runInContext(extract(interviews,'function interviewRole(x)','async function fetchInterviewAnswers'),roleContext);
 assert.equal(roleContext.interviewRole({vacancy_id:'operativo'}),'Gestor Operativo');
 assert.equal(roleContext.interviewRole({vacancy_id:'missing'}),'Plaza no indicada');
 const rrhh=read('rrhh.html');let dashboardRenders=0,modalRefreshes=0;
 const modal={classList:{contains:()=>true},dataset:{view:'overview',mode:'preselected'}};
 const renderContext={document:{body:{classList:{contains:()=>true}}},$:()=>modal,renderCandidateDashboard:()=>dashboardRenders++,openOverviewCandidates:mode=>{assert.equal(mode,'preselected');modalRefreshes++}};
 vm.createContext(renderContext);vm.runInContext(extract(rrhh,'function render(){','const gestorKeys='),renderContext);renderContext.render();
 assert.equal(dashboardRenders,1);assert.equal(modalRefreshes,1);
 const steps=Array.from({length:4},()=>({classList:{toggle(){}},dataset:{}}));
 const stepContext={steps,step:2,bar:{style:{}},syncReferralOther(){},scrollTo(){}};vm.createContext(stepContext);
 vm.runInContext(extract(read('aplicar.html'),'function show(){','function '),stepContext);
 stepContext.show();assert.equal(steps[2].dataset.stepNumber,'3');assert.equal(stepContext.bar.style.width,'75%');
 console.log('PASS: inline script syntax, paginated answers, read errors, vacancy titles, dashboard refresh, step numbering');
})().catch(error=>{console.error(error);process.exitCode=1});
