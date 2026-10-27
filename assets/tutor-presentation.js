/* Fast tutor links: no iframe, PDF generation or upload. */
window.CartelTutorPresentation={async publish(sb,trialId,roleId,onProgress){
 onProgress?.({step:'upload',done:0,total:0});
 const {data:{session}}=await sb.auth.getSession();
 if(!session)throw Error('Tu sesión ha caducado. Vuelve a iniciar sesión.');
 const response=await fetch('https://jhumvctocphyiwhszeaz.supabase.co/functions/v1/hr-tutor-presentation',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token,apikey:'sb_publishable_ZHV-5dlsjfamQpfUOsgumg_G-vN84Gn'},body:JSON.stringify({action:'issue-live',trial_id:trialId}),credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(12000)});
 const link=await response.json();
 if(!response.ok)throw Error(link.error||'No se pudo crear el enlace de presentación.');
 const u=new URL(link.url),expiry=Date.parse(link.expires_at);
 if(u.origin!=='https://gestion.elcartelstudio.com'||u.pathname!=='/presentacion-tutor.html'||u.search||!/^#token=[a-f0-9]{64}$/.test(u.hash)||String(link.role_id)!==String(roleId)||!Number.isFinite(expiry)||expiry<=Date.now())throw Error('El enlace no corresponde a la plaza.');
 return link;
}};