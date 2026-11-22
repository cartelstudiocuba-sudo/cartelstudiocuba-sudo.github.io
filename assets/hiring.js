const hiringChoices={education_level:['Primaria','Secundaria','Técnico medio','Bachiller','Bachiller técnico','Universitario','Máster','Doctor','Otro'],emergency_relation:['Madre','Padre','Hermana','Hermano','Hija','Hijo','Cónyuge','Pareja','Abuela','Abuelo','Tía','Tío','Prima','Primo','Amistad','Otro'],civil_status:['Soltero/a','Casado/a','Unión consensual','Divorciado/a','Viudo/a','Prefiero no declarar'],has_children:['Sí','No','Prefiero no declarar']};
function hiringSelectOptions(el,options,value){el.replaceChildren(new Option('Selecciona…',''));const aliases={'universitaria':'Universitario','universitario':'Universitario','plaza':'Plaza de la Revolución','10 de octubre':'Diez de Octubre','true':'Sí','false':'No'};let v=String(value??'');v=aliases[v.toLocaleLowerCase('es')]||v;const match=options.find(x=>x.localeCompare(v,'es',{sensitivity:'base'})===0);if(match)v=match;for(const x of options)el.add(new Option(x,x));if(v&&!options.includes(v))el.add(new Option(v+' · dato anterior, revisa',v));el.value=v;}
'use strict';
const hiringEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function hiringRpc(name,args){const r=await sb.rpc(name,args);if(r.error)throw Error(r.error.message);return r.data;}
function hiringMessage(name,plaza,form,contract){return `¡Felicidades, ${name}! Ya completaste tu capacitación para la plaza de ${plaza} y pasas a la etapa de contratación en El Cartel Studio.

*Paso 1 · Completa tu expediente laboral*

Abre el formulario, completa los datos que te faltan y adjunta los documentos que te pide. Al terminar, pulsa «Completar expediente».

${form}

*Paso 2 · Prepara tu contrato para entregarlo*

Cuando termines el formulario, abre tu contrato y revísalo. Descarga el PDF, imprímelo, fírmalo y entrégaselo a tu tutor.

${contract}

Cuando recibamos tu expediente y tu contrato firmado, los revisaremos para formalizar tu incorporación.`;}

