/* Public capability view. Uses the same live renderer and PDF generator as the role editor. */
if(new URLSearchParams(location.search).get('documento')==='contenido')document.documentElement.classList.add('training-public');
let trainingContentGeneration=0,trainingContentTimer,trainingContentResize;
window.addEventListener('hashchange',()=>{if(document.documentElement.classList.contains('training-public'))bootTrainingContent();});
async function bootTrainingContent(){
 const generation=++trainingContentGeneration;
 clearInterval(trainingContentTimer);trainingContentResize?.disconnect();
 document.getElementById('trainingPublicContent')?.remove();
 const token=new URLSearchParams(location.hash.slice(1)).get('token')||'';
 const client=CartelLoad.createClient(U,K,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 document.title='Contenido de la plaza · El Cartel Studio';
 const root=document.createElement('main');root.id='trainingPublicContent';
 root.innerHTML='<header class="training-public-head"><div><small>EL CARTEL STUDIO</small><h1>Contenido de la plaza</h1><p id="trainingContentStatus" role="status">Consultando documentación…</p></div><button id="trainingContentDownload" type="button" class="btn primary" disabled>Descargar PDF</button></header><section id="docPrototypePreview" class="doc-prototype-preview open" aria-label="Contenido de la plaza"></section>';
 document.body.append(root);
 const status=root.querySelector('[role=status]'),button=root.querySelector('button'),box=root.querySelector('section');
 const fit=()=>{const pages=box.querySelector('.contract-pages');if(pages){
  const scale=Math.min(1,box.clientWidth/816);
  pages.style.transformOrigin='top left';pages.style.transform='scale('+scale+')';
  box.style.height=Math.ceil(pages.offsetHeight*scale)+'px';
 }};
 trainingContentResize=new ResizeObserver(fit);trainingContentResize.observe(box);
 const invalidate=message=>{box.replaceChildren();button.disabled=true;status.textContent=message;};
 const reportError=error=>{status.textContent=error.message;button.disabled=!box.querySelector('.contract-paper-page');};
 let expires=0;
 async function refresh(){
  if(!/^[a-f0-9]{64}$/.test(token)){invalidate('El enlace no es válido. Solicita un nuevo enlace a tu tutor.');return false;}
  const result=await client.rpc('hr_read_training_content',{p_token:token});
  if(generation!==trainingContentGeneration)return false;
  if(result.error)throw Error('No se pudo consultar la documentación. Comprueba tu conexión y vuelve a abrir el enlace.');
  if(!result.data?.role){invalidate('Este enlace ha vencido o ya no está disponible. Solicita uno nuevo a tu tutor.');return false;}
  role=result.data.role;roles=result.data.roles||[];
  const by=category=>(result.data.nomenclators||[]).filter(x=>x.category===category);
  agencyPolicies=by('normas_politicas');agencyInstitutional=by('informacion_institucional');agencyDiscipline=by('regimen_disciplinario');agencyEvaluationParams=by('parametros_evaluacion');
  expires=Date.parse(result.data.expires_at);
  if(!Number.isFinite(expires)||expires<=Date.now()){invalidate('Este enlace ha vencido. Solicita uno nuevo a tu tutor.');return false;}
  await document.fonts.ready;
  // Build at full Carta size offscreen; keep the last verified preview if rebuilding fails.
  const draft=document.createElement('div');draft.className='training-public-pdf-stage';document.body.append(draft);
  try{
   buildDocumentationInformativePages('role_content',draft);box.replaceChildren(...draft.childNodes);
  }catch(error){
   if(!box.querySelector('.contract-paper-page')){
    draft.replaceChildren();buildDocumentationInformativePages('role_content',draft,undefined,undefined,true);
    box.replaceChildren(...draft.childNodes);fit();
   }
   throw Error(error.message+' Puedes consultar el contenido y volver a intentar la descarga.');
  }finally{draft.remove();}
  fit();
  status.textContent=role.title+' · Información vigente · Enlace válido hasta '+new Date(expires).toLocaleDateString('es-ES');button.disabled=false;
  return true;
 }
 button.onclick=async()=>{
  button.disabled=true;button.textContent='Generando PDF…';
  try{if(await refresh()){button.disabled=true;await exportTrainingContentPdf();}}
  catch(error){reportError(error);}
  finally{button.textContent='Descargar PDF';button.disabled=!box.querySelector('.contract-paper-page');}
 };
 try{await refresh();}catch(error){reportError(error);}
 // Clear already displayed content at expiry; server also enforces expiry and revocation on every read.
 if(generation===trainingContentGeneration)trainingContentTimer=setInterval(()=>{if(expires&&Date.now()>=expires)invalidate('Este enlace ha vencido. Solicita uno nuevo a tu tutor.');},15000);
}
async function exportTrainingContentPdf(){
 if(!window.html2canvas||!window.jspdf?.jsPDF)throw Error('No se cargó el generador de PDF. Vuelve a abrir el enlace.');
 const stage=document.createElement('div');stage.className='training-public-pdf-stage';document.body.append(stage);
 try{
  buildDocumentationInformativePages('role_content',stage);
  const pages=[...stage.querySelectorAll('.contract-paper-page')],{jsPDF}=window.jspdf,pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'letter',compress:true});
  for(let i=0;i<pages.length;i++){
   if(i)pdf.addPage('letter','portrait');
   const canvas=await html2canvas(pages[i],{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false});
   pdf.addImage(canvas.toDataURL('image/jpeg',.94),'JPEG',0,0,215.9,279.4,undefined,'FAST');
  }
  const blob=pdf.output('blob');
  const filename='Contenido de la plaza - '+String(role.title||'Plaza').replace(/[\\/:*?"<>|]+/g,'-')+'.pdf';
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(isIOS&&navigator.share&&typeof File!=='undefined'){
   const file=new File([blob],filename,{type:'application/pdf'});
   if(!navigator.canShare||navigator.canShare({files:[file]})){
    try{await navigator.share({files:[file],title:filename});return;}
    catch(error){if(error?.name==='AbortError')return;}
   }
  }
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();
  if(isIOS){
   const notice=document.getElementById('trainingContentSaveHelp')||document.createElement('p');
   notice.id='trainingContentSaveHelp';notice.setAttribute('role','status');
   notice.style.cssText='padding:12px 16px;margin:12px 0;background:#fff9dc;color:#242424;border-left:4px solid #ffda03;border-radius:8px;font-size:14px;line-height:1.5';
   notice.textContent='Si el PDF se abre en una vista previa, toca Compartir (cuadrado con flecha hacia arriba) y selecciona Guardar en Archivos.';
   document.getElementById('trainingPublicContent')?.querySelector('header')?.after(notice);
  }
  setTimeout(()=>URL.revokeObjectURL(url),120000);
 }finally{stage.remove();}
}
