'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../inventario-insumos.html'),'utf8');
const ctx={};vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('let inventoryCurrentPage=1,'),html.indexOf('function renderInventoryPagination(')),ctx);
const rows=Array.from({length:31},(_,i)=>i);
test('Numbered pages show ten rows, including the final partial page and back navigation',()=>{
 let page=ctx.inventoryPageState(rows,'all');assert.equal(page.page,1);assert.equal(page.pages,4);assert.equal(page.rows.length,10);assert.equal(page.start,1);assert.equal(page.end,10);
 vm.runInContext('inventoryCurrentPage=4',ctx);page=ctx.inventoryPageState(rows,'all');assert.equal(page.rows.length,1);assert.equal(page.rows[0],30);assert.equal(page.start,31);assert.equal(page.end,31);
 vm.runInContext('inventoryCurrentPage=2',ctx);page=ctx.inventoryPageState(rows,'all');assert.equal(page.rows[0],10);assert.equal(page.end,20);assert.equal(rows.length,31);
});
test('Changing filter resets page; shrinking results clamps page; empty results stay valid',()=>{
 vm.runInContext('inventoryCurrentPage=4',ctx);assert.equal(ctx.inventoryPageState(rows,'search').page,1);
 vm.runInContext('inventoryCurrentPage=4',ctx);let page=ctx.inventoryPageState(rows.slice(0,3),'search');assert.equal(page.page,1);assert.equal(page.rows.length,3);
 page=ctx.inventoryPageState([],'none');assert.equal(page.page,1);assert.equal(page.pages,1);assert.equal(page.start,0);assert.equal(page.end,0);
});
test('Large catalogs keep first, last and nearby page numbers with ellipses',()=>{
 const numbers=Array.from(ctx.inventoryPageNumbers(10,20));assert.deepEqual(numbers,[1,'…',8,9,10,11,12,'…',20]);assert.deepEqual(Array.from(ctx.inventoryPageNumbers(1,4)),[1,2,3,4]);
});
test('Movement actor header and value immediately follow currency',()=>{assert.match(html,/<th>Moneda<\/th><th>Realizado por<\/th><th>Observaciones<\/th>/);assert.ok(html.includes("escape(m.currency||p?.currency||'CUP')+'</td><td>'+escape(actor(m))"));assert.doesNotMatch(html,/<th>Usuario responsable<\/th>/)});
