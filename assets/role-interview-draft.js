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
    const draft = role.work_content?.[KEY];
    const published=role.work_content?.interview_questionnaire_published;
    return '<section class="definition-detail-card interview-draft-entry"><h3>Cuestionario de entrevista</h3><p>' + (published ? 'Publicada: versión '+escape(published.revision)+'.' : 'Sin versión publicada. Las propuestas no están activas.') + '</p><p>'+escape(draft?.review_note||'Borrador editable pendiente de revisión y aprobación.')+'</p><p>Guardar un borrador no lo activa. Las entrevistas iniciadas conservan su versión.</p><button type="button" class="btn" onclick="openRoleInterviewDraft()">Editar borrador de preguntas</button></section>';
  };

  window.openRoleInterviewDraft = function () {
    const existing = role.work_content?.[KEY];
    if (existing && (existing.version !== 1 || !Number.isSafeInteger(existing.revision) || !Array.isArray(existing.questions))) return alert('Formato de borrador no compatible. No se modificará.');
    try { if (existing) validate(existing.questions); } catch (error) { return alert(error.message); }
    editor = {roleId:String(role.id), original:existing ? copy(existing) : null, questions:existing ? copy(existing.questions) : [], saving:false};
    let dialog = document.getElementById('roleInterviewDraft');
    if (!dialog) {
      dialog = document.createElement('dialog'); dialog.id = 'roleInterviewDraft';
      dialog.setAttribute('aria-label', 'Borrador del cuestionario de entrevista');
      dialog.addEventListener('cancel', event => { event.preventDefault(); closeRoleInterviewDraft(); });
      document.body.appendChild(dialog);
    }
    editingIndex = null;
    render(); dialog.showModal();
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
      help:row.querySelector('[name=help]').value,
      type:row.querySelector('[name=type]').value,
      required:row.querySelector('[name=required]').checked,
      options:row.querySelector('[name=options]').value.split('\\n').map(x=>x.trim()).filter(Boolean)
    };
  }

  function render() {
    const dialog = document.getElementById('roleInterviewDraft');
    const rows = editor.questions.map((q,i) => {
      const open = editingIndex === i;
      return '<div class="iq-list-item"><div class="iq-list-row"><span class="iq-number">'+(i+1)+'</span><div class="iq-list-copy"><b>'+escape(q.text.trim()||'Nueva pregunta sin título')+'</b><small>'+escape(q.section||'Sin sección')+' · '+(q.type==='select'?'Selección':'Texto libre')+' · '+(q.required?'Obligatoria':'Opcional')+'</small></div><div class="iq-list-controls"><button type="button" onclick="changeRoleInterviewDraft('+i+',-1)" aria-label="Subir pregunta '+(i+1)+'" title="Subir" '+(i===0?'disabled':'')+'>↑</button><button type="button" onclick="changeRoleInterviewDraft('+i+',1)" aria-label="Bajar pregunta '+(i+1)+'" title="Bajar" '+(i===editor.questions.length-1?'disabled':'')+'>↓</button><button type="button" onclick="editRoleInterviewDraftQuestion('+i+')">'+(open?'Cerrar edición':'Editar')+'</button><button type="button" class="iq-delete" onclick="deleteRoleInterviewDraftQuestion('+i+')">Eliminar</button></div></div>'+(open?'<fieldset data-edit-index="'+i+'"><legend>Editar pregunta '+(i+1)+'</legend><label>Sección<input name="section" maxlength="200" value="'+escape(q.section)+'"></label><label>Pregunta<textarea name="text" maxlength="4000">'+escape(q.text)+'</textarea></label><label>Orientación para quien entrevista<textarea name="help" maxlength="4000">'+escape(q.help)+'</textarea></label><label>Respuesta<select name="type"><option value="text" '+(q.type==='text'?'selected':'')+'>Texto libre</option><option value="select" '+(q.type==='select'?'selected':'')+'>Una opción</option></select></label><label>Opciones (una por línea, para selección)<textarea name="options">'+escape(q.options.join('\\n'))+'</textarea></label><label><input name="required" type="checkbox" '+(q.required?'checked':'')+'> Obligatoria</label><button type="button" onclick="editRoleInterviewDraftQuestion('+i+')">Terminar edición</button></fieldset>':'')+'</div>';
    }).join('');
    dialog.innerHTML = '<style>#roleInterviewDraft{width:min(960px,96vw);max-height:90vh;overflow:auto;border:1px solid #e6e6e0;border-radius:18px;padding:22px}#roleInterviewDraft .iq-list-item{border:1px solid #e5e5e1;border-radius:13px;margin:8px 0;overflow:hidden;background:#fff}#roleInterviewDraft .iq-list-row{display:flex;align-items:center;gap:12px;padding:12px}#roleInterviewDraft .iq-number{flex:0 0 32px;height:32px;display:grid;place-items:center;border-radius:10px;background:#fff3bb;font-weight:800}#roleInterviewDraft .iq-list-copy{flex:1;min-width:0;overflow-wrap:anywhere}#roleInterviewDraft .iq-list-copy b{display:block;font-size:13px}#roleInterviewDraft .iq-list-copy small{display:block;color:#777;margin-top:4px}#roleInterviewDraft .iq-list-controls{display:flex;gap:5px;flex-wrap:wrap}#roleInterviewDraft .iq-list-controls button{border:1px solid #deded9;border-radius:8px;padding:7px 9px;background:#fafaf8;cursor:pointer}#roleInterviewDraft .iq-list-controls .iq-delete{color:#b33}#roleInterviewDraft fieldset{margin:0 12px 12px;padding:12px;border:1px solid #eee;border-radius:10px}#roleInterviewDraft fieldset label{display:block;margin:9px 0}#roleInterviewDraft fieldset textarea,#roleInterviewDraft fieldset input:not([type=checkbox]),#roleInterviewDraft fieldset select{display:block;width:100%;box-sizing:border-box;margin-top:5px}#roleInterviewDraft .draft-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:15px}@media(max-width:700px){#roleInterviewDraft .iq-list-row{flex-wrap:wrap}#roleInterviewDraft .iq-list-controls{width:100%;justify-content:flex-end}}</style><h2>Borrador de entrevista · '+escape(role.title)+'</h2><p>Una pregunta por fila. Ordena, edita o elimina individualmente. Guardar no publica.</p><div id="roleInterviewDraftRows">'+(rows||'<p>No hay preguntas. Puedes añadir la primera.</p>')+'</div><p id="roleInterviewDraftStatus" role="status"></p><div class="draft-actions"><button type="button" onclick="addRoleInterviewDraftQuestion()">Añadir pregunta</button><button type="button" onclick="saveRoleInterviewDraft()">Guardar borrador</button><button type="button" onclick="publishRoleInterviewDraft()">Aprobar y publicar</button><button type="button" onclick="closeRoleInterviewDraft()">Cerrar</button></div>';
  }

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
    document.getElementById('roleInterviewDraft').close(); editor=null;
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
