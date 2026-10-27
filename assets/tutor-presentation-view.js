'use strict';
(async()=>{
 const token=new URLSearchParams(location.hash.slice(1)).get('token')||'';
 // Keep the capability out of referrers, history snapshots and subsequent URLs.
 history.replaceState(null,'',location.pathname);
 window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#token='))location.reload();});
 const status=document.getElementById('status'),error=document.getElementById('error'),view=document.getElementById('view'),download=document.getElementById('download'),preview=document.getElementById('preview');
 let info,objectUrl,expiryTimer;
 const clearPreview=()=>{preview.replaceChildren();if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=null;};
 const fail=e=>{clearPreview();error.textContent=e.message||'No se pudo cargar la presentación.';status.textContent='Acceso no disponible';view.disabled=download.disabled=true;};
 const request=async action=>{const response=await fetch('https://jhumvctocphyiwhszeaz.supabase.co/functions/v1/hr-tutor-presentation',{method:'POST',headers:{'Content-Type':'application/json',apikey:'sb_publishable_ZHV-5dlsjfamQpfUOsgumg_G-vN84Gn'},body:JSON.stringify({action,token}),credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',signal:AbortSignal.timeout(120000)});if(!response.ok){const data=await response.json();throw Error(data.error||'No se pudo acceder a la presentación.');}return response;};
 const act=async downloading=>{
  view.disabled=download.disabled=true;error.textContent='';status.textContent='Cargando presentación…';
  try{
   if(Date.now()>=Date.parse(info.expires_at))throw Error('El enlace ha caducado. Solicita uno nuevo a Recursos Humanos.');
   const response=await request(downloading?'download':'read'),blob=await response.blob();
   clearPreview();objectUrl=URL.createObjectURL(blob);
   if(downloading||info.ext!=='pdf'){const a=document.createElement('a');a.href=objectUrl;a.download='Presentacion-capacitacion.'+info.ext;a.click();status.textContent='Descarga preparada. Revisa las descargas del navegador.';}
   else{const f=document.createElement('iframe');f.title='Presentación de capacitación en PDF';f.src=objectUrl;preview.append(f);status.textContent='Si el navegador no muestra el PDF, usa Descargar presentación.';}
  }catch(e){fail(e);return;}
  view.disabled=download.disabled=false;
 };
 view.onclick=()=>act(false);download.onclick=()=>act(true);window.addEventListener('pagehide',()=>{clearPreview();clearTimeout(expiryTimer);});
 try{
  if(!/^[a-f0-9]{64}$/.test(token))throw Error('Enlace no válido. Solicita uno nuevo a Recursos Humanos.');
  const liveResponse=await request('live-info').catch(()=>null);
  if(liveResponse){info=await liveResponse.json();const remaining=Date.parse(info.expires_at)-Date.now();if(!Number.isFinite(remaining)||remaining<=0)throw Error('El enlace ha caducado.');
   const title=document.createElement('h2');title.textContent=info.presentation_title||info.title;preview.append(title);
   const add=(heading,body)=>{if(!body)return;const section=document.createElement('section');section.style.cssText='padding:24px;margin:18px 0;background:#1c2c40;border-radius:18px;line-height:1.7';const h=document.createElement('h3');h.textContent=heading;section.append(h);const p=document.createElement('p');p.textContent=body;section.append(p);preview.append(section);};
   add('Plaza',info.title);add('Descripción',info.description);add('Capacitación',info.training);
   (info.modules||[]).forEach((m,i)=>add((i+1)+'. '+m.title,[m.guide,m.video].filter(Boolean).join('\n')));
   add('Indicaciones adicionales',info.custom_notes);
   status.textContent='Presentación disponible hasta '+new Date(info.expires_at).toLocaleString('es-ES')+'.';
   view.hidden=download.hidden=true;expiryTimer=setTimeout(()=>fail(Error('El enlace ha caducado.')),Math.min(remaining,2147483647));return;
  }
  info=await(await request('info')).json();
  const remaining=Date.parse(info.expires_at)-Date.now();if(!Number.isFinite(remaining)||remaining<=0||!['pdf','ppt','pptx','ppsx'].includes(info.ext))throw Error('El enlace ha caducado.');
  status.textContent='Acceso válido hasta '+new Date(info.expires_at).toLocaleString('es-ES')+'. El enlace permite acceder a quien lo posea; no lo compartas fuera de la capacitación.';
  view.textContent=info.ext==='pdf'?'Consultar presentación':'Consultar / descargar PowerPoint';view.disabled=download.disabled=false;
  expiryTimer=setTimeout(()=>fail(Error('El enlace ha caducado. Solicita uno nuevo a Recursos Humanos.')),Math.min(remaining,2147483647));
 }catch(e){fail(e);}
})();
