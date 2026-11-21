const hiringChoices={education_level:['Primaria','Secundaria','Técnico medio','Bachiller','Bachiller técnico','Universitario','Máster','Doctor','Otro'],emergency_relation:['Madre','Padre','Hermana','Hermano','Hija','Hijo','Cónyuge','Pareja','Abuela','Abuelo','Tía','Tío','Prima','Primo','Amistad','Otro'],civil_status:['Soltero/a','Casado/a','Unión consensual','Divorciado/a','Viudo/a','Prefiero no declarar'],has_children:['Sí','No','Prefiero no declarar']};
function hiringSelectOptions(el,options,value){el.replaceChildren(new Option('Selecciona…',''));const aliases={'universitaria':'Universitario','universitario':'Universitario','plaza':'Plaza de la Revolución','10 de octubre':'Diez de Octubre','true':'Sí','false':'No'};let v=String(value??'');v=aliases[v.toLocaleLowerCase('es')]||v;const match=options.find(x=>x.localeCompare(v,'es',{sensitivity:'base'})===0);if(match)v=match;for(const x of options)el.add(new Option(x,x));if(v&&!options.includes(v))el.add(new Option(v+' · dato anterior, revisa',v));el.value=v;}
'use strict';
const hiringEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function hiringRpc(name,args){const r=await sb.rpc(name,args);if(r.error)throw Error(r.error.message);return r.data;}
function hiringMessage(name,plaza,form,contract){return `Felicidades, ${name}, has completado satisfactoriamente tu período de capacitación para la plaza de ${plaza}. Nos complace informarte que avanzas a la etapa de contratación oficial en El Cartel Studio. Para continuar, necesitamos que completes los siguientes pasos:

1. Completar tu expediente laboral: Accede al siguiente formulario para confirmar tus datos personales y proporcionar la información y documentación pendiente que necesitamos para conformar tu expediente laboral.

${form}

2. Revisar y descargar tu contrato: Accede al siguiente enlace para consultar tu contrato laboral, descargarlo o imprimirlo. Deberás entregarlo firmado a tu tutor para completar el proceso de contratación.

${contract}

Una vez recibida y validada la documentación, podremos formalizar tu incorporación a nuestro equipo. Bienvenido a esta nueva etapa en El Cartel Studio.`;}

