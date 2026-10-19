'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../inventario-insumos.html'),'utf8');
const start=html.indexOf('function supplierHistoricalPurchases('),end=html.indexOf('function showDetail(',start);
const ctx={window:{inventoryProductsForMovements:[{id:'p',name:'Producto actual',unit:'Unidad',unit_cost:999,currency:'CUP'}]},esc:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
test('Recorded purchase prices survive later changes to the product cost',()=>{
 const movements=[{id:'a',product_id:'p',occurred_on:'2026-10-01',quantity:2,unit_cost:25,currency:'CUP'},{id:'b',product_id:'p',occurred_on:'2026-10-18',quantity:3,unit_cost:40,currency:'CUP'}];
 const rows=ctx.supplierHistoricalPurchases(movements,ctx.window.inventoryProductsForMovements);
 assert.equal(rows[0].unitCost,40);assert.equal(rows[0].total,120);assert.equal(rows[1].unitCost,25);assert.equal(rows[1].total,50);assert.equal(movements[0].id,'a');
});
test('Historical name, unit and currency take precedence over current product data',()=>{
 const row=ctx.supplierHistoricalPurchases([{product_id:'p',product_name:'Nombre histórico',product_unit:'Caja',currency:'USD',quantity:'1.5',unit_cost:'20'}],ctx.window.inventoryProductsForMovements)[0];
 assert.equal(row.name,'Nombre histórico');assert.equal(row.unit,'Caja');assert.equal(row.currency,'USD');assert.equal(row.total,30);
});
test('Unknown historical price stays missing; zero is a valid price',()=>{
 const rows=ctx.supplierHistoricalPurchases([{product_id:'p',unit_cost:null,quantity:2},{product_id:'p',unit_cost:0,quantity:2}],ctx.window.inventoryProductsForMovements);
 assert.equal(rows[0].unitCost,null);assert.equal(rows[0].total,null);assert.equal(rows[1].unitCost,0);assert.equal(rows[1].total,0);
});
test('All purchases are shown, beyond the previous 15-record limit',()=>{
 const records=Array.from({length:20},(_,i)=>({id:String(i),product_id:'p',occurred_on:'2026-10-18',quantity:2,unit_cost:25,currency:'CUP'}));
 const markup=ctx.supplierPurchaseHistoryHTML(records);assert.match(markup,/20 compras/);assert.equal((markup.match(/<tr>/g)||[]).length,21);assert.match(markup,/Precio unitario/);assert.match(markup,/50,00 CUP/);
});
test('History search and escaping work without changing stored records',()=>{
 const records=[{product_id:'p',product_name:'<b>PRUEBA</b>',occurred_on:'2026-10-18',quantity:1,unit_cost:25,currency:'CUP'}];
 const markup=ctx.supplierPurchaseHistoryHTML(records,'prueba');assert.match(markup,/&lt;b&gt;PRUEBA&lt;\/b&gt;/);assert.doesNotMatch(markup,/<b>PRUEBA<\/b>/);assert.match(ctx.supplierPurchaseHistoryHTML(records,'otro'),/No hay compras/);
});
