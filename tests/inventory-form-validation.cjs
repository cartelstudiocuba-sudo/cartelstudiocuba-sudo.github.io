'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../inventario-insumos.html'),'utf8');
function fixture(){
 const nodes={};
 for(const match of html.match(/<form id="movement-form"[\s\S]*?<\/form>/)[0].matchAll(/<(input|select|textarea|button)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){
  const [,tag,attrs,id]=match;nodes[id]={id,tag,required:/\brequired\b/.test(attrs),disabled:false,value:'',customError:''};
 }
 const groups=['existing-fields','new-fields','entry-extra','out-extra','price-field','currency-field'];
 for(const id of groups){
  const start=html.indexOf('<div id="'+id+'"');let depth=0,end=start;
  const re=/<\/?div\b[^>]*>/g;re.lastIndex=start;let match;
  while((match=re.exec(html))){depth+=match[0].startsWith('</')?-1:1;if(depth===0){end=re.lastIndex;break}}
  const ids=[...html.slice(start,end).matchAll(/<(?:input|select|textarea|button)\b[^>]*\bid="([^"]+)"/g)].map(m=>m[1]);
  nodes[id]={querySelectorAll:()=>ids.map(key=>nodes[key])};
 }
 nodes['econ-project-field']={classList:{toggle(){}}};nodes['form-message']={textContent:''};nodes['econ-destination'].value='project';
 const listeners={},ctx={movementType:'entry',productKind:'existing',byId:id=>nodes[id],form:{addEventListener:(event,fn)=>listeners[event]=fn}};vm.createContext(ctx);
 const allocation=html.slice(html.indexOf('function syncAllocation(){'),html.indexOf("byId('econ-destination').addEventListener"));
 const start=html.indexOf('function syncMovementFormFields(){'),end=html.indexOf('function closeModal()',start);
 vm.runInContext(allocation+html.slice(start,end),ctx);
 return {ctx,nodes,listeners,activeInvalid:()=>Object.values(nodes).filter(n=>!n.disabled&&(n.required&&!n.value||n.customError))};
}
test('New entry ignores hidden exit fields and stale existing-product validation',()=>{
 const f=fixture();f.ctx.productKind='new';f.nodes['existing-product'].customError='Selecciona un insumo de la lista.';
 for(const id of ['product-name','product-category','product-unit','move-qty','move-price','move-date'])f.nodes[id].value='completo';
 f.ctx.syncMovementFormFields();assert.deepEqual(f.activeInvalid().map(n=>n.id),[]);assert.equal(f.nodes['move-notes'].disabled,true);
});
test('Existing entry ignores hidden new-product errors and exit observations',()=>{
 const f=fixture();f.nodes['product-minimum'].customError='mínimo inválido';
 for(const id of ['existing-product','move-qty','move-price','move-date'])f.nodes[id].value='completo';
 f.ctx.syncMovementFormFields();assert.deepEqual(f.activeInvalid().map(n=>n.id),[]);
});
test('Switching back to exit restores receiver, area, notes and project validation',()=>{
 const f=fixture();f.ctx.syncMovementFormFields();f.ctx.movementType='out';f.ctx.syncMovementFormFields();
 for(const id of ['move-person','move-area','move-notes','econ-project'])assert.ok(f.activeInvalid().some(n=>n.id===id),id);
 assert.equal(f.nodes['move-price'].disabled,true);assert.equal(f.nodes['product-minimum'].disabled,true);
 f.nodes['econ-destination'].value='administrative';f.ctx.syncAllocation();assert.equal(f.nodes['econ-project'].disabled,true);assert.equal(f.nodes['econ-project'].required,false);
});
test('Incomplete visible entry fields still block submission',()=>{
 const f=fixture();f.ctx.productKind='new';f.ctx.syncMovementFormFields();assert.ok(f.activeInvalid().some(n=>n.id==='product-name'));assert.ok(f.activeInvalid().some(n=>n.id==='move-price'));
});
test('Invalid fields show their label and reason beside Save',()=>{
 const f=fixture();f.listeners.invalid({target:{labels:[{textContent:'Precio unitario *'}],validationMessage:'Introduce un número válido.'}});
 assert.match(f.nodes['form-message'].textContent,/Precio unitario.*Introduce un número válido/);
});
