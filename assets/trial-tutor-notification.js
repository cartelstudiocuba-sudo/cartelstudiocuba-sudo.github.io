/* Tutor notification is independent of candidate delivery and never writes HR records. */
window.CartelTrialTutor = (() => {
 const text = value => String(value ?? '').trim();
 function phone(value) {
  const raw=text(value);if(!/^\+?[\d\s().-]+$/.test(raw))return '';
  let digits=raw.replace(/\D/g,'');if(digits.startsWith('00'))digits=digits.slice(2);
  if(digits.length===8)digits='53'+digits;
  return /^[1-9]\d{7,14}$/.test(digits)?digits:'';
 }
 function message(v) {
  return `Hola, *${v.tutor}* 👋

Te informamos que el siguiente candidato ha sido asignado a tu supervisión para realizar su período de prueba.

👤 *Datos del candidato*
• Nombre: ${v.candidate}
• Plaza: ${v.role}
• Departamento: ${v.department}

📅 *Período de prueba*
• Fecha de inicio: ${new Date(v.start+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}
• Duración: ${v.days} días
• Días laborables: ${v.workdays}
• Horario: ${v.hours}
• Frecuencia: ${v.frequency}

📋 *Durante este período*, estarás a cargo de orientar al candidato, explicarle sus funciones, acompañarlo en su capacitación y supervisar su desempeño.

Es importante que nos comuniques cualquier incidencia que pueda surgir y que, al finalizar el período de prueba, realices la evaluación correspondiente para determinar si el candidato está listo para incorporarse al equipo.

¡Gracias por tu apoyo! 🤝`;
 }
 async function mount(host, candidate, role, sb, preserve, supplied={}) {
  if(host.querySelector('[data-trial-tutor]'))return;
  const section=document.createElement('section');section.dataset.trialTutor='1';section.style.cssText='margin-top:18px;display:grid;gap:12px;min-width:0';host.append(section);
  const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent='Cargando los datos del período de prueba…';section.append(status);
  try {
   const result=await sb.from('hr_trial_periods').select('*').eq('candidate_id',candidate.id).is('superseded_at',null).maybeSingle();
   if(result.error||!result.data)throw Error('No se pudo consultar el período de prueba. Cierra y vuelve a abrir esta etapa para reintentar.');
   const trial=result.data;
   const key='cartel-trial-tutor:'+trial.id;
   let saved={};try{saved=JSON.parse(sessionStorage.getItem(key)||'{}');}catch(_){}
   const schedule=text(trial.schedule).split(' · ');
   const defaults={tutor:trial.tutor_name||role.tutor_name||'',phone:trial.tutor_phone||role.tutor_phone||'',start:trial.start_date||'',days:trial.duration_days||'',workdays:trial.work_days||schedule.slice(1).join(' · ')||role.work_days||'',hours:schedule[0]||role.schedule||'',frequency:trial.frequency||role.payment_frequency||'',department:role.area||role.department||'',...supplied,...saved.values};
   const form=document.createElement('form');form.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:12px;min-width:0';
   const fields=[['tutor','Nombre del tutor','text'],['phone','WhatsApp del tutor','tel'],['start','Fecha de inicio','date'],['days','Duración (días)','number'],['workdays','Días laborables','text'],['hours','Horario','text'],['frequency','Frecuencia','text'],['department','Departamento','text']];
   for(const [name,label,type] of fields){const wrap=document.createElement('label');wrap.style.cssText='display:grid;gap:6px;min-width:0';wrap.textContent=label;const input=document.createElement('input');input.name=name;input.type=type;input.required=true;input.value=text(defaults[name]);input.style.cssText='width:100%;min-width:0;box-sizing:border-box;padding:12px;border-radius:10px;background:#223247;color:white;border:1px solid #667b92';if(name==='days'){input.min='1';input.max='365';input.step='1';}wrap.append(input);form.append(wrap);}
   const help=document.createElement('p');help.textContent='Revisa el nombre y el número del tutor. Si falta su teléfono, introdúcelo con código de país (8 dígitos para Cuba). Nunca se utiliza el teléfono del candidato.';help.style.gridColumn='1/-1';form.append(help);
   const prepare=document.createElement('button');prepare.type='submit';prepare.className='btn';prepare.style.cssText='grid-column:1/-1;background:linear-gradient(155deg,#49e78a,#25d366);color:#09251a;border:1px solid #83efae;border-radius:14px;padding:15px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:10px';prepare.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.5 7.4L3 21l2.1-5.2A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 8c0 4 3 7 7 7l1-2-3-1-1 1-2-2 1-1-1-2Z"/></svg><span>Notificar vía WhatsApp al tutor</span>';form.prepend(prepare);
   const output=document.createElement('div');output.style.minWidth='0';section.append(form,output);
   function values(){return Object.fromEntries([...new FormData(form)].map(([k,v])=>[k,text(v)]));}
   function store(state){saved={values:values(),state};try{sessionStorage.setItem(key,JSON.stringify(saved));}catch(_){} }
   status.textContent=saved.state||'Tutor: pendiente. Abrir WhatsApp no confirma el envío.';
   form.addEventListener('input',()=>{form.elements.phone.setCustomValidity('');output.replaceChildren();status.textContent='Tutor: datos modificados; revisa y prepara el mensaje.';store(status.textContent);});
   form.onsubmit=e=>{e.preventDefault();const v=values(),number=phone(v.phone);form.elements.phone.setCustomValidity(number?'':'Introduce un teléfono válido del tutor; no se abrirá WhatsApp sin destinatario.');if(!form.reportValidity())return;
    if(!text(candidate.full_name)||!text(trial.role_title||role.title)){status.textContent='Faltan los datos del candidato o de la plaza. Actualiza la ficha.';return;}
    output.replaceChildren();const snapshot=JSON.stringify(v);const preview=document.createElement('textarea');preview.rows=22;preview.readOnly=true;preview.setAttribute('aria-label','Mensaje para el tutor');preview.style.cssText='width:100%;box-sizing:border-box;min-width:0;padding:12px;background:#223247;color:white';preview.value=message({...v,candidate:text(candidate.full_name),role:text(trial.role_title||role.title)});
    const destination=document.createElement('p');destination.textContent='Destinatario: '+v.tutor+' · +'+number;
    const open=document.createElement('button');open.type='button';open.className='btn';open.textContent='Abrir WhatsApp del tutor';
    const confirm=document.createElement('button');confirm.type='button';confirm.className='btn';confirm.textContent='Confirmar que envié el mensaje al tutor';confirm.hidden=true;
    open.onclick=()=>{if(JSON.stringify(values())!==snapshot)return;preserve(candidate.id);const tab=window.open('https://wa.me/'+number+'?text='+encodeURIComponent(preview.value),'_blank');if(!tab){status.textContent='No se pudo abrir WhatsApp. Permite las ventanas emergentes y reintenta. Envío sin confirmar.';store(status.textContent);return;}try{tab.opener=null;}catch(_){}status.textContent='Tutor: WhatsApp abierto; envío sin confirmar.';confirm.hidden=false;store(status.textContent);};
    confirm.onclick=()=>{status.textContent='Tutor: envío confirmado manualmente por ti; entrega no verificada.';store(status.textContent);confirm.hidden=true;};
    output.append(destination,preview,open,confirm);status.textContent='Tutor: mensaje preparado; todavía no se ha enviado.';store(status.textContent);
   };
  }catch(error){status.textContent=error.message;const retry=document.createElement('button');retry.type='button';retry.className='btn';retry.textContent='Reintentar datos del tutor';retry.onclick=()=>{section.remove();mount(host,candidate,role,sb,preserve,supplied);};section.append(retry);}
 }
 return {mount,phone,message};
})();
