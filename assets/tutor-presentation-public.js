'use strict';
if(new URLSearchParams(location.search).get('documento')==='presentacion')document.documentElement.classList.add('training-public');
async function bootTutorPresentation(){
 const guide=new URLSearchParams(location.search).get('material')==='guia',supportType=guide?'guide':'presentation';
 const materialTitle=guide?'Documento de conducción para el tutor':'Presentación para el tutor';
 const token=new URLSearchParams(location.hash.slice(1)).get('token')||'';
 history.replaceState(null,'',location.pathname+'?documento=presentacion'+(guide?'&material=guia':''));
 document.title=materialTitle+' · El Cartel Studio';
 const root=document.createElement('main');root.id='trainingPublicContent';
 root.innerHTML='<header class="training-public-head"><div><small>EL CARTEL STUDIO · CAPACITACIÓN</small><h1>'+materialTitle+'</h1><p role="status">Validando acceso…</p></div><button class="btn primary" disabled>Descargar PDF</button></header><section class="training-support-body '+supportType+'" aria-label="'+materialTitle+'"></section>';
 document.body.append(root);
 const status=root.querySelector('[role=status]'),button=root.querySelector('button'),box=root.querySelector('section');
 let expires=0,pdfFile=null,pdfBlob=null,downloadUrl=null,busy=false,version='',timer,invalid=false;
 const clear=message=>{invalid=true;box.replaceChildren();pdfFile=pdfBlob=null;button.disabled=true;status.textContent=message;if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl=null;};
 const request=async()=>{
  if(!/^[a-f0-9]{64}$/.test(token))throw Error('Enlace no válido. Solicita uno nuevo a Recursos Humanos.');
  const response=await fetch(U+'/functions/v1/hr-tutor-presentation',{method:'POST',headers:{'Content-Type':'application/json',apikey:K},body:JSON.stringify({action:'live-info',token}),credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(!response.ok){if(response.status===404)clear('El enlace ha caducado o fue revocado. Solicita uno nuevo a Recursos Humanos.');throw Error('No se pudo consultar la presentación. Comprueba la conexión.');}
  const data=await response.json();
  if(!data.role||!Array.isArray(data.nomenclators))throw Error('El visor se está actualizando. Vuelve a abrir el enlace.');
  expires=Date.parse(data.expires_at);
  if(!Number.isFinite(expires)||expires<=Date.now()){clear('El enlace ha caducado.');throw Error('El enlace ha caducado.');}
  return data;
 };
 const apply=data=>{
  const next=JSON.stringify(data);
  if(next===version)return false;
  version=next;pdfFile=pdfBlob=null;
  role=data.role;roles=data.roles||[];
  const by=category=>data.nomenclators.filter(x=>x.category===category);
  agencyPolicies=by('normas_politicas');agencyInstitutional=by('informacion_institucional');agencyDiscipline=by('regimen_disciplinario');agencyEvaluationParams=by('parametros_evaluacion');
  return true;
 };
 const render=async()=>{
  await document.fonts.ready;
  box.innerHTML=guide?trainingGuideHtml():trainingPresentationHtml();
  if(!guide){paginateTrainingPresentation(box);trainingPresentationObserve(box);trainingPresentationScale(box);}
 };
 const save=()=>{
  if(invalid||Date.now()>=expires){clear('El enlace ha caducado.');return;}
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(ios&&pdfFile&&navigator.share&&navigator.canShare?.({files:[pdfFile]})){
   navigator.share({files:[pdfFile],title:pdfFile.name}).catch(error=>{if(error.name!=='AbortError')status.textContent='Toca Descargar PDF para reintentar. Si Safari abre el PDF, usa Compartir → Guardar en Archivos.';});
   return;
  }
  if(downloadUrl)URL.revokeObjectURL(downloadUrl);
  downloadUrl=URL.createObjectURL(pdfBlob);
  const link=document.createElement('a');link.href=downloadUrl;link.download=pdfFile?.name||'Presentacion-capacitacion.pdf';document.body.append(link);link.click();link.remove();
  status.textContent=ios?'En la vista del PDF, toca Compartir → Guardar en Archivos.':'PDF preparado. Revisa las descargas del navegador.';
 };
 button.onclick=async()=>{
  if(busy)return;
  // A second tap keeps native file sharing inside a fresh iOS user gesture.
  if(pdfBlob){save();return;}
  busy=true;button.disabled=true;button.textContent='Generando PDF…';
  try{
   const data=await request();if(apply(data))await render();
   const blob=await exportTrainingSupportPdf(supportType,false,true);
   const checked=await request();
   if(JSON.stringify(checked)!==version){apply(checked);await render();throw Error('La presentación cambió. Toca Descargar PDF para generar la versión actual.');}
   if(invalid)return;
   pdfBlob=blob;
   const filename=(guide?'Documento de conducción - ':'Presentación capacitación - ')+String(role.title||'Plaza').replace(/[\\/:*?"<>|]+/g,'-')+'.pdf';
   pdfFile=new File([blob],filename,{type:'application/pdf'});
   status.textContent='PDF listo. Toca Descargar PDF para guardarlo; en iPhone selecciona Guardar en Archivos en el menú Compartir.';
  }catch(error){if(!invalid)status.textContent=error.message;}
  finally{busy=false;button.textContent='Descargar PDF';button.disabled=invalid||!box.querySelector(guide?'.training-guide-page':'.training-slide');}
 };
 try{apply(await request());await render();button.disabled=false;status.textContent=role.title+(guide?' · Documento de conducción · Enlace válido hasta ':' · Diapositivas 16:9 · Enlace válido hasta ')+new Date(expires).toLocaleString('es-ES');}
 catch(error){if(!invalid)clear(error.message);}
 // Revalidate capabilities while open; never retain a downloadable PDF across checks.
 timer=setInterval(async()=>{
  if(invalid)return;
  if(Date.now()>=expires){clear('El enlace ha caducado.');return;}
  if(busy)return;
  try{const data=await request();if(apply(data)){await render();status.textContent='Presentación actualizada. Toca Descargar PDF para generar la versión actual.';}}
  catch(error){if(!invalid)clear('No se pudo verificar el acceso. Vuelve a abrir el enlace.');}
 },15000);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&expires&&Date.now()>=expires)clear('El enlace ha caducado.');});
 window.addEventListener('pagehide',()=>{clearInterval(timer);clear('Acceso cerrado. Vuelve a abrir el enlace para consultar la presentación.');});
}
