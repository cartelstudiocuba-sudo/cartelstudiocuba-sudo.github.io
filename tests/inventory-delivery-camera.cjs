const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
 const code=fs.readFileSync('assets/inventory-orders.js','utf8'),dom=new JSDOM('<input id="proof-file"><p id="message"></p>',{runScripts:'outside-only'}),w=dom.window,d=w.document;let stopped=0,resolveStream,selected;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};w.HTMLMediaElement.prototype.play=async()=>{};
 w.navigator.mediaDevices={getUserMedia:async opts=>{assert.equal(opts.audio,false);assert.equal(opts.video.facingMode.ideal,'environment');return new Promise(r=>resolveStream=r)}};
 w.$=id=>d.getElementById(id);w.photoPreparing=false;w.busy=false;w.message=t=>d.querySelector('#message').textContent=t;w.selectEvidence=async blob=>selected=blob;
 w.eval(code.slice(code.indexOf('let evidenceCamera='),code.indexOf('async function selectEvidence(')));
 const start=w.openEvidenceCamera();d.querySelector('[data-camera-close]').click();resolveStream({getTracks:()=>[{stop(){stopped++}}]});await start;assert.equal(stopped,1,'permission resolving after cancel releases camera');
 const next=w.openEvidenceCamera();resolveStream({getTracks:()=>[{stop(){stopped++}}]});await next;const video=d.querySelector('video');Object.defineProperties(video,{videoWidth:{value:1600},videoHeight:{value:900}});
 let draw;w.HTMLCanvasElement.prototype.getContext=function(){return{drawImage(...args){draw=args}}};w.HTMLCanvasElement.prototype.toBlob=function(fn){fn(new w.Blob(['jpeg'],{type:'image/jpeg'}))};
 await d.querySelector('[data-camera-shoot]').onclick();assert.equal(draw.length,5,'full frame, no crop coordinates');assert.equal(draw[3],1280);assert.equal(draw[4],720);assert(selected);assert.equal(stopped,2);assert.equal(d.querySelector('video').srcObject,null);
 let cameraOpened=0;delete w.navigator.mediaDevices;d.querySelector('#proof-file').click=()=>cameraOpened++;await w.openEvidenceCamera();assert.equal(cameraOpened,1);
 for(const name of ['inventario-pedidos.html','inventario-solicitud.html','inventario-aprobaciones.html']){const html=fs.readFileSync(name,'utf8');assert.match(html,/id="proof-camera"/);assert.match(html,/id="proof-file"[^>]*capture="environment"/);assert.match(html,/id="proof-gallery-file"/)}
 dom.window.close();console.log('PASS: rear camera, full frame with preserved ratio, cancel/late permission cleanup, native capture fallback and gallery');
})().catch(e=>{console.error(e);process.exit(1)});
