/* Agenda absence uses the existing interview/candidate refresh channel. */
let agendaAbsenceTarget=null,agendaAbsenceSaving=false,agendaAbsenceOpener=null;
function openAgendaAbsence(id,opener){
 if(agendaAbsenceSaving||agendaTab!=='scheduled')return;
 const candidate=candidates.find(x=>String(x.id)===String(id));
 const interview=interviews.find(x=>String(x.candidate_id)===String(id));
 if(!candidate||!interview?.id||interview.completed_at||interviewState(candidate)!=='scheduled')return;
 agendaAbsenceTarget={candidate,interview};agendaAbsenceOpener=opener;
 let dialog=document.getElementById('agendaAbsenceDialog');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='agendaAbsenceDialog';dialog.className='agenda-absence-dialog';dialog.setAttribute('aria-labelledby','agendaAbsenceTitle');dialog.setAttribute('aria-describedby','agendaAbsenceText');
 dialog.innerHTML='<h2 id="agendaAbsenceTitle">Registrar ausencia</h2><p id="agendaAbsenceText">Este candidato será cambiado al estado Cantera para futuras entrevistas. ¿Deseas confirmar?</p><p id="agendaAbsenceError" role="alert" hidden></p><div class="agenda-absence-actions"><button type="button" class="btn dark" onclick="closeAgendaAbsence()">No</button><button type="button" class="btn primary" id="agendaAbsenceConfirm" onclick="confirmAgendaAbsence()">Sí, confirmar</button></div>';
 dialog.addEventListener('cancel',event=>{event.preventDefault();closeAgendaAbsence()});
 document.body.append(dialog);}
 document.getElementById('agendaAbsenceError').hidden=true;
 dialog.showModal();dialog.querySelector('button').focus();
}
function closeAgendaAbsence(){if(agendaAbsenceSaving)return;document.getElementById('agendaAbsenceDialog')?.close();agendaAbsenceTarget=null;if(agendaAbsenceOpener?.isConnected)agendaAbsenceOpener.focus();else document.querySelector('.agenda-filter-card.is-selected')?.focus();}
async function confirmAgendaAbsence(){
 if(agendaAbsenceSaving||!agendaAbsenceTarget)return;
 const {candidate,interview}=agendaAbsenceTarget,dialog=document.getElementById('agendaAbsenceDialog'),errorBox=document.getElementById('agendaAbsenceError');
 agendaAbsenceSaving=true;dialog.setAttribute('aria-busy','true');dialog.querySelectorAll('button').forEach(b=>b.disabled=true);errorBox.hidden=true;
 let saved=false;
 try{
  const {data,error}=await sb.rpc('hr_register_interview_absence',{p_candidate:candidate.id,p_interview:interview.id});
  if(error)throw error;
  if(!data?.candidate||!data?.interview)throw new Error('Respuesta incompleta. Recarga la agenda para comprobar el estado.');
  Object.assign(candidate,data.candidate);Object.assign(interview,data.interview);
  renderList();renderInterviewStats();renderAgenda();saved=true;
  if(window.parent!==window)window.parent.postMessage({type:'cartel-interview-completed',candidateId:String(candidate.id),candidate:data.candidate,interview:data.interview},location.origin);
 }catch(error){errorBox.textContent='No se pudo registrar la ausencia: '+(error.message||'Error de conexión. Puedes reintentar.');errorBox.hidden=false;}
 finally{agendaAbsenceSaving=false;dialog.removeAttribute('aria-busy');dialog.querySelectorAll('button').forEach(b=>b.disabled=false);if(saved)closeAgendaAbsence();}
}
