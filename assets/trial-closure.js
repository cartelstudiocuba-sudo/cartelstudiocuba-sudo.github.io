'use strict';
const closureTemplate = `🎉 *¡Enhorabuena, {NOMBRE}!*

Has completado satisfactoriamente tu período de prueba para la plaza de *{PLAZA}* en *El Cartel Studio*.

Queremos felicitarte por esta primera etapa y agradecerte el esfuerzo, la disposición y el compromiso demostrado durante estos días.

📄 *Acta de Cierre del Período de Prueba:*
{CIERRE}

Por favor, descarga el acta, imprímela, complétala y fírmala. Deberás entregarla a tu jefe inmediato para formalizar el cierre de esta etapa.

Nos gustaría continuar contigo en el proceso de incorporación a El Cartel Studio y avanzar hacia la siguiente etapa de capacitación para tu plaza.

*¿Estás de acuerdo e interesado en continuar formando parte de nuestro equipo?*

Confírmanos por esta vía para coordinar los próximos pasos de tu capacitación.`;
const closureFinishTemplate = `🎉 *¡Enhorabuena, {NOMBRE}!*

Has completado satisfactoriamente tu período de prueba para la plaza de *{PLAZA}* en *El Cartel Studio*.

Queremos agradecerte el esfuerzo, la disposición y el compromiso demostrado durante esta etapa.

Por favor, descarga el acta, imprímela, complétala y fírmala. Deberás entregarla a tu jefe inmediato para formalizar el cierre de esta etapa.

{CIERRE}

En caso de que seas seleccionado para continuar hacia una contratación en nuestra empresa, te lo notificaremos oportunamente por esta misma vía.

¡Muchas gracias por haber formado parte de esta etapa con nosotros!`;
function closureMessage(name, links, role, mode) {
 return (mode==='finish'?closureFinishTemplate:closureTemplate).replace('{NOMBRE}',String(name||'').trim().split(/\\s+/)[0]).replace('{PLAZA}',role||'la plaza correspondiente').replace('{CIERRE}',links.document_url);
}
const closureEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function closureRpc(name,args){const {data,error}=await sb.rpc(name,args);if(error)throw Error(error.message);return data;}
async function openClosure(trial){location.href='/gestionar-cierre-prueba.html?trial='+encodeURIComponent(trial);}
async function initClosureAdmin(){
 const params=new URLSearchParams(location.search),id=params.get('trial'),mode=params.get('mode')==='finish'?'finish':'continue',root=document.getElementById('closure');
 const {data:t,error}=await sb.from('hr_trial_periods').select('*,hr_candidates(full_name,whatsapp)').eq('id',id).single();if(error)throw Error('Acceso autorizado requerido. '+error.message);
 let {data:c,error:ce}=await sb.from('hr_trial_closures').select('*').eq('trial_id',id).maybeSingle();if(ce)throw Error(ce.message);
 root.innerHTML='<h1>Cierre del período de prueba</h1><h2>'+closureEsc(t.hr_candidates.full_name)+'</h2><p>El cierre se verifica antes de preparar la capacitación y continuar a contratación.</p><div id="actions"></div>';
 const actions=document.getElementById('actions');
 if(!c){actions.innerHTML='<button id="prepare">Preparar acta de cierre</button>';document.getElementById('prepare').onclick=async()=>{try{await closureRpc('hr_prepare_trial_closure',{p_trial:id});location.reload();}catch(e){alert(e.message)}};return;}
 const {data:events,error:ee}=await sb.from('hr_trial_closure_events').select('*').eq('trial_id',id).order('created_at');if(ee)throw Error(ee.message);
 const links=events.find(e=>e.action==='closure_prepared')?.payload;
 actions.innerHTML='<p>Expediente: '+(c.submitted_at?'Recibido':'Pendiente')+' · Cierre firmado: '+(c.signed_received_at?'Recibido':'Pendiente')+' · Verificación: '+(c.verified_at?'Completada':'Pendiente')+'</p><p>Enlaces válidos hasta '+closureEsc(new Date(c.expires_at).toLocaleString('es-CU'))+(c.revoked_at?' · REVOCADOS':'')+'</p><button id="preview">Ver documento de cierre</button> <button id="edit">Revisar mensaje para WhatsApp</button><div id="editor" hidden><label for="message">Mensaje completo para este candidato</label><textarea id="message" rows="18"></textarea><p>La edición solo se aplica a este envío. La plantilla predeterminada se conserva para futuros candidatos.</p><button id="send">Guardar revisión y abrir WhatsApp</button></div><h2>Expediente recibido</h2><div id="file"></div><button id="signed">Registrar cierre firmado recibido</button> <button id="verify">Confirmar verificación del expediente</button><h2>Preparar capacitación</h2><form id="training"><label>Duración en días<input name="days" type="number" min="1" max="365" required></label><label>Tutor<input name="tutor" required maxlength="200"></label><label>Fecha de inicio<input name="start" type="date" required></label><button>Guardar preparación</button></form><button id="hire">Continuar a contratación</button> <button id="revoke">Revocar enlaces</button><h2>Trazabilidad</h2><div id="history"></div>';
 const representativeEditor=trialClosureRepresentativeEditor(document.getElementById('editor'),c.document?.representative||{},t);
 document.getElementById('preview').onclick=()=>{if(links?.document_url)window.open(links.document_url,'_blank','noopener');};
 document.getElementById('edit').onclick=()=>{if(c.revoked_at||Date.parse(c.expires_at)<=Date.now())return alert('Los enlaces ya no están vigentes.');document.getElementById('editor').hidden=false;document.getElementById('message').value=events.filter(e=>e.action==='message_opened').at(-1)?.payload.message||closureMessage(t.hr_candidates.full_name,links,t.role_title,mode);};
 document.getElementById('send').onclick=async()=>{const message=document.getElementById('message').value;const phone=String(t.hr_candidates.whatsapp||'').replace(/\D/g,'');if(phone.length<8)return alert('El candidato no tiene teléfono válido.');if(!message.includes(links.document_url))return alert('Conserva el enlace individual al Acta de Cierre.');const button=document.getElementById('send');button.disabled=true;try{await representativeEditor.save();await closureRpc('hr_manage_trial_closure',{p_trial:id,p_action:'message_opened',p_payload:{message}});window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(message),'_blank','noopener');alert('Revisión guardada. Confirma el envío en WhatsApp; abrirlo no confirma entrega.');}catch(e){alert(e.message)}finally{button.disabled=false}};
 const file=document.getElementById('file');file.innerHTML=Object.entries(c.data).filter(([k])=>!k.endsWith('_path')).map(([k,v])=>'<p><b>'+closureEsc(k)+':</b> '+closureEsc(v)+'</p>').join('')||'<p>Aún no se ha enviado el formulario.</p>';
 for(const [key,label] of [['document_front_path','Ver frente privado'],['document_back_path','Ver reverso privado']]){if(c.data[key]){const b=document.createElement('button');b.textContent=label;b.onclick=async()=>{const {data,error}=await sb.storage.from('hr-identity-private').download(c.data[key]);if(error)return alert(error.message);const url=URL.createObjectURL(data);window.open(url,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(url),60000);};file.append(b);}}
 const manage=async(action,payload={})=>{try{await closureRpc('hr_manage_trial_closure',{p_trial:id,p_action:action,p_payload:payload});location.reload()}catch(e){alert(e.message)}};
 document.getElementById('signed').onclick=()=>{if(confirm('¿Has recibido y revisado el documento firmado?'))manage('signed_received')};
 document.getElementById('verify').onclick=()=>{if(confirm('¿Verificaste los datos y ambas fotos del carné?'))manage('verified')};
 const training=document.getElementById('training');training.elements.days.value=c.training_days||'';training.elements.tutor.value=c.training_tutor||'';training.elements.start.value=c.training_start||'';training.onsubmit=e=>{e.preventDefault();manage('training_prepared',Object.fromEntries(new FormData(training)))};
 document.getElementById('hire').onclick=async()=>{if(!confirm('¿Continuar a contratación con el cierre verificado y la capacitación preparada?'))return;try{const employee=await closureRpc('hr_confirm_trial_hire',{p_trial_id:id});location.href='/trabajador-ficha.html?id='+encodeURIComponent(employee)}catch(e){alert(e.message)}};
 document.getElementById('revoke').onclick=()=>{if(confirm('¿Revocar el acceso por ambos enlaces?'))manage('revoked')};
 document.getElementById('history').innerHTML=events.map(e=>'<details><summary>'+closureEsc(new Date(e.created_at).toLocaleString('es-CU')+' · '+e.action)+'</summary><pre>'+closureEsc(JSON.stringify(e.payload,null,2))+'</pre></details>').join('');
}
async function initClosurePublic(documentMode){
 const root=document.getElementById('closure'),token=new URLSearchParams(location.hash.slice(1)).get('token');
 const data=await closureRpc('hr_read_trial_closure',{p_token:token,p_document:documentMode});if(!data)throw Error('Enlace no válido, caducado o revocado. Solicita ayuda a Recursos Humanos.');
 if(documentMode){
  const template=cleanTrialClosureTemplate(data.template);
  if(!template||template.key!=='trial_close'||!Array.isArray(template.blocks))throw Error('Esta acta fue creada con un formato anterior. Solicita a RR. HH. que verifique la plantilla de la plaza antes de enviarla.');
  const lines=v=>closureEsc(v).replace(/\\n|\n/g,'<br>');
  let clause=0; const ordinals=['PRIMERA','SEGUNDA','TERCERA','CUARTA','QUINTA','SEXTA','SÉPTIMA','OCTAVA','NOVENA'];
  const blocks=template.blocks.filter(b=>b.included!==false).map(b=>{
   let content=b.use_override&&b.override_text?b.override_text:b.text||'';
   // The evaluated person's identifying details are always completed by hand.
   if(b.id==='tcl2')content='Nombre y apellidos: ________________________________________________\\nCarné de Identidad: ________________________________________________';
   if(b.id==='tcl3'&&data.representative?.start_date&&data.representative?.end_date){
    const fmt=x=>x.split('-').reverse().join(' / ');
    content=content.replace(/desde el [^]*?hasta el [^]*?\. La fecha efectiva de cierre de esta etapa es el[^.]*\./i, 'desde el '+fmt(data.representative.start_date)+' hasta el '+fmt(data.representative.end_date)+'. La fecha efectiva de cierre de esta etapa es el '+fmt(data.representative.end_date)+'.');
   }
   if(b.id==='tcl7'){
    content=content.replace(/Cantidad\s*\|\s*Medio\s*\/\s*recurso[\s\S]*?(?=Cualquier incidencia)/i,'');
   }
   if(b.id==='tcl10'){content=content.replace(/Resumen de asuntos pendientes u observaciones:\s*(?:Ninguna|Sin asuntos pendientes ni excepciones declaradas\.)?/gi,'').trim();}
   if(b.id==='tcl11'){
    const declaration=content.split('PERSONA EVALUADA')[0].trim()||'Las partes manifiestan haber revisado el contenido de la presente acta y firman en señal de constancia del cierre del período de prueba.';
    content=declaration+'\\n\\nPERSONA EVALUADA\\nNombre: ________________________________________________\\nCarné de Identidad: ______________________________\\nFirma: ______________________________\\nFecha: ____ / ____ / ________\\n\\nPOR EL CARTEL STUDIO\\nNombre: '+(data.representative?.name||'________________________________')+'\\nCarné de Identidad: '+(data.representative?.ci||'________________________')+'\\nCargo: '+(data.representative?.position||'______________________________')+'\\nFirma: ______________________________\\nFecha: ____ / ____ / ________';
   }
   if(b.id==='tcl1'){const r=data.representative||{};content='El Cartel Studio\\nRepresentante: '+(r.name||'________________________________')+'\\nCarné de Identidad: '+(r.ci||'________________________________')+'\\nCargo: '+(r.position||'________________________________')+'\\nDirección de la sede: '+(r.address||'________________________________');}
   if(b.source==='candidate'&&!content)content='Nombre: ________________________________________________\\nCarné de Identidad: ______________________________';
   if(b.source==='company'&&!content)content='El Cartel Studio';
   const preamble=['tcl1','tcl2'].includes(b.id);
   const heading=preamble?'':(ordinals[clause++]||'CLÁUSULA '+clause)+' – '+(b.heading_title_override||b.title);
   return (b.id==='tcl3'?'<p>'+lines(template.agreement_text||'')+'</p>':'')+'<section class="act-section">'+(heading?'<h2>'+closureEsc(heading)+'</h2>':'')+'<p>'+lines(content)+'</p></section>';
  }).join('');
  root.innerHTML='<div class="act-toolbar"><button id="actDownload" type="button">↓ Descargar</button><button id="actPrint" type="button">▤ Imprimir</button></div><article id="actDocument" class="act-document"><header><div class="act-logo" style="text-align:'+( ['left','center','right'].includes(template.presentation?.logo_align)?template.presentation.logo_align:'right')+'"><img id="actLogo" src="/assets/cartel-studio-lettering-black.svg" alt="El Cartel Studio" style="width:'+Math.round(74*Math.max(50,Math.min(180,Number(template.presentation?.logo_size)||100))/100)+'px"></div><h1>'+closureEsc(template.presentation?.title||template.title)+'</h1><p>'+closureEsc(template.presentation?.plaza_line||('Plaza: '+data.role_title))+'</p><p>'+closureEsc('En La Habana, a '+new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'long',year:'numeric',timeZone:'America/Havana'}).format(new Date()).replace(/ de (\d{4})$/,' de $1')+'.')+'</p></header>'+blocks+'</article>';
  document.getElementById('actPrint').onclick=()=>window.print();
  document.getElementById('actDownload').onclick=()=>{alert('Para guardar el acta en PDF, selecciona «Guardar como PDF» en la ventana de impresión.');window.print()};
  if(template.presentation?.logo_path){try{const assetClient=CartelLoad.createClient('https://jhumvctocphyiwhszeaz.supabase.co','sb_publishable_ZHV-5dlsjfamQpfUOsgumg_G-vN84Gn',{auth:{persistSession:false},global:{headers:{'x-closure-token':token}}});const {data:logo}=await assetClient.storage.from('hr-role-documents').createSignedUrl(template.presentation.logo_path,3600);if(logo?.signedUrl)document.getElementById('actLogo').src=logo.signedUrl;}catch(e){console.warn('Se conserva el logotipo predeterminado.');}}
  return;
 }
 if(data.submitted){root.textContent='Tu expediente fue recibido. Espera las instrucciones de Recursos Humanos tras la verificación y entrega del cierre firmado.';return;}
 const fields=[['identity_number','Carné de identidad (11 dígitos)'],['address','Dirección particular'],['province','Provincia'],['municipality','Municipio'],['emergency_name','Contacto de emergencia'],['emergency_relation','Parentesco o relación'],['emergency_phone','Teléfono de emergencia'],['education_level','Nivel de escolaridad']];
 root.innerHTML='<h1>Actualizar expediente</h1><p>'+closureEsc(data.candidate.full_name)+'</p><p>Correo: '+closureEsc(data.candidate.email)+' · WhatsApp: '+closureEsc(data.candidate.whatsapp)+'</p><p>Confirma tus datos. Las fotos del carné se guardan en almacenamiento privado para revisión autorizada de Recursos Humanos.</p><form id="fileForm">'+fields.map(([k,l])=>'<label>'+l+'<input name="'+k+'" maxlength="1000" '+(['identity_number','address','emergency_name','emergency_phone'].includes(k)?'required':'')+' '+(k==='identity_number'?'pattern="[0-9]{11}" inputmode="numeric"':'')+' value="'+closureEsc(data.candidate[k]||'')+'"></label>').join('')+[['front','Frente'],['back','Reverso']].map(([side,l])=>'<label>'+l+' del carné · JPG o PNG, hasta 20 MB; compresión automática'+(data['uploaded_'+side]?' (ya recibido)':'')+'<input name="'+side+'" type="file" accept="image/jpeg,image/png" '+(data['uploaded_'+side]?'disabled':'required')+'></label>').join('')+'<label><input type="checkbox" required>Confirmo que los datos y documentos corresponden a mi identidad y autorizo su incorporación al expediente de RRHH.</label><button>Enviar expediente para verificación</button><p id="result" role="status"></p></form>';
 document.getElementById('fileForm').onsubmit=async e=>{e.preventDefault();const f=e.target,b=f.querySelector('button'),result=document.getElementById('result');b.disabled=true;try{const values={};for(const [k] of fields)values[k]=f.elements[k].value.trim();for(const side of ['front','back']){if(data['uploaded_'+side])continue;const file=await prepareIdentityPhoto(f.elements[side].files[0]);const uploadClient=CartelLoad.createClient('https://jhumvctocphyiwhszeaz.supabase.co','sb_publishable_ZHV-5dlsjfamQpfUOsgumg_G-vN84Gn',{auth:{persistSession:false},global:{headers:{'x-closure-token':token}}});const {error}=await uploadClient.storage.from('hr-identity-private').upload(data.trial_id+'/'+side,file,{contentType:file.type,upsert:false});if(error)throw Error(error.message);data['uploaded_'+side]=true;}await closureRpc('hr_submit_trial_closure',{p_token:token,p_data:values});root.textContent='Expediente recibido. Entrega el cierre impreso y firmado y espera instrucciones tras la verificación.';}catch(e){result.textContent=e.message;b.disabled=false;}};
}
