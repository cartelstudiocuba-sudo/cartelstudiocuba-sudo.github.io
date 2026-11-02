// Source resolvers extracted verbatim from plaza-ficha.html; tested for parity.
function renderHiringContract(root,result){
 const role=result.contract.role,n=result.contract.nomenclators||[];
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
function contractSpecificStructuredText(items){
 const intro='EL TRABAJADOR desarrollará las funciones y responsabilidades propias de la plaza, entre ellas las siguientes:';
 return [intro,...items.map(x=>'[[SUBCLAUSE]]'+String(x.title||'').trim()+'\n'+String(x.text||'').trim())].join('\n\n')
}
function contractDisciplineStructuredText(items){
 const intro='EL TRABAJADOR estará sujeto al régimen disciplinario aplicable a la plaza y deberá observar las siguientes disposiciones durante el desarrollo de sus funciones:';
 return [intro,...items.map(x=>'[[SUBCLAUSE]]'+String(x.label||x.title||'').trim()+'\n'+String(x.value||x.text||'').trim())].join('\n\n')
}
function contractBaseRenderedText(block){if(!block)return '';if(block.source==='custom')return String(block.text||'');if(block.source==='candidate')return contractCandidateTemplateText(block);if(block.source==='specific')return contractSpecificStructuredText(specificWorkItems());if(block.source==='discipline')return contractDisciplineStructuredText(appliedDiscipline());if(String(block.source).startsWith('policy:')){const p=agencyPolicies.find(x=>x.id===String(block.source).slice(7));return p?.value||''}if(String(block.source).startsWith('clause:')){const p=agencyContractClauses.find(x=>x.id===String(block.source).slice(7));return p?.value||''}return contractInheritedContent(block.source,{...block,use_override:false})||''}
function contractEffectiveRenderedText(block){if(!block)return '';if(block.source==='custom')return String(block.text||'');return block.use_override?String(block.override_text||''):contractBaseRenderedText(block)}
function contractPolicyByKey(key){return agencyPolicies.find(x=>x.key===key)||null}
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
 const d=result.data||{},template=result.contract.template;normalizeEmploymentPolicyBlocks(template);
 const candidateText=b=>/firma|disposiciones|conformidad|aceptación/i.test(b.title||'')
 ?'Por EL EMPLEADOR:\nNombre: ________________________________________________\nCI: ______________________________\nCargo: ______________________________\nFirma: ______________________________\n\nPor EL TRABAJADOR:\nNombre: '+(d.full_name||'________________')+'\nCI: '+(d.identity_number||'________________')+'\nFirma: ______________________________\nFecha: ____ / ____ / ________'
 :'Y DE LA OTRA PARTE, '+(d.full_name||'________________')+', con número de identidad '+(d.identity_number||'________________')+' y domicilio en '+(d.address||'________________')+', a quien en lo sucesivo se le denominará EL TRABAJADOR.';
 const blocks=template.blocks.filter(b=>b.included!==false).map(b=>({title:b.heading_title_override||b.title,text:b.use_override?String(b.override_text||''):b.source==='candidate'?candidateText(b):contractEffectiveRenderedText(b)}));
 if(template.agreement_text)blocks.splice(Math.min(2,blocks.length),0,{title:'',text:String(template.agreement_text)});
 const aliases={ci:'identity_number',cell:'mobile',phone_fixed:'fixed_phone',birth_date:'birth_date',emergency_address:'alternative_address'};
 for(const annex of (template.annexes||[]).filter(a=>a.included!==false)){
  const text=annex.type==='worker_data'?(annex.fields||[]).map(f=>f.type==='section'?f.label:f.label+': '+(d[aliases[f.id]||f.id]||'______________________________')).join('\n'):annex.type==='identity_copy'?'Anverso del CI: documento privado adjunto al expediente.\nReverso del CI: documento privado adjunto al expediente.':String(annex.text||'');
  blocks.push({title:annex.title,text});
 }
 const title=template.presentation?.title||template.title||'Contrato laboral';
 root.innerHTML='<div class="buttons contract-tools"><button id="contractPrint">Imprimir</button><button id="contractDownload">Descargar</button></div><article id="contractArticle"><div class="brand">EL CARTEL STUDIO</div><h1>'+hiringEsc(title)+'</h1><p>'+hiringEsc(template.presentation?.plaza_line||role.title)+'</p><p>'+hiringEsc(template.presentation?.date_line||'')+'</p>'+blocks.map(b=>'<section><h2>'+hiringEsc(b.title)+'</h2><p class="contract-text">'+hiringEsc(b.text).replace(/\[\[SUBCLAUSE\]\]/g,'')+'</p></section>').join('')+'</article><p id="contractError" role="alert"></p>';
 document.getElementById('contractPrint').onclick=()=>window.print();
 document.getElementById('contractDownload').onclick=()=>{try{
  if(!window.jspdf?.jsPDF)throw Error('No se pudo cargar el generador PDF. Usa Imprimir y Guardar como PDF, o vuelve a intentar.');
  const pdf=new window.jspdf.jsPDF({unit:'mm',format:'letter'});let y=22;
  const write=(text,size=11,bold=false)=>{pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);const lines=pdf.splitTextToSize(String(text).replace(/\[\[SUBCLAUSE\]\]/g,''),173);for(const line of lines){if(y>255){pdf.addPage();y=22;}pdf.text(line,21,y);y+=size*.45;}y+=4;};
  write('EL CARTEL STUDIO',11,true);write(title,17,true);write(template.presentation?.plaza_line||role.title);write(template.presentation?.date_line||'');for(const b of blocks){write(b.title,12,true);write(b.text);}pdf.save('Contrato laboral - '+String(d.full_name||'Trabajador').replace(/[^\p{L}\p{N} _-]/gu,'')+'.pdf');
 }catch(e){document.getElementById('contractError').textContent=e.message;}};
}
