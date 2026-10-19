'use strict';
// Run: node --test tests/inventory-recovery.cjs
// Uses published browser functions with isolated in-memory storage and transport.
// Backend idempotency is verified separately in a rolled-back authenticated SQL transaction.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../inventario-insumos.html'),'utf8');
function extract(name){
 const re=new RegExp('(?:async )?function '+name+'\\(');const match=re.exec(html);
 assert.ok(match,'Missing function '+name);const rest=html.slice(match.index);
 for(let end=rest.indexOf('}');end>=0;end=rest.indexOf('}',end+1)){
  const text=rest.slice(0,end+1);try{new vm.Script(text);return text}catch{}
 }
 throw Error('Cannot extract '+name);
}
const functions=['readPendingMovement','persistMovement','clearPersistedMovement','finishConfirmedPendingMovement','reconcilePendingInventoryMovement','autoCheckPendingInventoryMovement'];
const source=functions.map(extract).join('\n');
const id='12345678-1234-1234-1234-123456789abc';
function fixture(mode='normal'){
 const stored=new Map(),status={textContent:''},notice={textContent:''};
 const events={rpc:0,refresh:0,receipts:0,closed:0};
 const state={mode,rows:new Map()};
 const ctx={
  console:{warn(){}},inventoryPendingKey:'pending',pendingRequest:{id,signature:'original',submitted:true},draftType:'out',
  document:{querySelector:()=>notice},byId:()=>status,
  sessionStorage:{
   getItem(key){if(state.mode==='read-fails')throw Error('SecurityError');return stored.has(key)?stored.get(key):null},
   setItem(key,value){if(state.mode==='write-fails')throw Error('QuotaExceededError');stored.set(key,value)},
   removeItem(key){if(state.mode==='remove-fails')throw Error('SecurityError');if(state.mode!=='remove-ignored')stored.delete(key)}
  },
  syncPendingRecoveryButton(){},
  lookupPendingMovement:async key=>({data:state.rows.get(key)||null,error:null}),
  loadInventory:async()=>{events.refresh++},
  sb:{auth:{getUser:async()=>({data:{user:{id:'test-user'}},error:null})}}
 };
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {ctx,stored,status,notice,state,events};
}
function pending(f){f.stored.set('pending',JSON.stringify({id,signature:'original',submitted:true,payload:{kind:'out',quantity:2}}))}
function confirmed(f){f.state.rows.set(id,{id,kind:'out',quantity:2,occurred_on:'2026-10-18'})}
test('All inline JavaScript parses',()=>{for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1])});
test('Empty storage is distinct from unreadable storage',async()=>{
 const f=fixture();await f.ctx.reconcilePendingInventoryMovement(f.status);assert.match(f.status.textContent,/No existe/);
 f.state.mode='read-fails';await f.ctx.reconcilePendingInventoryMovement(f.status);assert.match(f.status.textContent,/No se pudo leer/);assert.match(f.notice.textContent,/No se pudo leer/);
});
test('Malformed data blocks reconciliation',async()=>{
 for(const raw of ['{','null','[]','{}']){const f=fixture();f.stored.set('pending',raw);await f.ctx.reconcilePendingInventoryMovement(f.status);assert.match(f.status.textContent,/No se pudo leer/);assert.equal(f.events.refresh,0)}
});
test('Write failure aborts durable request persistence',()=>{
 const f=fixture('write-fails');assert.throws(()=>f.ctx.persistMovement(f.ctx.pendingRequest,{kind:'out'}),e=>e.code==='INVENTORY_PENDING_STORAGE_FAILED');assert.equal(f.stored.size,0);
});
for(const mode of ['remove-fails','remove-ignored','read-fails']){
 test('Confirmed manual recovery retains protection when '+mode,async()=>{
  const f=fixture();pending(f);confirmed(f);
  if(mode==='read-fails'){f.state.mode=mode;assert.equal(f.ctx.finishConfirmedPendingMovement(id),false)}
  else{f.state.mode=mode;await f.ctx.reconcilePendingInventoryMovement(f.status);assert.match(f.status.textContent,/no se pudo liberar/)}
  assert.equal(f.ctx.pendingRequest.id,id);assert.equal(f.events.refresh,0);assert.ok(f.stored.has('pending'));
 });
}
test('Lost response: manual lookup clears only the confirmed original request',async()=>{
 const f=fixture();pending(f);confirmed(f);await f.ctx.reconcilePendingInventoryMovement(f.status);
 assert.equal(f.ctx.pendingRequest,null);assert.equal(f.stored.has('pending'),false);assert.equal(f.events.refresh,1);assert.match(f.status.textContent,/Movimiento confirmado/);
});
test('Absent server result keeps request and does not claim failure',async()=>{
 const f=fixture();pending(f);await f.ctx.reconcilePendingInventoryMovement(f.status);assert.ok(f.stored.has('pending'));assert.equal(f.ctx.pendingRequest.id,id);assert.match(f.status.textContent,/NO confirma/);
});
test('Automatic reconciliation follows the same cleanup protection',async()=>{
 const f=fixture();pending(f);confirmed(f);f.state.mode='remove-ignored';await f.ctx.autoCheckPendingInventoryMovement();
 assert.ok(f.stored.has('pending'));assert.equal(f.ctx.pendingRequest.id,id);assert.match(f.notice.textContent,/no se pudo liberar/);
 f.state.mode='normal';await f.ctx.autoCheckPendingInventoryMovement();assert.equal(f.ctx.pendingRequest,null);assert.equal(f.stored.size,0);assert.equal(f.events.refresh,1);
});
test('A newer pending identifier cannot be cleared by a stale confirmation',()=>{
 const f=fixture();pending(f);const replacement={id:'aaaaaaaa-1234-1234-1234-123456789abc',signature:'new',submitted:true};
 f.stored.set('pending',JSON.stringify(replacement));assert.equal(f.ctx.finishConfirmedPendingMovement(id),false);assert.equal(JSON.parse(f.stored.get('pending')).id,replacement.id);
});
const directStart=html.indexOf(' persistMovement({...pendingRequest,submitted:true},rpcPayload);');
const directEnd=html.indexOf('\n catch(error)',directStart);
assert.ok(directStart>=0&&directEnd>directStart);
const directFlow=html.slice(directStart,directEnd).replace(/\}\s*$/,'');
for(const mode of ['normal','remove-fails','remove-ignored']){
 test('Direct confirmed save: '+mode,async()=>{
  const f=fixture(mode);Object.assign(f.ctx,{
   rpcPayload:{kind:'out',quantity:2},receiptData:{id},
   sb:{rpc:async()=>{f.events.rpc++;return {error:null}}},
   storePendingReceipt(){f.events.receipts++},clearPendingReceipt(){},downloadDeliveryReceipt:async()=>{},
   clearPhoto(){},closeModal(){f.events.closed++},alert(){}
  });
  vm.runInContext('async function directSave(){'+directFlow+'\n}',f.ctx);await f.ctx.directSave();
  assert.equal(f.events.rpc,1);assert.equal(f.events.receipts,1);
  if(mode==='normal'){assert.equal(f.ctx.pendingRequest,null);assert.equal(f.events.closed,1)}
  else{assert.equal(f.ctx.pendingRequest.id,id);assert.equal(f.ctx.pendingRequest.submitted,true);assert.equal(f.events.closed,0);assert.match(f.status.textContent,/Movimiento confirmado y guardado/)}
 });
}
