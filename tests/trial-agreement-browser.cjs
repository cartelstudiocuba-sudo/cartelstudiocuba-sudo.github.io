const fs=require('fs'),assert=require('node:assert/strict'),cp=require('child_process');
const {chromium}=require('C:/Users/julio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=require('path').join(__dirname,'..');
const html=fs.readFileSync(root+'/acuerdo-periodo-prueba.html','utf8');
const old=cp.execFileSync('git',['show','HEAD:acuerdo-periodo-prueba.html'],{cwd:root,encoding:'utf8'});
assert.equal(html.split('doc.innerHTML=`')[1].split('`;')[0].replace(/\r/g,''),old.split('doc.innerHTML=`')[1].split('`;')[0].replace(/\r/g,''),'Contract template must remain identical');
const data={role_title:'Plaza de prueba',duration_days:7,start_date:'2026-10-30',schedule:'9:00–17:00',location:'Estudio',compensation:'Remuneración de prueba',hr_candidates:{full_name:'Persona de prueba'},representative:{name:'Representante de prueba',ci:'12345678901',address:'Dirección de prueba'}};
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
fs.mkdirSync(root+'/../outputs/contrato-vistas',{recursive:true});
for(const width of [390,1280])for(const admin of [false,true]){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:html.replace(/<script src="[^"]+"><\/script>/g,'')}));
 await page.addInitScript(d=>{window.CartelLoad={createClient:()=>({rpc:async()=>({data:d})}),run:(k,f)=>f()};},data);
 await page.goto('https://agreement.test/acuerdo-periodo-prueba.html'+(admin?'?candidate=test':'#token='+'a'.repeat(64)));
 await page.locator('#doc h1').waitFor();assert.equal(await page.locator('.bar').isVisible(),admin);
 assert.equal(await page.locator('#doc h2').count(),14);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:root+'/../outputs/contrato-vistas/'+(admin?'rrhh':'candidato')+'-'+width+'.jpg',type:'jpeg',quality:50,fullPage:true});
 if(width===1280&&!admin){await page.emulateMedia({media:'print'});assert.equal(await page.locator('.bar').isVisible(),false);await page.pdf({path:root+'/../outputs/contrato-vistas/contrato-prueba.pdf',format:'A4'});}
 await page.close();
}await browser.close();console.log('PASS browser: mobile/desktop, admin/candidate, printable PDF, unchanged full contract template.');})().catch(e=>{console.error(e);process.exitCode=1});
