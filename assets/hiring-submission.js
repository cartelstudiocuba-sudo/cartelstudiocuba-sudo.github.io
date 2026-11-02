/* Public hiring submission only. No tokens or personal data are persisted. */
'use strict';
function hiringCompletedScreen(root){
 root.innerHTML='<div class="brand">CARTEL <span>GESTIÓN</span></div><h1 tabindex="-1">Proceso completado. Ya puedes cerrar esta ventana</h1><p>Expediente enviado correctamente.</p><p>Recuerda entregar tu contrato firmado a tu tutor para continuar con el proceso de contratación.</p>';
 root.querySelector('h1').focus();
}
function hiringProgressFetch(update){
 return (input,init={})=>new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest(),request=input instanceof Request?input:null;
  xhr.open(init.method||request?.method||'GET',request?.url||String(input));
  new Headers(init.headers||request?.headers).forEach((v,k)=>xhr.setRequestHeader(k,v));
  xhr.responseType='arraybuffer';xhr.timeout=120000;
  xhr.upload.onprogress=e=>update(e.lengthComputable?e.loaded/e.total:null);
  xhr.upload.onload=()=>update(1);
  xhr.onload=()=>{const headers=new Headers();for(const line of xhr.getAllResponseHeaders().trim().split(/[\r\n]+/)){const i=line.indexOf(':');if(i>0)headers.append(line.slice(0,i),line.slice(i+1).trim());}resolve(new Response(xhr.status===204?null:xhr.response,{status:xhr.status,statusText:xhr.statusText,headers}));};
  xhr.onerror=xhr.ontimeout=xhr.onabort=()=>reject(Error('No se recibió la confirmación del servidor. Comprueba tu conexión y reintenta.'));
  // Never retry a write automatically: the caller first reconciles its revision.
  xhr.send(init.body??null);
 });
}
function hiringSubmission(root,form,token,result,pending){
 let busy=false,complete=false,uncertain=null,overlay=null;
 const canonical=o=>JSON.stringify(Object.keys(o||{}).sort().map(k=>[k,o[k]]));
 const sameData=(a,b)=>canonical(a)===canonical(b);
 const read=()=>hiringRpc('hr_read_hiring',{p_token:token,p_document:false});
 const labels={front:'Anverso del CI',back:'Reverso del CI',portrait:'Fotografía del trabajador'};
 const client=update=>CartelLoad.wrap(supabase.createClient(sb.supabaseUrl,sb.supabaseKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{'x-hiring-token':token,'x-hiring-revision':String(result.revision)},fetch:hiringProgressFetch(update)}}));
 const final=()=>{overlay?.remove();root.inert=false;hiringCompletedScreen(root);};
 const markComplete=()=>history.replaceState({...history.state,cartelHiringComplete:true},'',location.pathname+location.search);
 const protect=()=>{if(complete){markComplete();final();}};
 window.addEventListener('pageshow',protect);window.addEventListener('popstate',protect);window.addEventListener('hashchange',protect);
 window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
 async function reconcile(){
  const current=await read();
  if(!uncertain){if(current.locked||current.revision!==result.revision||!sameData(current.data,result.data))throw Error('El expediente cambió en otra ventana o fue validado. Solicita a RRHH revisar el enlace. Tus datos siguen en esta pantalla.');return false;}
  const u=uncertain;
  if(current.revision===u.revision&&!current.locked&&sameData(current.data,result.data)){uncertain=null;return false;}
  if(current.revision!==u.revision+1)throw Error('No se pudo confirmar este envío porque el expediente cambió. Conservamos tus datos; solicita revisión a RRHH.');
  if(u.type==='submit'){
   if(!current.submitted||!hiringFields.flat().every(([k])=>String(current.data[k]??'')===u.values[k]))throw Error('El servidor no confirmó estos datos. Conservamos el formulario para revisar el envío.');
   result.revision=current.revision;result.data=current.data;uncertain=null;return true;
  }
  if(current.locked||!sameData(current.data,result.data))throw Error('El expediente cambió durante la subida. Conservamos tus datos; solicita revisión a RRHH.');
  const {data,error}=await client(()=>{}).storage.from('hr-hiring-private').download(result.trial_id+'/'+u.key);
  if(error)throw Error('No se pudo comprobar la fotografía enviada. Reintenta la comprobación.');
  const digest=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))).join(',');
  if(await digest(data)!==await digest(u.file))throw Error('La fotografía del servidor cambió. Conservamos tus datos; solicita revisión a RRHH.');
  const after=await read();if(after.locked||after.revision!==current.revision||!sameData(after.data,current.data))throw Error('El expediente cambió durante la comprobación. Reintenta.');
  result.revision=current.revision;result[u.key]=true;delete pending[u.key];uncertain=null;return false;
 }
 function modal(){
  overlay=document.createElement('div');overlay.className='hiring-send-overlay';overlay.innerHTML='<section class="hiring-send-dialog" role="dialog" aria-modal="true" aria-labelledby="hiringSendTitle" tabindex="-1"><div class="brand">CARTEL GESTIÓN</div><h2 id="hiringSendTitle">Enviando expediente</h2><p id="hiringSendStatus" role="status" aria-live="polite">Comprobando el expediente…</p><progress id="hiringSendProgress" max="1" aria-label="Progreso de la operación actual"></progress><p id="hiringSendDetail">Mantén esta ventana abierta hasta recibir la confirmación.</p><div class="buttons"><button type="button" id="hiringSendRetry" hidden>Reintentar</button><button type="button" id="hiringSendEdit" hidden>Revisar datos</button><button type="button" id="hiringSendFinish" disabled>Finalizar</button></div></section>';
  document.body.append(overlay);root.inert=true;overlay.querySelector('section').focus();
  overlay.onkeydown=e=>{if(e.key==='Escape')e.preventDefault();if(e.key==='Tab'){const items=[...overlay.querySelectorAll('button:not(:disabled):not([hidden])')];if(!items.length){e.preventDefault();return;}const first=items[0],last=items.at(-1);if(e.shiftKey&&(document.activeElement===first||!items.includes(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!items.includes(document.activeElement))){e.preventDefault();first.focus();}}};
  overlay.querySelector('#hiringSendFinish').onclick=final;
 }
 async function send(){
  if(busy||complete)return;busy=true;if(!overlay)modal();
  const status=overlay.querySelector('#hiringSendStatus'),bar=overlay.querySelector('progress'),retry=overlay.querySelector('#hiringSendRetry'),edit=overlay.querySelector('#hiringSendEdit'),finish=overlay.querySelector('#hiringSendFinish'),title=overlay.querySelector('h2'),detail=overlay.querySelector('#hiringSendDetail');
  retry.hidden=edit.hidden=true;bar.hidden=false;finish.disabled=true;title.textContent='Enviando expediente';status.textContent='Comprobando el estado del servidor…';bar.removeAttribute('value');
  const progress=label=>fraction=>{if(fraction===null){bar.removeAttribute('value');status.textContent=label+' · transfiriendo…';}else{bar.value=fraction;status.textContent=label+' · '+Math.floor(fraction*100)+' %'+(fraction===1?' · esperando confirmación del servidor…':'');}};
  try{
   let confirmed=await reconcile();
   if(!confirmed){
    const entries=Object.entries(pending);let index=0;
    for(const [key,file] of entries){
     const update=progress(labels[key]+' ('+(++index)+' de '+entries.length+')');bar.value=0;update(0);uncertain={type:'upload',key,file,revision:result.revision};
     const {error}=await client(update).storage.from('hr-hiring-private').upload(result.trial_id+'/'+key,file,{contentType:file.type,upsert:true});if(error){if(Number(error.statusCode)>=400&&Number(error.statusCode)<500&&Number(error.statusCode)!==408)uncertain=null;throw Error(error.message);}
     result[key]=true;result.revision++;delete pending[key];uncertain=null;
    }
    const values=Object.fromEntries(hiringFields.flat().map(([k])=>[k,form.elements[k].value.trim()]));values.truth_confirmed=form.elements.truth_confirmed.checked;values._baseline=result.data;
    const update=progress('Datos del expediente');update(0);uncertain={type:'submit',values,revision:result.revision};
    const {data,error,status:code}=await client(update).rpc('hr_submit_hiring',{p_token:token,p_data:values,p_revision:result.revision}).retry(false);if(error){if(code>=400&&code<500&&code!==408)uncertain=null;throw Error(error.message);}
    if(!Number.isInteger(data)||data!==result.revision+1)throw Error('Respuesta de guardado incompleta. Reintenta para comprobar el resultado.');
    result.revision=data;result.data=Object.fromEntries(hiringFields.flat().map(([k])=>[k,values[k]]));uncertain=null;
   }
   complete=true;markComplete();
   bar.value=1;title.textContent='Expediente enviado correctamente';status.textContent='El servidor confirmó el guardado completo de tus datos y fotografías.';detail.textContent='Recuerda entregar tu contrato firmado a tu tutor para continuar con el proceso de contratación.';finish.disabled=false;finish.focus();
  }catch(error){title.textContent='No se ha confirmado el envío';status.textContent=error.message;detail.textContent='Tus datos y fotografías permanecen en esta ventana. Reintentar comprobará primero qué recibió el servidor.';bar.hidden=true;retry.hidden=false;edit.hidden=Boolean(uncertain);retry.onclick=send;edit.onclick=()=>{overlay.remove();overlay=null;root.inert=false;form.querySelector('#hiringSubmit').focus();};retry.focus();}
  finally{busy=false;}
 }
 return send;
}

