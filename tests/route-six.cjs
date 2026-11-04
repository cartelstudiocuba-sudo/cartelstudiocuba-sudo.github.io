const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/julio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),live=process.argv.includes('--live');
let mock=fs.readFileSync(path.join(__dirname,'interview-navigation.cjs'),'utf8').split('const mock=`')[1].split('`;')[0];
mock=mock.replace('auth:{','storage:{from:()=>({createSignedUrl:async()=>({data:null})})},auth:{').replace('select(){return q}','select(){return q},limit(){return q},range(){return q}');
(async()=>{
 assert.equal(fs.readFileSync(path.join(root,'rrhh.html'),'utf8'),fs.readFileSync(path.join(root,'rrhh-20261101.html'),'utf8'));
 const browser=await chromium.launch({headless:true,channel:'msedge'});const results=[];
 try{
 for(const width of [1440,1024,768,390,320])for(const entry of ['rrhh.html','rrhh-20261101.html']){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',ignoreHTTPSErrors:true});const page=await context.newPage();let writes=0;const errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});
 await context.route('**/*',async r=>{
 const u=new URL(r.request().url());
 if(u.pathname.includes('/assets/vendor/supabase'))return r.fulfill({contentType:'text/javascript',body:mock});
 if(r.request().method()!=='GET'){writes++;return r.abort();}
 if(u.hostname.includes('supabase'))return r.abort();
 if(!['gestion.elcartelstudio.com','isolated.test'].includes(u.hostname))return r.fulfill({body:''});
 if(live)return r.continue();
 const file=path.join(root,decodeURIComponent(u.pathname));return fs.existsSync(file)&&fs.statSync(file).isFile()?r.fulfill({path:file}):r.fulfill({status:404,body:''});
 });
 const url=(live?'https://gestion.elcartelstudio.com/':'http://isolated.test/')+entry+'?embedded=1&candidate=SIMULATED&verify=route-six';
 const response=await page.goto(url);assert.equal(response.status(),200);
 if(live){const served=(await response.text()).replace(/\r\n/g,'\n');assert.equal(served,fs.readFileSync(path.join(root,entry),'utf8').replace(/\r\n/g,'\n'),'published HTML matches');}
 await page.waitForFunction(()=>typeof openDetail==='function');await page.waitForTimeout(700);
 await page.evaluate(()=>{
 candidates=[{id:'SIMULATED',full_name:'Persona Simulada · Verificación visual',status:'hired',vacancy_id:'V',role_title:'Plaza de verificación'}];
 interviews=[];hiringCases.SIMULATED={notified_at:'2026-11-04'};
 const q={select(){return q},eq(){return q},is(){return q},order(){return q},limit(){return q},maybeSingle:async()=>({data:null}),single:async()=>({data:null}),then(a,b){return Promise.resolve({data:[]}).then(a,b)}};sb.from=()=>q;
 analysis=()=>{};openDetail('SIMULATED');CartelLoad.clearNotice();
 });
 await page.locator('#detail .candidate-flow').waitFor();
 const steps=page.locator('#detail .candidate-flow-step');assert.equal(await steps.count(),6);
 assert((await steps.nth(4).getAttribute('class')).includes('current'));assert((await steps.nth(5).innerText()).includes('Baja'));
 assert.equal(await page.locator('#detail .route-flow-arrow').count(),5);
 const metrics=await page.locator('#detail .candidate-flow-steps').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,display:getComputedStyle(el).display,boxes:[...el.querySelectorAll('.route-icon')].map(n=>{const b=n.getBoundingClientRect();return {x:b.x,right:b.right,y:b.y}}),gray:getComputedStyle(el.querySelector('.candidate-flow-step:last-child .route-icon')).color}));
 assert(metrics.scroll<=metrics.width+1,JSON.stringify(metrics));assert.equal(metrics.display,'grid');assert.equal(metrics.gray,'rgb(164, 173, 184)');
 for(const b of metrics.boxes){assert(b.x>=0&&b.right<=width,JSON.stringify(metrics));}if(width>600)assert(metrics.boxes.every(b=>Math.abs(b.y-metrics.boxes[0].y)<1));
 assert((await page.locator('.candidate-flow-next').innerText()).includes('12 · Inserción en sistema'));
 if([1440,390].includes(width)&&entry==='rrhh.html')await page.screenshot({path:path.join(root,'test-results',`route-six-${live?'published':'local'}-${width}.png`)});
 assert.equal(writes,0);assert.deepEqual(errors,[]);results.push({width,entry,...metrics});await context.close();
 }
 }finally{await browser.close();}
 fs.writeFileSync(path.join(root,'test-results',`route-six-${live?'published':'local'}.json`),JSON.stringify(results,null,2));console.log('PASS',results.length,'real browser layouts; six stages; no overflow; step 12 preserved; zero data writes');
})().catch(e=>{console.error(e);process.exitCode=1;});
