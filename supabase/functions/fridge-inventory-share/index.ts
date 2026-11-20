import {createClient} from 'npm:@supabase/supabase-js@2.57.0';
import {jsPDF} from 'npm:jspdf@2.5.2';
import {buildReport,message} from './report.mjs';
const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_ANON_KEY')!;
const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'https://gestion.elcartelstudio.com','Vary':'Origin','Cache-Control':'no-store'};
Deno.serve(async req=>{
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'}});
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
  const name='Inventario_nevera_'+snapshot.as_of.slice(0,10)+'.pdf';const signed=await bucket.createSignedUrl(path,604800,{download:name});if(signed.error||!signed.data?.signedUrl)throw Error('sign');
  return reply({url:signed.data.signedUrl,message:message(snapshot,signed.data.signedUrl),as_of:snapshot.as_of,expires_in:604800});
 }catch{if(path)await admin.storage.from('fridge-inventory-reports').remove([path]);return reply({error:'No se pudo preparar el PDF. Intenta de nuevo.'},500);}
});
