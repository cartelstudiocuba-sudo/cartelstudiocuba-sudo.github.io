'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../inventario-insumos.html'),'utf8');
const start=html.indexOf('function syncProductEditorAccess(){'),end=html.indexOf("window.addEventListener('inventory-access-updated'",start);
const source=html.slice(start,end);
function fixture(permission,saving=false){
 const fields=Object.fromEntries(['product-editor-save','product-editor-title','product-editor-message'].map(id=>[id,{}])),controls=[{},{}],photos=[{classList:{toggle(){}}}];
 const ctx={window:{inventoryCanEditProducts:permission},saving,field:id=>fields[id],form:{querySelectorAll:s=>s==='input,select,textarea'?controls:photos}};
 vm.createContext(ctx);vm.runInContext(source,ctx);ctx.syncProductEditorAccess();return {ctx,fields,controls,photos};
}
for(const permission of [false,undefined]){
 test('Read-only or unverified permission locks editor: '+String(permission),()=>{
  const f=fixture(permission);assert.ok(f.controls.every(x=>x.disabled));assert.ok(f.photos[0].hidden);assert.equal(f.fields['product-editor-save'].hidden,true);assert.match(f.fields['product-editor-title'].textContent,/Solo lectura/);
 });
}
test('Writer sees enabled fields and save button',()=>{
 const f=fixture(true);assert.ok(f.controls.every(x=>!x.disabled));assert.equal(f.photos[0].hidden,false);assert.equal(f.fields['product-editor-save'].hidden,false);assert.equal(f.fields['product-editor-save'].disabled,false);
});
test('Permission revoked while editor is open locks it on refresh',()=>{
 const f=fixture(true);f.ctx.window.inventoryCanEditProducts=false;f.ctx.syncProductEditorAccess();assert.ok(f.controls.every(x=>x.disabled));assert.equal(f.fields['product-editor-save'].hidden,true);
});
test('Active save stays disabled when permission UI synchronizes',()=>{
 const f=fixture(true,true);assert.equal(f.fields['product-editor-save'].disabled,true);
});
test('Read-only form submit stops before validation or transport',async()=>{
 const begin=html.indexOf('form.onsubmit=async e=>{e.preventDefault();if(window.inventoryCanEditProducts!==true)');
 const finish=html.indexOf('if(saving||!currentId',begin);
 assert.ok(begin>=0&&finish>begin);
 const prefix=html.slice(begin,finish);
 let protectedCalls=0,prevented=0;const ctx={form:{},window:{inventoryCanEditProducts:false},syncProductEditorAccess(){protectedCalls++}};
 vm.createContext(ctx);vm.runInContext(prefix+'throw Error("Unexpected write path")};',ctx);
 await ctx.form.onsubmit({preventDefault(){prevented++}});assert.equal(prevented,1);assert.equal(protectedCalls,1);
});
