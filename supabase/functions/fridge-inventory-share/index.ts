import {createClient} from 'npm:@supabase/supabase-js@2.57.0';
import {jsPDF} from 'npm:jspdf@2.5.2';
import {buildReport,message} from './report.mjs';
const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_ANON_KEY')!;
const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'https://gestion.elcartelstudio.com','Vary':'Origin','Cache-Control':'no-store'};
Deno.serve(async req=>{
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,GET,OPTIONS'}});
 const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,'0')).join('');
 if(req.method==='GET'){
  const id=new URL(req.url).searchParams.get('id')||'';if(!/^[A-Za-z0-9_-]{22}$/.test(id))return reply({error:'Enlace no válido o vencido.'},404);
  const {data:link,error}=await admin.from('fridge_report_short_links').select('object_path,filename,expires_at').eq('token_hash',await digest(id)).maybeSingle();
  if(error||!link||Date.parse(link.expires_at)<=Date.now())return reply({error:'Enlace no válido o vencido.'},404);
  const file=await admin.storage.from('fridge-inventory-reports').download(link.object_path);if(file.error||!file.data)return reply({error:'El reporte no está disponible.'},404);
  return new Response(file.data,{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="'+link.filename+'"','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}});
 }
 if(req.method!=='POST')return reply({error:'Método no permitido'},405);
 const token=req.headers.get('authorization')||'',client=createClient(url,key,{global:{headers:{Authorization:token}},auth:{persistSession:false}});
 const {data:{user},error}=await client.auth.getUser(token.replace(/^Bearer\s+/i,''));if(error||!user)return reply({error:'Inicia sesión para generar el reporte.'},401);
 let path:string|null=null;
 try{
  const body=await req.json();if(!Array.isArray(body.ids)||!body.ids.length||body.ids.length>500||body.ids.some((id:unknown)=>typeof id!=='string'))return reply({error:'Selecciona los productos del reporte.'},400);
  const {data:snapshot,error:denied}=await client.rpc('fridge_inventory_report_snapshot');if(denied)return reply({error:'No tienes acceso a este inventario.'},403);
  const ids=new Set(body.ids),rows=snapshot.products.filter((p:{id:string})=>ids.has(p.id));if(rows.length!==ids.size)return reply({error:'El inventario cambió. Actualiza y vuelve a intentarlo.'},409);
  const pdf=buildReport(jsPDF,snapshot,rows);path=user.id+'/'+crypto.randomUUID()+'.pdf';
  const bucket=admin.storage.from('fridge-inventory-reports');const uploaded=await bucket.upload(path,pdf,{contentType:'application/pdf',upsert:false});if(uploaded.error)throw Error('upload');
  const name='Inventario_nevera_'+snapshot.as_of.slice(0,10)+'.pdf';
  const id=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  const saved=await admin.from('fridge_report_short_links').insert({token_hash:await digest(id),object_path:path,filename:name,created_by:user.id,expires_at:new Date(Date.now()+604800000).toISOString()});if(saved.error)throw Error('short_link');
  const shortUrl='https://gestion.elcartelstudio.com/r/#'+id;
  return reply({url:shortUrl,message:message(snapshot,shortUrl),as_of:snapshot.as_of,expires_in:604800});
 }catch{if(path)await admin.storage.from('fridge-inventory-reports').remove([path]);return reply({error:'No se pudo preparar el PDF. Intenta de nuevo.'},500);}
});
