// MCP bridge: no paid image API. Credentials remain in Vault and server memory.
const siteOrigin='https://el-cartel-mcp-fotos.cloudlesscraft64.chatgpt.site';
const origins=new Set(['https://gestion.elcartelstudio.com','https://cartelstudiocuba-sudo.github.io']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encoder=new TextEncoder();
export async function privateJobId(userId,requestId,secret){
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const b=new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode('inventory-photo-v1:'+userId+':'+requestId.toLowerCase()))).slice(0,16);
 b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
 return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
export async function boundedBytes(body,limit){
 const reader=body?.getReader();if(!reader)throw Error('BODY');let size=0;const chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('SIZE')}chunks.push(value)}
 const bytes=new Uint8Array(size);let at=0;for(const part of chunks){bytes.set(part,at);at+=part.length}return bytes;
}
export function createHandler(env,fetcher=fetch){
 let config=null;const recent=new Map();
 return async function handler(req){
  const origin=req.headers.get('origin')||'';
  const cors={'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://gestion.elcartelstudio.com','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-photo-request-id','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
  const json=(data,status=200)=>Response.json(data,{status,headers:cors});
  if(origin&&!origins.has(origin))return json({error:'Origen no permitido.'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(!['GET','POST'].includes(req.method))return json({error:'Método no permitido.'},405);
  try{
   const authorization=req.headers.get('authorization')||'';
   if(!/^Bearer \S+$/.test(authorization))return json({error:'Inicia sesión para preparar la fotografía.'},401);
   const url=env('SUPABASE_URL'),anon=env('SUPABASE_ANON_KEY'),service=env('SUPABASE_SERVICE_ROLE_KEY');
   if(!url||!anon||!service)return json({error:'Servicio no disponible.'},503);
   const authHeaders={apikey:anon,Authorization:authorization};
   const userResponse=await fetcher(url+'/auth/v1/user',{headers:authHeaders,redirect:'manual',signal:AbortSignal.timeout(10000)});
   if(!userResponse.ok)return json({error:'La sesión ha caducado.'},401);
   const user=await userResponse.json();if(!uuid.test(user.id||''))return json({error:'Sesión no válida.'},401);
   const access=await fetcher(url+'/rest/v1/rpc/inventory_has_access',{method:'POST',headers:{...authHeaders,'Content-Type':'application/json'},body:JSON.stringify({operation:'write'}),redirect:'manual',signal:AbortSignal.timeout(10000)});
   if(!access.ok||await access.json()!==true)return json({error:'No tienes permiso para editar insumos.'},403);
   if(!config||config.until<Date.now()){
    const response=await fetcher(url+'/rest/v1/rpc/inventory_photo_bridge_config',{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:'{}',redirect:'manual',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('CONFIG');const token=await response.json();if(typeof token!=='string'||token.length<32)throw Error('CONFIG');config={token,until:Date.now()+60000};
   }
   const site=async(path,options={})=>{
    const response=await fetcher(siteOrigin+'/api/pilot/'+path,{...options,headers:{...(options.headers||{}),'OAI-Sites-Authorization':'Bearer '+config.token},redirect:'manual',signal:AbortSignal.timeout(25000)});
    if(!response.ok){await response.body?.cancel();throw Error('BRIDGE')}return response;
   };
   const requestUrl=new URL(req.url),requestId=req.method==='POST'?req.headers.get('x-photo-request-id'):requestUrl.searchParams.get('job_id');
   if(req.method==='GET'&&!requestId){const status=await(await site('status')).json();return json({available:status.active_subscriptions>0&&(status.jobs||[]).reduce((n,r)=>n+r.count,0)<20,mode:'mcp'});}
   if(!uuid.test(requestId||''))return json({error:'Solicitud de fotografía no válida.'},400);
   // A caller cannot address another user's jobs even if they learn its request nonce.
   const jobId=await privateJobId(user.id,requestId,config.token);
   if(req.method==='POST'){
    if(req.headers.get('content-type')?.split(';')[0]!=='image/jpeg')return json({error:'Se requiere una fotografía JPEG.'},415);
    if(Number(req.headers.get('content-length'))>1536*1024)return json({error:'Fotografía demasiado grande.'},413);
    const bytes=await boundedBytes(req.body,1536*1024);if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)return json({error:'Fotografía no válida.'},400);
    const now=Date.now();for(const [id,row] of recent)if(now-row.at>60000)recent.delete(id);
    const last=recent.get(user.id);if(last&&last.id!==requestId&&now-last.at<15000)return json({error:'Espera unos segundos antes de enviar otra fotografía.'},429);
    const status=await(await site('status')).json();if(status.active_subscriptions<1)return json({error:'La limpieza automática no está disponible.'},503);
    recent.set(user.id,{id:requestId,at:now});
    const response=await site('upload',{method:'POST',headers:{'Content-Type':'image/jpeg','x-photo-job-id':jobId},body:bytes});const job=await response.json();
    return json({job_id:requestId,state:job.state,accepted:!!job.delivery?.accepted},202);
   }
   const jobs=await(await site('jobs')).json(),row=jobs.jobs?.find(r=>r.id===jobId);
   if(!row)return json({error:'No se encontró esta fotografía.'},404);
   if(requestUrl.searchParams.get('result')==='1'){
    if(row.state!=='complete')return json({error:'La fotografía todavía se está procesando.'},409);
    const response=await site('image?id='+encodeURIComponent(jobId)+'&kind=result');
    if(!response.headers.get('content-type')?.startsWith('image/jpeg'))throw Error('RESULT');
    const bytes=await boundedBytes(response.body,200*1024);if(bytes[0]!==255||bytes[1]!==216)throw Error('RESULT');
    return new Response(bytes,{headers:{...cors,'Content-Type':'image/jpeg','X-Content-Type-Options':'nosniff'}});
   }
   const messages={queued:'Foto enviada · esperando a ChatGPT…',processing:'ChatGPT está limpiando el fondo…',complete:'Fondo limpio · preparando vista previa…',failed:'No se pudo limpiar el fondo. Se conserva la foto original optimizada.'};
   return json({job_id:requestId,state:row.state,message:messages[row.state]||messages.queued});
  }catch(error){return json({code:'MCP_UNAVAILABLE',error:error?.message==='SIZE'?'La fotografía supera el tamaño permitido.':'No se pudo completar la limpieza. Se conserva la foto original optimizada.'},error?.message==='SIZE'?413:502);}
 };
}
