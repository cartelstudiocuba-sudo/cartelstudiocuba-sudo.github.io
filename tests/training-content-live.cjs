// Temporary synthetic candidate only. Fixture is created and deleted by the operator.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/julio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.join(__dirname,'..'),fixture=JSON.parse(fs.readFileSync(path.join(root,'..','.task-tools','training-live.json'),'utf8')),published=process.argv.includes('--published');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true}),page=await context.newPage();const errors=[],reads=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('.supabase.co'))reads.push(new URL(r.url()).pathname);});
 if(!published)await page.route('https://gestion.elcartelstudio.com/**',async route=>{const p=new URL(route.request().url()).pathname,file=path.join(root,p);if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file,contentType:p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':undefined});return route.fulfill({status:404,body:''});});
 await page.goto(fixture.url);await page.waitForFunction(()=>document.getElementById('trainingContentDownload')&&!document.getElementById('trainingContentDownload').disabled,{},{timeout:45000});
 assert(await page.locator('.contract-paper-page').count()>1);assert.equal(await page.locator('.wrap').isVisible(),false);assert(!/contrato de trabajo/i.test(await page.locator('#trainingPublicContent').innerText()));
 assert(reads.length>0&&reads.every(x=>x==='/rest/v1/rpc/hr_read_training_content'));
 await page.waitForFunction(()=>!!window.jspdf?.jsPDF&&!!window.html2canvas,{},{timeout:45000});
 const download=page.waitForEvent('download',{timeout:180000});await page.getByRole('button',{name:'Descargar PDF',exact:true}).click();const pdf=await download,dest=path.join(root,'tests',published?'training-content-published.pdf':'training-content-live.pdf');await pdf.saveAs(dest);const bytes=fs.readFileSync(dest);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert(bytes.length>15000);assert.deepEqual(errors,[]);
 await page.screenshot({path:path.join(root,'tests',published?'training-content-published.png':'training-content-live.png'),fullPage:false});
 await page.goto(fixture.url.split('#')[0]+'#token='+'0'.repeat(64));await page.getByText('Este enlace ha vencido o ya no está disponible.',{exact:false}).waitFor();assert.equal(await page.locator('.contract-paper-page').count(),0);
 console.log(JSON.stringify({result:'PASS',mode:published?'published frontend + live Supabase':'local frontend + live Supabase',anonymous:true,onlyTokenRpc:true,pdfBytes:bytes.length,invalidTokenRejected:true,consoleErrors:errors}));await context.close();
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
