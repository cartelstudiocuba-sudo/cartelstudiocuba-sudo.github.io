/* Personal data only; authorization, allowlist and atomic conflict checks live in SQL. */
async function openCandidatePersonalEditor(id) {
  if(document.getElementById('candidatePersonalEditor'))return;
  const returnFocus=document.activeElement;
  const dialog=document.createElement('dialog');
  dialog.id='candidatePersonalEditor';dialog.setAttribute('aria-labelledby','personalEditorTitle');
  dialog.innerHTML='<form><h2 id="personalEditorTitle">Editar candidato</h2><p>Actualiza sus datos personales y de contacto.</p><div class="personal-editor-fields"></div><p class="personal-editor-status" role="status" aria-live="polite">Cargando datos actuales…</p><footer><button type="button" class="btn dark" data-cancel>Cancelar</button><button type="submit" class="btn primary" disabled>Guardar cambios</button></footer></form>';
  document.body.appendChild(dialog);dialog.showModal();
  const form=dialog.querySelector('form'),fields=dialog.querySelector('.personal-editor-fields'),status=dialog.querySelector('[role=status]'),save=form.querySelector('[type=submit]');
  let busy=false,snapshot,uploaded=null;
  const close=()=>{if(busy)return;dialog.close();dialog.remove();returnFocus?.focus();};
  dialog.querySelector('[data-cancel]').onclick=close;
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  const labels={full_name:'Nombre y apellidos',whatsapp:'Teléfono móvil / WhatsApp',email:'Correo electrónico (candidatura)',municipality:'Municipio (candidatura)',sex:'Sexo',address:'Dirección / zona de residencia',education_level:'Nivel escolar terminado',identity_card:'Carné de identidad',landline_phone:'Teléfono fijo',home_address:'Dirección particular',interview_email:'Correo electrónico (expediente)',interview_identity_card:'Carné de identidad',interview_home_address:'Dirección particular completa',interview_residence_municipality:'Municipio de residencia (expediente)',interview_landline_phone:'Teléfono fijo'};
  try {
    const {data,error}=await sb.rpc('hr_edit_candidate_personal',{p_candidate_id:id});
    if(error)throw error;
    if(!dialog.isConnected)return;
    snapshot=data;
    for(const [key,value] of Object.entries(data.values)){
      const name=key.replace(/^answer:/,'');
      if(!labels[name] || (value!==null&&typeof value!=='string'))continue;
      const label=document.createElement('label'),title=document.createElement('span'),input=document.createElement('input');
      title.textContent=labels[name];input.dataset.personalKey=key;input.value=value??'';input.maxLength=1000;
      input.type=/email/.test(name)?'email':/phone|whatsapp/.test(name)?'tel':'text';
      if(name==='full_name'){input.required=true;input.minLength=2;}
      if(/identity_card/.test(name)){input.inputMode='numeric';input.pattern='[0-9]{11}';input.maxLength=11;}
      if(input.type==='tel')input.pattern='[+0-9 \\(\\)\\-]{6,24}';
      label.append(title,input);fields.appendChild(label);
    }
    const photoLabel=document.createElement('label');photoLabel.textContent='Foto de perfil';
    const photo=document.createElement('input');photo.type='file';photo.accept='image/jpeg,image/png,image/webp,image/heic,image/heif';photoLabel.appendChild(photo);fields.appendChild(photoLabel);
    const preview=document.createElement('img');preview.alt='Foto de perfil';preview.hidden=true;preview.className='personal-editor-photo';photoLabel.appendChild(preview);
    const path=data.values['answer:photo_path'];
    if(path){const r=await sb.storage.from('hr-candidate-files').createSignedUrl(path,300);if(r.data?.signedUrl&&dialog.isConnected){preview.src=r.data.signedUrl;preview.hidden=false;}}
    photo.onchange=()=>{uploaded=null;const f=photo.files[0];if(f){const url=URL.createObjectURL(f);preview.onload=()=>URL.revokeObjectURL(url);preview.src=url;preview.hidden=false;status.textContent='La nueva foto se guardará al guardar los cambios.';}};
    status.textContent='';save.disabled=false;
    form.onsubmit=async event=>{
      event.preventDefault();if(busy||!form.reportValidity())return;
      const changes={},expected={};
      for(const input of fields.querySelectorAll('[data-personal-key]')){
        const key=input.dataset.personalKey;
        // Compare the displayed baseline first: merely opening/saving never trims old data.
        if(input.value!==(snapshot.values[key]??'')){changes[key]=input.value.trim();expected[key]=snapshot.values[key];}
      }
      const controls=[...form.querySelectorAll('input,button')];busy=true;controls.forEach(el=>el.disabled=true);status.textContent='Guardando cambios…';
      try{
        if(photo.files.length){
          if(!uploaded){
            status.textContent='Preparando fotografía…';const prepared=await CandidatePhoto.selection(photo);
            uploaded='interview-photos/'+id+'/'+crypto.randomUUID()+'.'+prepared.extension;
            const result=await sb.storage.from('hr-candidate-files').upload(uploaded,prepared.file,{upsert:false,contentType:prepared.file.type});
            if(result.error){uploaded=null;throw result.error;}
          }
          changes['answer:photo_path']=uploaded;expected['answer:photo_path']=snapshot.values['answer:photo_path'];
        }
        if(!Object.keys(changes).length){status.textContent='No hay cambios que guardar.';return;}
        const {data,error}=await sb.rpc('hr_edit_candidate_personal',{p_candidate_id:id,p_changes:changes,p_expected:expected});
        if(error)throw error;
        const candidate=candidates.find(c=>String(c.id)===String(id));if(candidate)Object.assign(candidate,data.candidate);
        for(const row of data.answers){const existing=answers.find(a=>a.id===row.id);if(existing)Object.assign(existing,row);else answers.push(row);}
        // Refresh the same open sheet; never close it or navigate to the dashboard.
        if(String(document.getElementById('detail')?.dataset.candidateId)===String(id)){
          await openDetail(id);
          const notice=document.createElement('p');notice.className='personal-editor-saved';notice.setAttribute('role','status');notice.textContent='Datos del candidato guardados correctamente.';document.getElementById('detailBody').prepend(notice);
        }
        busy=false;close();
      }catch(error){status.textContent='No se pudo guardar: '+error.message;}
      finally{busy=false;if(dialog.isConnected)controls.forEach(el=>el.disabled=false);}
    };
    fields.querySelector('input')?.focus();
  }catch(error){if(dialog.isConnected)status.textContent='No se pudo abrir el editor: '+error.message;}
}

