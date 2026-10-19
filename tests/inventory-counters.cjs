'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../inventario-insumos.html'),'utf8');
const source=html.slice(html.indexOf('function inventoryStockState('),html.indexOf('async function loadInventory(){'));
function setup(products){
 const categoryButtons=['Todos','Otros','Estudio'].map(cat=>({dataset:{cat},small:{},querySelector(){return this.small}}));
 const stockButtons=['available','low','empty'].map(stock=>({dataset:{stock},small:{},querySelector(){return this.small}}));
 const context={inventoryProducts:products,document:{querySelectorAll:s=>s==='.category[data-cat]'?categoryButtons:stockButtons}};
 vm.createContext(context);vm.runInContext(source,context);context.updateInventoryCounters();return {context,categoryButtons,stockButtons};
}
test('Real Mouse fixture counts as total 1, Otros 1, available 1',()=>{
 const f=setup([{category:'Otros',stock:1,minimum_stock:0}]);
 assert.deepEqual(f.categoryButtons.map(b=>b.small.textContent),['1 producto','1 producto','0 productos']);
 assert.deepEqual(f.stockButtons.map(b=>b.small.textContent),['1 producto','0 productos','0 productos']);
});
test('Minimum boundary belongs only to low stock; zero belongs only to empty',()=>{
 const f=setup([{category:'Otros',stock:'5',minimum_stock:'5'},{category:'Estudio',stock:6,minimum_stock:5},{category:'Otros',stock:0,minimum_stock:5}]);
 assert.deepEqual(f.stockButtons.map(b=>b.small.textContent),['1 producto','1 producto','1 producto']);
 assert.deepEqual(f.categoryButtons.map(b=>b.small.textContent),['3 productos','2 productos','1 producto']);
 assert.equal(f.context.inventoryStockState({stock:0,minimum_stock:0}),'empty');
});
test('Empty inventory has no stale counter values',()=>{
 const f=setup([]);assert.ok([...f.categoryButtons,...f.stockButtons].every(b=>b.small.textContent==='0 productos'));
});
