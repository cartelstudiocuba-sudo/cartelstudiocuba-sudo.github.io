/* Same authenticated MCP photography pipeline as Inventory; no image API credentials in the client. */
(()=>{'use strict';
function create(client,{scope='inventory'}={}){
 const endpoint='https://jhumvctocphyiwhszeaz.supabase.co/functions/v1/inventory-photo-clean?scope='+encodeURIComponent(scope);
 let availability=null;const attempts=new WeakMap();
 async function headers(){const {data,error}=await client.auth.getSession();if(error||!data?.session?.access_token)throw Error('Sesión caducada');return {Authorization:'Bearer '+data.session.access_token};}
 async function resize(file,{square=false,maxSide=1280,maxBytes=1536*1024,onStage=()=>{}}={}){
  const url=URL.createObjectURL(file),img=new Image();
  try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('No se pudo leer la foto. Usa JPG, PNG o WebP.'));img.src=url;});
   if(!img.naturalWidth||!img.naturalHeight)throw Error('La foto no tiene dimensiones válidas.');
   for(let side=Math.min(maxSide,Math.max(img.naturalWidth,img.naturalHeight));side>=1;side=Math.max(1,Math.floor(side*.75))){
    const scale=Math.min(1,side/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale)),canvas=document.createElement('canvas');
    canvas.width=square?side:w;canvas.height=square?side:h;
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('No se pudo preparar la foto.');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    // Fit the complete bottle/can into a square, preserving the label and cap.
    ctx.drawImage(img,(canvas.width-w)/2,(canvas.height-h)/2,w,h);onStage('Comprimiendo fotografía…');
    for(const quality of [.86,.72,.58,.44]){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=maxBytes)return blob;}
    if(side<=128)break;
   }throw Error('No se pudo comprimir la fotografía. Prueba con otra imagen.');
  }finally{URL.revokeObjectURL(url);}
 }
 async function upload(input,id,onStage,isCurrent){const auth=await headers();return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();xhr.open('POST',endpoint);xhr.timeout=40000;
  Object.entries({...auth,'Content-Type':'image/jpeg','x-photo-request-id':id}).forEach(([k,v])=>xhr.setRequestHeader(k,v));
  xhr.upload.onprogress=e=>{if(!isCurrent()){xhr.abort();return;}onStage(e.lengthComputable?'Subiendo foto… '+Math.round(e.loaded/e.total*100)+'%':'Subiendo foto…',e.lengthComputable?e.loaded/e.total:null);};
  xhr.onload=()=>{if(xhr.status<200||xhr.status>=300){let detail={};try{detail=JSON.parse(xhr.responseText);}catch{}const error=Error(detail.error||'No se pudo enviar la foto');if(xhr.status===429&&detail.code==='RATE_LIMITED')error.retryAfterMs=Math.min(30000,Math.max(1000,Number(detail.retry_after_seconds||15)*1000));reject(error);return;}try{resolve(JSON.parse(xhr.responseText));}catch{reject(Error('Respuesta no válida'));}};
  xhr.onerror=xhr.ontimeout=()=>reject(Error('No se pudo confirmar la carga'));xhr.onabort=()=>reject(new DOMException('Selección sustituida','AbortError'));xhr.send(input);
 });}
 async function prepare(file,onStage=()=>{},isCurrent=()=>true){
  if(!file.type?.startsWith('image/')||file.size>30*1024*1024)throw Error('Selecciona una foto de hasta 30 MB.');
  let source=file,cleaned=false,notice='';let attempt=attempts.get(file);if(!attempt){attempt={id:crypto.randomUUID(),input:null,sent:false};attempts.set(file,attempt);}
  try{
   onStage('Comprobando limpieza automática del fondo…');
   if(!attempt.sent&&(!availability||!availability.available||Date.now()-availability.at>20000)){const r=await fetch(endpoint,{headers:await headers(),cache:'no-store',signal:AbortSignal.timeout(15000)});let status;try{status=await r.json();}catch{throw Error('El servicio de limpieza no respondió correctamente');}if(!r.ok)throw Error(status.error||'Servicio de limpieza no disponible');availability={at:Date.now(),available:status.available===true,error:status.error};}
   if(!attempt.sent&&!availability.available)throw Error(availability.error||'La limpieza automática no está disponible');
   const input=attempt.input||(attempt.input=await resize(file,{onStage}));if(!isCurrent())throw new DOMException('Selección sustituida','AbortError');
   const id=attempt.id;let job;
   for(let retry=0;retry<2;retry++){
    try{attempt.sent=true;job=await upload(input,id,onStage,isCurrent);break;}
    catch(error){if(!error.retryAfterMs||retry===1)throw error;const until=Date.now()+error.retryAfterMs;while(Date.now()<until){if(!isCurrent())throw new DOMException('Selección sustituida','AbortError');onStage('Esperando '+Math.ceil((until-Date.now())/1000)+' segundos para reintentar el envío…');await new Promise(resolve=>setTimeout(resolve,Math.min(1000,until-Date.now())));}}
   }
   if(job.job_id!==id)throw Error('Solicitud no válida');
   const deadline=Date.now()+180000;
   while(Date.now()<deadline){
    if(!isCurrent())throw new DOMException('Selección sustituida','AbortError');
    const r=await fetch(endpoint+'&job_id='+encodeURIComponent(id),{headers:await headers(),cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('No se pudo consultar la fotografía');
    const status=await r.json();if(!isCurrent())throw new DOMException('Selección sustituida','AbortError');if(status.state==='failed'){attempts.delete(file);throw Error('No se pudo limpiar el fondo');}
    if(status.state==='complete'){
     onStage('Descargando fotografía con fondo limpio…');const result=await fetch(endpoint+'&job_id='+encodeURIComponent(id)+'&result=1',{headers:await headers(),cache:'no-store',signal:AbortSignal.timeout(25000)});
     if(!result.ok||!result.headers.get('content-type')?.startsWith('image/jpeg'))throw Error('Resultado no válido');source=await result.blob();if(!source.size||source.size>200*1024)throw Error('Imagen no válida');cleaned=true;break;
    }
    onStage(status.state==='processing'?'Limpiando fondo con ChatGPT… Puedes completar los demás campos.':'Foto enviada · esperando a ChatGPT… Puedes completar los demás campos.');await new Promise(resolve=>setTimeout(resolve,3000));
   }
   if(!cleaned)throw Error('La limpieza tardó demasiado');
  }catch(e){if(!isCurrent())throw e;source=file;notice='Limpieza no completada: '+(e.message||'No se pudo contactar con el servicio')+'. Se conserva la foto original optimizada.';}
  if(!isCurrent())throw new DOMException('Selección sustituida','AbortError');
  const blob=await resize(source,{square:true,maxSide:800,maxBytes:180000,onStage});
  if(!isCurrent())throw new DOMException('Selección sustituida','AbortError');return {blob,cleaned,notice};
 }
 return {prepare};
}
window.CartelCatalogPhoto={create};
})();
