import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('inventario-insumos.html','utf8');
const a=html.indexOf('function reportUsdTotal('),b=html.indexOf('function currentFilters()',a);
function setup(){
 const nodes=new Map(),requests=[],now=Date.parse('2026-11-12T22:00:00Z');
 const el=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',setAttribute(k,v){this[k]=v}});return nodes.get(id)};
 class FixedDate extends Date{static now(){return now}}
 const ctx={Date:FixedDate,Intl,AbortSignal,rows:[{stock:2,unit_cost:10,currency:'USD'},{stock:3,unit_cost:0.27,currency:'USD'}],loaded:true,reportLoading:false,totalRate:null,totalRateLoading:false,totalRateRun:0,el,money:n=>Number(n).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2}),num:n=>Number(n)||0,window:{inventorySupabaseClient:{auth:{getSession:async()=>({data:{session:{access_token:'test-session'}}})}}},fetch:(url,options)=>new Promise(resolve=>requests.push({url,options,resolve}))};
 vm.createContext(ctx);vm.runInContext(html.slice(a,b),ctx);
 const ready=async()=>{await Promise.resolve();await Promise.resolve()};
 const rate=(value=910,extra={})=>({ok:true,json:async()=>({rates:{USD:value},fetched_at:new Date(now).toISOString(),stale:false,...extra})});
 return {ctx,nodes,requests,ready,rate};
}
test('Loading indicator, current rate and filtered USD total update only the summary',async()=>{
 const h=setup(),original=JSON.stringify(h.ctx.rows),work=h.ctx.refreshCupTotalRate();
 assert.equal(h.nodes.get('inventory-general-cup-card')['aria-busy'],'true');assert.match(h.nodes.get('inventory-general-cup').innerHTML,/inventory-rate-spinner/);
 await h.ready();assert.equal(h.requests[0].options.cache,'no-store');assert.equal(h.requests[0].options.headers.Authorization,'Bearer test-session');
 h.requests[0].resolve(h.rate());await work;
 assert.equal(h.nodes.get('inventory-general-cup-card')['aria-busy'],'false');
 assert.equal(h.nodes.get('inventory-general-cup').textContent,'≈ 18.937,10 CUP');assert.match(h.nodes.get('inventory-general-cup-rate').textContent,/910,00 CUP/);
 assert.equal(JSON.stringify(h.ctx.rows),original);
 h.ctx.rows=[h.ctx.rows[1]];h.ctx.renderCupTotal();assert.equal(h.nodes.get('inventory-general-cup').textContent,'≈ 737,10 CUP');
 h.ctx.rows=[];h.ctx.renderCupTotal();assert.equal(h.nodes.get('inventory-general-cup').textContent,'≈ 0,00 CUP');
});
test('Stale or invalid rates show unavailable and never reuse a previous estimate',async()=>{
 for(const payload of [{stale:true},{fetched_at:'2026-11-10T00:00:00Z'},{rates:{USD:0}},{rates:{USD:'bad'}}]){
  const h=setup(),work=h.ctx.refreshCupTotalRate();await h.ready();h.requests[0].resolve(h.rate(910,payload));await work;
  assert.equal(h.nodes.get('inventory-general-cup').textContent,'No disponible');assert.equal(h.ctx.totalRate,null);assert.equal(h.ctx.reportUsdTotal(),20.81);
 }
});
test('Reopening refreshes the reference and ignores an older response',async()=>{
 const h=setup(),older=h.ctx.refreshCupTotalRate();await h.ready();const newer=h.ctx.refreshCupTotalRate();await h.ready();
 h.requests[1].resolve(h.rate(920));await newer;h.requests[0].resolve(h.rate(800));await older;
 assert.equal(h.ctx.totalRate.value,920);assert.match(h.nodes.get('inventory-general-cup-rate').textContent,/920,00 CUP/);
});
