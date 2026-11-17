/* Complete Nevera regression gate: isolated fixtures, no production commands. */
const fs=require('node:fs'),path=require('node:path'),{spawn,spawnSync}=require('node:child_process');
process.chdir(path.join(__dirname,'..'));
const syntax=fs.readdirSync('assets').filter(name=>/^fridge.*\.js$/.test(name)).map(name=>'assets/'+name).concat('supabase/functions/fridge-menu-image/handler.mjs');
for(const file of syntax){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0){console.error(r.stderr);process.exit(1);}}
const files=fs.readdirSync('tests').filter(name=>/^(fridge.*|finance-cost-sheets.*|catalog-photo\.test|mobile-navigation|mobile-navigation-selection)\.cjs$/.test(name)).sort();let next=0,passed=0;const failed=[];
function run(file){return new Promise(resolve=>{const child=spawn(process.execPath,['tests/'+file],{stdio:['ignore','pipe','pipe']}),log=[];let timedOut=false;const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},90000);child.stdout.on('data',data=>log.push(data));child.stderr.on('data',data=>log.push(data));child.on('error',error=>log.push(Buffer.from(error.message)));child.on('close',code=>{clearTimeout(timer);if(code===0&&!timedOut){passed++;console.log('PASS '+file);}else{failed.push(file);console.error('FAIL '+file+(timedOut?' (timeout)':'')+'\n'+Buffer.concat(log).toString());}resolve();});});}
async function worker(){for(;;){const index=next++;if(index>=files.length)return;await run(files[index]);}}
Promise.all(Array.from({length:3},worker)).then(()=>{console.log('Nevera: '+passed+'/'+files.length+' suites passed; '+syntax.length+' source syntax checks.');if(failed.length)process.exitCode=1;});
