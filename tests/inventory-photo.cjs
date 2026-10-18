const fs=require('fs'),vm=require('vm'),assert=require('assert');
const h=fs.readFileSync(require('path').join(__dirname,'../inventario-insumos.html'),'utf8');
for(const m of h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(m[1]);
const els={};const el=id=>els[id]||=( {value:'',files:[],disabled:false,textContent:'',style:{},classList:{add(){},toggle(){}},reportValidity:()=>true} );
let uploads=0,rpcs=0,closed=0,failRpc=true,failUpload=false,downloadFail=false,ids=[];
const ctx=vm.createContext({persistMovement(){},clearPersistedMovement(){},byId:el,form:Object.assign(el('form'),{elements:[]}),modal:el('modal'),showModal(){},photoRun:1,processingPhoto:false,photoBlob:new Blob(['jpeg'],{type:'image/jpeg'}),movementType:'entry',productKind:'new',pendingRequest:null,savingMovement:false,photoBucket:'inventory-images',productSelect:{value:''},crypto:require('crypto').webcrypto,sb:{auth:{getUser:async()=>({data:{user:{id:'user'}}})},storage:{from:()=>({upload:async()=>{uploads++;return {error:failUpload?{message:'upload offline'}:null}},download:async()=>({error:downloadFail?{}:null}),remove:async()=>({error:null})})} ,rpc:async(n,a)=>{rpcs++;ids.push(a.request_id);assert(a.payload.photo_path);return {error:failRpc?{message:'offline'}:null}}},closeModal(){closed++},loadInventory:async()=>{},document:{querySelector:()=>el('notice')}});
vm.runInContext(h.slice(h.indexOf('let draftType=null;'),h.indexOf("byId('move-purpose').closest")),ctx);
vm.runInContext(h.slice(h.indexOf('form.onsubmit=async'),h.indexOf("byId('week-ending').addEventListener",h.indexOf('form.onsubmit=async'))),ctx);
(async()=>{el('product-name').value='Prueba';el('move-qty').value=7;
await ctx.form.onsubmit({preventDefault(){}});assert.equal(uploads,1);assert.equal(rpcs,1);assert.equal(closed,0);assert.equal(el('product-name').value,'Prueba');
failRpc=false;await ctx.form.onsubmit({preventDefault(){}});assert.equal(uploads,1);assert.equal(rpcs,2);assert.equal(ids[0],ids[1]);assert.equal(closed,1);
ctx.photoBlob=new Blob(['jpeg']);ctx.photoRun=2;failUpload=true;downloadFail=true;await ctx.form.onsubmit({preventDefault(){}});assert.equal(rpcs,2);assert.match(el('form-message').textContent,/upload offline/);
ctx.photoBlob=null;ctx.photoRun++;ctx.sb.rpc=async()=>({error:null});await ctx.form.onsubmit({preventDefault(){}});assert.equal(closed,2);assert.equal(ctx.savingMovement,false);
console.log('PASS: syntax; upload before transaction; form retained on failure; stable retry UUID; no repeat upload; upload failure blocks RPC; omit photo permits save.');
})().catch(e=>{console.error(e);process.exit(1)});


