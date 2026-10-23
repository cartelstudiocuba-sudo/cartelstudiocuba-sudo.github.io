// Suggested descriptions for the interviewer to record after hearing the answer.
const INTERVIEW_QUESTION_OPTIONS = {
  2: ['Sí, ya conocía la agencia y su trabajo', 'Solo había oído el nombre', 'La conocí por esta convocatoria', 'La investigué después de ver la convocatoria', 'No la conocía ni la había investigado'],
  7: ['Ordena por horarios límite y reorganiza ante la urgencia', 'Consulta la prioridad de la urgencia antes de reorganizar', 'Delega o coordina tareas para cumplir los plazos', 'Mantiene el orden inicial aunque aparezca la urgencia', 'Atiende la urgencia y deja las demás tareas para después'],
  8: ['Pregunta por alternativas y busca resolver la gestión', 'Contacta a otra persona autorizada para orientarse', 'Espera una respuesta antes de continuar', 'Regresa y deja la gestión para el día siguiente', 'Busca otra solución e informa de lo ocurrido'],
  9: ['Organiza por horario de cierre, recorrido y tiempo disponible', 'Confirma primero horarios, distancias y requisitos', 'Delega o coordina alguna gestión para llegar a tiempo', 'Sigue el orden de la lista de tareas', 'Propone posponer alguna gestión para llegar a las 12'],
  11: ['Informa del error y propone cómo corregirlo', 'Corrige lo que puede y después informa', 'Consulta antes de intentar corregirlo', 'Espera a comprobar si el error genera un problema', 'Intenta resolverlo sin comunicarlo'],
  12: ['Resume el problema, propone una solución y pide una decisión concreta', 'Resume el problema y comunica el siguiente paso', 'Explica primero todos los antecedentes', 'Pide que le llamen para explicar la situación', 'Comunica que hay un problema sin proponer el siguiente paso'],
  15: ['Aclara el objetivo, investiga, prueba y valida el resultado', 'Busca una guía o tutorial y aprende mientras realiza la tarea', 'Pide orientación inicial y después continúa por su cuenta', 'Solicita acompañamiento durante toda la tarea', 'Espera instrucciones o formación antes de empezar']
};

let questionnaireSaveQueue = Promise.resolve();
function saveQuestionnaireValue(key, value) {
  // Serialize changes so a selection and its notes cannot overwrite one another.
  questionnaireSaveQueue = questionnaireSaveQueue.catch(() => {}).then(() => saveInterviewNote(key, value));
  return questionnaireSaveQueue;
}

function renderInterviewQuestionResponse(index, notes) {
  const number = index + 1, key = 'q' + index;
  const options = INTERVIEW_QUESTION_OPTIONS[number];
  const selected = notes[key + '_choice'] || '';
  const choices = options ? [...options, 'Otra respuesta', 'No responde / no se abordó'] : [];
  // Preserve any previously saved suggestion if the list is edited in the future.
  if (selected && !choices.includes(selected)) choices.push(selected);
  const dropdown = options ? `<label class="question-response-label no-print" for="questionChoice${number}">Respuesta indicada por el candidato</label><select class="question-response-choice no-print" id="questionChoice${number}" onchange="saveQuestionnaireValue('${key}_choice',this.value)"><option value="">Selecciona la respuesta que mejor coincida…</option>${choices.map(value => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(value)}</option>`).join('')}</select><p class="question-response-help no-print">Registra la respuesta después de escuchar al candidato.</p>` : '';
  if (options) return dropdown;
  return `<textarea class="no-print" aria-label="Notas de la pregunta ${number}" placeholder="Notas de la respuesta…" onblur="saveQuestionnaireValue('${key}',this.value)">${esc(notes[key] || '')}</textarea>`;
}

function interviewQuestionAnswer(notes, index) {
  return [notes['q' + index + '_choice'], notes['q' + index]].filter(Boolean).join('\n\n');
}
