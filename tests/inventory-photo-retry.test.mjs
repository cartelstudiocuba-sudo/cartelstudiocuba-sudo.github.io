import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('inventario-insumos.html','utf8');
function setup(){
 let now=1000,resolvePhoto;const nodes=new Map(),timers=[];
 const byId=id=>{if(!nodes.has(id))nodes.set(id,{disabled:false,textContent:'',title:'',value:'',replaceChildren(){}});return nodes.get(id)};
 const ctx={byId,window:{inventoryCanEditProducts:true},pendingRequest:null,savingMovement:false,movementType:'entry',productKind:'new',newPhotoRetrySource:null,newPhotoCleaned:false,newPhotoRetryAt:0,newPhotoRetryTimer:null,photoBlob:null,processingPhoto:false,photoRun:0,Date:{now:()=>now},setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},document:{createElement:()=>({})},inventoryPhotoStatus(){},prepareInventoryCatalogPhoto:()=>new Promise(r=>resolvePhoto=r)};
 vm.createContext(ctx);
 const helper=html.slice(html.indexOf('function inventoryPhotoRetryAllowed('),html.indexOf("byId('photo-clean-retry').addEventListener"));
 const a=html.indexOf('async function preparePhoto('),b=html.indexOf("}['photo-camera'",a);
 vm.runInContext(helper+html.slice(a,b+1),ctx);
 return {ctx,nodes,setTime:t=>{now=t;for(const timer of timers)timer()},resolve:r=>resolvePhoto(r)};
}
test('New photo retry stays disabled until three minutes, failed cleanup preserves savable original, success disables retry',async()=>{
 const h=setup(),source={type:'image/jpeg',size:2000},fallback={size:1000};
 const work=h.ctx.preparePhoto(source);assert.equal(h.nodes.get('photo-clean-retry').disabled,true);
 h.resolve({blob:fallback,cleaned:false,notice:'Se conserva original'});await work;
 assert.equal(h.ctx.photoBlob,fallback);assert.equal(h.ctx.processingPhoto,false);assert.equal(h.nodes.get('photo-clean-retry').disabled,true);
 h.setTime(180999);assert.equal(h.nodes.get('photo-clean-retry').disabled,true);
 h.setTime(181000);assert.equal(h.nodes.get('photo-clean-retry').disabled,false);
 const retry=h.ctx.preparePhoto(h.ctx.newPhotoRetrySource);assert.equal(h.nodes.get('photo-clean-retry').disabled,true);
 h.resolve({blob:{size:800},cleaned:true,notice:''});await retry;h.setTime(500000);
 assert.equal(h.nodes.get('photo-clean-retry').disabled,true);assert.equal(h.ctx.newPhotoCleaned,true);
});
test('Saved unconfirmed image can retry immediately; cleaned, busy and read-only images cannot',()=>{
 const {ctx}=setup(),photo={};
 assert.equal(ctx.inventoryPhotoRetryAllowed(photo,false,false,0,true),true);
 assert.equal(ctx.inventoryPhotoRetryAllowed(photo,true,false,0,true),false);
 assert.equal(ctx.inventoryPhotoRetryAllowed(photo,false,true,0,true),false);
 assert.equal(ctx.inventoryPhotoRetryAllowed(photo,false,false,0,false),false);
 assert.equal(ctx.inventoryPhotoRetryAllowed(null,false,false,0,true),false);
});
test('Replacing a selected photo ignores an older completed job',async()=>{
 const h=setup(),source={type:'image/jpeg',size:2000};
 const older=h.ctx.preparePhoto(source);const resolveOld=h.resolve;
 // Retain the first resolver before the second selection replaces it.
 const pending=h.ctx.prepareInventoryCatalogPhoto;
 let resolveSecond;h.ctx.prepareInventoryCatalogPhoto=()=>new Promise(r=>resolveSecond=r);
 const newer=h.ctx.preparePhoto({...source});
 resolveOld({blob:{size:300},cleaned:true,notice:''});await older;
 assert.equal(h.ctx.photoBlob,null);assert.equal(h.ctx.processingPhoto,true);
 resolveSecond({blob:{size:600},cleaned:false,notice:'original'});await newer;
 assert.equal(h.ctx.photoBlob.size,600);assert.equal(h.ctx.newPhotoCleaned,false);
 h.ctx.prepareInventoryCatalogPhoto=pending;
});
