const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../inventario-insumos.html'),'utf8');
test('Weekly load enables export and prints entries, exits and unified with USD references',async()=>{
 const elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:true,disabled:false,innerHTML:'',textContent:'',handlers:{},classList:{toggle(){}},focus(){},replaceChildren(){this.innerHTML=''},addEventListener(type,fn){this.handlers[type]=fn},querySelector(){return buttons[0]},querySelectorAll(){return buttons}});return elements.get(id)};
 const buttons=['entry','exit','both'].map(kind=>({dataset:{exportKind:kind},addEventListener(type,fn){this.click=fn},focus(){}}));
 const printed=[];let printCalls=0;
 const fixtures={inventory_movements:[{id:'e1',product_name:'Compra histórica',occurred_on:'2026-11-12',quantity:3,unit_cost:10230,usd_unit_cost:11.24,currency:'CUP',kind:'entry'},{id:'e2',product_name:'Compra USD',occurred_on:'2026-11-12',quantity:2,unit_cost:10,currency:'USD',kind:'entry'}],inventory_economic_movements:[{id:'s1',product_name:'Salida USD',occurred_on:'2026-11-12',quantity:2,unit_cost:10,currency:'USD',allocation_type:'administrative',receiving_area:'Oficina'}]};
 const client={from(table){const q={select(){return q},eq(){return q},gte(){return q},lte(){return q},order(){return q},range(){return Promise.resolve({data:fixtures[table],error:null})}};return q}};
 const ctx={document:{getElementById:element,addEventListener(){},body:{style:{}}},window:{inventorySupabaseClient:client,open:()=>({document:{write:s=>printed.push(s),close(){}},focus(){},print(){printCalls++}})}};
 vm.createContext(ctx);
 const helper=source.slice(source.indexOf('function normalizeInventoryMovementCurrency('),source.indexOf('function selectInventoryMenuFilter('));
 const watermark=source.slice(source.indexOf('function inventoryReportWatermarkHTML('),source.indexOf('function normalizeInventoryMovementCurrency('));
 const weekly=[...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes("toggle=el('weekly-expenses-toggle')"));
 vm.runInContext(helper+watermark+weekly,ctx);
 element('weekly-expenses-mode').value='week';element('weekly-expenses-end').value='2026-11-12';
 await element('weekly-expenses-refresh').handlers.click();
 assert.equal(element('weekly-expenses-pdf').disabled,false);assert.match(element('weekly-expenses-status').textContent,/Valores en USD/);
 for(const button of buttons){element('weekly-expenses-pdf').handlers.click();assert.equal(element('weekly-export-menu').hidden,false);button.click()}
 assert.equal(printCalls,3);assert.equal(printed.length,3);
 assert.match(printed[0],/Compra histórica/);assert.match(printed[0],/11[.,]24 USD/);assert.match(printed[0],/53[.,]72 USD/);assert.doesNotMatch(printed[0],/10230|NaN|undefined/);
 assert.match(printed[1],/Salida USD/);assert.doesNotMatch(printed[1],/Compra histórica/);
 assert.match(printed[2],/Compra histórica/);assert.match(printed[2],/Salida USD/);
 assert.equal(fixtures.inventory_movements[0].unit_cost,10230);assert.equal(fixtures.inventory_movements[0].currency,'CUP');
});
