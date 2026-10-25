/* Shared rendering: only the immutable published snapshot is used for answers. */
(function(global){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function questions(iv){return iv?.questionnaire_snapshot?.status==='published' ? iv.questionnaire_snapshot.questions||[] : []}
 function historical(iv){return Object.entries(iv?.interview_notes||{}).filter(([k])=>/^q\d+(_choice)?$/.test(k)).map(([key,value])=>{
  const index=Number(key.match(/^q(\d+)/)[1]),legacy=global.InterviewQuestionnaireLegacy||{},full=legacy.full?.[index],inline=legacy.inline?.[index];
  const description=(full?'Lista de 16: '+full.text+' · '+full.help:'Pregunta original no disponible')+(inline&&!key.endsWith('_choice')?' | Lista inline de 5: '+inline[0]:'');
  return {key,value,description};
 });}
 function rows(iv){return questions(iv).map(q=>({q:q.text,label:q.section,a:String(iv?.interview_notes?.[q.id]||'')})).concat(historical(iv).map(r=>({q:'Histórico '+r.key+' · '+r.description,label:'Origen histórico; no reasignado',a:String(r.value||'')})));}
 function render(iv,editable=false){
  const qs=questions(iv),notes=iv?.interview_notes||{};
  let html=qs.length?'<p>Cuestionario publicado · versión '+esc(iv.questionnaire_snapshot.revision)+'</p>':'<p>No hay una versión publicada fijada a esta entrevista.</p>';
  html+=qs.map((q,i)=>'<div class="question"><div class="section-title">'+(i+1)+'. '+esc(q.section)+(q.required?' · Obligatoria':' · Opcional')+'</div><h3>'+esc(q.text)+'</h3><p class="follow">'+esc(q.help)+'</p>'+(editable?(q.type==='select'?'<select data-iq="'+esc(q.id)+'" aria-label="'+esc(q.text)+'"><option value="">Selecciona una respuesta…</option>'+q.options.map(o=>'<option '+(notes[q.id]===o?'selected':'')+'>'+esc(o)+'</option>').join('')+'</select>':'<textarea data-iq="'+esc(q.id)+'" aria-label="'+esc(q.text)+'">'+esc(notes[q.id]||'')+'</textarea>'):'<div class="saved-answer" style="display:block;white-space:pre-wrap">'+esc(notes[q.id]||'Sin respuesta')+'</div>')+'</div>').join('');
  const history=historical(iv);if(history.length)html+='<details class="question" open><summary>Respuestas históricas sin reasignar · '+history.length+' registros</summary><p>El sistema anterior usaba dos listas diferentes de 5 y 16 preguntas sin registrar su origen. Se conservan las claves, respuestas y las preguntas de origen posibles; no se atribuyen a las preguntas nuevas.</p>'+history.map(r=>'<p><b>'+esc(r.key)+'</b><br><small>'+esc(r.description)+'</small><br>'+esc(r.value)+'</p>').join('')+'</details>';
  return html;
 }
 function missing(iv,notes){const qs=questions(iv);if(!qs.length)return ['Cuestionario publicado pendiente de iniciar'];return qs.filter(q=>q.required&&(!String(notes?.[q.id]||'').trim()||['Otra respuesta','No responde / no se abordó'].includes(notes[q.id])||(q.type==='select'&&!q.options.includes(notes[q.id])))).map(q=>q.text);}
 global.InterviewQuestionnaire={questions,historical,rows,render,missing};
})(window);
