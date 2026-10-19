'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../inventario-insumos.html'),'utf8');
function fixture(){
 const buttons={'inventory-retry-receipt':{},'inventory-reconcile-movement':{}};
 const state={receipt:null,movement:null,unreadable:false};
 const ctx={document:{getElementById:id=>buttons[id]},getPendingReceipt:()=>state.receipt,readPendingMovement:()=>{if(state.unreadable)throw Error('SecurityError');return state.movement}};
 vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('function syncFormRecoveryActions(){'),html.indexOf('function syncPendingRecoveryButton(){')),ctx);
 return {buttons,state,sync:()=>ctx.syncFormRecoveryActions()};
}
test('Normal form hides both recovery actions; each pending state reveals only its action',()=>{
 const f=fixture(),receipt=f.buttons['inventory-retry-receipt'],movement=f.buttons['inventory-reconcile-movement'];
 f.sync();assert.equal(receipt.hidden,true);assert.equal(movement.hidden,true);
 f.state.receipt={id:'receipt'};f.sync();assert.equal(receipt.hidden,false);assert.equal(movement.hidden,true);
 f.state.receipt=null;f.state.movement={id:'12345678-1234-1234-1234-123456789abc',submitted:true};f.sync();assert.equal(receipt.hidden,true);assert.equal(movement.hidden,false);assert.equal(movement.disabled,false);
 f.state.movement=null;f.sync();assert.equal(movement.hidden,true);
});
test('Unsent drafts stay hidden; malformed or unreadable pending requests keep protection visible',()=>{
 const f=fixture(),button=f.buttons['inventory-reconcile-movement'];f.state.movement={submitted:false};f.sync();assert.equal(button.hidden,true);
 f.state.movement={submitted:true,id:'invalid'};f.sync();assert.equal(button.hidden,false);assert.equal(button.disabled,true);
 f.state.unreadable=true;f.sync();assert.equal(button.hidden,false);assert.equal(button.disabled,true);assert.match(button.title,/solicita revisión/);
});
test('Visibility refreshes when receipts or pending requests change and hidden overrides button styles',()=>{
 assert.match(html,/finally\{syncFormRecoveryActions\(\)\}/);assert.match(html,/function syncPendingRecoveryButton\(\)\{[\s\S]*?syncFormRecoveryActions\(\);/);
 assert.match(html,/#inventory-retry-receipt\[hidden\],#inventory-reconcile-movement\[hidden\]\{display:none!important\}/);
 assert.match(html,/showModal=function\(type\)\{if\(savingMovement\)return;syncFormRecoveryActions\(\)/);
});
