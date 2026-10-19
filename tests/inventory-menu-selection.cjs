'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../inventario-insumos.html'),'utf8');
const start=html.indexOf('function selectInventoryMenuFilter('),end=html.indexOf('function inventoryStockState(',start);
function fixture(){
 const buttons=[{cat:'Todos'},{cat:'Otros'},{cat:'Estudio'},{stock:'available'},{stock:'low'},{stock:'empty'}].map(dataset=>{
  const b={dataset,selected:false,pressed:'false',setAttribute(name,v){if(name==='aria-pressed')this.pressed=v}};
  b.classList={toggle(name,value){b.selected=value}};return b;
 });
 const ctx={window:{activeStockFilter:'all'},document:{querySelectorAll:()=>buttons},renderInventory(){}};vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
 return {buttons,ctx};
}
test('Switching category to each stock filter leaves only the clicked button selected',()=>{
 const f=fixture();
 for(const index of [3,4,5]){
  f.ctx.selectInventoryMenuFilter(f.buttons[1]);f.ctx.selectInventoryMenuFilter(f.buttons[index]);
  assert.equal(f.buttons.filter(b=>b.selected).length,1);assert.equal(f.buttons[index].pressed,'true');assert.equal(f.buttons[1].pressed,'false');assert.equal(f.ctx.window.activeStockFilter,f.buttons[index].dataset.stock);
 }
});
test('Choosing a category resets the previous stock filter',()=>{
 const f=fixture();f.ctx.selectInventoryMenuFilter(f.buttons[5]);f.ctx.selectInventoryMenuFilter(f.buttons[2]);
 assert.equal(f.ctx.window.activeStockFilter,'all');assert.equal(f.buttons.filter(b=>b.selected).length,1);assert.equal(f.buttons[2].pressed,'true');
});
test('Total clears stock filters; repeated clicks keep one selected button',()=>{
 const f=fixture();f.ctx.selectInventoryMenuFilter(f.buttons[4]);f.ctx.selectInventoryMenuFilter(f.buttons[0]);f.ctx.selectInventoryMenuFilter(f.buttons[0]);
 assert.equal(f.ctx.window.activeStockFilter,'all');assert.equal(f.buttons.filter(b=>b.selected).length,1);assert.equal(f.buttons[0].pressed,'true');
});
