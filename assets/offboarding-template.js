// GENERATED from plaza-ficha.html. Do not author clauses here.
function createOffboardingPaper(role,n,options={}){
const e=options.escape||hiringEsc,contractLogoUrls=options.logos||{};
const agencyPolicies=n.filter(x=>x.category==='normas_politicas'),agencyDiscipline=n.filter(x=>x.category==='regimen_disciplinario'),agencyContractData=n.filter(x=>x.category==='datos_contractuales_empresa'),agencyContractClauses=n.filter(x=>x.category==='clausulas_contractuales');
const workDefaults=[
 {key:'global_description',title:'Descripción global de la plaza',text:'Define el propósito de la plaza, su alcance, nivel de autonomía y el resultado general que se espera de la persona dentro de El Cartel Studio.'},
 {key:'cartel_particularities',title:'Particularidades de la plaza en El Cartel Studio',text:'Explica cómo se integra esta plaza al sistema de trabajo de El Cartel Studio, los recursos y estructura que la empresa pone a su disposición y las particularidades que diferencian su desempeño dentro de la empresa.'},
 {key:'work_relationship',title:'Relación de trabajo',text:'La persona debe respetar la estructura organizativa y la cadena de mando definida para su plaza, mantener comunicación profesional con su jefe directo y las áreas con las que coordina, actuar con autonomía dentro de sus atribuciones y escalar oportunamente cualquier situación que exceda su capacidad de decisión.'},
 {key:'presence',title:'Presencia',text:'Debe mantener una imagen personal limpia, ordenada y profesional. Cuando la empresa asigne uniforme y/o credencial, su uso será obligatorio durante la jornada o actividad correspondiente. La presentación personal debe ser coherente con la imagen y los estándares de El Cartel Studio.'},
 {key:'behavior',title:'Comportamiento',text:'Debe mantener un trato respetuoso, actitud profesional, disposición y discreción. Se espera una comunicación adecuada con compañeros, clientes, artistas y proveedores, evitando conductas, comentarios o acciones que afecten el ambiente de trabajo o la imagen de El Cartel Studio.'},
 {key:'confidentiality',title:'Confidencialidad',text:'Toda información interna, documentación, archivos, datos de clientes, presupuestos, contactos, metodologías, procesos, materiales inéditos, accesos y demás información conocida por razón del trabajo debe tratarse de forma confidencial y utilizarse exclusivamente para las funciones autorizadas por El Cartel Studio.'},
 {key:'image_rights',title:'Derechos de imagen y créditos',text:'Como parte de la actividad de El Cartel Studio, la persona podrá aparecer en fotografías, videos, BTS y otros contenidos vinculados al trabajo y a la comunicación de la empresa. Los créditos profesionales se reconocerán cuando corresponda y de acuerdo con el tipo de contenido o proyecto.'},
 {key:'work_media',title:'Medios de trabajo',text:'Los medios, equipos, herramientas, uniformes y demás recursos entregados o puestos a disposición para el trabajo deben utilizarse únicamente para los fines autorizados, conservarse correctamente y devolverse en las condiciones establecidas. Cualquier pérdida, daño o incidencia debe reportarse de inmediato.'},
 {key:'whatsapp',title:'Grupos de WhatsApp y comunicación',text:'Los grupos de WhatsApp definidos por la empresa funcionan como canales de coordinación operativa. La persona deberá incorporarse a los grupos que correspondan a su plaza, mantener una comunicación clara y profesional y utilizar cada canal de acuerdo con su finalidad.'},
 {key:'access',title:'Accesos',text:'La empresa podrá asignar accesos a plataformas, aplicaciones, carpetas, servidores, cuentas u otros recursos necesarios para el desempeño de la plaza. Estos accesos son personales o de uso restringido según corresponda, no deben compartirse sin autorización y deberán utilizarse exclusivamente para funciones de trabajo.'},
 {key:'training',title:'Capacitación asociada a la plaza',text:'La persona deberá completar la capacitación inicial y las actualizaciones que correspondan a su plaza, estudiar los materiales, protocolos y herramientas entregados y solicitar aclaración o refuerzo cuando sea necesario para cumplir correctamente los estándares de trabajo de El Cartel Studio.'}
];
function workData(){const w=role.work_content&&typeof role.work_content==='object'?role.work_content:{};return {standard:w.standard&&typeof w.standard==='object'?w.standard:{},standard_titles:w.standard_titles&&typeof w.standard_titles==='object'?w.standard_titles:{},hidden_standard_keys:Array.isArray(w.hidden_standard_keys)?w.hidden_standard_keys:[],content_order:Array.isArray(w.content_order)?w.content_order:[],custom:Array.isArray(w.custom)?w.custom:[],protocol_blocks:Array.isArray(w.protocol_blocks)?w.protocol_blocks:[],policy_ids:Array.isArray(w.policy_ids)?w.policy_ids:[],institutional_info_ids:Array.isArray(w.institutional_info_ids)?w.institutional_info_ids:[],discipline_ids:Array.isArray(w.discipline_ids)?w.discipline_ids:[]}}
function selectedPolicyIds(){return workData().policy_ids}
function appliedPolicies(){const ids=new Set(selectedPolicyIds());return agencyPolicies.filter(x=>x.applies_to_all_roles||ids.has(x.id))}function selectedDisciplineIds(){return workData().discipline_ids}
function appliedDiscipline(){const ids=new Set(selectedDisciplineIds());return agencyDiscipline.filter(x=>x.applies_to_all_roles||ids.has(x.id))}
function specificWorkItems(){const w=workData(),hidden=new Set(w.hidden_standard_keys);const standards=workDefaults.filter(b=>!hidden.has(b.key)).map(b=>({id:'std:'+b.key,type:'standard',key:b.key,title:w.standard_titles[b.key]||b.title,text:w.standard[b.key]||b.text}));const custom=w.custom.map((b,i)=>{const cid=String(b.id||('legacy-'+i));return {id:'custom:'+cid,type:'custom',key:cid,title:b.title||'',text:b.text||''}});const all=[...standards,...custom].map((x,i)=>({...x,_base:i})),order=w.content_order||[],pos=new Map(order.map((id,i)=>[id,i]));return all.sort((a,b)=>{const pa=pos.has(a.id)?pos.get(a.id):99999,pb=pos.has(b.id)?pos.get(b.id):99999;return pa!==pb?pa-pb:a._base-b._base})}
function contractDataValue(key){return agencyContractData.find(x=>x.key===key)?.value||''}
function contractCompanyText(){const name=contractDataValue('denominacion_oficial'),rep=contractDataValue('titular_representante'),roleName=contractDataValue('caracter_representante'),identity=contractDataValue('identidad_representante'),address=contractDataValue('domicilio_legal');const missing=[];if(!name)missing.push('denominación');if(!rep)missing.push('representante');if(!roleName)missing.push('carácter del representante');if(!identity)missing.push('identidad');if(!address)missing.push('domicilio legal');if(missing.length)return 'Faltan datos contractuales: '+missing.join(', ')+'.';return 'DE UNA PARTE, '+name+', con domicilio legal en '+address+', representado por '+rep+', en su carácter de '+roleName+', con número de identidad '+identity+', a quien en lo sucesivo se le denominará EL EMPLEADOR.'}
function contractInheritedContent(src,block){
 const clean=v=>String(v||'').trim();
 const value=(v,fallback='______________________________')=>clean(v)||fallback;
 const title=value(role.title,'la plaza correspondiente');
 const area=value(role.area,'el área correspondiente');
 const boss=value(role.direct_manager,'su jefe directo');
 const modality=clean(role.modality);
 const employment=clean(role.employment_type);
 const days=clean(role.work_days);
 const schedule=clean(role.schedule);
 const location=clean(role.location);
 const currency=clean(role.currency);
 const frequency=clean(role.payment_frequency);
 const paymentMethod=clean(role.payment_method);
 if(src==='custom')return block.text||'';
 if(src==='company')return contractCompanyText();
 if(src==='candidate')return 'Se completará automáticamente al generar el documento con los datos del candidato o trabajador: nombre, identificación, domicilio, fecha y firmas según corresponda.';
 if(src==='role:title')return 'EL TRABAJADOR ocupará la plaza de '+title+', desempeñando las funciones y responsabilidades que correspondan a dicho cargo.';
 if(src==='role:description')return 'El presente contrato tiene por objeto regular la incorporación de EL TRABAJADOR a la plaza de '+title+'. '+(clean(role.description)||'Las funciones específicas, responsabilidades, límites de actuación y resultados esperados serán los establecidos para esta plaza y en las disposiciones que forman parte del presente documento.');
 if(src==='role:identity')return 'EL TRABAJADOR desempeñará la plaza de '+title+', adscrita al área de '+area+', y estará bajo la subordinación directa de '+boss+'. En el ejercicio de sus funciones deberá mantener comunicación y reporte con dicha jefatura, cumplir las orientaciones recibidas dentro del alcance de la plaza y respetar la estructura organizativa de El Cartel Studio.';
 if(src==='role:employment_terms'){
   const parts=[];
   parts.push('La relación laboral comenzará a surtir efecto a partir de la fecha que se consigne al formalizar el presente contrato.');
   if(employment)parts.push('La vinculación se establece como '+employment+'.');
   if(modality)parts.push('La modalidad de trabajo será '+modality+'.');
   parts.push('Cualquier modificación de estas condiciones deberá ser acordada y documentada conforme a los procedimientos de El Cartel Studio.');
   return parts.join(' ');
 }
 if(src==='role:trial_period')return 'Las partes acuerdan un período de prueba de '+value(role.trial_period)+', durante el cual se evaluará la adaptación de EL TRABAJADOR a la plaza, el cumplimiento de sus responsabilidades, su desempeño y su integración a los métodos de trabajo de El Cartel Studio.';
 if(src==='role:trial_object')return 'La persona candidata participará durante '+value(role.trial_period)+' en una etapa práctica y remunerada del proceso de selección para la plaza de '+title+', destinada a evaluar en condiciones reales su organización, responsabilidad, autonomía, seguimiento, comunicación, discreción y adaptación. La realización de esta etapa no constituye por sí sola garantía de contratación posterior.';
 if(src==='role:trial_conditions'){
   const amount=role.trial_compensation_different?clean(role.trial_compensation_amount):clean(role.compensation);
   let remuneration=value(amount);
   if(currency)remuneration+=' '+currency;
   if(frequency)remuneration+=' · '+frequency;
   return 'Inicio: ____________________________________\nDuración: '+value(role.trial_period)+'\nHorario: '+value(role.schedule)+'\nLugar: '+value(role.location)+'\nRemuneración: '+remuneration;
 }

 if(src==='role:schedule_location'){
   const chunks=[];
   if(days)chunks.push('La jornada laboral se desarrollará '+days.charAt(0).toLowerCase()+days.slice(1));
   if(schedule)chunks.push('en el horario de '+schedule);
   let first=chunks.length?chunks.join(', '):'La jornada y el horario de trabajo serán los establecidos para la plaza';
   if(location)first+=', teniendo como lugar habitual de trabajo '+location;
   first+='.';
   return first+' Cuando las necesidades operativas de la plaza lo requieran, podrán realizarse coordinaciones o ajustes puntuales previamente orientados por la jefatura correspondiente.';
 }
 if(src==='role:trial_compensation'){
   const amount=role.trial_compensation_different?clean(role.trial_compensation_amount):clean(role.compensation);
   let text='Durante el período de prueba, EL TRABAJADOR recibirá una remuneración de '+value(amount);
   if(currency)text+=' '+currency;
   if(frequency)text+=', con frecuencia de pago '+frequency.toLowerCase();
   text+='.';
   if(paymentMethod)text+=' El pago se realizará mediante '+paymentMethod+'.';
   return text;
 }
 if(src==='role:compensation'){
   let text='Como contraprestación por los servicios correspondientes a la plaza, EL TRABAJADOR recibirá una remuneración de '+value(role.compensation);
   if(currency)text+=' '+currency;
   if(frequency)text+=', con frecuencia de pago '+frequency.toLowerCase();
   text+='.';
   if(paymentMethod)text+=' El pago se efectuará mediante '+paymentMethod+'.';
   text+=' Cualquier componente variable, incentivo o ajuste que resulte aplicable se regirá por las condiciones y evaluaciones establecidas por El Cartel Studio.';
   return text;
 }
 if(src==='recruitment')return [role.recruitment_text,role.recruitment_responsibilities,role.recruitment_requirements].filter(Boolean).join('\n\n');
 if(src==='specific')return specificWorkItems().map(x=>x.title+': '+x.text).join('\n\n');
 if(src==='policies')return appliedPolicies().map(x=>x.label+': '+x.value).join('\n\n');
 if(src==='discipline')return appliedDiscipline().map(x=>x.label+': '+x.value).join('\n\n');
 if(String(src).startsWith('policy:')){const p=agencyPolicies.find(x=>x.id===String(src).slice(7));return p?(p.label+': '+(p.value||'')):'Política no disponible'}
 if(String(src).startsWith('clause:')){const p=agencyContractClauses.find(x=>x.id===String(src).slice(7));return p?(p.value||''):'Cláusula maestra no disponible'}
 return ''
}
function contractCandidateTemplateText(block){const t=String(block?.title||'').toLowerCase();if(t.includes('firma')||t.includes('aceptación')||t.includes('disposiciones')||t.includes('conformidad'))return 'Por EL EMPLEADOR:\nNombre: ________________________________________________\nCI: ______________________________\nCargo: ______________________________\nFirma: ______________________________\n\nPor EL TRABAJADOR:\nNombre: ________________________________________________\nCI: ______________________________\nFirma: ______________________________\nFecha: ____ / ____ / ________';return 'Y DE LA OTRA PARTE, ________________________________________________, con número de identidad ______________________________ y domicilio en ________________________________________________________________, a quien en lo sucesivo se le denominará EL TRABAJADOR.'}
function contractEffectiveRenderedText(block){if(!block)return '';if(block.source==='custom')return String(block.text||'');return block.use_override?String(block.override_text||''):contractBaseRenderedText(block)}
function contractBaseRenderedText(block){if(!block)return '';if(block.source==='custom')return String(block.text||'');if(block.source==='candidate')return contractCandidateTemplateText(block);if(block.source==='specific')return contractSpecificStructuredText(specificWorkItems());if(block.source==='discipline')return contractDisciplineStructuredText(appliedDiscipline());if(String(block.source).startsWith('policy:')){const p=agencyPolicies.find(x=>x.id===String(block.source).slice(7));return p?.value||''}if(String(block.source).startsWith('clause:')){const p=agencyContractClauses.find(x=>x.id===String(block.source).slice(7));return p?.value||''}return contractInheritedContent(block.source,{...block,use_override:false})||''}
function contractSpecificStructuredText(items){
 const intro='EL TRABAJADOR desarrollará las funciones y responsabilidades propias de la plaza, entre ellas las siguientes:';
 return [intro,...items.map(x=>'[[SUBCLAUSE]]'+String(x.title||'').trim()+'\n'+String(x.text||'').trim())].join('\n\n')
}
function contractDisciplineStructuredText(items){
 const intro='EL TRABAJADOR estará sujeto al régimen disciplinario aplicable a la plaza y deberá observar las siguientes disposiciones durante el desarrollo de sus funciones:';
 return [intro,...items.map(x=>'[[SUBCLAUSE]]'+String(x.label||x.title||'').trim()+'\n'+String(x.value||x.text||'').trim())].join('\n\n')
}
function normalizeEmploymentPolicyBlocks(doc){
 if(!doc||!Array.isArray(doc.blocks))return doc;
 const dedicatedDefs=[
  {id:'ec9',key:'confidencialidad_manejo_informacion',legacyTitles:['Confidencialidad y manejo de información','Confidencialidad']},
  {id:'ec10',key:'medios_recursos_desempeno_trabajo',legacyTitles:['Medios y recursos para el trabajo']},
  {id:'ec13',key:'termino_relacion_laboral',legacyTitles:['Terminación de la relación laboral']}
 ];
 const dedicatedSources=new Set();
 dedicatedDefs.forEach(def=>{
   const p=contractPolicyByKey(def.key),b=doc.blocks.find(x=>x.id===def.id);
   if(!p||!b)return;
   const src='policy:'+p.id;
   dedicatedSources.add(src);
   if(def.legacyTitles.includes(b.title))b.title=p.label;
   if(def.id==='ec13'&&b.source==='custom'&&String(b.text||'').trim()==='Cláusula contractual de terminación pendiente de ajustar y validar.'){
     b.source=src;b.text='';b.use_override=false;delete b.override_text;
   }
 });
 const existingGenerated=new Map(doc.blocks.filter(b=>String(b.id||'').startsWith('policyblock:')).map(b=>[b.source,b]));
 const applicable=appliedPolicies().filter(p=>!dedicatedSources.has('policy:'+p.id));
 const policyBlocks=applicable.map(p=>{
   const src='policy:'+p.id,old=existingGenerated.get(src);
   return old?{...old,source:src}:{id:'policyblock:'+p.id,title:p.label,source:src,included:true,text:''}
 });
 const cleaned=doc.blocks.filter(b=>b.id!=='ec11'&&b.source!=='policies'&&!String(b.id||'').startsWith('policyblock:'));
 let insertAt=cleaned.findIndex(b=>b.id==='ec10');
 if(insertAt<0)insertAt=cleaned.findIndex(b=>b.id==='ec8');
 insertAt=insertAt<0?cleaned.length:insertAt+1;
 cleaned.splice(insertAt,0,...policyBlocks);
 doc.blocks=cleaned;
 return doc
}
const CONTRACT_PRESENTATION_ID='__presentation__';
function contractPolicyByKey(key){return agencyPolicies.find(x=>x.key===key)||null}
function buildContractPreviewPages(doc,box){
 const company=contractDataValue('denominacion_oficial')||'El Cartel Studio',pages=document.createElement('div');
 pages.className='contract-pages';pages.id='contractPages';box.appendChild(pages);
 let pageNo=1,content=null;
 const fitPageContent=(page)=>{
   const body=page?.querySelector('.contract-page-content'),footer=page?.querySelector('.contract-paper-footer');
   if(!body||!footer)return body;
   body.style.height='';
   const bodyTop=body.getBoundingClientRect().top,footerTop=footer.getBoundingClientRect().top;
   const safeGap=24;
   const available=Math.max(120,Math.floor(footerTop-bodyTop-safeGap));
   body.style.height=available+'px';
   return body
 };
 const addPage=()=>{const tmp=document.createElement('div');tmp.innerHTML=contractPreviewPageShell(pageNo,company,doc);const page=tmp.firstElementChild;pages.appendChild(page);content=page.querySelector('.contract-page-content');fitPageContent(page);return content};
 const overflowing=()=>{
   if(!content)return false;
   const page=content.closest('.contract-paper-page'),footer=page?.querySelector('.contract-paper-footer');
   const byHeight=content.scrollHeight>content.clientHeight+1;
   if(!footer)return byHeight;
   const last=content.lastElementChild;
   const byGeometry=!!last&&last.getBoundingClientRect().bottom>footer.getBoundingClientRect().top-24;
   return byHeight||byGeometry
 };
 const newPage=()=>{pageNo+=1;return addPage()};
 const splitParagraph=(source,parentFactory)=>{
   const text=String(source.textContent||'').trim();if(!text)return;
   const words=text.split(/\s+/),tag=source.tagName.toLowerCase(),baseClass=source.className||'',baseStyle=source.getAttribute('style')||'';
   let pos=0;
   while(pos<words.length){
     const parent=parentFactory(),tester=document.createElement(tag);
     tester.className=baseClass;tester.setAttribute('style',baseStyle+(pos>0?';margin-top:0':''));
     parent.appendChild(tester);
     let lo=1,hi=words.length-pos,best=0;
     while(lo<=hi){
       const mid=Math.floor((lo+hi)/2);
       tester.textContent=words.slice(pos,pos+mid).join(' ');
       if(!overflowing()){best=mid;lo=mid+1}else hi=mid-1;
     }
     parent.removeChild(tester);
     if(best===0){newPage();continue}
     const p=document.createElement(tag);p.className=baseClass;
     p.setAttribute('style',baseStyle+(pos>0?';margin-top:0':'')+(pos+best<words.length?';margin-bottom:0':''));
     p.textContent=words.slice(pos,pos+best).join(' ');parent.appendChild(p);
     pos+=best;
     if(pos<words.length)newPage();
   }
 };
 const appendClause=(section)=>{
   content.appendChild(section);
   if(!overflowing())return;
   content.removeChild(section);
   if(content.children.length)newPage();
   content.appendChild(section);
   if(!overflowing())return;
   content.removeChild(section);
   const heading=section.querySelector('h3'),parts=[...section.children].filter(x=>x!==heading);
   let firstPart=true;
   const makeSection=()=>{
     let sec=content.lastElementChild;
     if(!sec||!sec.classList.contains('contract-paper-clause')||sec.dataset.splitClause!=='1'){
       sec=document.createElement('section');sec.className='contract-paper-clause';sec.dataset.splitClause='1';
       if(firstPart&&heading)sec.appendChild(heading.cloneNode(true));
       content.appendChild(sec);
     }
     return sec
   };
   let sec=makeSection();
   for(const part of parts){
     const node=part.cloneNode(true);sec.appendChild(node);
     if(!overflowing())continue;
     sec.removeChild(node);
     if(part.tagName==='P'){
       if(sec.children.length>(firstPart&&heading?1:0)){newPage();firstPart=false;sec=makeSection()}
       splitParagraph(part,()=>{let current=content.lastElementChild;if(!current||!current.classList.contains('contract-paper-clause')||current.dataset.splitClause!=='1'){current=document.createElement('section');current.className='contract-paper-clause';current.dataset.splitClause='1';content.appendChild(current)}return current});
       sec=content.lastElementChild;
     }else{
       newPage();firstPart=false;sec=makeSection();sec.appendChild(node);
       if(overflowing()&&part.textContent){sec.removeChild(node);splitParagraph(part,makeSection)}
     }
     firstPart=false;
   }
 };
 addPage();
 for(const html of contractPreviewUnits(doc)){
   const tmp=document.createElement('div');tmp.innerHTML=html;const node=tmp.firstElementChild;if(!node)continue;
   if(node.classList.contains('contract-paper-clause')){appendClause(node);continue}
   content.appendChild(node);
   if(overflowing()){content.removeChild(node);newPage();content.appendChild(node);if(overflowing()&&node.tagName==='P'){content.removeChild(node);splitParagraph(node,()=>content)}}
 }
 pages.querySelectorAll('.contract-paper-clause[data-split-clause="1"]').forEach(x=>x.removeAttribute('data-split-clause'));
 const annexes=contractIncludedAnnexes(doc);
 annexes.forEach((annex,index)=>{
   const fields=contractAnnexFields(annex);
   if(annex.type==='transport_photos'&&fields.length>4){
     for(let offset=0;offset<fields.length;offset+=4){
       newPage();
       const chunk={...annex,fields:fields.slice(offset,offset+4),title:(annex.title||'Anexo')+(offset?' · continuación':'')};
       const tmp=document.createElement('div');tmp.innerHTML=contractAnnexPreviewHtml(doc,chunk,index);
       const node=tmp.firstElementChild;if(node)content.appendChild(node)
     }
     return
   }
   newPage();
   const tmp=document.createElement('div');tmp.innerHTML=contractAnnexPreviewHtml(doc,annex,index);
   const node=tmp.firstElementChild;if(node)content.appendChild(node)
 });
}
function contractPreviewPageShell(pageNo,company,doc){const first=pageNo===1,p=contractPresentation(doc),logo=e(contractPresentationLogoSrc(doc)),watermark=e(contractWatermarkLogoSrc(doc)),align=contractLogoAlignValue(p),logoWidth=contractLogoWidthPx(p,74),watermarkWidth=contractWatermarkWidthPx(p,430);return '<article class="contract-paper-page '+(first?'first-page':'watermark-page')+'" data-page="'+pageNo+'">'+(first?'<img data-contract-presentation-logo class="contract-first-logo logo-'+align+'" style="width:'+logoWidth+'px" src="'+logo+'" alt="Logotipo">':'<div class="contract-page-watermark"><img data-contract-watermark-logo style="width:'+watermarkWidth+'px" src="'+watermark+'" alt=""></div>')+(first?'<header class="contract-paper-header"><h2>'+e(String(p.title||'').toUpperCase())+'</h2>'+(p.plaza_line?'<div class="contract-paper-role">'+e(p.plaza_line)+'</div>':'')+(p.date_line?'<div class="contract-paper-date">'+e(p.date_line)+'</div>':'')+'</header>':'')+'<div class="contract-page-content"></div><footer class="contract-paper-footer">'+e(company)+' · '+e(p.title||doc.title||'Documento contractual')+' · Página '+pageNo+'</footer></article>'}
function contractPresentation(doc){return {...contractPresentationDefaults(doc),...(doc?.presentation&&typeof doc.presentation==='object'?doc.presentation:{})}}
function contractPresentationDefaults(doc){return {title:String(doc?.title||'Contrato'),plaza_line:'PLAZA: '+String(role?.title||'').toUpperCase(),date_line:'En La Habana, a ____ de __________ de ______.',logo_path:'',logo_align:'right',logo_size:100,watermark_use_same:true,watermark_path:'',watermark_size:100}}
function contractPresentationLogoSrc(doc){const p=contractPresentation(doc),path=String(p.logo_path||'');return path?(contractLogoUrls[path]||'/assets/cartel-studio-lettering-black.svg'):'/assets/cartel-studio-lettering-black.svg'}
function contractWatermarkLogoSrc(doc){const p=contractPresentation(doc);if(contractWatermarkUsesSame(p))return contractPresentationLogoSrc(doc);const path=String(p.watermark_path||'');return path?(contractLogoUrls[path]||'/assets/cartel-studio-lettering-black.svg'):'/assets/cartel-studio-lettering-black.svg'}
function contractWatermarkUsesSame(p){return p?.watermark_use_same!==false}
function contractLogoAlignValue(p){const v=String(p?.logo_align||'right');return ['left','center','right'].includes(v)?v:'right'}
function contractLogoWidthPx(p,base){return Math.round(base*contractLogoSizeValue(p)/100)}
function contractLogoSizeValue(p){const n=Number(p?.logo_size||100);return Math.max(50,Math.min(180,Number.isFinite(n)?n:100))}
function contractWatermarkWidthPx(p,base){return Math.round(base*contractWatermarkSizeValue(p)/100)}
function contractWatermarkSizeValue(p){const n=Number(p?.watermark_size||100);return Math.max(50,Math.min(180,Number.isFinite(n)?n:100))}
function contractPreviewUnits(doc){
 doc=cleanTrialClosureTemplate(doc);
 const blocks=doc.blocks.filter(x=>x.included!==false),preamble=[],body=[];
 blocks.forEach((b,i)=>(contractPreviewIsPreamble(b,i)?preamble:body).push(b));
 const units=[];
 preamble.forEach(b=>units.push('<div class="contract-paper-preamble">'+contractPreviewTextHtml(contractPreviewSourceText(b))+'</div>'));
 if(preamble.length&&body.length)units.push('<p class="contract-paper-agreement">'+e(contractAgreementText(doc))+'</p>');
 body.forEach(b=>units.push('<section class="contract-paper-clause"><h3>'+e(contractEffectiveHeading(doc,b))+'</h3>'+contractPreviewTextHtml(contractPreviewSourceText(b))+'</section>'));
 return units
}
function contractPreviewIsPreamble(block,index){if(index>2)return false;const t=String(block.title||'').toLowerCase();return block.source==='company'||block.source==='candidate'||t.includes('identificación de las partes')||t.includes('identificación del trabajador')||t.includes('identificación del candidato')||t.includes('encabezado')}
function contractPreviewTextHtml(text){
 const clean=String(text||'').trim();if(!clean)return '<p class="contract-paper-missing">_______________________________________________</p>';
 if(clean.includes('[[SUBCLAUSE]]')){
   const parsed=contractParseSpecificStructuredText(clean);
   return (parsed.intro?'<p>'+e(parsed.intro)+'</p>':'')+parsed.items.map(x=>'<div class="contract-paper-subclause"><h4>'+e(x.title)+'</h4><p>'+e(x.text).replace(/\n/g,'<br>')+'</p></div>').join('')
 }
 const parts=clean.split(/\n{2,}/).map(x=>x.trim()).filter(Boolean);
 return parts.map(part=>{
   const lines=part.split(/\n+/).map(x=>x.trim()).filter(Boolean);
   if(lines.some(x=>/^_{8,}$/.test(x))){
     let out='',buffer=[],fillCount=0;
     const flush=()=>{if(buffer.length){out+='<p>'+buffer.map(e).join('<br>')+'</p>';buffer=[]}};
     lines.forEach(line=>{if(/^_{8,}$/.test(line)){flush();fillCount+=1;out+='<div class="contract-fill-line" aria-hidden="true"></div>'}else buffer.push(line)});
     flush();
     return '<div class="contract-fill-block">'+out+'</div>'
   }
   if(lines.length>1&&lines.every(x=>/^[-•*]|^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+:/.test(x)))return '<div class="contract-paper-lines">'+lines.map(x=>'<div>'+e(x)+'</div>').join('')+'</div>';
   return '<p>'+e(part).replace(/\n/g,'<br>')+'</p>'
 }).join('')
}
function contractParseSpecificStructuredText(text){
 const raw=String(text||'').trim(),parts=raw.split(/\n{2,}/).map(x=>x.trim()).filter(Boolean);
 let intro='',items=[];
 for(const part of parts){
   if(part.startsWith('[[SUBCLAUSE]]')){
     const body=part.slice('[[SUBCLAUSE]]'.length),lines=body.split(/\n/),title=(lines.shift()||'').trim(),content=lines.join('\n').trim();
     items.push({title,text:content})
   }else if(!intro)intro=part;
   else{
     const m=part.match(/^([^:\n]{2,120}):\s*([\s\S]+)$/);
     if(m)items.push({title:m[1].trim(),text:m[2].trim()});else intro+=(intro?'\n\n':'')+part
   }
 }
 return {intro:intro||'EL TRABAJADOR desarrollará las funciones y responsabilidades propias de la plaza, entre ellas las siguientes:',items}
}
function contractPreviewSourceText(block){return contractEffectiveRenderedText(block)}
function contractAgreementText(doc){return String(doc?.agreement_text||'Ambas partes acuerdan celebrar el presente documento bajo las siguientes cláusulas:')}
function contractEffectiveHeading(doc,block){return contractDefaultHeading(doc,block)}
function contractDefaultHeading(doc,block){
 const pos=contractBodyPosition(doc,block);
 return pos>=0?contractOrdinal(pos+1)+' – '+contractHeadingTitle(block):contractHeadingTitle(block)
}
function contractBodyPosition(doc,block){
 if(!doc||!block)return -1;
 const blocks=doc.blocks.filter(x=>x.included!==false||x.id===block.id),body=[];
 blocks.forEach((b,i)=>{if(!contractPreviewIsPreamble(b,i))body.push(b)});
 return body.findIndex(x=>x.id===block.id)
}
function contractOrdinal(n){return ['PRIMERA','SEGUNDA','TERCERA','CUARTA','QUINTA','SEXTA','SÉPTIMA','OCTAVA','NOVENA','DÉCIMA','DÉCIMA PRIMERA','DÉCIMA SEGUNDA','DÉCIMA TERCERA','DÉCIMA CUARTA','DÉCIMA QUINTA','DÉCIMA SEXTA','DÉCIMA SÉPTIMA','DÉCIMA OCTAVA','DÉCIMA NOVENA','VIGÉSIMA','VIGÉSIMA PRIMERA','VIGÉSIMA SEGUNDA','VIGÉSIMA TERCERA','VIGÉSIMA CUARTA','VIGÉSIMA QUINTA','VIGÉSIMA SEXTA','VIGÉSIMA SÉPTIMA','VIGÉSIMA OCTAVA','VIGÉSIMA NOVENA','TRIGÉSIMA'][n-1]||('CLÁUSULA '+n)}
function contractHeadingTitle(block){
 const custom=String(block?.heading_title_override||'').trim();
 if(custom)return custom;
 const legacy=String(block?.heading_override||'').trim();
 if(legacy){const parts=legacy.split(/\s+[–-]\s+/);if(parts.length>1)return parts.slice(1).join(' – ').trim()}
 return String(block?.title||'Cláusula')
}
function contractIncludedAnnexes(doc){return contractAnnexes(doc).filter(x=>x.included!==false)}
function contractAnnexes(doc){return Array.isArray(doc?.annexes)?doc.annexes:[]}
function contractAnnexFields(annex){return Array.isArray(annex?.fields)?annex.fields:contractWorkerDataDefaults()}
function contractWorkerDataDefaults(){return [
 {id:'full_name',label:'Nombre y Apellidos',type:'field'},
 {id:'ci',label:'CI',type:'field'},
 {id:'birth_date',label:'Fecha de nacimiento',type:'field'},
 {id:'address',label:'Dirección actual',type:'field'},
 {id:'municipality',label:'Municipio de Residencia',type:'field'},
 {id:'phone_fixed',label:'Teléfono Fijo',type:'field'},
 {id:'cell',label:'Celular',type:'field'},
 {id:'email',label:'Correo Electrónico',type:'field'},
 {id:'emergency_name',label:'Nombre contacto emergencia',type:'field'},
 {id:'emergency_relation',label:'Relación con el trabajador',type:'field'},
 {id:'emergency_phone',label:'Teléfono de contacto',type:'field'},
 {id:'emergency_address',label:'Dirección',type:'field'},
 {id:'banking_section',label:'Datos bancarios (si aplica para pago por transferencia)',type:'section'},
 {id:'bank_name',label:'Nombre del Banco',type:'field'},
 {id:'bank_account',label:'Número de cuenta',type:'field'},
 {id:'bank_holder',label:'Titular de Cuenta',type:'field'},
 {id:'allergies',label:'Alergias',type:'field'},
 {id:'observations',label:'Observaciones',type:'field'}
]}
function contractAnnexPreviewHtml(doc,annex,index){
 const label='Anexo '+(index+1),title=e(annex.title||'Anexo');
 if(annex.type==='identity_copy')return '<div class="contract-annex-page contract-annex-identity"><div class="contract-annex-label">'+e(label)+'</div><div class="contract-annex-box"><div class="contract-annex-box-title">FOTOCOPIA DEL CARNÉ DE IDENTIDAD</div><div class="contract-annex-id-space">ESPACIO PARA FOTOCOPIA DEL CARNÉ DE IDENTIDAD</div></div></div>';
 const fields=contractAnnexFields(annex);
 if(annex.type==='transport_photos')return '<div class="contract-annex-page contract-transport-photos"><div class="contract-annex-label">'+e(label)+'</div><h3>'+title+'</h3><div class="transport-photo-grid">'+fields.filter(f=>f.type!=='section').map(f=>'<div class="transport-photo-slot"><b>'+e(f.label)+'</b><span>ESPACIO PARA FOTOGRAFÍA</span></div>').join('')+'</div></div>';
 return '<div class="contract-annex-page"><div class="contract-annex-label">'+e(label)+'</div><table class="contract-annex-table"><thead><tr><th colspan="2">'+title+'</th></tr></thead><tbody>'+fields.map(f=>f.type==='section'?'<tr class="section"><th colspan="2">'+e(f.label)+'</th></tr>':'<tr><th>'+e(f.label)+'</th><td>&nbsp;</td></tr>').join('')+'</tbody></table></div>'
}
return {build:buildContractPreviewPages,normalize:normalizeEmploymentPolicyBlocks,candidateText:contractCandidateTemplateText,text:contractEffectiveRenderedText};
}