// Strip only an explicit display-only test label; never change the stored identity.
function hiringGreetingName(candidate){return String(candidate.full_name||'').trim().replace(/^CANDIDATO DE PRUEBA\s*[—–-]\s*(?=\S)/i,'').trim();}
function hiringNotificationDialog(title,returnTo=null){
 document.getElementById('hiringNotificationOverlay')?.remove();
 if(!document.getElementById('hiringNotificationStyles')){
  const style=document.createElement('style');style.id='hiringNotificationStyles';style.textContent=`
  .hiring-notification-overlay{position:fixed;inset:0;z-index:2147483100;background:#000b;backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}
  .hiring-notification-dialog{box-sizing:border-box;width:760px;max-width:100%;max-height:calc(100dvh - 48px);overflow:auto;background:#141719;color:#edf0f2;border:1px solid #424337;border-radius:24px;padding:28px;box-shadow:0 24px 90px #0009;font:15px/1.65 system-ui,sans-serif;color-scheme:dark}
  .hiring-notification-dialog *{box-sizing:border-box}.hiring-notification-dialog header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.hiring-notification-dialog > header h3{margin:0;color:#fff;font-size:25px;line-height:1.25}.hiring-notification-dialog small{display:block;color:#FFDA03;font-size:11px;letter-spacing:.12em;margin-bottom:8px;font-weight:800}
  .hiring-notification-dialog p:not(#contractArticle p,.hiring-contract-reading p){color:#c7cdd0;margin:18px 0}.hiring-notification-dialog button{font:600 14px/1.4 system-ui,sans-serif;border:1px solid #555a5d;border-radius:12px;padding:13px 18px;background:#262b2e;color:#fff;cursor:pointer;min-height:46px}.hiring-notification-dialog button:focus-visible{outline:3px solid #FFDA03;outline-offset:3px}.hiring-notification-dialog button:disabled{opacity:.55;cursor:wait}.hiring-notification-dialog button[hidden]{display:none}.hiring-notification-dialog .hiring-close{padding:4px;width:42px;min-height:42px;font-size:26px;flex-shrink:0;background:transparent}.hiring-notification-dialog .hiring-message{margin:20px 0;padding:22px;border:1px solid #373e42;border-radius:16px;background:#0d1012;white-space:pre-wrap;overflow-wrap:anywhere;max-height:48dvh;overflow:auto;user-select:text;line-height:1.75}.hiring-notification-dialog textarea.hiring-message{display:block;width:100%;height:40dvh;min-height:140px;resize:vertical;color:#edf0f2;font:inherit;line-height:1.75}.hiring-notification-dialog textarea.hiring-message:focus-visible{outline:2px solid #FFDA03;outline-offset:3px}.hiring-message a{color:#FFDA03;text-decoration:underline;overflow-wrap:anywhere}.hiring-notification-dialog .hiring-whatsapp{background:#218c52;border-color:#36b16e;display:inline-flex;gap:10px;align-items:center;justify-content:center}.hiring-whatsapp svg{width:22px;height:22px;flex-shrink:0}.hiring-notification-dialog .hiring-confirm{display:block;width:100%;margin-top:12px;color:#FFDA03;border-color:#817020;background:#292719}
  .hiring-notification-dialog.hiring-candidate-review{width:900px;line-height:1.5}.hiring-notification-dialog .hiring-review-back{position:sticky;top:0;z-index:2;margin:0 0 18px;display:inline-flex;align-items:center;color:#ffe566;border-color:#ffda0350;background:#28291d}.hiring-review-progress{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:22px}.hiring-review-progress>div{min-width:0;border:1px solid #ffffff20;border-radius:14px;padding:14px;background:linear-gradient(145deg,#ffffff0b,#ffffff03)}.hiring-review-progress span{display:block;font-size:12px;color:#bec7cc}.hiring-review-progress strong{display:block;font-size:15px;margin-top:5px;color:#ffe17a}.hiring-review-progress .is-ready strong{color:#84e2b5}.hiring-review-section{margin:16px 0;padding:20px;border:1px solid #ffffff1c;border-radius:17px;background:#ffffff03}.hiring-notification-dialog .hiring-review-section h4{font-size:16px;line-height:1.4;margin:0 0 16px;color:#fff}.hiring-review-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 24px;margin:0}.hiring-review-grid>div{min-width:0}.hiring-review-grid .is-wide{grid-column:1/-1}.hiring-review-grid dt{font-size:12px;color:#aeb9c0;line-height:1.45;margin-bottom:5px}.hiring-review-grid dd{font-size:14px;color:#edf0f2;margin:0;overflow-wrap:anywhere;white-space:pre-wrap;font-weight:600}.hiring-review-grid dd.is-missing{font-weight:400;color:#8d9aa2}.hiring-review-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.hiring-review-actions button{min-width:0;white-space:normal;text-align:left;font-size:13px}.hiring-notification-dialog .hiring-review-primary{background:linear-gradient(130deg,#ffe969,#ffda03);color:#191919;border-color:#ffe45b}.hiring-personal-links{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 20px}.hiring-personal-links a{display:flex;align-items:center;padding:11px 14px;border:1px solid #ffda0340;border-radius:12px;color:#ffe566;background:#ffda0309;font-size:13px;text-decoration:none;overflow-wrap:anywhere}.hiring-personal-links a:focus-visible{outline:2px solid #ffda03;outline-offset:3px}
  .hiring-candidate-review .contract-tools{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 16px}.hiring-candidate-review #contractDownload{background:#ffda03;color:#1c1c15;border-color:#ffda03}.hiring-candidate-review #contractArticle{color:#222;font:14px/1.5 Arial,sans-serif}.hiring-candidate-review #contractArticle .contract-page-content{overflow-wrap:anywhere}.hiring-candidate-review #contractArticle .contract-paper-footer{font-size:10px}.hiring-contract-reading{background:#fff;color:#222;border-radius:14px;padding:clamp(16px,4vw,36px);font:16px/1.6 Arial,sans-serif;overflow-wrap:anywhere}.hiring-contract-reading h1,.hiring-contract-reading h2,.hiring-contract-reading h3,.hiring-contract-reading h4{color:#222;line-height:1.35}.hiring-contract-reading h2{font-size:22px}.hiring-contract-reading h3{font-size:17px}.hiring-contract-reading .contract-paper-header{margin:0 0 20px;text-align:left}.hiring-contract-reading .contract-paper-clause{margin:16px 0 0}.hiring-contract-reading .contract-annex-table{table-layout:fixed}.hiring-contract-reading .contract-annex-box{height:auto;min-height:80px}.hiring-contract-reading .transport-photo-slot{height:110px}
  .hiring-review-nav{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;padding:4px;margin:0 0 16px;border:1px solid #465058;border-radius:13px;background:#111518}.hiring-review-nav button{min-height:44px;min-width:0;padding:6px 2px;border-radius:9px;border-color:transparent;background:transparent;font-size:clamp(11px,3.3vw,14px)}.hiring-review-nav button[aria-selected="true"]{background:#ffda03;color:#1c1c15;font-weight:750}.hiring-review-grid>div{padding:10px 12px;border-radius:9px;background:#ffffff05}.hiring-candidate-review [role="tabpanel"][hidden]{display:none}.hiring-candidate-review [role="tabpanel"][hidden][aria-busy="true"]{display:block;position:absolute;left:-10000px;width:calc(100% - 32px);max-width:844px;visibility:hidden}.hiring-candidate-review>[role="status"]{font-weight:650}.hiring-candidate-review>[role="status"]:empty{display:none}.hiring-candidate-review .hiring-review-back{position:static}
  .hiring-notification-dialog.hiring-candidate-review{background:#141719;border-color:#4a4e50}
  .hiring-candidate-review .hiring-review-back{padding:4px 0;margin:10px 0;min-height:38px;border-color:transparent;background:transparent;font-size:13px}
  .hiring-review-profile{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:14px;margin:0 0 14px;padding:16px;border:1px solid #504a33;border-radius:16px;background:linear-gradient(115deg,#2b3032,#1a1d1f 67%,#3d3418);box-shadow:0 4px 10px #0003}
  .hiring-review-initials{display:grid;place-items:center;width:52px;height:52px;border:2px solid #ffda03;border-radius:14px;background:#181b1d;color:#fff;font-size:18px;font-weight:800}
  .hiring-review-profile-name,.hiring-review-profile-role{display:block;overflow-wrap:anywhere}.hiring-review-profile-name{font-size:18px;line-height:1.25;color:#fff}.hiring-review-profile-role{margin-top:3px;color:#c9d0d4;font-size:13px}
  .hiring-review-profile-state{display:inline-block;margin-top:8px;padding:3px 8px;border-radius:7px;background:#574315;color:#ffe587;font-size:11px;font-weight:750}.hiring-review-profile-state.is-ready{background:#1c4931;color:#bdffcf}
  .hiring-review-nav{background:#1f2427;border-color:#42484b}.hiring-review-nav button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-height:52px;font-size:clamp(10px,3vw,14px);line-height:1.15}.hiring-review-nav button[aria-selected="true"]{background:linear-gradient(#ffe342,#ffda03);box-shadow:0 2px 0 #b99c00}
  .hiring-review-icon{display:inline-flex;flex:none}.hiring-review-icon svg{width:19px;height:19px}.hiring-data-card h4{display:flex;align-items:center;gap:9px}.hiring-data-card h4 .hiring-review-icon{color:#ffda03}
  .hiring-candidate-review .hiring-data-card{margin:0 0 11px;padding:13px 14px;background:linear-gradient(145deg,#25292b,#1d2123);border-color:#40464a;border-radius:13px}
  .hiring-candidate-review .hiring-data-card h4{margin-bottom:7px}.hiring-candidate-review .hiring-data-card .hiring-review-grid{grid-template-columns:minmax(0,1fr);gap:0}.hiring-data-card .hiring-review-grid>div{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;align-items:baseline;padding:7px 0;border-top:1px solid #ffffff16;border-radius:0;background:none}.hiring-data-card .hiring-review-grid dt{margin:0;overflow-wrap:anywhere}.hiring-data-card .hiring-review-grid dd{text-align:right;font-size:13px}
  @media screen{.hiring-candidate-review .is-reading .contract-viewport,.hiring-candidate-review .is-reading>#contractArticle{position:absolute;left:-10000px}.hiring-contract-reading[hidden]{display:none}}
  @media print{.hiring-contract-reading,.hiring-contract-review .hiring-review-back,.hiring-candidate-review .contract-tools,.hiring-contract-review #contractError{display:none!important}}
  .hiring-document-preview:empty{display:none}.hiring-document-preview{margin-top:14px;color:#c7cdd0}.hiring-document-preview p{margin:0 0 8px}.hiring-document-preview img{display:block;max-width:100%;max-height:55dvh;object-fit:contain;border-radius:10px}
  .hiring-checklist{border:0;padding:0;margin:12px 0 20px;background:none}.hiring-validation-list{display:grid;gap:9px;position:relative;margin:0;padding:0 0 0 32px;list-style:none}.hiring-validation-list::before{content:"";position:absolute;left:9px;top:22px;bottom:22px;width:2px;background:#59636a}.hiring-validation-step{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:5px 8px;padding:11px 12px;border:1px solid #465058;border-radius:10px;background:linear-gradient(145deg,#282e32,#1c2124)}.hiring-validation-step::before{content:"";position:absolute;left:-31px;top:13px;width:18px;height:18px;border:2px solid #a3adb5;border-radius:50%;background:#141719;box-sizing:border-box}.hiring-validation-step.is-complete::before{content:"✓";background:#8be3aa;border-color:#8be3aa;color:#14261a;text-align:center;font:bold 12px/14px system-ui}.hiring-validation-step.is-next,.hiring-validation-step.is-next::before{border-color:#ffda03}.hiring-validation-step h5{margin:0;color:#f2f4f6;font-size:14px;line-height:1.3}.hiring-validation-step p{grid-column:1/-1;margin:0;font-size:12px;line-height:1.4}.hiring-validation-status{font-size:11px;font-weight:750;padding:3px 7px;border-radius:7px;background:#414b52;color:#fff}.is-complete .hiring-validation-status{background:#205938;color:#dcffe7}.is-next .hiring-validation-status{background:#ffda03;color:#211d00}.hiring-checklist .hiring-review-primary{width:100%;margin-top:14px;box-shadow:0 3px 0 #a28b00}.hiring-management{margin-top:16px;padding:10px 12px;border:1px solid #465058;border-radius:10px;background:#202529}.hiring-management summary{color:#edf0f2;cursor:pointer;font-weight:650}.hiring-management .hiring-review-actions,.hiring-checklist>.hiring-review-actions:not(:empty){margin-top:12px}.hiring-notification-dialog .hiring-revoke{color:#ffb5ad;border-color:#a65e59}
  .hiring-message-actions{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:10px;padding-top:14px;border-top:1px solid #ffffff20}.hiring-message-actions .hiring-whatsapp,.hiring-message-actions .hiring-confirm{grid-column:1/-1;margin:0}.hiring-message-actions button{min-width:0;white-space:normal}.hiring-message-actions .hiring-whatsapp{font-weight:750;background:linear-gradient(150deg,#1c844a,#126338);box-shadow:0 3px 0 #0c4828}
  @media(max-width:600px){.hiring-message-actions{grid-template-columns:minmax(0,1fr)}.hiring-review-grid{grid-template-columns:minmax(0,1fr)}.hiring-review-section{padding:15px}.hiring-review-actions{grid-template-columns:minmax(0,1fr)}.hiring-review-progress{gap:6px}.hiring-review-progress>div{padding:11px 8px}.hiring-review-progress span{font-size:10px}.hiring-review-progress strong{font-size:12px}.hiring-personal-links a{width:100%}}
  @media(max-width:600px){.hiring-notification-overlay{padding:10px}.hiring-notification-dialog{padding:20px 16px;max-height:calc(100dvh - 20px);border-radius:18px}.hiring-notification-dialog > header h3{font-size:22px}.hiring-notification-dialog .hiring-message{padding:16px;font-size:14px}.hiring-notification-dialog .hiring-whatsapp{width:100%}}
  `;document.head.append(style);
 }
 const previous=document.activeElement,overlay=document.createElement('div'),dialog=document.createElement('section');overlay.id='hiringNotificationOverlay';overlay.className='hiring-notification-overlay';dialog.className='hiring-notification-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',title);
 const head=document.createElement('header'),label=document.createElement('div'),brand=document.createElement('small'),heading=document.createElement('h3'),close=document.createElement('button');brand.textContent='EL CARTEL STUDIO · CONTRATACIÓN';heading.textContent=title;close.type='button';close.className='hiring-close';close.textContent='×';close.setAttribute('aria-label','Cerrar');const dismiss=()=>{overlay.remove();if(returnTo)returnTo();else previous?.focus()};close.onclick=dismiss;label.append(brand,heading);head.append(label,close);dialog.append(head);overlay.append(dialog);document.body.append(overlay);close.focus();
 overlay.addEventListener('keydown',e=>{if(e.key==='Escape')dismiss();if(e.key==='Tab'){const items=[...dialog.querySelectorAll('button:not([hidden]):not(:disabled),a[href],textarea:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter(item=>!item.closest('[hidden]')&&item.tabIndex>=0);const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
 return {overlay,dialog};
}
function hiringMessagePreview(text){const preview=document.createElement('div');preview.className='hiring-message';preview.setAttribute('aria-label','Mensaje aprobado para el candidato');for(const part of text.split(/(https:\/\/[^\s]+)/g)){if(/^https:\/\//.test(part)){const a=document.createElement('a');a.href=part;a.textContent=part;a.target='_blank';a.rel='noopener noreferrer';preview.append(a)}else preview.append(document.createTextNode(part))}return preview;}

function hiringRestorePanel(overlay,dialog,focus){
 const scroll=dialog.scrollTop;return ()=>{document.getElementById('hiringNotificationOverlay')?.remove();document.body.append(overlay);dialog.scrollTop=scroll;if(focus?.isConnected)focus.focus({preventScroll:true});};
}
function hiringReviewBack(dialog,back,label){const button=document.createElement('button');button.type='button';button.className='hiring-review-back';button.textContent='← '+label;button.onclick=back;dialog.append(button);return button;}
function hiringPersonalLinks(form,contract){const links=document.createElement('nav');links.className='hiring-personal-links';links.setAttribute('aria-label','Enlaces personalizados');for(const [href,label] of [[form,'Completar expediente laboral'],[contract,'Revisar y descargar contrato']]){const a=document.createElement('a');a.href=href;a.textContent=label+' ↗';a.target='_blank';a.rel='noopener noreferrer';links.append(a);}return links;}
let hiringCases={};
function hiringPreparationActions(id,h){
 return '<button type="button" class="candidate-flow-action" onclick="openHiringPreparationNotification(\''+hiringEsc(id)+'\')">Notificar al candidato →</button>';
}
function hiringReturnToSheet(dialog,overlay){
 const back=document.createElement('button');back.textContent='Volver a la ficha';back.onclick=()=>overlay.remove();dialog.append(back);
}
function hiringTrainingReviewActions(id){return '<div style="display:grid;gap:10px;min-width:0"><button type="button" class="candidate-flow-action" onclick="openHiringTrainingReview(\''+hiringEsc(id)+'\')">Consultar datos de adiestramiento</button><button type="button" class="candidate-flow-action" onclick="continueHiringTrainingRoute(\''+hiringEsc(id)+'\')">Continuar a preparar contratación →</button></div>';}
async function openHiringTrainingReview(id){
 const {dialog}=hiringNotificationDialog('10 · Comienzo de adiestramiento');const body=document.createElement('div');body.textContent='Consultando datos guardados…';dialog.append(body);
 try{const t=trialPeriodsByCandidate[String(id)];const {data,error}=await sb.from('hr_trial_closures').select('training_start,training_days,training_tutor').eq('trial_id',t.id).maybeSingle();if(error)throw error;body.replaceChildren();for(const [key,label] of [['training_start','Inicio'],['training_days','Duración (días)'],['training_tutor','Tutor']]){const p=document.createElement('p');p.textContent=label+': '+(data?.[key]?(typeof data[key]==='object'?JSON.stringify(data[key]):data[key]):'Sin dato registrado');body.append(p);}const note=document.createElement('p');note.textContent='Revisión de la etapa ya realizada. Se conservan la notificación, el expediente, el contrato y el estado laboral.';body.append(note);}catch(e){body.textContent='No se pudo consultar el adiestramiento: '+e.message;}
}
async function continueHiringTrainingRoute(id){try{await onboardingCall(id,'hiring_training_continue');preserveCandidateSheet(id);window.CartelEvolution?.refresh();}catch(e){alert(e.message);}}
const hiringReviewScripts=new Map();
async function loadHiringContractReview(root,h){
 root.textContent='Cargando contrato guardado…';
 root.setAttribute('aria-busy','true');
 if(!document.getElementById('hiringReviewStyles')){
  const style=document.createElement('style');style.id='hiringReviewStyles';
  style.textContent='@media print{body:has(.hiring-contract-review)>:not(#hiringNotificationOverlay){display:none!important}body:has(.hiring-contract-review) #hiringNotificationOverlay{position:static;display:block;padding:0;background:white;backdrop-filter:none}.hiring-notification-dialog.hiring-contract-review{width:100%;max-width:none;max-height:none;overflow:visible;border:0;padding:0;background:white;box-shadow:none}.hiring-contract-review>:not(#hiring-review-panel-contract){display:none!important}}';
  document.head.append(style);
 }
 try{for(const file of ['vendor/jspdf-2.5.2.umd.min.js','vendor/html2canvas-1.4.1.min.js','trial-closure-document.js','contract-paper.js','hiring-contract-paper.js','hiring-contract.js']){
  if(!hiringReviewScripts.has(file))hiringReviewScripts.set(file,new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/assets/'+file+'?v=20261111-hiring-restored';s.onload=resolve;s.onerror=()=>{hiringReviewScripts.delete(file);reject(Error('No se pudo cargar el visor. Cierra y reintenta.'));};document.head.append(s);}));await hiringReviewScripts.get(file);
 }const snapshot=structuredClone(h);snapshot.contract.logos={...(snapshot.contract.logos||{})};
 for(const key of ['logo_path','watermark_path']){const path=snapshot.contract.template?.presentation?.[key];if(path&&!snapshot.contract.logos[path]){const {data,error}=await sb.storage.from('hr-role-documents').download(path);if(error||!data)throw Error('No se pudo leer la presentación del contrato guardado.');snapshot.contract.logos[path]=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(data);});}}
 if(!root.isConnected)return;
 await renderHiringContract(root,snapshot);
 if(root.isConnected)hiringContractReadingView(root);
 }catch(e){
  const retry=document.createElement('button');retry.type='button';retry.textContent='Reintentar';
  retry.onclick=()=>loadHiringContractReview(root,h);
  root.replaceChildren(document.createTextNode(e.message+' '),retry);
 }finally{root.removeAttribute('aria-busy');}
}
function hiringContractReadingView(root){
 const article=root.querySelector('#contractArticle'),tools=root.querySelector('.contract-tools');
 if(!article||!tools)return;
 const reading=document.createElement('article');
 reading.className='hiring-contract-reading';
 const paper=article.querySelectorAll('.contract-paper-page');
 if(paper.length){
  for(const page of paper){
   const header=page.querySelector('.contract-paper-header');
   if(header)reading.append(header.cloneNode(true));
   const content=page.querySelector('.contract-page-content');
   if(content)for(const child of content.children)reading.append(child.cloneNode(true));
  }
 }else{
  for(const child of article.children)reading.append(child.cloneNode(true));
 }
 const toggle=document.createElement('button');toggle.type='button';
 const showReading=enabled=>{
  root.classList.toggle('is-reading',enabled);reading.hidden=!enabled;
  toggle.textContent=enabled?'Vista Carta':'Lectura cómoda';
 };
 toggle.onclick=()=>showReading(reading.hidden);
 tools.prepend(toggle);root.append(reading);
 const download=root.querySelector('#contractDownload');
 if(download){download.textContent='Descargar PDF';download.addEventListener('click',()=>showReading(false),true);}
 showReading(true);
}
function hiringCandidateLabel(x,fallback){return x.status==='trial'&&hiringCases[String(x.id)]?.notified_at?'Contratación en trámite':fallback;}
async function loadHiringCases(){const {data,error}=await sb.from('hr_hiring_cases').select('trial_id,candidate_id,notified_at,verified_at,signed_at,employee_id,revision,submitted_at,revoked_at,expires_at');if(error)throw Error('No se pudo comprobar la contratación. '+error.message);hiringCases=Object.fromEntries((data||[]).map(h=>[String(h.candidate_id),h]));}
function hiringToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');}
const hiringWhatsAppIcon='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.4-4.7A8.5 8.5 0 1 1 20.5 11.6Z"/><path d="M8 7.5c.5 4 3 6.5 7 7l1-2-2.5-1-1 1c-1.5-.7-2.3-1.5-3-3l1-1-1-2.5Z"/></svg>';
function hiringWhatsAppButton(){
 const button=document.createElement('button');
 button.className='hiring-whatsapp';
 button.innerHTML=hiringWhatsAppIcon+'<span>Abrir WhatsApp</span>';
 return button;
}
function hiringMessageActions(dialog){
 const actions=document.createElement('footer');
 actions.className='hiring-message-actions';
 dialog.append(actions);
 return actions;
}
let hiringMessageDraft;
function hiringAddReview(candidateId,overlay,container){
 const review=document.createElement('button');
 review.textContent='Revisar expediente y contrato';
 review.onclick=()=>openHiringReview(candidateId,hiringRestorePanel(overlay,overlay.firstElementChild,review));
 container.append(review);
}
async function openHiringPreparationNotification(candidateId,renew=false,previewOnly=false,whatsappTab=null){
 const existing=hiringCases[String(candidateId)];
 const candidate=candidates.find(c=>String(c.id)===String(candidateId)),trial=trialPeriodsByCandidate[String(candidateId)];
 if(!renew&&(existing||previewOnly)&&candidate){
  const draft=hiringMessageDraft;
  if(existing&&draft?.candidateId===candidateId&&draft.expiresAt===existing.expires_at&&!existing.revoked_at&&Date.parse(existing.expires_at)>Date.now()){
   draft.restore();
   return;
  }
  const {overlay,dialog}=hiringNotificationDialog('Preparar contratación');
  const status=document.createElement('p');
  status.setAttribute('role','status');
  status.textContent=existing?.employee_id?'Contratación formalizada.':'Al abrir WhatsApp se prepararán los enlaces del expediente y del contrato.';
  dialog.append(status,hiringMessagePreview(hiringMessage(hiringGreetingName(candidate),dashboardCandidateRoleName(candidate),'[Enlace al expediente laboral]','[Enlace al contrato laboral]')));
  const actions=hiringMessageActions(dialog);
  if(!existing?.employee_id){
   const send=hiringWhatsAppButton();
   send.onclick=()=>{
    if(candidatePhone(candidate).length<8){status.textContent='Falta un WhatsApp válido.';return;}
    if(existing&&!existing.revoked_at&&Date.parse(existing.expires_at)>Date.now()&&
       !confirm('Se crearán enlaces nuevos. Los anteriores dejarán de funcionar. ¿Continuar?'))return;
    const tab=window.open('about:blank','_blank');
    if(!tab){status.textContent='El navegador bloqueó WhatsApp. Permite las ventanas emergentes y reintenta.';return;}
    return openHiringPreparationNotification(candidateId,true,false,tab);
   };
   actions.append(send);
  }
  hiringAddReview(candidateId,overlay,actions);
  hiringReturnToSheet(actions,overlay);
  return;
 }
 if(!candidate||!['trial','hired'].includes(candidate.status)||!trainingNotificationByTrial[String(trial?.id)]||trainingDecisionByTrial[String(trial?.id)]!=='continue'){whatsappTab?.close();return alert('Actualiza la ficha para comprobar la etapa.');}
 const {overlay,dialog}=hiringNotificationDialog('Preparar contratación');
 const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Preparando enlaces individuales protegidos…';dialog.append(status);

 try{
  hiringMessageDraft=undefined;
  const token=hiringToken(),prepared=await hiringRpc('hr_prepare_hiring',{p_trial:trial.id,p_token:token});
  await loadHiringCases();
  if(!overlay.isConnected){whatsappTab?.close();return;}
  const form=location.origin+'/expediente-contratacion.html#token='+token,contract=location.origin+'/contrato-laboral.html#token='+token;
  status.textContent='Puedes editar el mensaje antes de abrir WhatsApp. Los enlaces vencen el '+new Date(prepared.expires_at).toLocaleString('es-CU',{timeZone:'America/Havana'})+'. Abrir WhatsApp no confirma su envío.';
  const messageText=hiringMessage(hiringGreetingName(candidate),dashboardCandidateRoleName(candidate),form,contract);const editor=document.createElement('textarea');editor.className='hiring-message';editor.setAttribute('aria-label','Mensaje para el candidato (editable)');editor.value=messageText;dialog.append(editor);
  const links=hiringPersonalLinks(form,contract);dialog.append(links);
  const confirmSend=document.createElement('button');confirmSend.textContent='Confirmar notificación enviada';confirmSend.className='hiring-confirm';confirmSend.hidden=true;
  confirmSend.onclick=async()=>{if(confirmSend.disabled)return;confirmSend.disabled=true;try{await persistHiringNotification(candidateId,trial);hiringMessageDraft=undefined;overlay.remove();}catch(e){status.textContent=e.message;confirmSend.disabled=false;}};
  const send=hiringWhatsAppButton();let opened=false;
  send.onclick=async()=>{
   if(send.disabled)return;
   const phone=candidatePhone(candidate);
   if(phone.length<8)return alert('Falta un WhatsApp válido.');
   if(!editor.value.trim())return alert('Escribe un mensaje.');
   if(Date.parse(prepared.expires_at)<=Date.now())return status.textContent='Los enlaces han caducado. Cierra y vuelve a preparar la contratación.';
   send.disabled=true;
   try{
    if(!opened){
     // Reserve synchronously so popup blocking never advances the route.
     const tab=whatsappTab||window.open('about:blank','_blank');
     whatsappTab=null;
     if(!tab)throw Error('El navegador bloqueó WhatsApp. Permite las ventanas emergentes y reintenta.');
     try{tab.opener=null;if(tab.document){const policy=tab.document.createElement('meta');policy.name='referrer';policy.content='no-referrer';tab.document.head.append(policy);}tab.location.replace('https://wa.me/'+phone+'?text='+encodeURIComponent(editor.value));}catch(e){tab.close();throw e;}
     opened=true;
     const pending={version:3,stage:trial.stage,expires_at:prepared.expires_at,at:Date.now(),action:'whatsapp_opened'};
     try{sessionStorage.setItem('cartel-hiring-pending:'+trial.id,JSON.stringify(pending));}catch(_){}
    }
    preserveCandidateSheet(candidateId);confirmSend.hidden=false;
    status.textContent='WhatsApp abierto. Si enviaste el mensaje, confirma la notificación para avanzar al paso 12.';send.disabled=false;
   }catch(e){status.textContent=e.message;send.textContent='Abrir WhatsApp';send.disabled=false;}
  };
  const actions=hiringMessageActions(dialog);
  actions.append(send,confirmSend);
  hiringAddReview(candidateId,overlay,actions);
  hiringReturnToSheet(actions,overlay);
  hiringMessageDraft={candidateId,expiresAt:prepared.expires_at,restore:hiringRestorePanel(overlay,dialog,editor)};
  if(whatsappTab)await send.onclick();
 }catch(e){
  whatsappTab?.close();
  status.textContent=e.message;
  if(overlay.isConnected){
   const actions=hiringMessageActions(dialog);
   const retry=document.createElement('button');retry.textContent='Reintentar';retry.onclick=()=>openHiringPreparationNotification(candidateId);
   actions.append(retry);hiringAddReview(candidateId,overlay,actions);hiringReturnToSheet(actions,overlay);
  }
 }
}
// Legacy notified_at / hiring_notify mean notification initiated, never verified delivery.
const hiringNotificationSaves=new Map();
async function persistHiringNotification(id,trial){
 if(hiringNotificationSaves.has(trial.id))return hiringNotificationSaves.get(trial.id);
 const save=(async()=>{
  if(!hiringCases[String(id)]?.notified_at){
   let timeout;
   try{await Promise.race([hiringRpc('hr_manage_hiring',{p_trial:trial.id,p_action:'notify'}),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('El guardado tarda demasiado. Reintenta para comprobar el avance.')),15000);})]);}finally{clearTimeout(timeout);}
  }
  await loadHiringCases();
  if(!hiringCases[String(id)]?.notified_at)throw Error('No se pudo comprobar el guardado. Reintenta.');
  preserveCandidateSheet(id);
  await refreshCandidateAfterStatusChange(id);
  try{sessionStorage.removeItem('cartel-hiring-pending:'+trial.id);}catch(_){}
 })();
 hiringNotificationSaves.set(trial.id,save);
 try{return await save;}finally{hiringNotificationSaves.delete(trial.id);}
}
async function resumeHiringConfirmation(id){
 const t=trialPeriodsByCandidate[String(id)],candidate=candidates.find(c=>String(c.id)===String(id));if(!t||!['trial','hired'].includes(candidate?.status))return;
 let p;try{p=JSON.parse(sessionStorage.getItem('cartel-hiring-pending:'+t.id)||'null');}catch(_){return;}
 // Old explicit-send confirmations are not evidence of a new automatic action.
 if(![2,3].includes(p?.version)||p.action!=='whatsapp_opened')return;
 if(document.getElementById('hiringNotificationOverlay'))return;
 const h=hiringCases[String(id)];
 if(p.stage!==t.stage||!h||h.revoked_at||Date.parse(h.expires_at)!==Date.parse(p.expires_at)||!Number.isFinite(Date.parse(p.expires_at))||Date.parse(p.expires_at)<=Date.now()||!Number.isFinite(p.at)||Date.now()-p.at>=86400000||p.at>Date.now()){
  try{sessionStorage.removeItem('cartel-hiring-pending:'+t.id);}catch(_){}return;
 }
 const {overlay,dialog}=hiringNotificationDialog('Confirmar notificación de contratación');
 const info=document.createElement('p');info.setAttribute('role','status');info.textContent='Si enviaste el mensaje preparado, confirma el envío para avanzar al paso 12. Si no lo enviaste, vuelve a la ficha.';
 const confirmSend=document.createElement('button');confirmSend.className='hiring-confirm';confirmSend.textContent='Confirmar notificación enviada';confirmSend.onclick=async()=>{if(confirmSend.disabled)return;confirmSend.disabled=true;try{await persistHiringNotification(id,t);overlay.remove();}catch(e){info.textContent=e.message;confirmSend.disabled=false;}};
 dialog.append(info,confirmSend);hiringReturnToSheet(dialog,overlay);
}

function hiringReviewIcon(key){
 const paths={
  data:'<circle cx="12" cy="7" r="3"/><path d="M5 21v-3a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v3z"/>',
  documents:'<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6"/>',
  contract:'<path d="m4 16 12-12 4 4L8 20H4zm10-10 4 4M3 22h18"/>',
  validation:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 3 3 5-6"/>',
  contact:'<path d="M7 3H4c-1 0-1 2-1 3 0 8 7 15 15 15 1 0 3 0 3-1v-3l-5-2-2 2c-3-1-6-4-7-7l2-2z"/>',
  education:'<path d="m2 9 10-5 10 5-10 5zM6 11v5l6 3 6-3v-5m4-2v7"/>'
 };
 const icon=document.createElement('span');icon.className='hiring-review-icon';icon.setAttribute('aria-hidden','true');
 icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">'+paths[key]+'</svg>';
 return icon;
}
function hiringReviewProfile(h){
 const profile=document.createElement('div');profile.className='hiring-review-profile';
 const name=String(h.data?.full_name||'').trim();
 const initials=document.createElement('span');initials.className='hiring-review-initials';initials.setAttribute('aria-hidden','true');initials.textContent=name.split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]||'').join('').toLocaleUpperCase()||'—';
 const details=document.createElement('div');
 const label=document.createElement('strong');label.className='hiring-review-profile-name';label.textContent=name||'Nombre pendiente';details.append(label);
 if(h.contract?.role?.title){const role=document.createElement('span');role.className='hiring-review-profile-role';role.textContent=h.contract.role.title;details.append(role);}
 const state=document.createElement('span');state.className='hiring-review-profile-state';
 if(h.verified_at||h.submitted_at)state.classList.add('is-ready');
 state.textContent=h.verified_at?'Expediente validado':h.submitted_at?'Expediente recibido':'Expediente pendiente';
 details.append(state);profile.append(initials,details);return profile;
}
async function openHiringReview(id,returnTo=null,activeTab='data'){
 const {overlay,dialog}=hiringNotificationDialog('Revisar expediente y contrato',returnTo);dialog.classList.add('hiring-candidate-review');const t=trialPeriodsByCandidate[String(id)];
 const status=document.createElement('p');status.setAttribute('role','status');dialog.append(status);
 hiringReviewBack(dialog,()=>{
  overlay.remove();
  return returnTo ? returnTo() : openHiringPreparationNotification(id,false,true);
 },'Volver al mensaje');
 try{
 const {data:h,error}=await sb.from('hr_hiring_cases').select('*').eq('trial_id',t.id).single();if(error)throw error;
 if(!overlay.isConnected)return;
 status.textContent='';
 dialog.append(hiringReviewProfile(h));
 const navigation=document.createElement('div');navigation.className='hiring-review-nav';navigation.setAttribute('role','tablist');navigation.setAttribute('aria-label','Secciones del expediente');dialog.append(navigation);
 const tabs=new Map();
 const selectTab=key=>{
  for(const [name,{button,panel}] of tabs){
   const selected=name===key;
   button.setAttribute('aria-selected',String(selected));
   button.tabIndex=selected?0:-1;
   panel.hidden=!selected;
  }
  activeTab=key;
  dialog.classList.toggle('hiring-contract-review',key==='contract');
  dialog.scrollTop=0;
  const panel=tabs.get(key).panel;
  if(key==='contract'&&!panel.hasChildNodes())return loadHiringContractReview(panel,h);
 };
 for(const [label,key] of [['Datos','data'],['Documentos','documents'],['Contrato','contract'],['Validación','validation']]){
  const button=document.createElement('button');button.type='button';button.append(hiringReviewIcon(key),document.createTextNode(label));button.id='hiring-review-tab-'+key;
  button.setAttribute('role','tab');button.setAttribute('aria-controls','hiring-review-panel-'+key);
  button.onclick=()=>selectTab(key);
  const panel=document.createElement('div');panel.id='hiring-review-panel-'+key;panel.hidden=true;
  panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);
  navigation.append(button);dialog.append(panel);tabs.set(key,{button,panel});
 }
 navigation.onkeydown=e=>{
  const keys=[...tabs.keys()],index=keys.indexOf(activeTab);
  const target={ArrowLeft:keys[(index+3)%4],ArrowRight:keys[(index+1)%4],Home:keys[0],End:keys.at(-1)}[e.key];
  if(!target)return;
  e.preventDefault();selectTab(target);tabs.get(target).button.focus();
 };
 const groups=[['Identificación','data'],['Contacto y emergencia','contact'],['Escolaridad','education']];
 hiringFields.forEach((fields,index)=>{const section=document.createElement('section');section.className='hiring-review-section hiring-data-card';const title=document.createElement('h4');const [group,icon]=groups[index];title.append(hiringReviewIcon(icon),document.createTextNode(group));const details=document.createElement('dl');details.className='hiring-review-grid';for(const [key,label] of fields){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd'),value=h.data?.[key];dt.textContent=label.replace(' (opcional)','');const empty=value===null||value===undefined||String(value).trim()==='';dd.textContent=empty?(label.includes('(opcional)')?'No declarado':'Pendiente'):String(value);if(empty)dd.className='is-missing';if(['address','care_responsibilities','planned_absence','alternative_address'].includes(key))row.className='is-wide';row.append(dt,dd);details.append(row);}section.append(title,details);tabs.get('data').panel.append(section);});
 const documents=document.createElement('section');documents.className='hiring-review-section';documents.dataset.reviewSection='documents';documents.innerHTML='<h4>Documentos del expediente</h4>';const documentActions=document.createElement('div');documentActions.className='hiring-review-actions';documents.append(documentActions);tabs.get('documents').panel.append(documents);
 const preview=document.createElement('div');preview.className='hiring-document-preview';preview.setAttribute('aria-live','polite');
 documents.append(preview);
 for(const [file,title] of [['front','Anverso del CI'],['back','Reverso del CI'],['portrait','Fotografía del trabajador']]){
  const button=document.createElement('button');button.textContent='Ver '+title.charAt(0).toLowerCase()+title.slice(1);
  button.onclick=async()=>{
   if(documentActions.getAttribute('aria-busy')==='true')return;
   documentActions.setAttribute('aria-busy','true');
   preview.textContent='Cargando documento…';
   try{
    let {data,error}=await sb.storage.from('hr-hiring-private').download(t.id+'/'+file);
    let caption=title;
    if(error&&h.inherited_documents?.[file])({data,error}=await sb.storage.from('hr-identity-private').download(h.inherited_documents[file]));
    const missing=()=>String(error?.statusCode||error?.status||'')==='404'||/object not found/i.test(error?.message||'');
    if(error&&missing()&&file==='portrait'){
     const {data:rows,error:lookupError}=await sb.from('hr_candidate_answers').select('answer').eq('candidate_id',id).eq('question_key','photo_path').limit(1);
     if(lookupError)throw lookupError;
     const path=String(rows?.[0]?.answer||'').trim();
     if(path){
      ({data,error}=await sb.storage.from('hr-candidate-files').download(path));
      caption='Foto de la candidatura · Fotografía del expediente pendiente';
     }
    }
    if(!overlay.isConnected)return;
    if(error||!data){
     preview.textContent=missing()?(file==='portrait'?'Fotografía del expediente pendiente. No se encontró una foto de la candidatura.':'Este documento todavía no está disponible en el expediente.'):'No se pudo cargar el documento. Intenta nuevamente.';
     return;
    }
    const url=URL.createObjectURL(data);
    const photo=document.createElement('img');photo.alt=caption;
    photo.onload=()=>URL.revokeObjectURL(url);
    photo.onerror=()=>{URL.revokeObjectURL(url);if(preview.contains(photo))preview.textContent='No se pudo mostrar la imagen.';};
    const label=document.createElement('p');label.textContent=caption;
    preview.replaceChildren(label,photo);photo.src=url;preview.scrollIntoView?.({block:'nearest'});
   }catch(e){preview.textContent='No se pudo cargar el documento. Intenta nuevamente.';}
   finally{documentActions.removeAttribute('aria-busy');}
  };
  documentActions.append(button);
 }
 const contractButton=document.createElement('button');contractButton.textContent='Revisar y descargar contrato laboral';contractButton.onclick=()=>{const loading=selectTab('contract');tabs.get('contract').button.focus();return loading;};documentActions.append(contractButton);
 const controls=document.createElement('section');controls.className='hiring-review-section hiring-checklist';controls.dataset.reviewSection='validation';const steps=document.createElement('ol');steps.className='hiring-validation-list';controls.append(steps);tabs.get('validation').panel.append(controls);
 const actions=document.createElement('div');actions.className='hiring-review-actions';
 let primaryAction;
 const step=(title,complete,hint,button)=>{
  const available=!complete&&button&&!button.disabled;
  const row=document.createElement('li');row.className='hiring-validation-step'+(complete?' is-complete':available?' is-next':'');
  const heading=document.createElement('h5');heading.textContent=title;
  const state=document.createElement('span');state.className='hiring-validation-status';state.textContent=complete?'Completado':available?'Disponible':'Pendiente';
  row.append(heading,state);
  if(!complete&&!available&&hint){const info=document.createElement('p');info.textContent=hint;row.append(info);}
  if(available){button.classList.add('hiring-review-primary');primaryAction=button;}
  steps.append(row);
 };
 const act=(label,action,disabled=false)=>{const b=document.createElement('button');b.textContent=label;b.disabled=disabled||!!h.employee_id;b.onclick=async()=>{if(!confirm(label+' para la versión '+h.revision+' del expediente?'))return;b.disabled=true;try{await hiringRpc('hr_manage_hiring',{p_trial:t.id,p_action:action,p_revision:h.revision});overlay.remove();await loadHiringCases();window.CartelEvolution?.refresh();openHiringReview(id,returnTo,activeTab);}catch(e){status.textContent=e.message;b.disabled=false;}};return b;};
 step('Expediente recibido',!!(h.submitted_at||h.verified_at||h.employee_id),'Esperando el envío del candidato.');
 step('Validar expediente',!!h.verified_at,'Disponible al recibir el expediente.',act('Validar expediente revisado','verify',!h.submitted_at||!!h.verified_at));
 step('Contrato firmado',!!h.signed_at,'Valida el expediente para poder confirmar el contrato firmado.',act('Confirmar contrato firmado recibido y validado','signed',!h.verified_at||!!h.signed_at));
 const hire=document.createElement('button');hire.textContent='Formalizar contratación';hire.disabled=!!h.employee_id||!h.verified_at||!h.signed_at||!h.notified_at;if(h.employee_id)hire.textContent='Contratación formalizada';hire.onclick=async()=>{if(!confirm('¿Formalizar la contratación con el expediente y el contrato firmado validados?'))return;hire.disabled=true;try{await hiringRpc('hr_finalize_hiring',{p_trial:t.id});overlay.remove();await loadHiringCases();await refreshCandidateAfterStatusChange(id);}catch(e){status.textContent=e.message;hire.disabled=false;}};step('Formalizar contratación',!!h.employee_id,!h.verified_at||!h.signed_at?'Valida el expediente y confirma el contrato firmado.':'Confirma el envío de la notificación al candidato.',hire);
 if(primaryAction)controls.append(primaryAction);
 const renew=document.createElement('button');renew.textContent='Preparar nueva notificación y renovar enlaces';renew.onclick=()=>{overlay.remove();openHiringPreparationNotification(id,true)};
 if(!h.employee_id){
  const management=document.createElement('details');management.className='hiring-management';
  const label=document.createElement('summary');label.textContent='Gestionar enlaces';
  const secondary=document.createElement('div');secondary.className='hiring-review-actions';
  const revoke=act('Revocar enlaces','revoke',!!h.revoked_at);revoke.className='hiring-revoke';
  if(h.verified_at)secondary.append(act('Permitir correcciones del expediente','reopen'));
  secondary.append(renew,revoke);management.append(label,secondary);controls.append(management);
 }
 controls.append(actions);
 if(h.notified_at){const next=document.createElement('button');next.textContent='Continuar a inserción en sistema →';next.onclick=async()=>{if(next.disabled)return;next.disabled=true;try{await onboardingCall(id,'hiring_continue');preserveCandidateSheet(id);window.CartelEvolution?.refresh();overlay.remove();}catch(e){status.textContent=e.message;next.disabled=false;}};actions.append(next);}
 await selectTab(activeTab);
 }catch(e){status.textContent=e.message;}
}
const hiringFields=[
 [['full_name','Nombre completo'],['identity_number','Número de CI'],['birth_date','Fecha de nacimiento'],['nationality','Nacionalidad'],['province','Provincia'],['municipality','Municipio'],['address','Dirección particular'],['civil_status','Estado civil (opcional)'],['has_children','¿Tienes hijos? (opcional)'],['care_responsibilities','Responsabilidades familiares que requieren coordinar el horario (opcional)'],['planned_absence','Ausencias previstas que necesitas coordinar (opcional)']],
 [['mobile','Teléfono móvil'],['fixed_phone','Teléfono fijo (opcional)'],['email','Correo electrónico'],['alternative_address','Dirección alternativa (opcional)'],['emergency_name','Nombre del contacto de emergencia'],['emergency_relation','Parentesco con el contacto de emergencia'],['emergency_phone','Teléfono de emergencia']],
 [['education_level','Nivel de escolaridad']]
];
async function initHiringPublic(documentMode){
 const root=document.getElementById('hiring');
 if(!documentMode&&history.state?.cartelHiringComplete){hiringCompletedScreen(root);return;}
 const token=new URLSearchParams(location.hash.slice(1)).get('token');
 if(!/^[a-f0-9]{64}$/.test(token||''))throw Error('Enlace no válido, caducado o revocado. Solicita uno nuevo a RRHH.');
 const result=await hiringRpc('hr_read_hiring',{p_token:token,p_document:documentMode});
 if(documentMode)return renderHiringContract(root,result);
 if(result.locked){root.textContent='Tu expediente está validado. Solicita a RRHH cualquier corrección.';return;}
 const saved=result.data||{},optional=new Set(['fixed_phone','alternative_address','civil_status','has_children','care_responsibilities','planned_absence']);
 root.innerHTML='<div class="brand">CARTEL <span>GESTIÓN</span></div><h1>Completar expediente laboral</h1><p>'+hiringEsc(result.role_title)+'</p><p>Confirma los datos precargados, corrige lo necesario y completa los campos pendientes. '+(result.submitted?'Puedes corregir el expediente antes de su validación.':'')+'</p><p class="privacy-note">Los datos de familia son voluntarios y se usan solo para coordinar horarios y permisos. No incluyas diagnósticos ni datos médicos aquí. Si necesitas una adaptación de salud, puedes solicitar voluntariamente a RRHH un canal confidencial: se tratará solo lo necesario para esa finalidad, con acceso restringido y separado del contrato.</p><form id="hiringForm"><nav aria-label="Secciones del expediente"></nav><section><h2>1. Datos personales</h2></section><section hidden><h2>2. Contacto y emergencia</h2></section><section hidden><h2>3. Documentación y escolaridad</h2><p>Adjunta dos fotos independientes, nítidas y completas del CI. Se comprimen automáticamente. Revisa que todos los datos sigan siendo legibles.</p></section><section hidden><h2>4. Revisión y confirmación</h2><div id="hiringSummary"></div><label><input name="truth_confirmed" type="checkbox" required> Confirmo que los datos y documentos son veraces y corresponden a mi identidad.</label></section><div class="buttons"><button type="button" id="hiringPrev">Anterior</button><button type="button" id="hiringNext">Siguiente</button><button id="hiringSubmit" hidden>Guardar y enviar expediente</button></div><p role="alert" id="hiringResult"></p></form>';
 const form=document.getElementById('hiringForm'),sections=[...form.querySelectorAll('section')];let step=0;
 hiringFields.forEach((fields,i)=>fields.forEach(([key,label])=>{const l=document.createElement('label');l.textContent=label;const choices=key==='province'?Object.keys(hiringLocalities):key==='municipality'?[]:hiringChoices[key];const input=document.createElement(choices?'select':'input');input.name=key;if(choices)hiringSelectOptions(input,choices,saved[key]);else input.value=saved[key]??'';input.maxLength=1000;input.required=!optional.has(key);if(!choices)input.type=key==='birth_date'?'date':key==='email'?'email':/phone|mobile/.test(key)?'tel':'text';if(key==='identity_number'){input.pattern='[0-9]{11}';input.inputMode='numeric';input.maxLength=11;}if(key==='birth_date'){input.min='1900-01-01';input.max=new Date().toISOString().slice(0,10);}l.append(input);const small=document.createElement('small');small.id='status-'+key;small.setAttribute('aria-live','polite');const initialValue=input.value;const update=()=>{small.textContent=input.value?(String(input.value)===initialValue?'Precargado · revisa y confirma':'Completado por ti'):(input.required?'Pendiente':'Opcional');small.className=input.value?'field-ready':'field-pending'};input.addEventListener('input',update);input.addEventListener('change',update);l.append(small);update();sections[i].append(l);}));
 const province=form.elements.province,municipality=form.elements.municipality;const updateMunicipality=(initial=false)=>{const previous=initial?saved.municipality:'';hiringSelectOptions(municipality,hiringLocalities[province.value]||[],previous);municipality.disabled=!province.value;municipality.dispatchEvent(new Event('change'));if(initial&&saved.municipality)document.getElementById('status-municipality').textContent='Precargado · revisa y confirma'};province.addEventListener('change',()=>updateMunicipality());updateMunicipality(true);
 const pending={},processing={};
 for(const [key,label] of [['front','Anverso del CI'],['back','Reverso del CI'],['portrait','Fotografía del trabajador para el expediente: de los hombros hacia arriba, fondo blanco, mirando a cámara y sin sonreír']]){
  const l=document.createElement('label');l.textContent=label+(result[key]?' · Ya recibido. Puedes reemplazarlo.':'');const input=document.createElement('input');input.type='file';input.name=key;input.accept='image/jpeg,image/png';input.required=!result[key];l.append(input);const preview=document.createElement('img');preview.alt='Vista previa de '+label;preview.hidden=true;preview.style.cssText='max-width:100%;max-height:200px';l.append(preview);let previewUrl;
  input.onchange=()=>{processing[key]=(async()=>{input.disabled=true;try{delete pending[key];if(previewUrl)URL.revokeObjectURL(previewUrl);preview.hidden=true;const f=input.files[0];if(!f)return;pending[key]=await prepareIdentityPhoto(f);previewUrl=URL.createObjectURL(pending[key]);preview.src=previewUrl;preview.hidden=false;input.setCustomValidity('');}catch(e){input.setCustomValidity(e.message);input.reportValidity();}finally{input.disabled=false;}})();};sections[2].append(l);
 }
 const show=()=>{sections.forEach((s,i)=>s.hidden=i!==step);document.getElementById('hiringPrev').hidden=step===0;document.getElementById('hiringNext').hidden=step===3;document.getElementById('hiringSubmit').hidden=step!==3;form.querySelector('nav').textContent='Sección '+(step+1)+' de 4';if(step===3){document.getElementById('hiringSummary').innerHTML=hiringFields.flat().map(([k,l])=>'<p><b>'+hiringEsc(l)+':</b> '+hiringEsc(form.elements[k].value||'Sin declarar')+'</p>').join('')+['front','back','portrait'].map(k=>'<p>'+({front:'Anverso del CI',back:'Reverso del CI',portrait:'Fotografía del trabajador'}[k])+': '+(pending[k]?'Preparado':result[k]?'Recibido':'No adjunto')+'</p>').join('');}};
 document.getElementById('hiringPrev').onclick=()=>{step--;show()};document.getElementById('hiringNext').onclick=async()=>{await Promise.all(Object.values(processing));for(const el of sections[step].querySelectorAll('input,select'))if(!el.reportValidity())return;step++;show();sections[step].scrollIntoView({block:'start',behavior:'smooth'})};show();
 const send=hiringSubmission(root,form,token,result,pending);let validating=false;
 form.noValidate=true;form.onsubmit=async e=>{e.preventDefault();if(validating)return;validating=true;try{await Promise.all(Object.values(processing));for(let i=0;i<sections.length;i++)for(const el of sections[i].querySelectorAll('input,select'))if(!el.checkValidity()){step=i;show();el.reportValidity();return;}await send();}finally{validating=false;}};
}
