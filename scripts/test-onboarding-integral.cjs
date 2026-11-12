// Offline regression matrix. Browser requests are intercepted by the selected suites.
// npm ci first; optional PLAYWRIGHT_MODULE/PGLITE_MODULE support bundled runtimes.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results/onboarding-integral');
const suites=['recruitment-regressions','questionnaire-resilience','interview-navigation','interview-completion','evolution-stage-back','trial-visible-flow','trial-closure-browser','training-content-browser','hiring-current-transition-sql','hiring-flow-sql','hiring-whatsapp-browser','hiring-review-browser','hiring-submission-browser','contract-paper-browser','step12-return-sql','step12-return-browser','onboarding-fresh-browser','onboarding-sql','onboarding-edge','roles-individual-sql','roles-individual-browser','public-capability-session','session-boundary','logout-modal'];
if(process.argv.includes('--list')){console.log(suites.join('\n'));process.exit(0);}
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',');
if(only?.some(n=>!suites.includes(n)))throw Error('Unknown suite');
const selected=only||suites,results=[];fs.mkdirSync(out,{recursive:true});
const env={...process.env};
for(const [key,module] of [['PGLITE_MODULE','@electric-sql/pglite'],['PLAYWRIGHT_MODULE','playwright']])if(!env[key])env[key]=require.resolve(module);
let next=0;
async function worker(){while(next<selected.length){const name=selected[next++];await new Promise(resolve=>{
 const start=Date.now(),child=cp.spawn(process.execPath,['tests/'+name+'.cjs'],{cwd:root,env});let log='',timedOut=false;
 child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);
 const timer=setTimeout(()=>{timedOut=true;if(process.platform==='win32')cp.spawn('taskkill',['/PID',String(child.pid),'/T','/F']);else child.kill('SIGKILL');},600000);
 child.on('close',(code,signal)=>{clearTimeout(timer);fs.writeFileSync(path.join(out,name+'.log'),log);results.push({name,code,signal,timedOut,ms:Date.now()-start});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({base:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),selected,results},null,2));console.log((code===0?'PASS ':'FAIL ')+name);resolve();});
 });}}
Promise.all([worker(),worker()]).then(()=>{if(results.some(r=>r.code!==0))process.exitCode=1;});
