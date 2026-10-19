'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../inventario-insumos.html'),'utf8');
const code=html.slice(html.indexOf('function normalizeInventoryMovementCurrency('),html.indexOf('function inventoryStockState('));
const ctx={};vm.createContext(ctx);vm.runInContext(code,ctx);
test('Historical movement uses known product CUP currency and name without changing source',()=>{
 const m={product_id:'mouse',currency:null,product_name:null,quantity:1,unit_cost:25};
 const r=ctx.normalizeInventoryMovementCurrency(m,[{id:'mouse',currency:'CUP',name:'Mouse'}]);
 assert.equal(r.currency,'CUP');assert.equal(r.product_name,'Mouse');assert.equal(r.quantity*r.unit_cost,25);assert.equal(m.currency,null);
});
test('Explicit historical currency is never converted or replaced',()=>{
 assert.equal(ctx.normalizeInventoryMovementCurrency({product_id:'x',currency:'USD'},[{id:'x',currency:'CUP'}]).currency,'USD');
});
test('Unknown movement currency remains unknown',()=>{
 assert.equal(ctx.normalizeInventoryMovementCurrency({product_id:'missing',currency:null},[]).currency,null);
});
test('Weekly report starts from Cuba day across UTC midnight',()=>{
 class FixedDate extends Date{constructor(...args){super(...(args.length?args:['2026-10-19T01:30:00Z']))}}
 const local={Date:FixedDate};vm.createContext(local);vm.runInContext(code,local);assert.equal(local.inventoryTodayInCuba(),'2026-10-18');
});
