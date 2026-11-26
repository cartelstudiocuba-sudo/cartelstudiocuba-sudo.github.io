(()=>{'use strict';
const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,cls,fn)=>{const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;};
const norm=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const stop=new Set('que como cual cuales hay puedo donde cuando debo hacer para por los las del una uno con sobre quiero dime necesito me mi de el la se un y en a al es son o lo tu sus'.split(' '));
const tokens=text=>[...new Set(norm(text).match(/[a-z0-9]+/g)||[])].filter(w=>w.length>2&&!stop.has(w));
const terms=text=>tokens(text).flatMap(w=>[w,...({abrir:['apertura'],apertura:['abrir'],cerrar:['cierre'],cierre:['cerrar'],presupuestos:['presupuesto'],compra:['presupuesto','insumos'],dinero:['efectivo','presupuesto'],uniforme:['vestimenta'],responsabilidades:['funciones'],diarias:['diaria','rutina'],diario:['diaria','rutina'],solicitar:['solicitud'],solicito:['solicitud'],pedir:['solicitud','pedido']}[w]||[])]);
const find=(docs,q)=>{const words=terms(q);if(!words.length)return [];return docs.map(d=>{const t=norm(d.title),b=norm(d.body),score=words.reduce((s,w)=>s+(t.includes(w)?5:0)+(b.includes(w)?1:0),0);return {d,score};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).map(x=>x.d);};
const date=value=>value?new Intl.DateTimeFormat('es-CU',{dateStyle:'medium'}).format(new Date(value)):'';
async function getLibrary(client){const {data,error}=await client.rpc('staff_protocol_library');if(error)throw error;return data||{documents:[],roles:[]};}
const symbols={'Protocolos':'▤','Funciones y rutinas':'◷','Normas y políticas':'✓','Régimen disciplinario':'⚖','Información institucional':'◆'};
function openDocument(doc){const modal=el('dialog','','knowledge-dialog');modal.setAttribute('aria-label',doc.title);const head=el('header','','knowledge-dialog-head');head.append(el('div',doc.category,'knowledge-eyebrow'),button('×','knowledge-close',()=>modal.close()));const body=el('div','','knowledge-document');body.append(el('h2',doc.title),el('p',doc.scope+' · '+date(doc.updated_at),'knowledge-meta'),el('p',doc.body,'knowledge-full-text'));modal.append(head,body);document.body.append(modal);modal.addEventListener('close',()=>modal.remove());modal.showModal();}
function protocolArt(doc){const title=norm(doc.title);if(/apertura|cierre|instalacion|acceso|sede/.test(title))return 'operation';if(/almacen|insumo|inventario|equipamiento|material|proveedor/.test(title))return 'warehouse';if(/uniforme|imagen|presencia|vestimenta/.test(title))return 'uniform';if(/inciden|mantenim|reparaci|seguridad|emergencia|contingencia/.test(title))return 'incident';if(/video|foto|rodaje|produccion|proyecto|cliente|agenda/.test(title))return 'studio';return 'routine';}
async function mountLibrary(client,root){
 const state=el('p','Cargando tu biblioteca…','knowledge-status');root.append(state);
 try{
  const data=await getLibrary(client),docs=data.documents||[];root.replaceChildren();
  const hero=el('header','','knowledge-hero');const heroText=el('div');heroText.append(el('small','EL CARTEL STUDIO'),el('h1','Protocolos'),el('p',data.roles?.length===1?data.roles[0]:'Biblioteca de trabajo'));hero.append(heroText,el('span','▤','knowledge-hero-icon'));root.append(hero);
  const search=el('input');search.type='search';search.placeholder='Buscar protocolo…';search.setAttribute('aria-label','Buscar en protocolos');const searchBox=el('div','','knowledge-search');searchBox.append(el('span','⌕'),search);root.append(searchBox);
  let category='Todos';const categories=el('div','','knowledge-categories'),sections=el('div','','knowledge-sections');root.append(categories,sections);
  const categoriesList=['Todos',...new Set(docs.map(d=>d.category))];
  for(const c of categoriesList){const b=button('','knowledge-category',()=>{category=c;draw()});b.dataset.category=c;const count=docs.filter(d=>c==='Todos'||d.category===c).length;b.append(el('span',c==='Todos'?'▦':symbols[c]||'▤','knowledge-category-icon'),el('strong',c),el('small',String(count)));categories.append(b);}
  function visualCard(d){const card=button('','knowledge-visual-card',()=>openDocument(d));const art=el('span','','knowledge-art');art.dataset.art=protocolArt(d);art.setAttribute('aria-hidden','true');const content=el('div','','knowledge-card-content');content.append(el('small',d.category,'knowledge-card-category'),el('h3',d.title),el('p',d.body.slice(0,115)+(d.body.length>115?'…':'')));const footer=el('div','','knowledge-card-footer');footer.append(el('span',d.scope),el('span','Ver protocolo ›'));content.append(footer);card.append(art,content);return card;}
  function policyCard(d){const card=button('','knowledge-policy-card',()=>openDocument(d));const copy=el('div');copy.append(el('strong',d.title),el('small',d.scope));card.append(el('span',symbols[d.category]||'✓','knowledge-policy-icon'),copy,el('span','›','knowledge-arrow'));return card;}
  function section(title,rows,compact=false){if(!rows.length)return;const block=el('section','','knowledge-section'+(compact?' knowledge-policy-section':''));const heading=el('div','','knowledge-section-heading');heading.append(el('h2',title),el('small',rows.length+' documentos'));const grid=el('div','',compact?'knowledge-policy-grid':'knowledge-visual-grid');for(const d of rows)grid.append(compact?policyCard(d):visualCard(d));block.append(heading,grid);sections.append(block);}
  function draw(){const q=search.value.trim();const results=(q?find(docs,q):docs).filter(d=>category==='Todos'||d.category===category);for(const b of categories.children)b.setAttribute('aria-pressed',String(b.dataset.category===category));sections.replaceChildren();const policy=d=>['Normas y políticas','Régimen disciplinario'].includes(d.category);section('Protocolos y funciones de la plaza',results.filter(d=>!policy(d)&&d.category!=='Información institucional'));section('Políticas generales',results.filter(policy),true);section('Información institucional',results.filter(d=>d.category==='Información institucional'),true);if(!results.length)sections.append(el('p','No encontramos documentos para esta búsqueda.','knowledge-empty'));}
  search.addEventListener('input',draw);draw();const selected=docs.find(d=>d.id===new URLSearchParams(location.search).get('doc'));if(selected)openDocument(selected);
 }catch(e){state.textContent='No se pudo cargar la biblioteca. ';state.append(button('Reintentar','knowledge-filter',()=>{root.replaceChildren();void mountLibrary(client,root);}));}
}
function authorizedLinks(){return [...document.querySelectorAll('.nav a[href]')].filter(a=>{const href=a.getAttribute('href');if(!href?.startsWith('/')||href.startsWith('/protocolos.html')||a.hasAttribute('data-soon'))return false;for(let n=a;n&&n!==document.querySelector('.nav');n=n.parentElement)if(n.hidden||n.style.display==='none')return false;return true;});}
function excerpt(doc,q){const words=terms(q);const paragraphs=doc.body.split(/\n+/).filter(Boolean);const ranked=paragraphs.map((p,i)=>({p,i,score:words.filter(w=>norm(p).includes(w)).length})).sort((a,b)=>b.score-a.score);return ranked.slice(0,Math.min(3,ranked.length)).sort((a,b)=>a.i-b.i).map(x=>x.p).join('\n').slice(0,1100);}
function mountVoiceInput({panel,form,question,submit,ask}){
 const voice=button('','assistant-mic',()=>{});
 voice.setAttribute('aria-label','Mantén pulsado para hablar');
 voice.title='Mantén pulsado para hablar';
 voice.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg>';
 const status=el('p','','assistant-voice-status');status.setAttribute('role','status');status.hidden=true;form.before(status);form.insertBefore(voice,submit);
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 let session=null,held=false;
 function message(text){status.textContent=text;status.hidden=!text;}
 function paint(active){voice.classList.toggle('is-recording',active);voice.setAttribute('aria-pressed',String(active));}
 function fallback(){message('El dictado del navegador no está disponible. Usa el micrófono de tu teclado o escribe tu pregunta.');question.focus();}
 function complete(current){if(session!==current)return;clearTimeout(current.timeout);session=null;held=false;paint(false);voice.disabled=false;
  if(current.cancelled||!panel.open)return;
  const text=(current.final+current.interim).trim().slice(0,500);
  if(current.failed){message(current.failed);if(text)question.value=text;return;}
  if(!text){message('No pude escuchar la pregunta. Mantén pulsado el micrófono e inténtalo de nuevo.');return;}
  message('');question.value=text;void ask(text,{voice:true});
 }
 function stop(cancel=false){const current=session;if(!current)return;held=false;paint(false);current.cancelled=cancel;current.released=true;
  if(cancel){clearTimeout(current.timeout);session=null;voice.disabled=false;try{current.recognition.abort();}catch{}message('');return;}
  if(current.ended){complete(current);return;}
  message('Transcribiendo…');voice.disabled=true;
  if(current.started){try{current.recognition.stop();}catch{complete(current);}}
  current.timeout=setTimeout(()=>{if(session===current){try{current.recognition.abort();}catch{}complete(current);}},8000);
 }
 function start(){if(session||submit.disabled||!panel.open)return;if(!Speech){fallback();return;}
  const recognition=new Speech();const current={recognition,started:false,ended:false,released:false,cancelled:false,final:'',interim:'',failed:'',timeout:null};session=current;held=true;paint(true);message('Escuchando… suelta para enviar.');
  recognition.lang='es-CU';recognition.interimResults=true;recognition.continuous=true;recognition.maxAlternatives=1;
  recognition.onstart=()=>{if(session!==current)return;current.started=true;if(current.released)try{recognition.stop();}catch{complete(current);}};
  recognition.onresult=event=>{if(session!==current)return;let final='',interim='';for(let i=0;i<event.results.length;i++){const result=event.results[i],part=result[0]?.transcript||'';if(result.isFinal)final+=' '+part;else interim+=' '+part;}current.final=final;current.interim=interim;question.value=(final+interim).trim().slice(0,500);};
  recognition.onerror=event=>{if(session!==current||current.cancelled)return;current.failed=({ 'not-allowed':'Permite el acceso al micrófono en tu navegador.', 'service-not-allowed':'El dictado no está disponible. Usa el micrófono del teclado.', 'audio-capture':'No se encontró un micrófono disponible.', 'network':'El dictado necesita conexión. Inténtalo otra vez.', 'no-speech':'No pude escuchar la pregunta. Inténtalo de nuevo.'})[event.error]||'No se pudo transcribir la pregunta.';current.released=true;complete(current);};
  recognition.onend=()=>{clearTimeout(current.timeout);if(session!==current)return;current.ended=true;if(current.released)complete(current);else{paint(false);message('Suelta el micrófono para enviar.');}};
  try{recognition.start();}catch{current.cancelled=true;complete(current);fallback();}
 }
 voice.addEventListener('pointerdown',event=>{if(event.button!==0||!event.isPrimary)return;event.preventDefault();try{voice.setPointerCapture(event.pointerId);}catch{}start();});
 voice.addEventListener('pointerup',event=>{if(!event.isPrimary)return;event.preventDefault();if(held)stop();});
 voice.addEventListener('pointercancel',()=>stop(true));
 voice.addEventListener('lostpointercapture',()=>{if(held)stop(true);});
 voice.addEventListener('contextmenu',event=>event.preventDefault());
 voice.addEventListener('keydown',event=>{if(![' ','Enter'].includes(event.key))return;event.preventDefault();if(!event.repeat&&!held)start();});
 voice.addEventListener('keyup',event=>{if([' ','Enter'].includes(event.key)){event.preventDefault();if(held)stop();}});
 voice.onclick=event=>{if(event.detail!==0)return;if(held)stop();else if(!session){start();if(held)message('Escuchando… pulsa de nuevo para enviar.');}};
 panel.addEventListener('close',()=>stop(true));
 window.addEventListener('blur',()=>{if(held&&session?.started)stop(true);});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop(true);});
 form.addEventListener('submit',()=>{if(session)stop(true);},true);
 question.addEventListener('input',()=>{if(!session)message('');});
}
function mountAssistant(client,openModule){if(document.getElementById('cartel-assistant-launch'))return;const launch=button('','cartel-assistant-launch',()=>{if(!panel.open){panel.showModal();if(matchMedia('(pointer: fine)').matches)question.focus();}});launch.id='cartel-assistant-launch';launch.setAttribute('aria-label','Pregúntame lo que quieras');launch.append(el('span','✦','assistant-star'),el('span','Pregúntame','assistant-launch-label'));
const panel=el('dialog','','cartel-assistant');panel.setAttribute('aria-label','Asistente Cartel');const head=el('header','','assistant-head');const branding=el('div');branding.append(el('strong','Asistente Cartel'),el('small','Consulta tus protocolos y módulos'));head.append(el('span','✦','assistant-star'),branding,button('×','knowledge-close',()=>panel.close()));const log=el('div','','assistant-log');log.setAttribute('role','log');const welcome=el('div','¡Hola! Pregúntame lo que quieras. 👋','assistant-answer');log.append(welcome);const quick=el('div','','assistant-quick');const form=el('form','','assistant-form'),question=el('input');question.type='text';question.placeholder='Escribe tu pregunta';question.maxLength=500;question.required=true;question.setAttribute('aria-label','Pregunta');const submit=el('button','↑','assistant-send');submit.type='submit';submit.setAttribute('aria-label','Enviar pregunta');form.append(question,submit);panel.append(head,log,quick,form);document.body.append(launch,panel);
function navigate(path){panel.close();openModule(path);}
async function ask(input,{voice=false}={}){if(submit.disabled)return;const q=input.trim();if(!q)return;log.append(el('div',q,'assistant-question'));question.value='';submit.disabled=true;quick.hidden=true;const reply=el('div','Consultando tu información…','assistant-answer');log.append(reply);log.scrollTop=log.scrollHeight;try{const data=await getLibrary(client);const matches=find(data.documents||[],q).slice(0,3);const links=authorizedLinks();const relevant=find(links.map(a=>({title:a.textContent.trim(),body:'',link:a})),q).slice(0,2);reply.replaceChildren();if(matches.length){reply.append(el('strong','Encontré información relacionada:'));for(const doc of matches){const block=el('section','','assistant-source');block.append(el('h4',doc.title),el('p',excerpt(doc,q)),button('Leer documento completo ›','assistant-source-link',()=>navigate('/protocolos.html?doc='+encodeURIComponent(doc.id))));reply.append(block);}}else reply.append(el('p','No encontré una respuesta directa en los documentos disponibles para tu plaza.'));for(const {link} of relevant)reply.append(button('Abrir '+link.textContent.trim()+' ›','assistant-source-link',()=>{panel.close();link.click();}));if(!matches.length&&!relevant.length)reply.append(el('small','Prueba con una palabra clave o consulta tu biblioteca de protocolos.'));}catch(e){reply.textContent='No pude consultar tu información. Inténtalo nuevamente.';}finally{submit.disabled=false;log.scrollTop=log.scrollHeight;if(!voice&&panel.open)question.focus();}}
mountVoiceInput({panel,form,question,submit,ask});
form.onsubmit=e=>{e.preventDefault();void ask(question.value);};for(const q of ['¿Cuáles son mis funciones?','¿Qué normas debo cumplir?','¿Cómo solicito un presupuesto?'])quick.append(button(q,'assistant-chip',()=>void ask(q)));
panel.addEventListener('close',()=>launch.focus());
}
window.CartelKnowledge={mountLibrary,mountAssistant};
})();
