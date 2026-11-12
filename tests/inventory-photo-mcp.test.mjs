import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHandler,privateJobId} from '../supabase/functions/inventory-photo-clean/bridge.mjs';
const nonce='12345678-1234-4234-8234-123456789012',uid='12345678-1234-4234-8234-123456789013',other='12345678-1234-4234-8234-123456789014';
const token='private-site-credential-abcdefghijklmnopqrstuvwxyz';
const jpeg=Uint8Array.from([255,216,255,192,0,17,8,0,32,0,32,3,1,17,0,2,17,0,3,17,0,255,217]);
test('bridge authenticates, isolates jobs, preserves idempotency and returns bounded private results',async()=>{
 let permission=true,subscriptions=1,state='queued',redirect=false,tooLarge=false;const jobs=new Map(),uploads=[];let configCalls=0;
 const fetcher=async(url,o={})=>{
  assert.equal(o.redirect,'manual');
  if(url==='https://supa.test/auth/v1/user')return Response.json({id:o.headers.Authorization==='Bearer other'?other:uid});
  if(url==='https://supa.test/rest/v1/rpc/inventory_has_access')return Response.json(permission);
  if(url==='https://supa.test/rest/v1/rpc/inventory_photo_bridge_config'){configCalls++;assert.equal(o.headers.Authorization,'Bearer service-secret');return Response.json(token)}
  assert(url.startsWith('https://el-cartel-mcp-fotos.cloudlesscraft64.chatgpt.site/api/pilot/'));assert.equal(o.headers['OAI-Sites-Authorization'],'Bearer '+token);assert.equal(o.headers.Authorization,undefined);
  if(redirect)return new Response(null,{status:302,headers:{Location:'https://untrusted.test/'}});
  if(url.endsWith('/status'))return Response.json({active_subscriptions:subscriptions,jobs:[]});
  if(url.endsWith('/upload')){const id=o.headers['x-photo-job-id'];uploads.push(id);jobs.set(id,{id,state});return Response.json({state,delivery:{accepted:1}})}
  if(url.endsWith('/jobs'))return Response.json({jobs:[...jobs.values()].map(row=>({...row,state}))});
  if(url.includes('/image?'))return new Response(tooLarge?new Uint8Array(205000):jpeg,{headers:{'Content-Type':'image/jpeg'}});
  throw Error('Unexpected outbound request');
 };
 const h=createHandler(name=>({SUPABASE_URL:'https://supa.test',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service-secret'}[name]),fetcher);
 const req=(method='GET',query='',auth='user',body)=>new Request('https://edge.test/'+query,{method,headers:{origin:'https://gestion.elcartelstudio.com',...(auth?{Authorization:'Bearer '+auth}:{}),'Content-Type':'image/jpeg','x-photo-request-id':nonce},...(body?{body}: {})});
 assert.equal((await h(req('GET','',null))).status,401);permission=false;assert.equal((await h(req())).status,403);assert.equal(configCalls,0);permission=true;
 assert.equal((await h(new Request('https://edge.test',{headers:{origin:'https://evil.test'}}))).status,403);
 assert.equal((await(await h(req())).json()).available,true);
 assert.equal((await h(req('POST','','user',jpeg))).status,202);assert.equal((await h(req('POST','','user',jpeg))).status,202);
 assert.equal(uploads[0],uploads[1]);assert.notEqual(uploads[0],nonce);assert.equal(jobs.size,1);
 assert.equal((await h(req('GET','?job_id='+nonce,'other'))).status,404);
 assert.equal((await h(req('GET','?job_id='+nonce+'&result=1'))).status,409);
 state='complete';const result=await h(req('GET','?job_id='+nonce+'&result=1'));assert.equal(result.status,200);assert.deepEqual(new Uint8Array(await result.arrayBuffer()),jpeg);assert.equal(result.headers.get('Cache-Control'),'no-store');
 tooLarge=true;assert.equal((await h(req('GET','?job_id='+nonce+'&result=1'))).status,413);tooLarge=false;
 subscriptions=0;assert.equal((await h(req('POST','','user',jpeg))).status,503);subscriptions=1;
 redirect=true;assert.equal((await h(req())).status,502);
 assert.notEqual(await privateJobId(uid,nonce,token),await privateJobId(other,nonce,token));
});
test('form handles upload progress, asynchronous processing, original fallback and changed selection',async()=>{
 const html=fs.readFileSync('inventario-insumos.html','utf8');for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))if(match[1].includes('async function prepareInventoryCatalogPhoto'))new vm.Script(match[1]);
 assert(html.includes('id="photo-camera"'));assert(html.includes('capture="environment"'));assert(!html.includes('api.openai.com/v1/images'));
 const source=html.slice(html.indexOf('async function inventoryPhotoAuthHeaders('),html.indexOf('async function shrinkPhoto('));
 const original=new Blob([jpeg],{type:'image/jpeg'}),edited=new Blob([jpeg,Uint8Array.from([1])],{type:'image/jpeg'});let mode='success',current=true,clock=0,shrinkSource,polls=0;const stages=[];
 const context={Blob,URL,DOMException,AbortSignal,crypto,Date:{now:()=>clock},setTimeout:cb=>{clock+=3000;queueMicrotask(cb)},inventoryPhotoAiEndpoint:'https://edge.test/',inventoryPhotoAiAvailability:null,window:{inventorySupabaseClient:{auth:{getSession:async()=>({data:{session:{access_token:'session'}}})}}},inventoryPhotoAiInput:async()=>original,shrinkPhoto:async value=>{shrinkSource=value;return value},fetch:async(url,options)=>{
  assert.equal(options.headers.Authorization,'Bearer session');if(mode==='network')throw Error('offline');
  if(!url.includes('?'))return Response.json({available:true});
  if(url.includes('&result=1'))return new Response(edited,{headers:{'Content-Type':'image/jpeg'}});
  polls++;return Response.json({state:mode==='timeout'?'queued':polls===1?'queued':polls===2?'processing':'complete'});
 },XMLHttpRequest:class{
  constructor(){this.upload={};this.status=202;}open(method,url){assert.equal(method,'POST');assert.equal(url,'https://edge.test/')}setRequestHeader(){}abort(){this.onabort()}send(){queueMicrotask(()=>{this.upload.onprogress({lengthComputable:true,loaded:4,total:8});this.responseText=JSON.stringify({job_id:this.nonce,state:'queued'});if(mode==='changed')current=false;this.onload()})}
 }};
 const originalSet=context.XMLHttpRequest.prototype.setRequestHeader;context.XMLHttpRequest.prototype.setRequestHeader=function(k,v){if(k==='x-photo-request-id')this.nonce=v;originalSet.call(this,k,v)};
 vm.createContext(context);new vm.Script(source).runInContext(context);
 let r=await context.prepareInventoryCatalogPhoto(original,(...args)=>stages.push(args),()=>current);assert.equal(r.cleaned,true);assert.equal(await shrinkSource.text(),await edited.text());assert(stages.some(row=>row[1]===.5));assert(stages.some(row=>row[0].includes('ChatGPT')));
 mode='network';context.inventoryPhotoAiAvailability=null;r=await context.prepareInventoryCatalogPhoto(original,()=>{},()=>true);assert.equal(r.cleaned,false);assert.equal(shrinkSource,original);assert(r.notice.includes('original'));
 mode='changed';context.inventoryPhotoAiAvailability=null;await assert.rejects(context.prepareInventoryCatalogPhoto(original,()=>{},()=>current),{name:'AbortError'});
 mode='timeout';current=true;clock=0;polls=0;context.inventoryPhotoAiAvailability=null;r=await context.prepareInventoryCatalogPhoto(original,()=>{},()=>true);assert.equal(r.cleaned,false);assert.equal(shrinkSource,original);
});
