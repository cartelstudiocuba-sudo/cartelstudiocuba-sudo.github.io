import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
const url=Deno.env.get('SUPABASE_URL')!;
const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const bucket='hr-tutor-presentations';
const origins=new Set(['https://gestion.elcartelstudio.com','https://cartelstudiocuba-sudo.github.io']);
const types:Record<string,string>={pdf:'application/pdf',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',ppsx:'application/vnd.openxmlformats-officedocument.presentationml.slideshow'};
const max=50*1024*1024;
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const headers:Record<string,string>={'Cache-Control':'no-store, private','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://gestion.elcartelstudio.com','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Expose-Headers':'Content-Disposition,Content-Type'};
 const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json'}});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return json({error:'Método no permitido'},405);
 if(origin&&!origins.has(origin))return json({error:'Origen no permitido'},403);
 try{
  if((req.headers.get('content-type')||'').startsWith('multipart/form-data')){
   const bearer=req.headers.get('authorization')||'';
   const {data:{user},error:authError}=await admin.auth.getUser(bearer.replace(/^Bearer\s+/i,''));
   if(authError||!user)return json({error:'Sesión no válida'},401);
   const client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:bearer}},auth:{persistSession:false}});
   if(Number(req.headers.get('content-length')||0)>max+8192)return json({error:'La presentación supera 50 MB'},413);
   // Bound multipart input even when the client uses chunked transfer encoding.
   const reader=req.body?.getReader();if(!reader)return json({error:'Archivo no válido'},400);
   const chunks:Uint8Array[]=[];let total=0;
   while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max+8192){await reader.cancel();return json({error:'La presentación supera 50 MB'},413);}chunks.push(value);}
   const input=new Uint8Array(total);let offset=0;for(const chunk of chunks){input.set(chunk,offset);offset+=chunk.length;}
   const form=await new Response(input,{headers:{'Content-Type':req.headers.get('content-type')!}}).formData(),trial=String(form.get('trial_id')||''),file=form.get('file'),version=String(form.get('version')||'');
   const {data:ctx,error:contextError}=await client.rpc('hr_tutor_context',{p_trial:trial});
   if(contextError||!ctx)return json({error:'No autorizado o capacitación no vigente'},403);
   if(!(file instanceof File)||file.size<8||file.size>max)return json({error:'Archivo vacío o demasiado grande'},400);
   const ext=file.name.split('.').pop()?.toLowerCase()||'',magic=new Uint8Array(await file.slice(0,8).arrayBuffer());
   const valid=ext==='pdf'?new TextDecoder().decode(magic).startsWith('%PDF-'):ext==='ppt'?magic.slice(0,4).join(',')==='208,207,17,224':['pptx','ppsx'].includes(ext)&&magic[0]===80&&magic[1]===75;
   if(!types[ext]||!valid)return json({error:'Formato de presentación no válido'},400);
   const path=ctx.role_id+'/'+crypto.randomUUID()+'.'+ext;
   const {error:uploadError}=await admin.storage.from(bucket).upload(path,file,{contentType:types[ext],upsert:false});
   if(uploadError)return json({error:'No se pudo publicar el archivo privado. Reintenta.'},502);
   const {data:link,error:publishError}=await client.rpc('hr_publish_tutor',{p_trial:trial,p_path:path,p_ext:ext,p_version:version});
   if(publishError){await admin.storage.from(bucket).remove([path]);return json({error:'La plaza o la capacitación cambió. Vuelve a preparar el mensaje.'},409);}
   return json(link);
  }
  const body=await req.json();
  if(body.action==='issue-live'){
   const bearer=req.headers.get('authorization')||'';
   const {data:{user},error:authError}=await admin.auth.getUser(bearer.replace(/^Bearer\s+/i,''));
   if(authError||!user)return json({error:'Sesión no válida'},401);
   const client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:bearer}},auth:{persistSession:false}});
   const {data,error}=await client.rpc('hr_issue_tutor_live',{p_trial:String(body.trial_id||'')});
   if(error||!data)return json({error:'No autorizado o capacitación no vigente'},403);
   return json(data);
  }
  if(body.action==='live-info'){
   if(!/^[a-f0-9]{64}$/.test(String(body.token||'')))return json({error:'Enlace no válido'},404);
   const {data:link,error}=await admin.rpc('hr_resolve_tutor_live',{p_token:body.token});
   if(error||!link)return json({error:'Enlace caducado o revocado'},404);
   // Only renderer inputs are public: no contracts, replies, candidate data or private storage paths.
   const fields=['id','title','description','training','area','direct_manager','modality','variable_income','employment_type','work_days','schedule','payment_frequency','payment_method','training_period','trial_period','subordinate_workers'];
   const {data:source,error:roleError}=await admin.from('hr_roles').select(fields.join(',')+',work_content').eq('id',link.role_id).single();
   if(roleError||!source)return json({error:'La plaza no está disponible'},404);
   const raw=source.work_content&&typeof source.work_content==='object'?source.work_content:{};
   const wc:Record<string,unknown>={};
   for(const key of ['standard','standard_titles','hidden_standard_keys','content_order','custom','protocol_blocks','policy_ids','institutional_info_ids','discipline_ids','evaluation_master'])if(key in raw)wc[key]=raw[key];
   if(Array.isArray(wc.protocol_blocks))wc.protocol_blocks=wc.protocol_blocks.map((p:Record<string,unknown>)=>{const {images,...rest}=p;return rest;});
   const master=raw.training_master&&typeof raw.training_master==='object'?raw.training_master:{};
   wc.training_master={modules:master.modules||[],custom_notes:master.custom_notes||'',presentation_title:master.presentation_title||'',support_overrides:{presentation:master.support_overrides?.presentation||{}}};
   const {data:nomenclators,error:nomError}=await admin.from('hr_nomenclators').select('id,category,key,label,value,notes,sort_order,applies_to_all_roles').eq('active',true).in('category',['normas_politicas','informacion_institucional','regimen_disciplinario','parametros_evaluacion']).order('sort_order').order('label');
   if(nomError)return json({error:'No se pudo cargar el contenido de capacitación'},502);
   const selected:Record<string,unknown>={normas_politicas:wc.policy_ids,informacion_institucional:wc.institutional_info_ids,regimen_disciplinario:wc.discipline_ids,parametros_evaluacion:(wc.evaluation_master as Record<string,unknown>)?.master_param_ids};
   const noms=(nomenclators||[]).filter(n=>n.applies_to_all_roles||(Array.isArray(selected[n.category])&&(selected[n.category] as string[]).includes(n.id))).map(n=>({...n,notes:n.category==='parametros_evaluacion'?n.notes:null}));
   // The presentation's organigram uses the same active role list as the editor.
   const {data:roles,error:rolesError}=await admin.from('hr_roles').select('id,title,status').order('title');
   if(rolesError)return json({error:'No se pudo cargar la estructura de la agencia'},502);
   const {data:valid}=await admin.rpc('hr_resolve_tutor_live',{p_token:body.token});
   if(!valid)return json({error:'Enlace caducado o revocado'},404);
   return json({mode:'live',expires_at:link.expires_at,role:{...source,work_content:wc},nomenclators:noms,roles:roles||[]});
  }

  if(!['info','read','download'].includes(body.action)||!/^([a-f0-9]{64})$/.test(body.token||''))return json({error:'Enlace no válido o caducado'},404);
  const {data:link,error}=await admin.rpc('hr_resolve_tutor',{p_token:body.token});
  if(error||!link)return json({error:'Enlace no válido o caducado. Solicita uno nuevo a Recursos Humanos.'},404);
  if(body.action==='info')return json({ext:link.ext,expires_at:link.expires_at});
  const {data:file,error:readError}=await admin.storage.from(bucket).download(link.path);
  if(readError||!file)return json({error:'La presentación no está disponible. Solicita un enlace nuevo.'},404);
  // Revalidate after storage I/O; expired/revoked capabilities never start a download.
  const {data:stillValid}=await admin.rpc('hr_resolve_tutor',{p_token:body.token});
  if(!stillValid)return json({error:'Enlace no válido o caducado'},404);
  return new Response(file,{headers:{...headers,'Content-Type':types[link.ext],'Content-Disposition':(body.action==='download'||link.ext!=='pdf'?'attachment':'inline')+'; filename="Presentacion-capacitacion.'+link.ext+'"'}});
 }catch{return json({error:'No se pudo completar la operación. Reintenta.'},400);}
});
