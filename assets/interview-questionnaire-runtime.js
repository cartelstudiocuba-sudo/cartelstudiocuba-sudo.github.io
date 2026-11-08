/* Pending answers stay in memory, scoped to candidate and immutable questionnaire revision. */
let publishedSaveError=null;
let questionnaireAutoLoadCandidate='';
const questionnaireStates=new Map(),questionnaireLoads=new Map(),questionnaireLoadFailures=new Set();
function questionnaireCall(name,args){return typeof CartelLoad!=='undefined'&&CartelLoad.deadline?CartelLoad.deadline(()=>sb.rpc(name,args),12000):sb.rpc(name,args);}
function questionnaireState(id){id=String(id);if(!questionnaireStates.has(id))questionnaireStates.set(id,{pending:new Map(),error:null,loadError:null,message:'',flushing:null});return questionnaireStates.get(id);}
function questionnaireRecord(id){return interviews.find(v=>String(v.candidate_id)===String(id));}
function publishedInterviewRecord(data,candidateId){const row=Array.isArray(data)&&data.length===1?data[0]:data;if(!row||Array.isArray(row)||String(row.candidate_id)!==String(candidateId))throw Error('La respuesta del servidor no corresponde a esta entrevista.');return row;}
function questionnaireError(error){const message=String(error?.message||'No se pudo conectar con el servidor.');if(/no tiene cuestionario aprobado y publicado/.test(message))return 'Esta plaza no tiene cuestionario publicado. Un borrador no se puede utilizar en la entrevista. Solicita a RRHH su revisión y publicación autorizada.';if(/Failed to fetch|fetch failed|NetworkError|offline|timeout/i.test(message))return 'No se pudo conectar. Tus ediciones siguen en esta pantalla; comprueba la conexión y reintenta.';return message;}
function paintQuestionnaireStatus(id){
 if(String(current?.id)!==String(id))return;const pane=document.getElementById('interviewStepQuestionnaire');if(!pane)return;
 const state=questionnaireState(id);publishedSaveError=state.error;
 const text=state.loadError?questionnaireError(state.loadError):state.error?'No se guardaron todos los cambios. '+questionnaireError(state.error):state.pending.size?'Cambios pendientes de guardar. No cierres esta pestaña.':state.message;
 let bar=pane.querySelector('[data-questionnaire-status]');if(!bar&&!text)return;
 if(!bar){bar=document.createElement('div');bar.dataset.questionnaireStatus='';bar.className='questionnaire-status';bar.style.cssText='padding:12px;margin:12px 0;border:1px solid #6d6330;border-radius:10px;overflow-wrap:anywhere';bar.innerHTML='<p role="status" aria-live="polite"></p><button type="button" class="btn" data-load-retry>Reintentar carga</button> <button type="button" class="btn" data-save-retry>Reintentar guardado</button>';pane.prepend(bar);}
 const label=bar.querySelector('p');if(label.textContent!==text)label.textContent=text;
 const load=bar.querySelector('[data-load-retry]'),save=bar.querySelector('[data-save-retry]');load.hidden=!state.loadError;save.hidden=!state.pending.size||!state.error;load.disabled=questionnaireLoads.has(String(id));save.disabled=!!state.flushing;
 load.onclick=()=>loadPublishedQuestionnaire(String(id),true);save.onclick=()=>enqueueQuestionnaireSave(String(id));
 pane.setAttribute('aria-busy',String(questionnaireLoads.has(String(id))));
}
function restorePublishedQuestionnaire(){
 const id=String(current?.id||'');if(!id)return;const pane=document.getElementById('interviewStepQuestionnaire');if(!pane)return;
 const state=questionnaireState(id),iv=questionnaireRecord(id);
 pane.querySelectorAll('[data-iq]').forEach(field=>{field.dataset.questionnaireCandidate=id;const pending=state.pending.get(field.dataset.iq);if(pending&&pending.revision===iv?.questionnaire_snapshot?.revision&&field.value!==pending.value)field.value=pending.value;if(state.error&&pending)field.setAttribute('aria-invalid','true');else field.removeAttribute('aria-invalid');});paintQuestionnaireStatus(id);
}
function rememberPublishedField(field){
 const id=field.dataset.questionnaireCandidate||String(current?.id||''),iv=questionnaireRecord(id),key=field.dataset.iq;if(!iv?.questionnaire_snapshot||iv.completed_at||!InterviewQuestionnaire.questions(iv).some(q=>q.id===key))return;
 const state=questionnaireState(id),old=state.pending.get(key),expected=iv.interview_notes?.[key]??null;
 if(!old&&field.value===(expected??''))return;
 if(old)old.value=field.value;else state.pending.set(key,{value:field.value,expected,revision:iv.questionnaire_snapshot.revision});paintQuestionnaireStatus(id);
}
function capturePublishedQuestionnaire(){document.querySelectorAll('#interviewStepQuestionnaire [data-iq]').forEach(rememberPublishedField);}
async function loadPublishedQuestionnaire(id,manual=false){
 id=String(id);if(questionnaireLoads.has(id))return questionnaireLoads.get(id);const iv=questionnaireRecord(id);if(!iv||iv.completed_at||iv.questionnaire_snapshot)return;
 if(!manual&&(questionnaireLoadFailures.has(id)||iv.questionnaire_required===false))return;
 const state=questionnaireState(id);state.loadError=null;state.message='Cargando cuestionario publicado de esta plaza…';questionnaireAutoLoadCandidate=id;
 const flight=(async()=>{try{const {data,error}=await questionnaireCall('hr_begin_role_questionnaire',{p_candidate:id});if(error)throw error;const record=publishedInterviewRecord(data,id);interviews=interviews.filter(v=>String(v.candidate_id)!==id).concat(record);questionnaireLoadFailures.delete(id);state.message='Cuestionario publicado cargado. Las respuestas se guardan al salir del campo.';if(String(current?.id)===id){const pane=document.getElementById('interviewStepQuestionnaire');if(pane){pane.innerHTML=InterviewQuestionnaire.render(record,!record.completed_at);restorePublishedQuestionnaire();}}}catch(error){state.loadError=error;state.message='';questionnaireLoadFailures.add(id);questionnaireAutoLoadCandidate='';}finally{questionnaireLoads.delete(id);paintQuestionnaireStatus(id);}})();
 questionnaireLoads.set(id,flight);paintQuestionnaireStatus(id);return flight;
}
async function ensurePublishedQuestionnaireForNewInterview(){const id=String(current?.id||'');if(id)return loadPublishedQuestionnaire(id);}
async function beginPublishedQuestionnaire(button){const id=String(current?.id||'');if(!id)return;if(InterviewQuestionnaire.historical(questionnaireRecord(id)).length&&!confirm('Se conservarán las respuestas históricas sin reasignarlas. ¿Iniciar por separado el cuestionario publicado de esta plaza?'))return;button.disabled=true;try{await loadPublishedQuestionnaire(id,true);}finally{if(button.isConnected)button.disabled=false;}}
async function persistPublishedAnswer(candidateId,key,value,entry){
 const id=String(candidateId),iv=questionnaireRecord(id);if(!iv?.questionnaire_snapshot)throw Error('Inicia primero una versión publicada.');
 const expected=entry?entry.expected:iv.interview_notes?.[key]??null,revision=entry?.revision??iv.questionnaire_snapshot.revision;
 if(value===expected)return;
 const {data,error}=await questionnaireCall('hr_save_role_interview_answer',{p_candidate:id,p_question:key,p_value:value,p_expected:expected,p_revision:revision});if(error)throw error;
 Object.assign(iv,publishedInterviewRecord(data,id));if(window.parent!==window)window.parent.postMessage({type:'cartel-interview-progress-saved',candidateId:id},location.origin);
}
async function flushQuestionnaire(candidateId){
 const id=String(candidateId),state=questionnaireState(id);if(state.flushing)return state.flushing;state.error=null;
 state.flushing=Promise.resolve().then(async()=>{try{while(state.pending.size){for(const [key,entry] of state.pending){const sent={...entry};await persistPublishedAnswer(id,key,sent.value,sent);if(entry.value===sent.value)state.pending.delete(key);else entry.expected=sent.value;}}state.message='Respuestas guardadas.';}catch(error){state.error=error;state.message='';throw error;}finally{state.flushing=null;restorePublishedQuestionnaire();paintQuestionnaireStatus(id);}});return state.flushing;
}
function enqueueQuestionnaireSave(id){questionnaireSaveQueue=questionnaireSaveQueue.catch(()=>{}).then(()=>flushQuestionnaire(id)).catch(()=>{});return questionnaireSaveQueue;}
async function persistPublishedQuestionnaire(candidateId,notes){
 const id=String(candidateId),iv=questionnaireRecord(id),state=questionnaireState(id);for(const q of InterviewQuestionnaire.questions(iv)){if(!Object.hasOwn(notes,q.id))continue;const value=notes[q.id],old=state.pending.get(q.id);if(old)old.value=value;else if(value!==(iv.interview_notes?.[q.id]??''))state.pending.set(q.id,{value,expected:iv.interview_notes?.[q.id]??null,revision:iv.questionnaire_snapshot.revision});}await flushQuestionnaire(id);if(state.error)throw state.error;
}
document.addEventListener('input',event=>{const field=event.target.closest?.('#interviewStepQuestionnaire [data-iq]');if(field)rememberPublishedField(field);});
function queuePublishedInput(event){const field=event.target.closest?.('#interviewStepQuestionnaire [data-iq]');if(!field)return;rememberPublishedField(field);enqueueQuestionnaireSave(field.dataset.questionnaireCandidate||String(current?.id||''));}
document.addEventListener('change',queuePublishedInput);document.addEventListener('focusout',queuePublishedInput);
window.addEventListener('online',()=>{for(const [id,state] of questionnaireStates)if(state.pending.size&&state.error?.code!=='40001')enqueueQuestionnaireSave(id);});
new MutationObserver(()=>restorePublishedQuestionnaire()).observe(document.getElementById('interviewBody')||document.body,{childList:true,subtree:true});
window.addEventListener('beforeunload',event=>{capturePublishedQuestionnaire();if([...questionnaireStates.values()].some(s=>s.pending.size)){event.preventDefault();event.returnValue='';}});
