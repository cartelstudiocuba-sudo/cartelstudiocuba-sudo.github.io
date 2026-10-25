/* Shared rendering: only the immutable published snapshot is used for answers. */
(function(global){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function questions(iv){return iv?.questionnaire_snapshot?.status==='published' ? iv.questionnaire_snapshot.questions||[] : []}
 function historical(iv){
  const entries=Object.entries(iv?.interview_notes||{}).filter(([k])=>/^q\d+(_choice)?$/.test(k));
  const legacy=global.InterviewQuestionnaireLegacy||{};
  const usesFull=entries.some(([key])=>Number(key.match(/^q(\d+)/)[1])>=5||key.endsWith('_choice'));
  return entries.map(([key,value])=>{
   const index=Number(key.match(/^q(\d+)/)[1]);
   const full=legacy.full?.[index],inline=legacy.inline?.[index];
   const question=usesFull?full?.text:(inline?.[0]||full?.text);
   const help=usesFull?full?.help:'';
   return {key,value,question:question||'Pregunta original no identificada',help:help||'',certain:usesFull&&!!full||!usesFull&&!!inline,ambiguous:!usesFull&&!!full&&!!inline&&full.text!==inline[0]};
  });
 }
 function rows(iv){return questions(iv).map(q=>({q:q.text,label:q.section,a:String(iv?.interview_notes?.[q.id]||'')})).concat(historical(iv).map(r=>({q:r.question,label:r.certain&&!r.ambiguous?'Cuestionario histórico':'Pregunta histórica sin origen confirmado',a:String(r.value||'')})));}
 function render(iv,editable=false){
  const qs=questions(iv),notes=iv?.interview_notes||{};
  let html=qs.length?'<p>Cuestionario publicado · versión '+esc(iv.questionnaire_snapshot.revision)+'</p>':'';
  html+=qs.map((q,i)=>'<div class="question"><div class="section-title">'+(i+1)+'. '+esc(q.section)+(q.required?' · Obligatoria':' · Opcional')+'</div><h3>'+esc(q.text)+'</h3><p class="follow">'+esc(q.help)+'</p>'+(editable?(q.type==='select'?'<select data-iq="'+esc(q.id)+'" aria-label="'+esc(q.text)+'"><option value="">Selecciona una respuesta…</option>'+q.options.map(o=>'<option '+(notes[q.id]===o?'selected':'')+'>'+esc(o)+'</option>').join('')+'</select>':'<textarea data-iq="'+esc(q.id)+'" aria-label="'+esc(q.text)+'">'+esc(notes[q.id]||'')+'</textarea>'):'<div class="saved-answer" style="display:block;white-space:pre-wrap">'+esc(notes[q.id]||'Sin respuesta')+'</div>')+'</div>').join('');
  const history=historical(iv);
  if(history.length){
   const certain=history.every(r=>r.certain&&!r.ambiguous);
   html+='<section class="historical-interview" aria-label="Cuestionario histórico"><h3>Cuestionario original · respuestas conservadas</h3><p class="muted">'+(certain?'Entrevista anterior a la publicación de cuestionarios versionados. Se muestran las preguntas históricas identificadas y sus respuestas originales.':'Se conservan las respuestas originales. Algunas preguntas no pueden identificarse con certeza porque el sistema anterior no registraba la versión del cuestionario.')+'</p>'+history.map((r,i)=>'<div class="question"><div class="section-title">Pregunta histórica '+(i+1)+'</div><h3>'+esc(r.question)+'</h3>'+(r.help?'<p class="follow">'+esc(r.help)+'</p>':'')+(r.ambiguous?'<p class="muted">La pregunta de origen no está confirmada.</p>':'')+'<div class="saved-answer" style="display:block;white-space:pre-wrap">'+esc(r.value||'Sin respuesta')+'</div></div>').join('')+'</section>';
  }
  if(!qs.length&&!history.length)html='<p>Esta entrevista no tiene respuestas de cuestionario registradas.</p>';
  return html;
 }
 function missing(iv,notes){const qs=questions(iv);if(!qs.length)return ['Cuestionario publicado pendiente de iniciar'];return qs.filter(q=>q.required&&(!String(notes?.[q.id]||'').trim()||['Otra respuesta','No responde / no se abordó'].includes(notes[q.id])||(q.type==='select'&&!q.options.includes(notes[q.id])))).map(q=>q.text);}
 global.InterviewQuestionnaire={questions,historical,rows,render,missing};
})(window);
