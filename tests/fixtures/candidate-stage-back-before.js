async function openCandidateStageBack(id){
 const c=candidates.find(x=>String(x.id)===String(id)),t=trialPeriodsByCandidate[String(id)];
 if(!c||!t)return alert('No hay una etapa anterior disponible.');
 const options=c.status==='trial'?[{stage:'pending_agreement',title:'Volver al envío del contrato',detail:'Regresar al paso inmediatamente anterior.'}]:c.status==='interviewed'&&t.proposal_sent_at?[{stage:'pending_confirmation',title:'Volver a la propuesta de prueba',detail:'Regresar al paso inmediatamente anterior.'}]:[];
 if(!options.length)return alert('No hay etapas anteriores disponibles.');
 document.getElementById('candidateBackOverlay')?.remove();
 const overlay=document.createElement('div');overlay.id='candidateBackOverlay';overlay.className='candidate-back-overlay';
 const dialog=document.createElement('div');dialog.className='candidate-back-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Retroceder etapa');
 dialog.innerHTML='<h3 style="margin:0 0 8px;font-size:22px">Retroceder etapa</h3><p style="color:#cbd5e1;line-height:1.5;margin:0 0 16px">Regresa únicamente al paso anterior de este candidato.</p>';
 options.forEach(option=>{
  const button=document.createElement('button');button.type='button';button.className='candidate-back-option';
  const arrow=document.createElement('span');arrow.className='candidate-back-icon';arrow.textContent='↶';
  const copy=document.createElement('span');const title=document.createElement('strong');title.textContent=option.title;const desc=document.createElement('small');desc.textContent=option.detail;copy.append(title,desc);button.append(arrow,copy);
  button.onclick=async()=>{
   button.disabled=true;
   try{
    const update=option.stage==='pending_agreement'?{stage:'pending_agreement',proposal_sent_at:t.proposal_sent_at||new Date().toISOString(),agreement_sent_at:null,agreement_received_at:null,agreement_accepted_at:null}:{stage:'pending_confirmation',proposal_sent_at:null,agreement_sent_at:null,agreement_received_at:null,agreement_accepted_at:null};
    const {data,error}=await sb.from('hr_trial_periods').update(update).eq('id',t.id).select('id').maybeSingle();
    if(error||!data)throw Error(error?.message||'No se pudo actualizar el período de prueba.');
    const {data:person,error:personError}=await sb.from('hr_candidates').update({status:'interviewed',decision_status:'consider'}).eq('id',id).select('id').maybeSingle();
    if(personError||!person)throw Error(personError?.message||'No se pudo actualizar la candidatura. Actualiza la ficha.');
    trialPeriodsByCandidate[String(id)]={...t,...update};
    c.status='interviewed';c.decision_status='consider';
    overlay.remove();
    const scrollY=window.scrollY;
    openDetail(id);
    window.scrollTo(0,scrollY);
   }catch(e){button.disabled=false;alert(e.message)}
  };
  dialog.appendChild(button);
 });
 const cancel=document.createElement('button');cancel.type='button';cancel.className='candidate-back-cancel';cancel.textContent='Cancelar';cancel.onclick=()=>overlay.remove();dialog.appendChild(cancel);overlay.appendChild(dialog);document.body.appendChild(overlay);
 overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});
}
