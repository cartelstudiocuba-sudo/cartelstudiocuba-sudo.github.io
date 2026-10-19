'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../inventario-insumos.html'),'utf8');
const nodes={};for(const id of ['inventory-category-donut','inventory-category-legend','inventory-stock-alert-content'])nodes[id]={style:{},dataset:{},setAttribute(k,v){this[k]=v}};
const ctx={inventoryProducts:[],byId:id=>nodes[id],esc:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};vm.createContext(ctx);
vm.runInContext(html.slice(html.indexOf('function inventoryStockState('),html.indexOf('function updateInventoryCounters('))+html.slice(html.indexOf('function inventoryStockSummary('),html.indexOf('function sortInventoryProducts(')),ctx);
const p=(id,stock,minimum_stock,category='Otros')=>({id,name:id,stock,minimum_stock,category,unit:'Unidad'});
test('Category counts cover all products and alerts share the table minimum boundary',()=>{
 const rows=[p('disponible',1,0),p('agotado',0,5,'Estudio'),p('mínimo',5,5,'Estudio'),p('bajo',3,5)];
 const s=ctx.inventoryStockSummary(rows);assert.equal(s.total,4);assert.equal(s.empty,1);assert.equal(s.low,2);assert.equal(s.categories.reduce((n,c)=>n+c[1],0),4);assert.equal(s.alerts[0].product.id,'agotado');assert.equal(rows[0].id,'disponible');
});
test('Rendering updates donut, category legend and actionable alerts without unescaped names',()=>{
 ctx.inventoryProducts=[p('<img>',0,5),p('Disponible',8,5,'Estudio')];ctx.renderInventoryStockSummary();
 assert.match(nodes['inventory-category-donut'].style.background,/conic-gradient/);assert.equal(nodes['inventory-category-donut'].dataset.total,'2');assert.match(nodes['inventory-category-legend'].innerHTML,/50%/);assert.match(nodes['inventory-stock-alert-content'].innerHTML,/1 sin stock/);assert.match(nodes['inventory-stock-alert-content'].innerHTML,/inventory-edit-product/);assert.match(nodes['inventory-stock-alert-content'].innerHTML,/&lt;img&gt;/);assert.doesNotMatch(nodes['inventory-stock-alert-content'].innerHTML,/<img>/);
});
test('Empty inventory and healthy inventory clear stale alerts and chart segments',()=>{
 ctx.inventoryProducts=[];ctx.renderInventoryStockSummary();assert.equal(nodes['inventory-category-donut'].style.background,'#444b53');assert.equal(nodes['inventory-category-donut'].dataset.total,'0');assert.match(nodes['inventory-stock-alert-content'].innerHTML,/no hay insumos/);
 ctx.inventoryProducts=[p('Sano',10,2)];ctx.renderInventoryStockSummary();assert.match(nodes['inventory-stock-alert-content'].innerHTML,/por encima/);assert.doesNotMatch(nodes['inventory-stock-alert-content'].innerHTML,/inventory-alert-row/);
});