// Strip only an explicit display-only test label; never change the stored identity.
function hiringCandidateDisplayName(candidate){return String(candidate.full_name||'').trim().replace(/^CANDIDATO DE PRUEBA\s*[—–-]\s*(?=\S)/i,'').trim();}
function hiringGreetingName(candidate){
 return hiringCandidateDisplayName(candidate).split(/\s+/,1)[0]||'';
}
function hiringNotificationDialog(title,returnTo=null){
 document.getElementById('hiringNotificationOverlay')?.remove();
 if(!document.getElementById('hiringNotificationStyles')){
  const style=document.createElement('style');style.id='hiringNotificationStyles';style.textContent=`
  .hiring-notification-overlay{position:fixed;inset:0;z-index:2147483100;background:#000b;backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}
  .hiring-notification-dialog{box-sizing:border-box;width:760px;max-width:100%;max-height:calc(100dvh - 48px);overflow:auto;background:#141719;color:#edf0f2;border:1px solid #424337;border-radius:24px;padding:28px;box-shadow:0 24px 90px #0009;font:15px/1.65 system-ui,sans-serif;color-scheme:dark}
  .hiring-notification-dialog *{box-sizing:border-box}.hiring-notification-dialog header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.hiring-notification-dialog > header h3{margin:0;color:#fff;font-size:25px;line-height:1.25}.hiring-notification-dialog small{display:block;color:#FFDA03;font-size:11px;letter-spacing:.12em;margin-bottom:8px;font-weight:800}
  .hiring-notification-dialog p:not(#contractArticle p,.hiring-contract-reading p){color:#c7cdd0;margin:18px 0}.hiring-notification-dialog button{font:600 14px/1.4 system-ui,sans-serif;border:1px solid #555a5d;border-radius:12px;padding:13px 18px;background:#262b2e;color:#fff;cursor:pointer;min-height:46px}.hiring-notification-dialog button:focus-visible{outline:3px solid #FFDA03;outline-offset:3px}.hiring-notification-dialog button:disabled{opacity:.55;cursor:wait}.hiring-notification-dialog button[hidden]{display:none}.hiring-notification-dialog .hiring-close{padding:4px;width:42px;min-height:42px;font-size:26px;flex-shrink:0;background:transparent}.hiring-notification-dialog .hiring-message{margin:20px 0;padding:22px;border:1px solid #373e42;border-radius:16px;background:#0d1012;white-space:pre-wrap;overflow-wrap:anywhere;max-height:48dvh;overflow:auto;user-select:text;line-height:1.75}.hiring-notification-dialog textarea.hiring-message{display:block;width:100%;height:40dvh;min-height:140px;resize:vertical;color:#edf0f2;font:inherit;line-height:1.75}.hiring-notification-dialog textarea.hiring-message:focus-visible{outline:2px solid #FFDA03;outline-offset:3px}.hiring-message a{color:#FFDA03;text-decoration:underline;overflow-wrap:anywhere}.hiring-notification-dialog .hiring-whatsapp{background:#218c52;border-color:#36b16e;display:inline-flex;gap:10px;align-items:center;justify-content:center}.hiring-whatsapp svg{width:22px;height:22px;flex-shrink:0}.hiring-notification-dialog .hiring-confirm{display:block;width:100%;margin-top:12px;color:#FFDA03;border-color:#817020;background:#292719}
  .hiring-notification-dialog.hiring-candidate-review{width:900px;line-height:1.5}.hiring-notification-dialog .hiring-review-back{position:sticky;top:0;z-index:2;margin:0 0 18px;display:inline-flex;align-items:center;color:#ffe566;border-color:#ffda0350;background:#28291d}.hiring-review-progress{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:22px}.hiring-review-progress>div{min-width:0;border:1px solid #ffffff20;border-radius:14px;padding:14px;background:linear-gradient(145deg,#ffffff0b,#ffffff03)}.hiring-review-progress span{display:block;font-size:12px;color:#bec7cc}.hiring-review-progress strong{display:block;font-size:15px;margin-top:5px;color:#ffe17a}.hiring-review-progress .is-ready strong{color:#84e2b5}.hiring-review-section{margin:16px 0;padding:20px;border:1px solid #ffffff1c;border-radius:17px;background:#ffffff03}.hiring-notification-dialog .hiring-review-section h4{font-size:16px;line-height:1.4;margin:0 0 16px;color:#fff}.hiring-review-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 24px;margin:0}.hiring-review-grid>div{min-width:0}.hiring-review-grid .is-wide{grid-column:1/-1}.hiring-review-grid dt{font-size:12px;color:#aeb9c0;line-height:1.45;margin-bottom:5px}.hiring-review-grid dd{font-size:14px;color:#edf0f2;margin:0;overflow-wrap:anywhere;white-space:pre-wrap;font-weight:600}.hiring-review-grid dd.is-missing{font-weight:400;color:#8d9aa2}.hiring-review-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.hiring-review-actions button{min-width:0;white-space:normal;text-align:left;font-size:13px}.hiring-notification-dialog .hiring-review-primary{background:linear-gradient(130deg,#ffe969,#ffda03);color:#191919;border-color:#ffe45b}.hiring-personal-links{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 20px}.hiring-personal-links a{display:flex;align-items:center;padding:11px 14px;border:1px solid #ffda0340;border-radius:12px;color:#ffe566;background:#ffda0309;font-size:13px;text-decoration:none;overflow-wrap:anywhere}.hiring-personal-links a:focus-visible{outline:2px solid #ffda03;outline-offset:3px}
  .hiring-candidate-review .contract-tools{display:grid;gap:9px;margin:20px 0 0;padding:12px 14px 8px;border:1px solid #c6ccd0;border-bottom-color:#d4d8db;border-radius:14px 14px 0 0;background:#eceff1;color:#15191c;color-scheme:light}
  .hiring-contract-toolbar-title{display:flex;align-items:center;gap:8px;font-size:15px}.hiring-contract-modes,.hiring-contract-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}.hiring-contract-modes{padding:3px;border:1px solid #a2aab0;border-radius:9px;background:#dfe4e7}.hiring-contract-actions{border-top:1px solid #cbd1d5;padding-top:5px}
  .hiring-notification-dialog .contract-tools button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:0;min-height:40px;padding:5px 3px;border:1px solid transparent;border-radius:6px;background:transparent;color:#15191c;font-size:12px;line-height:1.2}.hiring-notification-dialog .contract-tools button[aria-pressed="true"]{background:#fff;border-color:#a2aab0;box-shadow:0 1px 2px #0002;font-weight:750}.hiring-notification-dialog .contract-tools button:focus-visible{outline-color:#475560}.hiring-contract-actions .hiring-review-icon svg{width:16px;height:16px}.hiring-contract-actions button + button{border-left-color:#cbd1d5;border-radius:0 6px 6px 0}
  .hiring-candidate-review #contractArticle{color:#222;font:14px/1.5 Arial,sans-serif}.hiring-candidate-review #contractArticle .contract-page-content{overflow-wrap:anywhere}.hiring-candidate-review #contractArticle .contract-paper-footer{font-size:10px}.hiring-contract-reading{background:#fff;color:#222;border-radius:0 0 14px 14px;padding:clamp(16px,4vw,30px);font:16px/1.6 Arial,sans-serif;overflow-wrap:anywhere}.hiring-contract-reading h1,.hiring-contract-reading h2,.hiring-contract-reading h3,.hiring-contract-reading h4{color:#222;line-height:1.35}.hiring-contract-reading h2{font-size:22px}.hiring-contract-reading h3{font-size:17px}.hiring-contract-reading .contract-paper-header{margin:0 0 16px;min-height:0;padding:0;text-align:left}.hiring-contract-reading .contract-paper-header h2{margin:0}.hiring-contract-reading .contract-paper-date{margin:10px 0 16px}.hiring-contract-reading .contract-paper-clause{margin:16px 0 0}.hiring-contract-reading .contract-annex-table{table-layout:fixed}.hiring-contract-reading .contract-annex-box{height:auto;min-height:80px}.hiring-contract-reading .transport-photo-slot{height:110px}
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
  .hiring-data-card .hiring-review-grid>div.is-pending{padding-inline:8px;border-radius:6px;background:#ffbf4714}.hiring-data-card .hiring-review-grid>.is-pending dt{color:#f7dfaf}.hiring-data-card .hiring-review-grid dd.is-pending{color:#ffda03;font-weight:750;display:flex;align-items:center;justify-content:flex-end;gap:6px}.hiring-field-pending-dot{display:inline-block;flex:0 0 7px;height:7px;border-radius:50%;background:#ff5a62}
  .hiring-doc-gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.hiring-doc-card{min-width:0;display:flex;flex-direction:column;gap:7px;padding:10px;border:1px solid #454c50;border-radius:12px;background:linear-gradient(145deg,#2b3033,#1b1e21)}.hiring-doc-card.is-portrait{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,120px) minmax(0,1fr);align-items:center;gap:12px}.hiring-doc-card h5{margin:0;font-size:13px;line-height:1.3}.hiring-notification-dialog .hiring-doc-thumb{position:relative;display:grid;place-items:center;width:100%;padding:4px;aspect-ratio:1.6;background:#111416;border-radius:8px;border:1px solid #4a5156;color:#c4cdd2}.hiring-doc-card.is-portrait .hiring-doc-thumb{aspect-ratio:1}.hiring-doc-thumb img{width:100%;height:100%;min-height:0;object-fit:contain;border-radius:5px}.hiring-doc-expand{position:absolute;top:5px;right:5px;padding:0 4px;border-radius:4px;background:#111e;color:#fff}.hiring-doc-status{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px;color:#c7d0d6}.hiring-doc-status.is-pending{color:#ffda03}.hiring-doc-status.is-ready{color:#bdffcf}.hiring-doc-viewer{border:1px solid #53575b;border-radius:16px;background:#16191b;color:white;width:min(94vw,860px);max-width:none;padding:14px;box-sizing:border-box}.hiring-doc-viewer::backdrop{background:#000c}.hiring-doc-viewer header{margin-bottom:12px}.hiring-doc-viewer img{display:block;max-width:100%;max-height:72dvh;object-fit:contain;margin:auto}
  .hiring-send-recipient,.hiring-send-message,.hiring-send-card{border:1px solid #485055;border-radius:12px;background:linear-gradient(140deg,#292e31,#1b1e21)}.hiring-send-recipient{display:flex;align-items:center;gap:10px;padding:10px 12px;margin-top:14px}.hiring-send-recipient .hiring-review-icon,.hiring-send-card .hiring-review-icon{color:#ffda03}.hiring-send-recipient strong,.hiring-send-recipient small{display:block;overflow-wrap:anywhere}.hiring-notification-dialog .hiring-send-recipient small{margin:0;color:#c7d0d6;font-size:12px;letter-spacing:normal;font-weight:500}.hiring-send-message{padding:10px 12px;margin-bottom:12px}.hiring-send-message summary{cursor:pointer;font-weight:700}.hiring-send-excerpt{font-size:13px;font-weight:400;color:#e2e8ec;line-height:1.45;overflow-wrap:anywhere}.hiring-send-message[open] .hiring-send-excerpt,.hiring-send-excerpt:empty{display:none}.hiring-send-message summary small{margin:3px 0;color:#c7d0d6;font-size:12px;letter-spacing:normal;font-weight:500}.hiring-notification-dialog .hiring-send-message .hiring-message{margin:10px 0 0;padding:12px}.hiring-send-card{width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px;text-align:left;margin-bottom:8px}.hiring-send-card .hiring-send-preview-text{font-size:11px;color:#ffe474}.hiring-notification-dialog .hiring-send-card{border-color:#485055;background:linear-gradient(140deg,#292e31,#1b1e21);font-size:13px;padding:9px 10px}.hiring-preview-form label{display:block;margin:10px 0}.hiring-preview-form input:not([type="checkbox"]),.hiring-preview-form select{display:block;width:100%;margin-top:4px;padding:8px;border:1px solid #4d565d;border-radius:6px;background:#20262b;color:#fff;opacity:1}.hiring-preview-form small{letter-spacing:normal}.hiring-preview-form [hidden]{display:none!important}
  .hiring-notification-dialog .hiring-return-to-sheet{background:#56242b;border-color:#a14853;color:#ffe4e7}
  .hiring-notification-dialog .hiring-prepare-links{grid-column:1/-1;border-color:#8b742e;color:#ffe68b}
  .hiring-notification-dialog.hiring-renew-dialog{width:440px;max-width:calc(100vw - 32px);max-height:calc(100dvh - 32px);margin:auto;padding:clamp(18px,5vw,26px);border-color:#66552c}
  .hiring-renew-dialog::backdrop{background:#080a0cbb}
  .hiring-renew-heading{display:flex;align-items:center;gap:12px}.hiring-renew-heading .hiring-review-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:#ffda031c;color:#ffda03}.hiring-renew-heading h3{margin:0;color:#fff;font-size:clamp(18px,5vw,22px);line-height:1.25}
  .hiring-renew-dialog .hiring-renew-effects{margin:14px 0 16px;padding:11px 13px;background:#292416;border:1px solid #65502c;border-radius:10px;color:#ffe5a8;line-height:1.5}
  .hiring-renew-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.hiring-renew-actions button{flex:1 1 auto}.hiring-notification-dialog .hiring-renew-submit{background:linear-gradient(150deg,#ffe45b,#ffda03);border-color:#ffda03;color:#1d1a11;font-weight:750}
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
function hiringWithLinkRenewalConfirmation(overlay,trigger,existing,proceed,opensWhatsApp=false){
 if(!existing||existing.revoked_at||Date.parse(existing.expires_at)<=Date.now())return proceed();
 const confirmation=document.createElement('dialog');
 confirmation.className='hiring-notification-dialog hiring-renew-dialog';
 confirmation.setAttribute('aria-labelledby','hiringRenewTitle');
 confirmation.setAttribute('aria-describedby','hiringRenewEffects');
 confirmation.innerHTML=`
  <div class="hiring-renew-heading"><h3 id="hiringRenewTitle">Renovar enlaces de contratación</h3></div>
  <p id="hiringRenewEffects" class="hiring-renew-effects">Los enlaces anteriores dejarán de funcionar. Si ya los compartiste con el candidato, envíale los nuevos.</p>
  <div class="hiring-renew-actions">
   <button type="button" autofocus>Cancelar</button>
   <button type="button" class="hiring-renew-submit">${opensWhatsApp?'Renovar y abrir WhatsApp':'Renovar enlaces'}</button>
  </div>`;
 confirmation.querySelector('.hiring-renew-heading').prepend(hiringReviewIcon('documents'));
 const [cancel,accept]=confirmation.querySelectorAll('button');
 const dismiss=()=>{confirmation.close();confirmation.remove();trigger.focus({preventScroll:true});};
 cancel.onclick=dismiss;
 accept.onclick=()=>{dismiss();return proceed();};
 confirmation.addEventListener('keydown',event=>event.stopPropagation());
 confirmation.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
 overlay.append(confirmation);
 confirmation.showModal();
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
 const back=document.createElement('button');back.className='hiring-return-to-sheet';back.textContent='Volver a la ficha';back.onclick=()=>overlay.remove();dialog.append(back);
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
 try{for(const file of ['vendor/jspdf-2.5.2.umd.min.js','vendor/html2canvas-1.4.1.min.js','trial-closure-document.js','contract-paper.js','hiring-contract-paper.js','hiring-contract.js','contract-paper-v3.js','hiring-contract-paper-v3.js']){
  if(!hiringReviewScripts.has(file))hiringReviewScripts.set(file,new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/assets/'+file+'?v=20261122-contract-annexes';s.onload=resolve;s.onerror=()=>{hiringReviewScripts.delete(file);reject(Error('No se pudo cargar el visor. Cierra y reintenta.'));};document.head.append(s);}));await hiringReviewScripts.get(file);
 }const snapshot=structuredClone(h);snapshot.contract.logos={...(snapshot.contract.logos||{})};
 for(const key of ['logo_path','watermark_path']){const path=snapshot.contract.template?.presentation?.[key];if(path&&!snapshot.contract.logos[path]){const {data,error}=await sb.storage.from('hr-role-documents').download(path);if(error||!data)throw Error('No se pudo leer la presentación del contrato guardado.');snapshot.contract.logos[path]=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(data);});}}
 if(!h.signed_at&&h.contract.template?.annexes?.some(annex=>annex.type==='identity_copy'&&annex.included!==false)){
  const form=await hiringRpc('hr_preview_hiring_form',{p_trial:h.trial_id});
  if(form&&Object.hasOwn(form,'requires_emergency_address')){
   snapshot.contract.renderer_version=3;
   snapshot.data=form.data;
   snapshot.identity_images={};
   for(const side of ['front','back'])if(form[side]){
    snapshot.identity_images[side]={bucket:'hr-hiring-private',path:h.trial_id+'/'+side,inherited:h.inherited_documents?.[side]};
   }
  }
 }else if(h.signed_at){
  snapshot.signed=true;
  snapshot.data=h.contract.signed_data||h.data;
  snapshot.identity_images=h.contract.signed_identity_images;
 }
 if(!root.isConnected)return;
 await renderHiringContractDocument(root,snapshot);
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
 const title=document.createElement('strong');title.className='hiring-contract-toolbar-title';
 title.append(hiringReviewIcon('documents'),document.createTextNode('Contrato laboral'));
 const modes=document.createElement('div');modes.className='hiring-contract-modes';modes.setAttribute('role','group');modes.setAttribute('aria-label','Vista del contrato');
 const readButton=document.createElement('button'),letterButton=document.createElement('button');
 readButton.type=letterButton.type='button';readButton.textContent='Lectura';letterButton.textContent='Carta';
 const showReading=enabled=>{
  root.classList.toggle('is-reading',enabled);reading.hidden=!enabled;
  readButton.setAttribute('aria-pressed',String(enabled));letterButton.setAttribute('aria-pressed',String(!enabled));
 };
 readButton.onclick=()=>showReading(true);letterButton.onclick=()=>showReading(false);
 modes.append(readButton,letterButton);
 const actions=document.createElement('div');actions.className='hiring-contract-actions';
 for(const [id,key,label] of [['contractPrint','print','Imprimir'],['contractDownload','download','Descargar PDF']]){
  const action=root.querySelector('#'+id);
  if(!action)continue;
  action.replaceChildren(hiringReviewIcon(key),document.createTextNode(label));
  if(key==='download')action.addEventListener('click',()=>showReading(false),true);
  actions.append(action);
 }
 tools.replaceChildren(title,modes,actions);root.append(reading);
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
function hiringSendCards(overlay,dialog,candidate,trial,message){
 const recipient=document.createElement('div');recipient.className='hiring-send-recipient';
 const identity=document.createElement('div'),name=document.createElement('strong'),role=document.createElement('small');
 name.textContent=hiringCandidateDisplayName(candidate);role.textContent=dashboardCandidateRoleName(candidate);
 identity.append(name,role);recipient.append(hiringReviewIcon('data'),identity);
 dialog.querySelector('header').after(recipient);
 const disclosure=document.createElement('details');disclosure.className='hiring-send-message';
 const summary=document.createElement('summary'),caption=document.createElement('small');
 summary.textContent='Mensaje de WhatsApp';caption.textContent='Ver mensaje completo';summary.append(caption);
 const excerpt=document.createElement('div');excerpt.className='hiring-send-excerpt';
 const updateExcerpt=()=>{
  const text=(message.value??message.textContent).split(/\n\s*\n/)[0].replace(/https?:\/\/\S+/g,'').trim();
  excerpt.textContent=text.length>145?text.slice(0,142).trimEnd()+'…':text;
 };
 message.addEventListener('input',updateExcerpt);updateExcerpt();
 summary.append(excerpt);disclosure.append(summary,message);dialog.append(disclosure);
 const card=document.createElement('button');card.type='button';card.className='hiring-send-card';
 card.setAttribute('aria-label','Previsualizar formulario de expediente');
 const action=document.createElement('span');action.className='hiring-send-preview-text';action.textContent='Previsualizar';
 card.append(hiringReviewIcon('documents'),document.createTextNode('Formulario de expediente'),action);
 card.onclick=()=>openHiringCandidatePreview(trial,hiringRestorePanel(overlay,dialog,card));
 dialog.append(card);
}
async function openHiringCandidatePreview(trial,back){
 const {dialog}=hiringNotificationDialog('Formulario de expediente',back);
 hiringReviewBack(dialog,back,'Volver al mensaje');
 const status=document.createElement('p');status.textContent='Vista del candidato · Solo lectura';
 const root=document.createElement('div');root.textContent='Cargando vista previa…';dialog.append(status,root);
 try{
  const result=trial?await hiringRpc('hr_preview_hiring_form',{p_trial:trial.id}):null;
  if(!root.isConnected)return;
  if(!result){root.textContent='El formulario de esta candidatura todavía no está preparado.';return;}
  root.className='hiring-preview-form';
  showHiringCandidateForm(root,result,null,true);
 }catch(e){root.textContent='No se pudo cargar la vista previa. Vuelve al mensaje e inténtalo de nuevo.';}
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
  status.textContent=existing?.employee_id?'Contratación formalizada.':'Prepara los enlaces para revisar el mensaje. Al abrir WhatsApp, la ficha avanzará al paso 12.';
  dialog.append(status);
  hiringSendCards(overlay,dialog,candidate,trial,hiringMessagePreview(hiringMessage(hiringGreetingName(candidate),dashboardCandidateRoleName(candidate),'[Enlace al expediente laboral]','[Enlace al contrato laboral]')));
  const actions=hiringMessageActions(dialog);
  if(!existing?.employee_id){
   const prepareLinks=document.createElement('button');
   prepareLinks.type='button';prepareLinks.className='hiring-prepare-links';prepareLinks.textContent='Preparar enlaces del expediente y contrato';
   prepareLinks.onclick=()=>hiringWithLinkRenewalConfirmation(overlay,prepareLinks,existing,()=>openHiringPreparationNotification(candidateId,true));
   const send=hiringWhatsAppButton();
   send.onclick=()=>{
    if(candidatePhone(candidate).length<8){status.textContent='Falta un WhatsApp válido.';return;}
    return hiringWithLinkRenewalConfirmation(overlay,send,existing,()=>{
     const tab=window.open('about:blank','_blank');
     if(!tab){status.textContent='El navegador bloqueó WhatsApp. Permite las ventanas emergentes y reintenta.';return;}
     return openHiringPreparationNotification(candidateId,true,false,tab);
    },true);
   };
   actions.append(prepareLinks,send);
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
  status.textContent='Puedes editar el mensaje antes de abrir WhatsApp. Los enlaces vencen el '+new Date(prepared.expires_at).toLocaleString('es-CU',{timeZone:'America/Havana'})+'. Al abrir WhatsApp, la ficha avanzará al paso 12.';
  const messageText=hiringMessage(hiringGreetingName(candidate),dashboardCandidateRoleName(candidate),form,contract);const editor=document.createElement('textarea');editor.className='hiring-message';editor.setAttribute('aria-label','Mensaje para el candidato (editable)');editor.value=messageText;hiringSendCards(overlay,dialog,candidate,trial,editor);
  const links=hiringPersonalLinks(form,contract);dialog.append(links);
  dialog.querySelector('.hiring-send-message').open=true;
  const send=hiringWhatsAppButton();
  const retryAdvance=document.createElement('button');retryAdvance.textContent='Reintentar avance al paso 12';retryAdvance.className='hiring-confirm';retryAdvance.hidden=true;
  const continueRoute=!!window.CartelEvolution?.onboardingState?.(candidateId)?.hiring_reopened;
  const advance=()=>finishHiringWhatsAppAdvance(candidateId,trial,continueRoute,overlay,status,retryAdvance);
  retryAdvance.onclick=advance;
  send.onclick=async()=>{
   if(send.disabled)return;
   const phone=candidatePhone(candidate);
   if(phone.length<8)return alert('Falta un WhatsApp válido.');
   if(!editor.value.trim())return alert('Escribe un mensaje.');
   if(!editor.value.includes(form)||!editor.value.includes(contract)){
    status.textContent='Incluye los enlaces del expediente y del contrato antes de abrir WhatsApp.';
    whatsappTab?.close();whatsappTab=null;return;
   }
   if(Date.parse(prepared.expires_at)<=Date.now())return status.textContent='Los enlaces han caducado. Cierra y vuelve a preparar la contratación.';
   send.disabled=true;
   try{
    // The browser handoff, not WhatsApp delivery, triggers the transition.
    const tab=whatsappTab||window.open('about:blank','_blank');
    whatsappTab=null;
    if(!tab)throw Error('El navegador bloqueó WhatsApp. Permite las ventanas emergentes y reintenta.');
    try{tab.opener=null;if(tab.document){const policy=tab.document.createElement('meta');policy.name='referrer';policy.content='no-referrer';tab.document.head.append(policy);}tab.location.replace('https://wa.me/'+phone+'?text='+encodeURIComponent(editor.value));}catch(e){tab.close();throw e;}
   }catch(e){status.textContent=e.message;send.disabled=false;return;}
   send.hidden=true;
   const pending={version:4,stage:trial.stage,expires_at:prepared.expires_at,at:Date.now(),action:'whatsapp_opened',continueRoute};
   try{sessionStorage.setItem('cartel-hiring-pending:'+trial.id,JSON.stringify(pending));}catch(_){}
   preserveCandidateSheet(candidateId);
   await advance();
  };
  const actions=hiringMessageActions(dialog);
  actions.append(send,retryAdvance);
  hiringAddReview(candidateId,overlay,actions);
  hiringReturnToSheet(actions,overlay);
  hiringMessageDraft={candidateId,expiresAt:prepared.expires_at,restore:hiringRestorePanel(overlay,dialog,dialog.querySelector('.hiring-send-message summary'))};
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
async function persistHiringNotification(id,trial,continueRoute){
 if(hiringNotificationSaves.has(trial.id))return hiringNotificationSaves.get(trial.id);
 const save=(async()=>{
  if(!hiringCases[String(id)]?.notified_at){
   let timeout;
   try{await Promise.race([hiringRpc('hr_manage_hiring',{p_trial:trial.id,p_action:'notify'}),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('El guardado tarda demasiado. Reintenta para comprobar el avance.')),15000);})]);}finally{clearTimeout(timeout);}
  }
  await loadHiringCases();
  if(!hiringCases[String(id)]?.notified_at)throw Error('No se pudo comprobar el guardado. Reintenta.');
  if(continueRoute)await onboardingCall(id,'hiring_continue');
  preserveCandidateSheet(id);
  await refreshCandidateAfterStatusChange(id);
  try{sessionStorage.removeItem('cartel-hiring-pending:'+trial.id);}catch(_){}
 })();
 hiringNotificationSaves.set(trial.id,save);
 try{return await save;}finally{hiringNotificationSaves.delete(trial.id);}
}
async function finishHiringWhatsAppAdvance(id,trial,continueRoute,overlay,status,retry){
 if(retry.disabled)return;
 retry.disabled=true;retry.hidden=true;
 status.textContent='WhatsApp abierto. Guardando el avance al paso 12…';
 try{await persistHiringNotification(id,trial,continueRoute);hiringMessageDraft=undefined;overlay.remove();}
 catch(e){status.textContent='No pudimos completar el avance. '+e.message;retry.disabled=false;retry.hidden=false;}
}
async function resumeHiringAdvance(id){
 const t=trialPeriodsByCandidate[String(id)],candidate=candidates.find(c=>String(c.id)===String(id));if(!t||!['trial','hired'].includes(candidate?.status))return;
 let p;try{p=JSON.parse(sessionStorage.getItem('cartel-hiring-pending:'+t.id)||'null');}catch(_){return;}
 // Old explicit-send confirmations are not evidence of a new automatic action.
 if(p?.version!==4||p.action!=='whatsapp_opened')return;
 if(document.getElementById('hiringNotificationOverlay'))return;
 const h=hiringCases[String(id)];
 if(p.stage!==t.stage||!h||String(h.trial_id)!==String(t.id)||h.revoked_at||Date.parse(h.expires_at)!==Date.parse(p.expires_at)||!Number.isFinite(Date.parse(p.expires_at))||Date.parse(p.expires_at)<=Date.now()||!Number.isFinite(p.at)||Date.now()-p.at>=86400000||p.at>Date.now()){
  try{sessionStorage.removeItem('cartel-hiring-pending:'+t.id);}catch(_){}return;
 }
 const {overlay,dialog}=hiringNotificationDialog('Avanzar a inserción en sistema');
 const info=document.createElement('p');info.setAttribute('role','status');
 const retry=document.createElement('button');retry.className='hiring-confirm';retry.textContent='Reintentar avance al paso 12';
 retry.onclick=()=>finishHiringWhatsAppAdvance(id,t,p.continueRoute===true,overlay,info,retry);
 dialog.append(info,retry);hiringReturnToSheet(dialog,overlay);
 await retry.onclick();
}

function hiringReviewIcon(key){
 const paths={
  data:'<circle cx="12" cy="7" r="3"/><path d="M5 21v-3a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v3z"/>',
  documents:'<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6"/>',
  print:'<path d="M6 8V3h12v5M6 17H4a2 2 0 0 1-2-2v-4a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v4a2 2 0 0 1-2 2h-2M6 14h12v7H6zM6 11h1"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 18v3h16v-3"/>',
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
  if(key==='documents')return loadGallery();
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
 hiringFields.forEach((fields,index)=>{const section=document.createElement('section');section.className='hiring-review-section hiring-data-card';const title=document.createElement('h4');const [group,icon]=groups[index];title.append(hiringReviewIcon(icon),document.createTextNode(group));const details=document.createElement('dl');details.className='hiring-review-grid';for(const [key,label] of fields){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd'),value=h.data?.[key];dt.textContent=label.replace(' (opcional)','');const empty=value===null||value===undefined||String(value).trim()==='';const optional=label.includes('(opcional)');dd.textContent=empty?(optional?'No declarado':'Pendiente'):String(value);if(empty)dd.classList.add(optional?'is-missing':'is-pending');if(empty&&!optional){row.classList.add('is-pending');const dot=document.createElement('span');dot.className='hiring-field-pending-dot';dot.setAttribute('aria-hidden','true');dd.prepend(dot);}if(['address','care_responsibilities','planned_absence','alternative_address'].includes(key))row.classList.add('is-wide');row.append(dt,dd);details.append(row);}section.append(title,details);tabs.get('data').panel.append(section);});
 const documents=document.createElement('section');documents.className='hiring-review-section';
 documents.innerHTML='<h4>Documentos del expediente</h4>';
 const gallery=document.createElement('div');gallery.className='hiring-doc-gallery';documents.append(gallery);
 tabs.get('documents').panel.append(documents);
 const viewer=document.createElement('dialog');viewer.className='hiring-doc-viewer';viewer.setAttribute('aria-labelledby','hiring-doc-viewer-title');
 const viewerHeader=document.createElement('header'),viewerTitle=document.createElement('strong'),viewerClose=document.createElement('button'),viewerImage=document.createElement('img');
 viewerTitle.id='hiring-doc-viewer-title';viewerClose.textContent='Cerrar';viewerClose.type='button';viewerClose.onclick=()=>viewer.close();
 viewer.addEventListener('keydown',event=>event.stopPropagation());
 viewer.addEventListener('close',()=>viewerImage.removeAttribute('src'));
 viewerHeader.append(viewerTitle,viewerClose);viewer.append(viewerHeader,viewerImage);documents.append(viewer);
 const loaders=[];
 for(const [file,title] of [['front','Anverso del CI'],['back','Reverso del CI'],['portrait','Fotografía del trabajador']]){
  const card=document.createElement('article');card.className='hiring-doc-card'+(file==='portrait'?' is-portrait':'');
  const thumbnail=document.createElement('button');thumbnail.className='hiring-doc-thumb';thumbnail.type='button';
  const placeholder=hiringReviewIcon(file==='portrait'?'data':'documents');thumbnail.append(placeholder);
  thumbnail.setAttribute('aria-label','Ver '+title.toLowerCase());thumbnail.disabled=true;
  const details=document.createElement('div'),label=document.createElement('h5'),badge=document.createElement('div');
  label.textContent=title;badge.className='hiring-doc-status';badge.setAttribute('aria-live','polite');details.append(label,badge);
  card.append(thumbnail,details);gallery.append(card);
  const load=async()=>{
   thumbnail.disabled=true;thumbnail.replaceChildren(placeholder);badge.className='hiring-doc-status';badge.textContent='Cargando…';
   try{
    let {data,error}=await sb.storage.from('hr-hiring-private').download(t.id+'/'+file);
    let candidatePhoto=false;
    if(error&&h.inherited_documents?.[file])({data,error}=await sb.storage.from('hr-identity-private').download(h.inherited_documents[file]));
    const missing=()=>String(error?.statusCode||error?.status||'')==='404'||/object not found/i.test(error?.message||'');
    if(error&&missing()&&file==='portrait'){
     const {data:rows,error:lookupError}=await sb.from('hr_candidate_answers').select('answer').eq('candidate_id',id).eq('question_key','photo_path').limit(1);
     if(lookupError)throw lookupError;
     const path=String(rows?.[0]?.answer||'').trim();
     if(path){({data,error}=await sb.storage.from('hr-candidate-files').download(path));candidatePhoto=!!data&&!error;}
    }
    if(!overlay.isConnected)return;
    if(error&&!missing())throw error;
    if(!data||candidatePhoto){
     const dot=document.createElement('span');dot.className='hiring-field-pending-dot';dot.setAttribute('aria-hidden','true');
     badge.classList.add('is-pending');badge.replaceChildren(dot,document.createTextNode(candidatePhoto?'Pendiente · Foto de la candidatura':'Pendiente'));
    }
    if(!data)return;
    const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(data);});
    if(!overlay.isConnected)return;
    const caption=candidatePhoto?'Foto de la candidatura':title;
    const photo=document.createElement('img');photo.alt=caption;
    photo.onerror=()=>showRetry();
    const expand=document.createElement('span');expand.className='hiring-doc-expand';expand.textContent='⤢';expand.setAttribute('aria-hidden','true');
    thumbnail.replaceChildren(photo,expand);photo.src=source;
    if(!candidatePhoto){badge.classList.add('is-ready');badge.textContent='Disponible';}
    thumbnail.disabled=false;
    thumbnail.onclick=()=>{viewerTitle.textContent=caption;viewerImage.alt=caption;viewerImage.src=source;viewer.showModal();};
   }catch(e){if(overlay.isConnected)showRetry();}
  };
  const showRetry=()=>{
   thumbnail.replaceChildren(placeholder);thumbnail.disabled=true;
   const retry=document.createElement('button');retry.type='button';retry.textContent='Reintentar';retry.onclick=load;
   badge.className='hiring-doc-status';badge.replaceChildren(document.createTextNode('No se pudo cargar la imagen. '),retry);
  };
  loaders.push(load);
 }
 let galleryLoad;
 const loadGallery=()=>galleryLoad??=Promise.all(loaders.map(load=>load()));
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
 const act=(label,action,disabled=false)=>{const b=document.createElement('button');b.textContent=label;b.disabled=disabled||!!h.employee_id;b.onclick=async()=>{if(b.disabled)return;if(action!=='verify'&&!confirm(label+' para la versión '+h.revision+' del expediente?'))return;b.disabled=true;try{await hiringRpc('hr_manage_hiring',{p_trial:t.id,p_action:action,p_revision:h.revision});overlay.remove();await loadHiringCases();window.CartelEvolution?.refresh();openHiringReview(id,returnTo,activeTab);}catch(e){status.textContent=e.message;b.disabled=false;}};return b;};
 step('Expediente recibido',!!(h.submitted_at||h.verified_at||h.employee_id),'Esperando el envío del candidato.');
 step('Validar expediente',!!h.verified_at,'Disponible al recibir el expediente.',act('Validar expediente revisado','verify',!h.submitted_at||!!h.verified_at));
 step('Contrato firmado',!!h.signed_at,'Valida el expediente para poder confirmar el contrato firmado.',act('Confirmar contrato firmado recibido y validado','signed',!h.verified_at||!!h.signed_at));
 const hire=document.createElement('button');hire.textContent='Formalizar contratación';hire.disabled=!!h.employee_id||!h.verified_at||!h.signed_at||!h.notified_at;if(h.employee_id)hire.textContent='Contratación formalizada';hire.onclick=async()=>{if(!confirm('¿Formalizar la contratación con el expediente y el contrato firmado validados?'))return;hire.disabled=true;try{await hiringRpc('hr_finalize_hiring',{p_trial:t.id});overlay.remove();await loadHiringCases();await refreshCandidateAfterStatusChange(id);}catch(e){status.textContent=e.message;hire.disabled=false;}};step('Formalizar contratación',!!h.employee_id,!h.verified_at||!h.signed_at?'Valida el expediente y confirma el contrato firmado.':'Confirma el envío de la notificación al candidato.',hire);
 if(primaryAction)controls.append(primaryAction);
 const renew=document.createElement('button');renew.textContent='Preparar nueva notificación y renovar enlaces';renew.onclick=()=>hiringWithLinkRenewalConfirmation(overlay,renew,h,()=>openHiringPreparationNotification(id,true));
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
function renderHiringContractDocument(root,result){
 if(result.contract.renderer_version===3||result.publicToken&&!result.signed&&Object.hasOwn(result,'identity_images'))return renderHiringContractPaperV3(root,result);
 return renderHiringContract(root,result);
}
async function initHiringPublic(documentMode){
 const root=document.getElementById('hiring');
 if(!documentMode&&history.state?.cartelHiringComplete){hiringCompletedScreen(root);return;}
 const token=new URLSearchParams(location.hash.slice(1)).get('token');
 if(!/^[a-f0-9]{64}$/.test(token||''))throw Error('Enlace no válido, caducado o revocado. Solicita uno nuevo a RRHH.');
 const result=await hiringRpc('hr_read_hiring',{p_token:token,p_document:documentMode});
 if(documentMode){
  window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
  return renderHiringContractDocument(root,{...result,publicToken:token});
 }
 showHiringCandidateForm(root,result,token);
}
function showHiringCandidateForm(root,result,token,preview=false){
 if(result.locked){root.textContent='Tu expediente está validado. Solicita a RRHH cualquier corrección.';return;}
 renderHiringForm(root,result,token,preview);
}
function renderHiringForm(root,result,token,preview,onComplete){
 const saved=result.data||{},optional=new Set(['fixed_phone','alternative_address','civil_status','has_children','care_responsibilities','planned_absence']);
 root.innerHTML=`
  <header class="hiring-form-header">
   <div class="hiring-form-brandline">
    <span class="brand">CARTEL <span>GESTIÓN</span></span>
    ${result.role_title?'<span class="hiring-form-role">'+hiringEsc(result.role_title)+'</span>':''}
   </div>
   <h1>Expediente laboral</h1>
   <p>Completa los datos y adjunta los documentos que faltan para preparar tu contrato laboral.</p>
  </header>
  <form id="hiringForm">
   <div class="hiring-form-progress">
    <p role="status" class="hiring-form-step"></p>
    <div class="hiring-form-segments" aria-hidden="true"></div>
   </div>
   <section><h2 tabindex="-1">Datos personales</h2></section>
   <section hidden><h2 tabindex="-1">Contacto y emergencia</h2></section>
   <section hidden><h2 tabindex="-1">Documentación y escolaridad</h2></section>
   <section hidden><h2 tabindex="-1">Revisión y confirmación</h2><div id="hiringSummary"></div><label class="hiring-form-confirmation"><input name="truth_confirmed" type="checkbox" required> Confirmo que los datos y documentos son veraces y corresponden a mi identidad.</label></section>
   <div class="buttons">
    <button type="button" id="hiringNext">Continuar <span aria-hidden="true">→</span></button>
    <button id="hiringSubmit" hidden>Completar expediente</button>
   </div>
   <p role="alert" id="hiringResult" class="hiring-form-result"></p>
  </form>
  <details class="hiring-form-privacy">
   <summary>Privacidad de tus datos</summary>
   <p>Los datos de familia son voluntarios y se usan solo para coordinar horarios y permisos. Evita incluir diagnósticos o datos médicos en el expediente. Si necesitas una adaptación de salud, puedes solicitar voluntariamente a RRHH un canal confidencial. Se tratará solo lo necesario para esa finalidad, con acceso restringido y separado del contrato.</p>
  </details>`;
 const form=root.querySelector('#hiringForm'),groups=[...form.querySelectorAll('section')];
 const matchingName=(names,value)=>names.find(name=>name.localeCompare(String(value??'').trim(),'es',{sensitivity:'base'})===0);
 const provinces=Object.keys(hiringLocalities);
 const savedProvince=matchingName(provinces,saved.province);
 const savedMunicipality=String(saved.municipality??'').trim().replace(/^La Habana Vieja$/i,'Habana Vieja');
 const acceptedMunicipality=savedProvince?matchingName(hiringLocalities[savedProvince],savedMunicipality):'';
 const fieldsBySection=hiringFields.map(fields=>[...fields]);
 if(result.requires_emergency_address)fieldsBySection[1].push(['emergency_address','Dirección del contacto de emergencia']);
 fieldsBySection.forEach((fields,index)=>fields.forEach(([key,label])=>{
  const choices=key==='province'?provinces:key==='municipality'?(hiringLocalities[savedProvince]||[]):hiringChoices[key];
  const input=document.createElement(choices?'select':'input');
  input.name=key;input.required=!optional.has(key);input.maxLength=1000;
  if(choices){
   const value=key==='province'?savedProvince:key==='municipality'?acceptedMunicipality:saved[key];
   hiringSelectOptions(input,choices,value);
   if(input.required&&!choices.includes(input.value)&&key!=='municipality')input.value='';
  }else{
   input.type=key==='birth_date'?'date':key==='email'?'email':/phone|mobile/.test(key)?'tel':'text';
   input.value=saved[key]??'';
  }
  if(key==='identity_number'){input.pattern='[0-9]{11}';input.inputMode='numeric';input.maxLength=11;}
  if(key==='birth_date'){input.min='1900-01-01';input.max=new Date().toISOString().slice(0,10);}
  const validate=()=>{
   const value=input.value.trim();
   let error='';
   if(key==='mobile'||key==='emergency_phone'){
    if(value&&!/^\+?[0-9 ()-]{8,24}$/.test(value))error='Introduce un teléfono válido.';
   }else if(key==='email'){
    if(value&&!/^[^ @]+@[^ @]+\.[^ @]+$/.test(value))error='Introduce un correo válido.';
   }else if(input.required&&key!=='birth_date'&&key!=='identity_number'&&value.length<2){
    error='Completa este campo.';
   }
   input.setCustomValidity(error);
  };
  validate();
  const accepted=key==='municipality'?acceptedMunicipality:input.value.trim()&&input.checkValidity()?input.value:'';
  if(accepted){
   const hidden=document.createElement('input');hidden.type='hidden';hidden.name=key;hidden.value=accepted;
   form.append(hidden);return;
  }
  const field=document.createElement('label');field.textContent=label;field.append(input);
  const note=document.createElement('small');note.setAttribute('aria-live','polite');
  const update=()=>{
   validate();
   const ready=input.value.trim()&&input.checkValidity();
   note.textContent=ready?'Completado por ti':input.required?'Pendiente':'Opcional';
   note.className=ready?'field-ready':'field-pending';
  };
  input.addEventListener('input',update);input.addEventListener('change',update);update();
  field.append(note);groups[index].append(field);
 }));
 const province=form.elements.province,municipality=form.elements.municipality;
 if(municipality.tagName==='SELECT'){
  const updateMunicipality=()=>{
   const options=hiringLocalities[province.value]||[];
   const value=options.includes(municipality.value)?municipality.value:matchingName(options,savedMunicipality);
   hiringSelectOptions(municipality,options,value);
   municipality.disabled=!province.value;
   municipality.dispatchEvent(new Event('change'));
  };
  province.addEventListener('change',updateMunicipality);updateMunicipality();
 }
 const pending={},processing={},documentPreviews=new Map();
 const documents=[['front','Anverso del CI'],['back','Reverso del CI'],['portrait','Fotografía']];
 for(const [key,title] of documents){
  if(result[key])continue;
  const label=key==='portrait'?'Fotografía del trabajador para el expediente: de los hombros hacia arriba, fondo blanco, mirando a cámara y sin sonreír':title;
  const l=document.createElement('label');l.textContent=label;const input=document.createElement('input');input.type='file';input.name=key;input.accept='image/jpeg,image/png';input.required=true;l.append(input);const preview=document.createElement('img');preview.alt='Vista previa de '+title;preview.hidden=true;preview.style.cssText='max-width:100%;max-height:200px';l.append(preview);let previewUrl;
  documentPreviews.set(key,preview);
  input.onchange=()=>{processing[key]=(async()=>{input.disabled=true;try{delete pending[key];input.setCustomValidity('');if(previewUrl)URL.revokeObjectURL(previewUrl);preview.hidden=true;const f=input.files[0];if(!f)return;pending[key]=await prepareIdentityPhoto(f);previewUrl=URL.createObjectURL(pending[key]);preview.src=previewUrl;preview.hidden=false;}catch(e){input.setCustomValidity(e.message);input.reportValidity();}finally{input.disabled=false;}})();};groups[2].append(l);
 }
 const sections=groups.filter(group=>group.querySelector('input,select'));
 if(documentPreviews.size){
  const instructions=document.createElement('p');instructions.textContent='Adjunta las imágenes pendientes, nítidas y completas.';
  groups[2].querySelector('h2').after(instructions);
 }
 root.classList.add('hiring-candidate-form-surface');
 if(!document.getElementById('hiringCandidateFormStyle')){
  const style=document.createElement('style');style.id='hiringCandidateFormStyle';
  style.textContent=`
   .hiring-candidate-form-surface{color:#edf0f2;font:16px/1.5 system-ui,sans-serif;color-scheme:dark}
   main.hiring-candidate-form-surface{max-width:640px;padding:clamp(16px,4vw,30px)}
   .hiring-candidate-form-surface *{box-sizing:border-box}
   .hiring-form-brandline{display:flex;align-items:center;gap:8px 12px;flex-wrap:wrap}
   .hiring-candidate-form-surface .brand{font-size:13px;font-weight:900;letter-spacing:.11em;color:#ffda03}
   .hiring-candidate-form-surface .brand span{color:#edf0f2}
   .hiring-form-role{margin-inline-start:auto;border:1px solid #786829;border-radius:999px;padding:4px 10px;color:#ffdf55;font-size:12px;font-weight:700;overflow-wrap:anywhere}
   .hiring-form-demo{display:inline-block;margin-top:9px;color:#d3bf75;font-size:12px}
   .hiring-candidate-form-surface .hiring-form-header h1{font-size:clamp(24px,7vw,36px);line-height:1.14;letter-spacing:-.035em;margin:14px 0 6px;color:#f6f7f8}
   .hiring-candidate-form-surface .hiring-form-header p{margin:0;color:#bdc6ca;font-size:14px;line-height:1.5;max-width:44ch}
   .hiring-form-progress{margin:19px 0 14px;scroll-margin-top:14px}
   .hiring-candidate-form-surface .hiring-form-step{margin:0 0 6px;color:#e9ecee;font-size:13px;font-weight:750}
   .hiring-form-segments{display:flex;gap:5px}
   .hiring-form-segments span{height:6px;flex:1;border-radius:99px;background:#3a4043}
   .hiring-form-segments .is-filled{background:#ffda03}
   .hiring-candidate-form-surface #hiringForm>section{background:#15191b;border:1px solid #373e42;border-radius:14px;padding:0 14px 4px;min-width:0}
   .hiring-candidate-form-surface #hiringForm h2{display:flex;gap:10px;align-items:center;margin:0 -14px 12px;padding:12px 14px;border-radius:13px 13px 0 0;background:#252a2d;color:#f4f6f7;font-size:17px;line-height:1.3}
   .hiring-candidate-form-surface #hiringForm h2 svg{width:22px;height:22px;display:block;color:#ffda03}
   .hiring-candidate-form-surface #hiringForm label{display:block;margin:12px 0;color:#e2e7e9;font-size:14px;font-weight:600;overflow-wrap:anywhere}
   .hiring-candidate-form-surface #hiringForm .hiring-form-confirmation{display:flex;align-items:flex-start;gap:8px}
   .hiring-form-confirmation input{flex:none;margin-top:3px;accent-color:#ffda03}
   .hiring-candidate-form-surface #hiringForm input:not([type="checkbox"]),.hiring-candidate-form-surface #hiringForm select{display:block;width:100%;max-width:100%;min-width:0;min-height:46px;margin-top:5px;padding:8px 10px;color:#f2f4f5;background:#22282c;border:1px solid #565e62;border-radius:9px;font:16px system-ui}
   .hiring-candidate-form-surface #hiringForm input[type="date"]::-webkit-date-and-time-value{text-align:left}
   .hiring-candidate-form-surface #hiringForm small{display:block;margin:4px 0 0;font-size:12px;font-weight:500}
   .hiring-candidate-form-surface .field-pending{color:#dcc975}.hiring-candidate-form-surface .field-ready{color:#91c9ab}
   .hiring-candidate-form-surface #hiringForm .buttons{display:flex;margin:14px 0}
   .hiring-candidate-form-surface #hiringForm .buttons button{flex:1;min-height:48px;background:linear-gradient(#ffe34d,#ffda03);border:1px solid #ffda03;box-shadow:0 2px 0 #a58a00;color:#111518;border-radius:11px;font:750 15px system-ui}
   .hiring-candidate-form-surface #hiringForm .buttons button span{margin-left:5px}
   .hiring-candidate-form-surface #hiringForm .hiring-review-final{padding-bottom:12px}
   .hiring-review-cards{display:grid;gap:9px}
   .hiring-summary-card{min-width:0;padding:11px;border:1px solid #3f474b;border-radius:12px;background:linear-gradient(140deg,#272d30,#202528)}
   .hiring-summary-header{display:flex;align-items:center;gap:8px;justify-content:space-between;margin-bottom:7px}
   .hiring-summary-header h3{display:flex;align-items:center;gap:7px;min-width:0;margin:0;color:#f3f5f6;font-size:14px;line-height:1.25}
   .hiring-summary-card svg{display:block;width:19px;height:19px;color:#ffda03}
   .hiring-summary-header .hiring-review-icon{flex:none}
   .hiring-candidate-form-surface #hiringForm .hiring-summary-edit{flex:none;min-height:44px;margin:-8px -5px -8px 0;padding:5px;border:0;background:none;color:#ffdf55;font:700 13px system-ui;cursor:pointer}
   .hiring-summary-card dl{margin:0}
   .hiring-summary-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:7px;padding:5px 0;border-top:1px solid #ffffff12;font-size:13px;overflow-wrap:anywhere}
   .hiring-summary-pair dt{color:#b9c2c8}
   .hiring-summary-pair dd{margin:0;color:#f0f2f4;font-weight:650;text-align:right}
   .hiring-summary-documents{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:6px}
   .hiring-summary-document{min-width:0;margin:0;text-align:center;overflow-wrap:anywhere}
   .hiring-summary-thumbnail{display:grid;place-items:center;aspect-ratio:4/3;border:1px solid #465055;border-radius:8px;background:#141819;overflow:hidden}
   .hiring-summary-thumbnail img{display:block;width:100%;height:100%;min-height:0;margin:0;border-radius:0;object-fit:contain}
   .hiring-summary-document figcaption{margin-top:4px;color:#e5e9eb;font-size:11px;font-weight:650}
   .hiring-candidate-form-surface #hiringForm .hiring-summary-document small{margin:1px 0;font-size:10px;color:#aeb9c0}
   .hiring-candidate-form-surface .hiring-form-result:empty{display:none}
   .hiring-candidate-form-surface #hiringForm [hidden],.hiring-candidate-form-surface #hiringForm input[type="hidden"]{display:none!important}
   .hiring-form-privacy{margin-top:17px;padding-top:9px;border-top:1px solid #42484b}
   .hiring-form-privacy summary{padding:5px 0;color:#e4e8ea;font-size:13px;cursor:pointer}
   .hiring-candidate-form-surface .hiring-form-privacy p{margin:8px 0;color:#bdc6ca;font-size:13px}
   .hiring-candidate-form-surface :focus-visible{outline:2px solid #ffda03;outline-offset:3px}
  `;
  document.head.append(style);
 }
 groups.forEach((group,index)=>group.querySelector('h2').prepend(hiringReviewIcon(['data','contact','documents','validation'][index])));
 const progress=form.querySelector('.hiring-form-progress');
 const segments=sections.map(()=>document.createElement('span'));
 progress.querySelector('.hiring-form-segments').replaceChildren(...segments);
 const finalStep=sections.length-1;
 const next=form.querySelector('#hiringNext'),submit=form.querySelector('#hiringSubmit');
 let step=0,editing=false;
 const showStep=index=>{
  step=index;show();sections[step].querySelector('h2').focus({preventScroll:true});
  progress.scrollIntoView?.({block:'start',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 };
 const summary=form.querySelector('#hiringSummary');
 summary.className='hiring-review-cards';
 groups.at(-1).classList.add('hiring-review-final');
 const dateFormat=new Intl.DateTimeFormat('es-CU',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 const renderSummary=()=>{
  const cards=['Datos personales','Contacto de emergencia','Documentos'].map((title,index)=>{
   const card=document.createElement('article'),header=document.createElement('header'),heading=document.createElement('h3');
   card.className='hiring-summary-card';header.className='hiring-summary-header';
   heading.append(hiringReviewIcon(['data','contact','documents'][index]),title);
   header.append(heading);card.append(header);
   const target=sections.indexOf(groups[index]);
   if(target!==-1&&!preview){
    const edit=document.createElement('button');
    edit.type='button';edit.className='hiring-summary-edit';edit.textContent='Editar';
    edit.setAttribute('aria-label','Editar '+title.toLocaleLowerCase('es'));
    edit.onclick=()=>{form.elements.truth_confirmed.checked=false;editing=true;showStep(target);};
    header.append(edit);
   }
   const details=document.createElement('dl');
   for(const [key,label] of fieldsBySection[index]){
    const value=form.elements[key].value.trim();
    if(!value)continue;
    const pair=document.createElement('div'),term=document.createElement('dt'),description=document.createElement('dd');
    const date=key==='birth_date'?new Date(value):null;
    pair.className='hiring-summary-pair';term.textContent=label.replace(/ \(opcional\)$/,'');
    description.textContent=date&&Number.isFinite(+date)?dateFormat.format(date):value;
    pair.append(term,description);details.append(pair);
   }
   if(details.childElementCount)card.append(details);
   return card;
  });
  const gallery=document.createElement('div');gallery.className='hiring-summary-documents';
  for(const [key,title] of documents){
   const figure=document.createElement('figure'),thumbnail=document.createElement('div'),caption=document.createElement('figcaption');
   figure.className='hiring-summary-document';thumbnail.className='hiring-summary-thumbnail';
   const image=documentPreviews.get(key);
   if(pending[key]&&image){
    const photo=document.createElement('img');photo.src=image.src;photo.alt='';thumbnail.append(photo);
   }else thumbnail.append(hiringReviewIcon(key==='portrait'?'data':'documents'));
   const status=document.createElement('small');status.textContent=pending[key]?'Adjuntado':result[key]?'En expediente':'Pendiente';
   caption.append(title,status);figure.append(thumbnail,caption);gallery.append(figure);
  }
  cards[2].append(gallery);summary.replaceChildren(...cards);
 };
 const show=()=>{
  groups.forEach(group=>group.hidden=group!==sections[step]);
  const final=step===finalStep;
  next.hidden=final;submit.hidden=!final;submit.disabled=preview;
  next.firstChild.nodeValue=editing?'Volver al resumen ':'Continuar ';
  progress.querySelector('.hiring-form-step').textContent='Paso '+(step+1)+' de '+sections.length;
  segments.forEach((segment,index)=>segment.classList.toggle('is-filled',index<=step));
  if(final)renderSummary();
 };
 next.onclick=async()=>{
  await Promise.all(Object.values(processing));
  if(step>=finalStep)return;
  if(!preview)for(const input of sections[step].querySelectorAll('input,select'))if(!input.reportValidity())return;
  const target=editing?finalStep:step+1;
  editing=false;showStep(target);
 };
 show();
 if(preview){
  for(const input of form.querySelectorAll('input,select'))input.disabled=true;
  form.onsubmit=event=>event.preventDefault();
  return;
 }
 const send=onComplete?()=>onComplete(form,pending):hiringSubmission(root,form,token,result,pending);let validating=false;
 form.noValidate=true;form.onsubmit=async e=>{e.preventDefault();if(validating||step!==finalStep)return;validating=true;try{await Promise.all(Object.values(processing));for(let i=0;i<sections.length;i++)for(const el of sections[i].querySelectorAll('input,select'))if(!el.checkValidity()){step=i;show();el.reportValidity();return;}await send();}finally{validating=false;}};
}
