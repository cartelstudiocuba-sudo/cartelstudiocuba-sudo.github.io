/* Drafts and publication are separate, explicit operations. */
(function () {
  'use strict';
  const KEY = 'interview_questionnaire_draft';
  let editor = null;
  let editingIndex = null;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const copy = value => JSON.parse(JSON.stringify(value));
  const canonical = value => JSON.stringify(value, function (key, item) {
    return item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.keys(item).sort().map(name => [name,item[name]])) : item;
  });

  function validate(questions) {
    if (!Array.isArray(questions) || questions.length > 100) throw Error('El borrador admite hasta 100 preguntas.');
    const ids = new Set();
    return questions.map(q => {
      if (!q || !/^iq_[a-zA-Z0-9_-]{1,80}$/.test(q.id) || ids.has(q.id)) throw Error('Identificador de pregunta inválido o repetido.');
      ids.add(q.id);
      const text = String(q.text || '').trim(), section = String(q.section || '').trim(), help = String(q.help || '').trim();
      if (!text || text.length > 4000 || section.length > 200 || help.length > 4000) throw Error('Completa el texto de cada pregunta y revisa su longitud.');
      if (!['text', 'select'].includes(q.type) || typeof q.required !== 'boolean') throw Error('Tipo de pregunta inválido.');
      const options = q.type === 'select' && Array.isArray(q.options) ? q.options.map(x => String(x).trim()).filter(Boolean) : [];
      if (q.type === 'select' && (options.length < 2 || options.length > 30 || new Set(options).size !== options.length || options.some(x => x.length > 500))) throw Error('Cada pregunta con opciones necesita entre 2 y 30 opciones distintas.');
      return {id:q.id, section, text, help, type:q.type, required:q.required, options};
    });
  }

  window.renderRoleInterviewDraftEntry = function () {
    const published = role.work_content?.interview_questionnaire_published;
    setTimeout(() => { if (document.getElementById('roleInterviewDraft')) openRoleInterviewDraft(true); }, 0);
    const label = published ? 'Publicado · Versión '+escape(published.revision) : 'Borrador · Sin publicar';
    return '<section class="definition-detail-card interview-draft-entry"><div id="roleInterviewDraft" class="iq-inline-editor"></div></section>';
  };

  window.openRoleInterviewDraft = function (inline = false) {
    const existing = role.work_content?.[KEY];
    if (existing && (existing.version !== 1 || !Number.isSafeInteger(existing.revision) || !Array.isArray(existing.questions))) return alert('Formato de borrador no compatible. No se modificará.');
    try { if (existing) validate(existing.questions); } catch (error) { return alert(error.message); }
    editor = {roleId:String(role.id), original:existing ? copy(existing) : null, questions:existing ? copy(existing.questions) : [], saving:false};
    let dialog = document.getElementById('roleInterviewDraft');
    if (!dialog) {
      dialog = document.createElement(inline ? 'div' : 'dialog'); dialog.id = 'roleInterviewDraft';
      dialog.setAttribute('aria-label', 'Borrador del cuestionario de entrevista');
      dialog.addEventListener('cancel', event => { event.preventDefault(); closeRoleInterviewDraft(); });
      document.body.appendChild(dialog);
    }
    editingIndex = null;
    render(); if (!inline && typeof dialog.showModal === 'function') dialog.showModal();
  };

  function read() {
    if (!editor) return;
    const row = document.querySelector('#roleInterviewDraft [data-edit-index]');
    if (!row) return;
    const index = Number(row.dataset.editIndex);
    if (!Number.isInteger(index) || !editor.questions[index]) return;
    editor.questions[index] = {
      ...editor.questions[index],
      section:row.querySelector('[name=section]').value,
      text:row.querySelector('[name=text]').value,
      help:'',
      type:row.querySelector('[name=type]').value,
      required:row.querySelector('[name=required]').checked,
      options:row.querySelector('[name=type]').value === 'select' ? [...row.querySelectorAll('[data-option-index]')].map(x=>x.value.trim()).filter(Boolean) : []
    };
  }

  function render() {
    const dialog = document.getElementById('roleInterviewDraft');
    const rows = editor.questions.map((q,i) => {
      const open = editingIndex === i;
      return '<div class="iq-list-item"><div class="iq-list-row"><span class="iq-number">'+(i+1)+'</span><div class="iq-list-copy"><b>'+escape(q.text.trim()||'Nueva pregunta sin título')+'</b><small>'+escape(q.section||'Sin sección')+' · '+(q.type==='select'?'Menú desplegable':'Texto libre')+' · '+(q.required?'Obligatoria':'Opcional')+'</small></div><div class="iq-list-controls"><button type="button" onclick="changeRoleInterviewDraft('+i+',-1)" aria-label="Subir pregunta '+(i+1)+'" title="Subir" '+(i===0?'disabled':'')+'>↑</button><button type="button" onclick="changeRoleInterviewDraft('+i+',1)" aria-label="Bajar pregunta '+(i+1)+'" title="Bajar" '+(i===editor.questions.length-1?'disabled':'')+'>↓</button><button type="button" onclick="editRoleInterviewDraftQuestion('+i+')">'+(open?'Cerrar edición':'Editar')+'</button><button type="button" class="iq-delete" onclick="deleteRoleInterviewDraftQuestion('+i+')">Eliminar</button></div></div>'+(open?'<fieldset data-edit-index="'+i+'"><legend>Editar pregunta '+(i+1)+'</legend><label>Sección<input name="section" maxlength="200" value="'+escape(q.section)+'"></label><label>Pregunta<textarea name="text" maxlength="4000">'+escape(q.text)+'</textarea></label><label>Respuesta<select name="type" onchange="changeRoleInterviewAnswerType()"><option value="text" '+(q.type==='text'?'selected':'')+'>Texto libre</option><option value="select" '+(q.type==='select'?'selected':'')+'>Menú desplegable</option></select></label><div class="iq-option-editor" '+(q.type==='select'?'':'hidden')+'><strong>Opciones del menú desplegable</strong><div class="iq-option-list">'+q.options.map((option,j)=>'<div class="iq-option-row"><input data-option-index="'+j+'" aria-label="Opción '+(j+1)+'" maxlength="500" value="'+escape(option)+'"><button type="button" onclick="moveRoleInterviewOption('+j+',-1)" '+(j===0?'disabled':'')+' title="Subir opción">↑</button><button type="button" onclick="moveRoleInterviewOption('+j+',1)" '+(j===q.options.length-1?'disabled':'')+' title="Bajar opción">↓</button><button type="button" onclick="removeRoleInterviewOption('+j+')" title="Eliminar opción">×</button></div>').join('')+'</div><button type="button" onclick="addRoleInterviewOption()">+ Añadir opción</button><small>El menú necesita entre 2 y 30 opciones diferentes.</small></div><label><input name="required" type="checkbox" '+(q.required?'checked':'')+'> Obligatoria</label><button type="button" onclick="editRoleInterviewDraftQuestion('+i+')">Terminar edición</button></fieldset>':'')+'</div>';
    }).join('');
    dialog.innerHTML = '<style>#roleInterviewDraft{width:100%;max-height:none;overflow:visible;border:0;border-radius:14px;padding:10px 0}#roleInterviewDraft .iq-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}#roleInterviewDraft .iq-heading h2{margin:0}#roleInterviewDraft .iq-state{display:inline-flex;border-radius:999px;padding:6px 12px;background:#fff3bb;color:#594800;font-size:12px;font-weight:750}#roleInterviewDraft .iq-list-item{border:1px solid #e5e5e1;border-radius:13px;margin:8px 0;overflow:hidden;background:#fff}#roleInterviewDraft .iq-list-row{display:flex;align-items:center;gap:12px;padding:12px}#roleInterviewDraft .iq-number{flex:0 0 32px;height:32px;display:grid;place-items:center;border-radius:10px;background:#fff3bb;font-weight:800}#roleInterviewDraft .iq-list-copy{flex:1;min-width:0;overflow-wrap:anywhere}#roleInterviewDraft .iq-list-copy b{display:block;font-size:13px}#roleInterviewDraft .iq-list-copy small{display:block;color:#777;margin-top:4px}#roleInterviewDraft .iq-list-controls{display:flex;gap:5px;flex-wrap:wrap}#roleInterviewDraft .iq-list-controls button{border:1px solid #deded9;border-radius:8px;padding:7px 9px;background:#fafaf8;cursor:pointer}#roleInterviewDraft .iq-list-controls .iq-delete{color:#b33}#roleInterviewDraft fieldset{margin:0 12px 12px;padding:12px;border:1px solid #eee;border-radius:10px}#roleInterviewDraft fieldset label{display:block;margin:9px 0}#roleInterviewDraft fieldset textarea,#roleInterviewDraft fieldset input:not([type=checkbox]),#roleInterviewDraft fieldset select{display:block;width:100%;box-sizing:border-box;margin-top:5px}#roleInterviewDraft .iq-option-editor{margin:12px 0;padding:12px;border:1px solid #eee;border-radius:10px}#roleInterviewDraft .iq-option-editor[hidden]{display:none}#roleInterviewDraft .iq-option-row{display:flex;gap:6px;margin:8px 0;align-items:center}#roleInterviewDraft .iq-option-row input{flex:1;min-width:0}#roleInterviewDraft .iq-option-row button{border:1px solid #ddd;border-radius:8px;background:#fafafa;padding:8px;cursor:pointer}#roleInterviewDraft .iq-option-editor>button{margin-top:8px;border:1px solid #ddd;border-radius:8px;background:#fff7d4;padding:9px 12px;cursor:pointer}#roleInterviewDraft .iq-option-editor small{display:block;margin-top:8px;color:#777}#roleInterviewDraft .draft-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:15px}@media(max-width:700px){#roleInterviewDraft .iq-list-row{flex-wrap:wrap}#roleInterviewDraft .iq-list-controls{width:100%;justify-content:flex-end}}</style><div class="iq-heading"><h2>Cuestionario de entrevista</h2><span class="iq-state">'+(role.work_content?.interview_questionnaire_published?'Publicado · Versión '+escape(role.work_content.interview_questionnaire_published.revision):'Borrador · Sin publicar')+'</span></div><p>Organiza, edita y administra las preguntas de esta plaza.</p><div id="roleInterviewDraftRows">'+(rows||'<p>No hay preguntas. Puedes añadir la primera.</p>')+'</div><p id="roleInterviewDraftStatus" role="status"></p><p class="iq-publication-note">Guardar el borrador no lo activa. Las entrevistas iniciadas conservan su versión.</p><div class="draft-actions"><button type="button" onclick="addRoleInterviewDraftQuestion()">Añadir pregunta</button><button type="button" onclick="saveRoleInterviewDraft()">Guardar borrador</button><button type="button" onclick="publishRoleInterviewDraft()">Aprobar y publicar</button> </div>';
  }

  window.changeRoleInterviewAnswerType = function () {
    if (!editor || editor.saving) return;
    read();
    const index = editingIndex;
    if (index === null) return;
    if (editor.questions[index].type === 'select' && !editor.questions[index].options.length) editor.questions[index].options = ['Opción 1', 'Opción 2'];
    render();
  };
  window.addRoleInterviewOption = function () {
    if (!editor || editor.saving || editingIndex === null) return;
    read();
    const q = editor.questions[editingIndex];
    if (q.options.length >= 30) return alert('Máximo 30 opciones.');
    q.options.push('Nueva opción '+(q.options.length+1));
    render();
    document.querySelector('#roleInterviewDraft [data-option-index="'+(q.options.length-1)+'"]')?.focus();
  };
  window.removeRoleInterviewOption = function (index) {
    if (!editor || editor.saving || editingIndex === null) return;
    read(); editor.questions[editingIndex].options.splice(index,1); render();
  };
  window.moveRoleInterviewOption = function (index, delta) {
    if (!editor || editor.saving || editingIndex === null) return;
    read(); const options=editor.questions[editingIndex].options, next=index+delta;
    if (next < 0 || next >= options.length) return;
    [options[index],options[next]]=[options[next],options[index]]; render();
  };
  window.editRoleInterviewDraftQuestion = function(index) {
    if (!editor || editor.saving) return;
    read();
    editingIndex = editingIndex === index ? null : index;
    render();
    if (editingIndex !== null) document.querySelector('#roleInterviewDraft [data-edit-index] [name=text]')?.focus();
  };
  window.deleteRoleInterviewDraftQuestion = function(index) {
    if (!editor || editor.saving || !confirm('¿Eliminar esta pregunta del borrador?')) return;
    read();
    editor.questions.splice(index,1);
    editingIndex = null;
    render();
  };
  window.addRoleInterviewDraftQuestion = function () {
    if (!editor || editor.saving) return;
    read(); if (editor.questions.length >= 100) return alert('El borrador admite hasta 100 preguntas.');
    editor.questions.push({id:'iq_'+crypto.randomUUID(), section:'',text:'',help:'',type:'text',required:true,options:[]});
    editingIndex = editor.questions.length-1;
    render(); document.querySelector('#roleInterviewDraft [data-edit-index] [name=text]')?.focus();
  };
  window.changeRoleInterviewDraft = function (index, delta) {
    if (!editor || editor.saving) return;
    read();
    if (!delta) editor.questions.splice(index,1);
    else if (index+delta>=0 && index+delta<editor.questions.length) [editor.questions[index],editor.questions[index+delta]]=[editor.questions[index+delta],editor.questions[index]];
    editingIndex = null;
    render();
  };
  window.closeRoleInterviewDraft = function () {
    if (!editor || editor.saving) return;
    read();
    if (JSON.stringify(editor.questions)!==JSON.stringify(editor.original?.questions || []) && !confirm('¿Cerrar sin guardar los cambios del borrador?')) return;
    const el=document.getElementById('roleInterviewDraft'); if(el && typeof el.close==='function')el.close(); editor=null; if(el && el.tagName!=='DIALOG')el.innerHTML='';
  };

  window.saveRoleInterviewDraft = async function () {
    if (!editor || editor.saving) return;
    const state = editor, status = document.getElementById('roleInterviewDraftStatus');
    try {
      read(); const questions=validate(state.questions);
      state.saving=true;
      document.querySelectorAll('#roleInterviewDraft button, #roleInterviewDraft input, #roleInterviewDraft textarea, #roleInterviewDraft select').forEach(el=>el.disabled=true);
      status.textContent='Guardando borrador…';
      const latest=await sb.from('hr_roles').select('id,work_content,updated_at').eq('id',state.roleId).single();
      if (latest.error) throw latest.error;
      if (!latest.data || String(role.id)!==state.roleId) throw Error('La plaza cambió. Vuelve a abrir el borrador.');
      const content=latest.data.work_content || {};
      if (canonical(content[KEY] || null)!==canonical(state.original)) throw Error('Otra sesión modificó este borrador. Cierra y vuelve a abrir la plaza antes de guardar.');
      const draft={...state.original,version:1,revision:(state.original?.revision || 0)+1,status:'draft',questions};
      let query=sb.from('hr_roles').update({work_content:{...content,[KEY]:draft},updated_at:new Date().toISOString()}).eq('id',state.roleId);
      query=latest.data.updated_at==null ? query.is('updated_at',null) : query.eq('updated_at',latest.data.updated_at);
      query=latest.data.work_content==null ? query.is('work_content',null) : query.eq('work_content',JSON.stringify(latest.data.work_content));
      const result=await query.select().maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) throw Error('La plaza cambió durante el guardado. No se sobrescribió su contenido. Vuelve a intentarlo.');
      if (String(role.id)===state.roleId) role=result.data;
      state.original=copy(draft); state.questions=copy(questions);
      status.textContent='Borrador guardado. Aún no está activo en entrevistas.';
    } catch (error) { status.textContent='No se guardó: '+(error.message || String(error)); }
    finally {
      state.saving=false;
      document.querySelectorAll('#roleInterviewDraft button, #roleInterviewDraft input, #roleInterviewDraft textarea, #roleInterviewDraft select').forEach(el=>el.disabled=false);
    }
  };
  window.publishRoleInterviewDraft = async function () {
    if(!editor||editor.saving)return;
    const state=editor;
    if(String(role.id)!==state.roleId)return alert('La plaza cambió. Vuelve a abrir el borrador.');
    read();
    if(canonical(editor.questions)!==canonical(editor.original?.questions||[]))return alert('Guarda primero el borrador que deseas aprobar.');
    if(!editor.questions.length)return alert('Un cuestionario vacío no se puede publicar.');
    if(!confirm('¿Aprobar y publicar este cuestionario para nuevas entrevistas de esta plaza? Las entrevistas iniciadas conservarán su versión.'))return;
    editor.saving=true;
    try{
      const {data,error}=await sb.rpc('hr_publish_role_questionnaire',{p_role:state.roleId,p_expected:state.original});
      if(error)throw error;const row=Array.isArray(data)&&data.length===1?data[0]:data;
      if(!row||Array.isArray(row)||String(row.id)!==state.roleId)throw Error('Respuesta de publicación no válida. Recarga la plaza.');
      if(String(role.id)===state.roleId)role=row;document.getElementById('roleInterviewDraftStatus').textContent='Cuestionario aprobado y publicado. Versión '+row.work_content.interview_questionnaire_published.revision;
    }catch(error){document.getElementById('roleInterviewDraftStatus').textContent='No se publicó: '+error.message}finally{state.saving=false}
  };
  window.addEventListener('beforeunload',event=>{
    if(!editor)return;read();
    if(editor.saving||canonical(editor.questions)!==canonical(editor.original?.questions||[])){event.preventDefault();event.returnValue=''}
  });
})();
