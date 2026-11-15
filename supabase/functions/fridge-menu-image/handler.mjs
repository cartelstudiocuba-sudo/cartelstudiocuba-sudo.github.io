const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function jpegSize(bytes){if(bytes[0]!==255||bytes[1]!==216)throw Error('JPEG');let p=2;while(p+4<bytes.length){if(bytes[p]!==255){p++;continue;}let code=bytes[++p];while(code===255)code=bytes[++p];p++;if(code===217||code===218)break;if(code===1||code>=208&&code<=215)continue;const n=bytes[p]*256+bytes[p+1];if(n<2||p+n>bytes.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(code))return {width:bytes[p+5]*256+bytes[p+6],height:bytes[p+3]*256+bytes[p+4]};p+=n;}throw Error('JPEG');}
export function createHandler(env,fetcher=fetch){return async req=>{
 const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, HEAD, OPTIONS','X-Content-Type-Options':'nosniff'};
 const error=(text,status)=>Response.json({error:text},{status,headers:{...cors,'Cache-Control':'no-store'}});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(!['GET','HEAD'].includes(req.method))return error('Método no permitido',405);
 const u=new URL(req.url),version=u.searchParams.get('version'),photo=u.searchParams.get('photo');if(version&&!uuid.test(version))return error('Versión no válida',400);if(photo&&!uuid.test(photo))return error('Producto no válido',400);if(photo&&u.searchParams.has('data'))return error('Solicitud no válida',400);
 try{
  const base=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');if(!base||!key)throw Error('CONFIG');
  const headers={apikey:key,Authorization:'Bearer '+key};
  if(photo){
   const lookup=await fetcher(base+'/rest/v1/rpc/fridge_menu_product_photo_ref',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({p_product:photo,p_version:version||null}),redirect:'manual',signal:AbortSignal.timeout(10000)});if(!lookup.ok)throw Error('PHOTO_LOOKUP');const ref=await lookup.json();if(!ref)return error('Fotografía no disponible',404);
   if(!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(ref.path||''))throw Error('PHOTO_PATH');
   const file=await fetcher(base+'/storage/v1/object/fridge-images/'+ref.path,{headers,redirect:'manual',signal:AbortSignal.timeout(15000)});if(!file.ok)return error('Fotografía no disponible',404);
   const reader=file.body.getReader(),chunks=[];let size=0;while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>4194304){await reader.cancel();throw Error('PHOTO_SIZE');}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}const dims=jpegSize(bytes);if(!dims.width||!dims.height||dims.width*dims.height>16000000)throw Error('PHOTO_DIMENSIONS');
   return new Response(req.method==='HEAD'?null:bytes,{headers:{...cors,'Content-Type':'image/jpeg','Content-Length':String(size),'Cache-Control':'public, max-age=60'}});
  }
  const dataMode=u.searchParams.get('data')==='1';
  const r=await fetcher(base+'/rest/v1/rpc/'+(dataMode?'fridge_menu_public':'fridge_menu_image_ref'),{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({p_version:version||null}),redirect:'manual',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('LOOKUP');const row=await r.json();if(dataMode)return Response.json(row,{headers:{...cors,'Cache-Control':'no-store'}});if(!row)return error('Todavía no hay una carta aprobada',404);
  if(!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(row.path||'')||!uuid.test(row.id||''))throw Error('PATH');
  const file=await fetcher(base+'/storage/v1/object/fridge-menu/'+row.path,{headers,redirect:'manual',signal:AbortSignal.timeout(20000)});if(!file.ok)throw Error('FILE');
  const reader=file.body.getReader(),parts=[];let length=0;while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>4194304){await reader.cancel();throw Error('SIZE');}parts.push(value);}
  const bytes=new Uint8Array(length);let pos=0;for(const part of parts){bytes.set(part,pos);pos+=part.length;}
  const dims=jpegSize(bytes);const expected={width:row.width??2550,height:row.height??3300};if(!Number.isInteger(expected.width)||!Number.isInteger(expected.height)||expected.width<1181||expected.height<1181||expected.width>4724||expected.height>4724||expected.width*expected.height>16000000||dims.width!==expected.width||dims.height!==expected.height)throw Error('DIMENSIONS');
  const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(sha!==row.sha256)throw Error('HASH');
  return new Response(req.method==='HEAD'?null:bytes,{headers:{...cors,'Content-Type':'image/jpeg','Content-Length':String(length),'Content-Disposition':(u.searchParams.get('download')==='1'?'attachment':'inline')+'; filename="carta-menu-bar-v'+Number(row.number)+'.jpg"','Cache-Control':version?'public, max-age=31536000, immutable':'public, max-age=60','ETag':'"'+sha+'"'}});
 }catch{return error('No se pudo obtener la carta aprobada. Reintenta en unos segundos.',503);}
};}
