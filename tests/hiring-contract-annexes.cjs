const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const {createCanvas} = require('@napi-rs/canvas');

const root = path.resolve(__dirname, '..');
const token = 'a'.repeat(64);
const endpoint = 'https://test.local/contrato-laboral.html#token=' + token;
const candidate = {
 full_name:'Persona de prueba',identity_number:'99010112345',address:'Calle simulada 123',
 birth_date:'1999-01-01',municipality:'Habana Vieja',mobile:'55555555',email:'persona@example.com',
 emergency_name:'Contacto de prueba',emergency_relation:'Hermana',emergency_phone:'55555556',
 emergency_address:'Dirección de emergencia simulada'
};
const contract = process.env.HIRING_CONTRACT_FIXTURE
 ? JSON.parse(fs.readFileSync(process.env.HIRING_CONTRACT_FIXTURE))
 : {
   renderer_version:2,role:{title:'Plaza de prueba',payment_method:'Según disponibilidad'},
   template:{
    title:'Contrato de prueba',
    blocks:[{source:'candidate',title:'Identificación del trabajador'},{source:'custom',title:'Cláusula de prueba',text:'Texto de prueba. '.repeat(120)}],
    annexes:[{type:'worker_data',title:'Datos del trabajador contratado'},{type:'identity_copy',title:'Fotocopia del carné'}]
   }
  };
const image = createCanvas(320, 200);
image.getContext('2d').fillRect(20, 20, 100, 100);
const photo = Array.from(image.toBuffer('image/png'));
const images = {
 front:{bucket:'hr-identity-private',path:'test-synthetic-front'},
 back:{bucket:'hr-hiring-private',path:'test-synthetic-back'}
};
const types = {'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.html':'text/html'};

(async () => {
 const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined,headless:true});
 try {
  for(const width of [390,1440]){
   const page = await browser.newPage({viewport:{width,height:900}});
   const errors=[];
   page.on('pageerror', error=>errors.push(error.message));
   await page.route('https://test.local/**', route=>{
    const file = path.join(root,new URL(route.request().url()).pathname);
    if(file.endsWith('loading-runtime.js'))return route.fulfill({contentType:'text/javascript',body:''});
    return route.fulfill({path:file,contentType:types[path.extname(file)]});
   });
   await page.addInitScript(({candidate,contract,images,photo})=>{
    const incomplete = !location.search.includes('ready=1');
    const data = incomplete?{...candidate,birth_date:'',emergency_address:''}:candidate;
    window.CartelLoad = {createClient:(_url,_key,options)=>({
     rpc:async(_name,args)=>({data:args.p_document
      ?{contract,data,identity_images:incomplete?{front:images.front}:images}
      :{data,requires_emergency_address:true,front:true,back:false,role_title:contract.role.title}}),
     storage:{from:bucket=>({download:async file=>{
      if(!options.global?.headers?.['x-hiring-token']||!Object.values(images).some(image=>image.bucket===bucket&&image.path===file))throw Error('Unexpected document request');
      return {data:new Blob([new Uint8Array(photo)],{type:'image/png'})};
     }})}
    })};
   },{candidate,contract,images,photo});
   await page.goto(endpoint);
   const notice = page.locator('.hiring-contract-pending');
   await notice.waitFor();
   assert.deepEqual(await notice.locator('li').allTextContents(),['Fecha de nacimiento','Dirección del contacto de emergencia','Reverso del carné de identidad']);
   assert.equal(await page.locator('#contractPrint').isDisabled(),true);
   assert.equal(await page.locator('#contractDownload').isDisabled(),true);
   await page.locator('.hiring-identity-images img').waitFor();
   await page.emulateMedia({media:'print'});
   assert.equal(await page.locator('.contract-viewport').isVisible(),false);
   await page.emulateMedia({media:'screen'});
   await notice.getByRole('link',{name:'Completar mi expediente'}).click();
   await page.locator('#hiringForm').waitFor();
   assert.equal(await page.locator('input[name=full_name]').getAttribute('type'),'hidden');
   assert.equal(await page.locator('input[name=birth_date]').isVisible(),true);
   assert.equal(await page.locator('input[name=emergency_address]').getAttribute('required'),'');
   assert.equal(await page.locator('input[name=front]').count(),0);
   assert.equal(await page.locator('input[name=back]').count(),1);

   await page.goto(endpoint.replace('#','?ready=1#'));
   await page.locator('#contractDownload:enabled').waitFor();
   assert.equal(await notice.count(),0);
   assert.equal(await page.locator('#contractPrint').isEnabled(),true);
   assert.deepEqual(await page.locator('.hiring-identity-images figcaption').allTextContents(),['Anverso del carné de identidad','Reverso del carné de identidad']);
   const cells = await page.locator('.contract-annex-table tbody td').allTextContents();
   assert(cells.includes(candidate.emergency_address));
   assert(cells.every(value=>value.trim()&&value!=='Pendiente'));
   assert.equal(await page.locator('.contract-page-content').evaluateAll(pages=>pages.some(p=>p.scrollHeight>p.clientHeight+2)),false);
   assert.deepEqual(errors,[]);
   if(width===390){
    const printed = await page.pdf({preferCSSPageSize:true,printBackground:true});
    assert(printed.length>10000);
    const pending = page.waitForEvent('download');
    await page.locator('#contractDownload').click();
    const pdf = await pending;
    assert(fs.statSync(await pdf.path()).size>10000);
   }
   await page.close();
  }
  console.log('PASS: contract checklist, same-token form, two ID images, filled annexes, print and PDF at mobile and desktop widths');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
