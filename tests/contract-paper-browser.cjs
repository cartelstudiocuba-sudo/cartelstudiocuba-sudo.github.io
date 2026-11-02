const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/julio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const output=path.join(root,'test-results/contract-paper');fs.mkdirSync(output,{recursive:true});
const contract=process.env.CONTRACT_REAL_FIXTURE?JSON.parse(fs.readFileSync(process.env.CONTRACT_REAL_FIXTURE,'utf8')):{renderer_version:2,role:{title:'Plaza de prueba',work_content:{}},nomenclators:[],template:{key:'employment_contract',title:'Contrato de prueba',blocks:[{id:'p',source:'candidate',title:'Identificación del trabajador'},{id:'c',title:'Cláusula de prueba',source:'custom',text:'Texto simulado para verificar la presentación. '.repeat(130)},{id:'s',source:'candidate',title:'Conformidad y firmas'}],annexes:[{id:'data',type:'worker_data',title:'Datos',fields:[{id:'full_name',label:'Nombre',type:'field'}]}]}};
// Template-only layout QA: private logo is substituted, not copied into the repo.
if(process.env.CONTRACT_REAL_FIXTURE){contract.logos={};for(const key of ['logo_path','watermark_path'])if(contract.template.presentation?.[key])contract.logos[contract.template.presentation[key]]='data:image/svg+xml;base64,'+Buffer.from(read('assets/cartel-studio-lettering-black.svg')).toString('base64');}
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{let count;
for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const url=new URL(r.request().url()),file=url.pathname.slice(1);if(url.hostname!=='test.local')return r.abort();if(!fs.existsSync(path.join(root,file)))return r.fulfill({status:404,body:''});r.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html',body:fs.readFileSync(path.join(root,file))});});
 await page.route('**/assets/loading-runtime.js*',r=>r.fulfill({contentType:'text/javascript',body:''}));
 await page.addInitScript(contract=>{window.CartelLoad={createClient:()=>({rpc:async()=>({data:{contract,data:{full_name:'Persona simulada <script>',identity_number:'99010112345',address:'Calle simulada'}}})})};},contract);
 await page.goto('https://test.local/contrato-laboral.html#token='+'a'.repeat(64));
 await page.locator('#contractPrint:enabled').waitFor();
 assert.equal(errors.length,0,errors.join('\n'));const pages=await page.locator('.contract-paper-page').count();assert(pages>=3);if(count)assert.equal(pages,count);count=pages;
 assert((await page.locator('#contractArticle').innerText()).includes('Persona simulada <script>'));assert.equal(await page.locator('#contractArticle script').count(),0);
 assert.equal(await page.locator('.contract-paper-page').first().evaluate(e=>e.offsetWidth),816);
 await page.screenshot({path:path.join(output,'view-'+width+'.png'),fullPage:true});
 await page.pdf({path:path.join(output,'print-'+width+'.pdf'),preferCSSPageSize:true,printBackground:true});
 const pending=page.waitForEvent('download');await page.locator('#contractDownload').click();const download=await pending;await download.saveAs(path.join(output,'download-'+width+'.pdf'));
 assert(fs.statSync(path.join(output,'download-'+width+'.pdf')).size>10000);
 await page.close();
}console.log('PASS contract paper mobile/desktop, pagination, candidate escaping, print and PDF');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
