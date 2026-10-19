'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../inventario-insumos.html'),'utf8');
const start=html.indexOf("(function(){const main=document.getElementById('inventory-main-view'),reports=");
const end=html.indexOf('</script>',start);assert.ok(start>=0&&end>start);
test('Stored out movements display as Salida and allow historical receipt download',async()=>{
 const nodes=new Map();function node(id){if(!nodes.has(id))nodes.set(id,{hidden:false,style:{},dataset:{},listeners:{},addEventListener(type,fn){this.listeners[type]=fn},focus(){},textContent:'',innerHTML:''});return nodes.get(id)}
 const out={id:'00000000-0000-4000-8000-000000000001',product_id:'product',kind:'out',quantity:2,unit_cost:25,currency:'CUP',occurred_on:'2026-10-18',recorded_by_name:'Operador de prueba',project_reference:'Proyecto de prueba',allocation_type:'project',receiving_area:'Gerencia',received_by:'Receptor',notes:'Prueba'};
 const rows=[out,{...out,id:'00000000-0000-4000-8000-000000000002',kind:'entry'}];let receipt;
 const query={select(){return this},order(){return this},range:async()=>({data:rows,error:null})};
 const ctx={window:{inventoryProductsForMovements:[{id:'product',name:'Insumo de prueba',unit:'Unidad',currency:'CUP'}],inventorySupabaseClient:{from(){return query}}},document:{getElementById:node,body:{style:{}},addEventListener(){}},console,downloadDeliveryReceipt:async d=>{receipt=d},alert:msg=>{throw Error(msg)}};
 vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
 await node('open-movements').listeners.click();
 const rendered=node('movements-rows').innerHTML;assert.match(rendered,/Salida/);assert.match(rendered,/Operador de prueba/);assert.match(rendered,/Proyecto de prueba/);assert.equal((rendered.match(/data-receipt-id=/g)||[]).length,1);
 const button={dataset:{receiptId:out.id},textContent:'PDF',disabled:false};
 await node('movements-rows').listeners.click({target:{closest:()=>button}});
 assert.equal(receipt.id,out.id);assert.equal(receipt.unitCost,25);assert.equal(receipt.name,'Insumo de prueba');assert.equal(button.disabled,false);
});
