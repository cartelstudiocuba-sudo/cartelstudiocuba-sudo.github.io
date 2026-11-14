const {JSDOM}=require('jsdom'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('dashboard.html','utf8'),start=html.indexOf('async function configurePersonalNavigation()'),end=html.indexOf("window.addEventListener('message',function(event){",start),source=html.slice(start,end);
async function menu(enabled,ordersFail=false,isManager=false){
 const dom=new JSDOM(html,{url:'https://gestion.elcartelstudio.com/dashboard.html',runScripts:'outside-only'}),w=dom.window;
 w.sb={auth:{getUser:async()=>({data:{user:{id:'test-chief'}}})},rpc:async name=>{assert.equal(name,'inventory_order_capabilities','Fridge must not depend on another RPC');if(ordersFail)throw Error('Orders unavailable');return {data:{create:true,fulfil:true,area:'Audiovisual'}};}};
 w.showModule=()=>{};w.CartelLoad={read:async()=>({data:{is_owner:false,views:[{code:'inventory_admin',is_default:true}],fridge_audiovisual:enabled,fridge_manager:isManager,finance_cost_sheets:isManager}})};
 w.console.warn=()=>{};w.eval(source);await w.configurePersonalNavigation();
 const labels=[...w.document.querySelectorAll('.personal-nav-group a')].map(a=>a.textContent);
 assert.equal(labels.includes('Nevera audiovisual'),enabled);assert.equal(labels.filter(x=>x==='Nevera audiovisual').length,enabled?1:0);assert(labels.includes('Insumos'));assert.equal(labels.includes('Fichas de costo'),isManager);assert(!labels.includes('Ingresos'));assert.equal(labels.includes('Cuadre de nevera'),isManager&&!enabled,'Only managers retain the separate sidebar review entry');assert(w.cartelPersonalNavigationReady);dom.window.close();return labels;
}
(async()=>{const labels=await menu(true);assert.deepEqual(labels,['Insumos','Pedidos y entregas','Solicitud','Nevera audiovisual']);await menu(false);await menu(true,true);await menu(false,false,true);await menu(true,false,true);console.log('PASS: chief menu includes fridge exactly once, permission isolation and no dependency on optional order requests');})().catch(e=>{console.error(e);process.exitCode=1;});
