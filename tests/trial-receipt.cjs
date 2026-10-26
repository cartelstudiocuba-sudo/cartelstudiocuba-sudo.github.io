const fs=require('fs'),assert=require('assert/strict'),vm=require('vm');
const {chromium}=require('C:/Users/julio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const html=fs.readFileSync('rrhh.html','utf8'),css=fs.readFileSync('assets/trial-receipt.css','utf8');
for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
const dialog=html.slice(html.indexOf('function trialFinishDialog('),html.indexOf('async function openTrialFinishDestination('));
const receipt=html.slice(html.indexOf('async function openTrialFinishReceipt('),html.indexOf('async function registerTrialAgreementReceived('));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});let checks=0;
for(const [width,height] of [[320,568],[360,640],[390,844],[430,932],[1440,900],[844,320]]){
 const context=await browser.newContext({viewport:{width,height}});let requests=0;await context.route('**/*',r=>{requests++;return r.abort()});const page=await context.newPage();
 await page.setContent(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,''));await page.addStyleTag({content:css});await page.evaluate(()=>{const s=document.createElement('i');s.id='trialReceiptStyles';document.head.append(s)});
 await page.addScriptTag({content:dialog+receipt});
 for(const outcome of ['talent_pool','profiled','not_selected','error','invalid']){
 const payload={outcome,phone:outcome==='invalid'?'bad':'5350000001',message:'Hola, Persona sintética.\n\n'+('Gracias por tu participación. '.repeat(30))+'\nhttps://example.test/cierre#token=UNICO-'+('abc'.repeat(100)),new_candidate_id:outcome==='profiled'?'synthetic-id':null};
 await page.evaluate(async({payload,fail})=>{window.trialPeriodsByCandidate={A:{id:'T'}};const q={select(){return q},eq(){return q},order(){return q},limit(){return q},async maybeSingle(){return fail?{error:{message:'Error sintético'}}:{data:{payload}}}};window.sb={from:()=>q};await openTrialFinishReceipt('A')},{payload,fail:outcome==='error'});
 const box=await page.locator('.trial-receipt').boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1);
 const back=page.getByRole('button',{name:'Regresar a la ficha',exact:true});const b=await back.boundingBox();assert(b.y>=0&&b.y+b.height<=height);
 if(outcome!=='error'){
 assert.equal(await page.getByRole('textbox').inputValue(),payload.message);
 assert.equal(await page.locator('.trial-receipt').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
 await page.getByRole('button',{name:'Editar',exact:true}).click();const edited=payload.message+'\nTexto editado';await page.getByRole('textbox').fill(edited);await page.getByRole('button',{name:'Listo',exact:true}).click();
 if(outcome!=='invalid'){const href=await page.getByRole('link',{name:'Abrir WhatsApp'}).getAttribute('href');assert.equal(new URL(href).searchParams.get('text'),edited)}else assert.equal(await page.getByRole('link',{name:'Abrir WhatsApp'}).count(),0);
 await page.evaluate(()=>{window.copied='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>window.copied=t}})});await page.getByRole('button',{name:'Copiar',exact:true}).click();assert.equal(await page.evaluate(()=>window.copied),edited);
 }
 if(outcome==='talent_pool'&&[320,390,1440].includes(width))await page.screenshot({path:'../outputs/cierre-modal-'+width+'.png'});
 await back.click();assert.equal(await page.locator('#trialFinishOverlay').count(),0);checks++;
 }assert.equal(requests,0);await context.close();
}await browser.close();console.log(JSON.stringify({checks,syntheticOnly:true,networkRequests:0,viewports:6}));})().catch(e=>{console.error(e);process.exit(1)});
