const {JSDOM}=require('jsdom');const fs=require('node:fs');const assert=require('node:assert/strict');
const html=fs.readFileSync('nevera-audiovisual.html','utf8');
const code=fs.readFileSync('assets/fridge.js','utf8');
const tick=()=>new Promise(r=>setTimeout(r,15));
(async()=>{for(const width of [390,800,1280])for(const requested of ['', '?tab=reconciliation']){
 const dom=new JSDOM(html,{url:'https://gestion.elcartelstudio.com/nevera-audiovisual.html'+requested,runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.matchMedia=q=>({matches:q.includes('650')?width<=650:width<=900,addEventListener(){}});w.scrollTo=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const p={photo_path:'test/photo.jpg',id:'p1',name:'Botella de agua natural de nombre muy largo de ejemplo',category:'Agua',price:200,cost:100,stock:24,minimum:5,version:1,active:true};
 const state={workspace_sections:['sale','accounts','stock'],products:[p],customers:[{id:'c1',name:'Cliente de ejemplo',balance:400,kind:'client'}],staff:[{id:'s1',name:'Trabajador de ejemplo'}],stats:{sales_today:600,collected_today:200,owed:400,open_accounts:1,stock:24}};let calls=[],commandError=null,photoResolve=null,historyFixture=[],boardFixture=null;
 w.URL.createObjectURL=()=> 'blob:photo-preview';w.URL.revokeObjectURL=()=>{};
 w.CartelCatalogPhoto={create:()=>({prepare:async(file,onStage)=>{onStage('Subiendo foto… 50%',.5);return new Promise(resolve=>{photoResolve=resolve;});}})};
 w.CartelLoad={createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'test-token'}}}),getUser:async()=>({data:{user:{id:'test-user'}}}),onAuthStateChange:()=>{}},storage:{from:()=>({upload:async()=>({data:{}}),download:async()=>({data:new w.Blob(['photo'],{type:'image/jpeg'})})})},rpc:async(name,args)=>{calls.push([name,args]);if(name==='fridge_command')return commandError?{error:commandError}:{data:{}};return {data:name==='fridge_access'?true:name==='fridge_pricing_state'?{manager:false,config:{revision:1,total:55,rows:[{key:'profit',label:'Utilidad',percent:55}]},products:[p],requests:[],recipes:[],history:[],audit:[]}:name==='fridge_state'?state:name==='fridge_account_board'?{accounts:boardFixture||state.customers.map(c=>({...c,account_key:c.id,customer_id:c.id,amount:400,latest_at:'2026-11-15T23:00:00Z',reconciliation_id:null,operations:historyFixture.filter(o=>o.details.customer_id===c.id)}))}:name==='fridge_history'?{rows:historyFixture.filter(o=>!args.p_customer||o.details.customer_id===args.p_customer).slice(args.p_offset,args.p_offset+30),more:historyFixture.filter(o=>!args.p_customer||o.details.customer_id===args.p_customer).length>args.p_offset+30}:{rows:[],more:false}};}})};
 w.fetch=async()=>({ok:false});w.eval(fs.readFileSync('assets/fridge-inventory.js','utf8'));w.AbortSignal=AbortSignal;w.eval(fs.readFileSync('assets/exchange-rates.js','utf8'));w.eval(fs.readFileSync('assets/fridge-pricing.js','utf8'));w.eval(fs.readFileSync('assets/fridge-composition.js','utf8'));w.eval(fs.readFileSync('assets/fridge-menu-render.js','utf8'));w.eval(fs.readFileSync('assets/fridge-menu.js','utf8'));w.eval(code);await tick();

 assert.deepEqual([...d.querySelectorAll('.fr-nav [data-tab]')].filter(b=>!b.hidden).map(b=>b.textContent),['Venta','Cuentas','Inventario']);
 assert(d.querySelector('.fr-sale-layout'),'restricted default and reconciliation link open Venta');
 assert(!d.querySelector('#fr-mobile-more').hidden);if(width<=900){d.querySelector('#fr-mobile-more').click();assert(d.querySelector('#fr-mobile-more-sheet').open);assert(!d.querySelector('[data-mobile-tab=menu]'));d.querySelector('[data-action=mobile-more-close]').click();}
 for(const name of ['summary','menu','reconciliation']){d.querySelector('[data-tab="'+name+'"]').click();await tick();assert(d.querySelector('.fr-sale-layout'),'excluded tab cannot be opened');}
 d.querySelector('[data-tab="accounts"]').click();await tick();assert(d.querySelector('.fr-account-board'),'Cuentas opens');
 d.querySelector('[data-tab="stock"]').click();await tick();assert.match(d.querySelector('#fr-content').textContent,/Inventario/);
 assert(!calls.some(c=>/^fridge_(menu|reconciliation)/.test(c[0])));
 dom.window.close();
 }
 const htmlDashboard=fs.readFileSync('dashboard.html','utf8'),dom=new JSDOM(htmlDashboard,{url:'https://gestion.elcartelstudio.com/dashboard.html',runScripts:'outside-only'}),w=dom.window;
 w.eval(fs.readFileSync('assets/module-access.js','utf8')+';window.accessFixture=CartelAccess');w.accessFixture.applyDashboard({rrhh:false,inventario_insumos:false,usuarios_roles:false});
 let opened;w.showModule=url=>opened=url;w.sb={auth:{getUser:async()=>({data:{user:{id:'operator'}}})},rpc:async()=>({data:{create:false,fulfil:false,approve:false}})};
 w.CartelLoad={read:async()=>({data:{is_owner:false,views:[],fridge_audiovisual:true,fridge_limited:true,fridge_manager:false,finance_cost_sheets:false}})};
 const start=htmlDashboard.indexOf('async function configurePersonalNavigation()'),end=htmlDashboard.indexOf("window.addEventListener('message',function(event){",start);w.eval(htmlDashboard.slice(start,end));await w.configurePersonalNavigation();
 assert.deepEqual([...w.document.querySelectorAll('.personal-nav-group a')].map(a=>a.textContent),['Nevera audiovisual']);assert.equal(w.cartelFridgeOperatorAccess,false);assert.equal(w.document.querySelector('.module.inv').style.display,'');w.document.querySelector('.module.inv').click();assert.equal(opened,'/nevera-audiovisual.html');dom.window.close();
 console.log('PASS: operational role has exactly Venta, Cuentas, Inventario at phone/tablet/desktop widths; denied tabs stay inaccessible');
})().catch(e=>{console.error(e);process.exit(1);});
