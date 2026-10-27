/* Same-origin export bridge. Only the role ID crosses into the generator. */
window.CartelTutorPresentation={async publish(sb,trialId,roleId){
 const frame=document.createElement('iframe');let loadTimer;
 frame.title='Preparando presentación de capacitación';frame.setAttribute('aria-hidden','true');
 frame.style.cssText='position:fixed;left:-20000px;top:0;width:1200px;height:900px;border:0;pointer-events:none';
 try{
  const loaded=new Promise((resolve,reject)=>{frame.onload=resolve;frame.onerror=()=>reject(Error('No se pudo cargar el generador.'));});
  frame.src='/plaza-ficha.html?id='+encodeURIComponent(roleId)+'&tutor_export=1';document.body.append(frame);
  await Promise.race([loaded,new Promise((_,reject)=>{loadTimer=setTimeout(()=>reject(Error('El generador tardó demasiado. Reintenta.')),45000);})]);clearTimeout(loadTimer);
  const deadline=Date.now()+45000;
  while(!frame.contentWindow?.tutorExportReady){if(Date.now()>deadline)throw Error('No se pudo cargar toda la información de la plaza. Reintenta.');await new Promise(r=>setTimeout(r,100));}
  const result=await Promise.race([frame.contentWindow.exportTutorPresentationFile(String(roleId)),new Promise((_,reject)=>{loadTimer=setTimeout(()=>reject(Error('La exportación tardó demasiado. Reintenta.')),300000);})]);clearTimeout(loadTimer);
  if(!result?.file||!result.version)throw Error('El generador no produjo un archivo válido.');
  if(result.file.size>50*1024*1024)throw Error('La presentación supera 50 MB. Reduce las imágenes de la plaza y reintenta.');
  const {data:{session}}=await sb.auth.getSession();if(!session)throw Error('Tu sesión ha caducado. Vuelve a iniciar sesión.');
  const form=new FormData();form.append('trial_id',trialId);form.append('version',result.version);form.append('file',result.file,result.name);
  const response=await fetch('https://jhumvctocphyiwhszeaz.supabase.co/functions/v1/hr-tutor-presentation',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:'sb_publishable_ZHV-5dlsjfamQpfUOsgumg_G-vN84Gn'},body:form,credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(120000)});
  const link=await response.json();if(!response.ok)throw Error(link.error||'No se pudo publicar la presentación.');
  const u=new URL(link.url),expiry=Date.parse(link.expires_at);
  if(u.origin!=='https://gestion.elcartelstudio.com'||u.pathname!=='/presentacion-tutor.html'||u.search||!/^#token=[a-f0-9]{64}$/.test(u.hash)||String(link.role_id)!==String(roleId)||!Number.isFinite(expiry)||expiry<=Date.now())throw Error('La presentación recibida no corresponde a la plaza.');
  return link;
 }finally{clearTimeout(loadTimer);frame.remove();}
}};
