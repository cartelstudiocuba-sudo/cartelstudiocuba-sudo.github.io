/* Runs in the existing interview page; RPCs retain its RLS authorization. */
let publishedSaveError=null;
let questionnaireAutoLoadCandidate='';
async function ensurePublishedQuestionnaireForNewInterview(){
 const target=String(current?.id||'');if(!target||questionnaireAutoLoadCandidate===target)return;
 const iv=interviews.find(v=>String(v.candidate_id)===target);
 if(!iv||iv.questionnaire_snapshot||iv.completed_at||InterviewQuestionnaire.historical(iv).length)return;
 questionnaireAutoLoadCandidate=target;
 const pane=document.getElementById('interviewStepQuestionnaire');
 if(pane)pane.innerHTML='<p role="status">Cargando cuestionario vigente de esta plaza…</p>';
 try{
  const {data,error}=await sb.rpc('hr_begin_role_questionnaire',{p_candidate:target});
  if(error)throw error;
  const record=publishedInterviewRecord(data,target);
  interviews=interviews.filter(v=>String(v.candidate_id)!==target).concat(record);
  if(String(current?.id)===target&&pane?.isConnected){
   pane.innerHTML=InterviewQuestionnaire.render(record,!record.completed_at);
  }
 }catch(e){
  console.error('No se pudo cargar automáticamente el cuestionario',e);
  if(String(current?.id)===target&&pane?.isConnected)pane.innerHTML='<p role="alert">No se pudo cargar el cuestionario publicado. Vuelve a entrar al paso Cuestionario o recarga la entrevista.</p>';
  questionnaireAutoLoadCandidate='';
 }
}

function publishedInterviewRecord(data,candidateId){
 const row=Array.isArray(data)&&data.length===1?data[0]:data;
 if(!row||Array.isArray(row)||String(row.candidate_id)!==String(candidateId))throw Error('La respuesta del servidor no corresponde a esta entrevista.');
 return row;
}
async function beginPublishedQuestionnaire(button){
 const target=String(current?.id||'');if(!target)return;button.disabled=true;
 try{
  const iv=interviews.find(v=>String(v.candidate_id)===target);
  if(InterviewQuestionnaire.historical(iv).length&&!confirm('Se conservarán las respuestas históricas sin reasignarlas. ¿Iniciar por separado el cuestionario publicado de esta plaza?'))return;
  const {data,error}=await sb.rpc('hr_begin_role_questionnaire',{p_candidate:target});if(error)throw error;
  interviews=interviews.filter(v=>String(v.candidate_id)!==target).concat(publishedInterviewRecord(data,target));
  if(String(current?.id)===target){publishedSaveError=null;renderInterview();initializeInterviewSteps();goInterviewStep(4)}
 }catch(e){alert('No se pudo iniciar: '+e.message)}finally{if(button.isConnected)button.disabled=false}
}
async function persistPublishedAnswer(candidateId,key,value){
 const iv=interviews.find(v=>String(v.candidate_id)===String(candidateId));
 if(!iv?.questionnaire_snapshot)throw Error('Inicia primero una versión publicada.');
 const expected=iv.interview_notes?.[key]??null;
 if(value===expected)return;
 const {data,error}=await sb.rpc('hr_save_role_interview_answer',{p_candidate:candidateId,p_question:key,p_value:value,p_expected:expected,p_revision:iv.questionnaire_snapshot.revision});
 if(error)throw error;Object.assign(iv,publishedInterviewRecord(data,candidateId));if(window.parent!==window)window.parent.postMessage({type:'cartel-interview-progress-saved',candidateId:String(candidateId)},location.origin);
}
async function persistPublishedQuestionnaire(candidateId,notes){
 if(publishedSaveError)throw publishedSaveError;
 const iv=interviews.find(v=>String(v.candidate_id)===String(candidateId));
 for(const q of InterviewQuestionnaire.questions(iv))if(Object.hasOwn(notes,q.id))await persistPublishedAnswer(candidateId,q.id,notes[q.id]);
}
document.addEventListener('change',queuePublishedInput);
document.addEventListener('focusout',queuePublishedInput);
function queuePublishedInput(event){
 const field=event.target.closest?.('#interviewStepQuestionnaire [data-iq]');if(!field)return;
 const target=String(current?.id||''),key=field.dataset.iq,value=field.value;
 questionnaireSaveQueue=questionnaireSaveQueue.then(()=>{if(publishedSaveError)throw publishedSaveError;return persistPublishedAnswer(target,key,value)}).catch(e=>{publishedSaveError=e;field.setAttribute('aria-invalid','true');alert('No se guardó la respuesta: '+e.message+' Recarga la entrevista para revisar los cambios concurrentes.');throw e});
 // Keep the rejection visible to finalization while avoiding unhandled-rejection noise.
 questionnaireSaveQueue.catch(()=>{});
}
window.addEventListener('beforeunload',event=>{
 const iv=interviews.find(v=>String(v.candidate_id)===String(current?.id));
 const dirty=[...document.querySelectorAll('#interviewStepQuestionnaire [data-iq]')].some(el=>el.value!==(iv?.interview_notes?.[el.dataset.iq]||''));
 if(dirty||publishedSaveError){event.preventDefault();event.returnValue=''}
});
