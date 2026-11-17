const {JSDOM}=require('jsdom');const fs=require('node:fs');const assert=require('node:assert/strict');
const html=fs.readFileSync('nevera-audiovisual.html','utf8');
const code=fs.readFileSync('assets/fridge.js','utf8');
const tick=()=>new Promise(r=>setTimeout(r,15));
(async()=>{
 const dom=new JSDOM(html,{url:'https://gestion.elcartelstudio.com/nevera-audiovisual.html?tab=reconciliation',runScripts:'outside-only'}),w=dom.window,d=w.document;
 let scroll=420;Object.defineProperty(w,'scrollY',{get:()=>scroll});w.scrollTo=o=>{scroll=Number(o.top)||0;};let width=800;const mediaListeners=[];w.matchMedia=query=>({get matches(){return width<=Number(query.match(/max-width:(\d+)/)[1]);},addEventListener:(name,fn)=>mediaListeners.push(fn)});w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;w.queueMicrotask(()=>this.dispatchEvent(new w.Event('close')));};
 const p={photo_path:'test/photo.jpg',id:'p1',name:'Botella de agua natural de nombre muy largo de ejemplo',category:'Agua',price:200,cost:100,stock:24,minimum:5,version:1,active:true};
 const state={products:[p],customers:[{id:'c1',name:'Cliente de ejemplo',balance:400,kind:'client'}],staff:[{id:'s1',name:'Trabajador de ejemplo'}],stats:{sales_today:600,collected_today:200,owed:400,open_accounts:1,stock:24}};let calls=[],commandError=null,photoResolve=null;
 w.URL.createObjectURL=()=> 'blob:photo-preview';w.URL.revokeObjectURL=()=>{};
 w.CartelCatalogPhoto={create:()=>({prepare:async(file,onStage)=>{onStage('Subiendo foto… 50%',.5);return new Promise(resolve=>{photoResolve=resolve;});}})};
 w.CartelLoad={createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'test-token'}}}),getUser:async()=>({data:{user:{id:'test-user'}}}),onAuthStateChange:()=>{}},storage:{from:()=>({upload:async()=>({data:{}}),download:async()=>({data:new w.Blob(['photo'],{type:'image/jpeg'})})})},rpc:async(name,args)=>{calls.push([name,args]);if(name==='fridge_command')return commandError?{error:commandError}:{data:{}};return {data:name==='fridge_access'?true:name==='fridge_pricing_state'?{manager:false,config:{revision:1,total:55,rows:[{key:'profit',label:'Utilidad',percent:55}]},products:[p],requests:[],recipes:[],history:[],audit:[]}:name==='fridge_state'?state:{rows:[],more:false}};}})};
 state.products.push({...p,id:'p2',name:'Cerveza de prueba',price:65,cost:30,stock:2,category:'Cervezas'});w.fetch=async()=>({ok:false});w.eval(fs.readFileSync('assets/fridge-inventory.js','utf8'));w.eval(fs.readFileSync('assets/fridge-pricing.js','utf8'));w.eval(fs.readFileSync('assets/fridge-composition.js','utf8'));w.eval(fs.readFileSync('assets/fridge-menu-render.js','utf8'));w.eval(fs.readFileSync('assets/fridge-menu.js','utf8'));w.eval(code);await tick();

 assert(d.body.classList.contains('fr-compact-navigation'),'tablet enables unified navigation');
 assert(!d.body.classList.contains('fr-mobile-active'),'tablet retains regular sale cart');
 assert.equal(d.querySelector('#fr-mobile-more').getAttribute('aria-current'),'page');
 d.querySelector('#fr-mobile-more').click();assert(d.querySelector('#fr-mobile-more-sheet').open,'tablet More opens');
 d.querySelector('[data-mobile-tab="stock"]').click();await tick();assert(!d.querySelector('#fr-mobile-more-sheet').open);
 d.querySelector('[data-tab="sale"]').click();d.querySelector('[data-add="p1"]').click();
 assert.equal(d.querySelector('#fr-cart [data-quantity="p1"]').value,'1');assert(d.querySelector('#fr-mobile-cart-bar').hidden);
 width=1024;mediaListeners.forEach(fn=>fn());assert(!d.body.classList.contains('fr-compact-navigation'));
 width=390;mediaListeners.forEach(fn=>fn());assert(d.body.classList.contains('fr-compact-navigation'));assert(d.body.classList.contains('fr-mobile-active'));assert(!d.querySelector('#fr-mobile-cart-bar').hidden);
 dom.window.close();console.log('PASS: tablet single navigation, More shortcuts, normal cart and phone/desktop transitions');
})().catch(e=>{console.error(e);process.exitCode=1;});
