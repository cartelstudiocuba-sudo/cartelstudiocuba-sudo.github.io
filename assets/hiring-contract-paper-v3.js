// Data binding only: contractual prose and layout come from contract-paper.js.
const hiringContractIdentitySides={front:'Anverso del carné de identidad',back:'Reverso del carné de identidad'};
const hiringContractFieldAliases={ci:'identity_number',cell:'mobile',phone_fixed:'fixed_phone'};
const hiringContractFieldLabels={
 full_name:'Nombre completo',identity_number:'Número de CI',address:'Dirección particular',
 birth_date:'Fecha de nacimiento',municipality:'Municipio',mobile:'Teléfono móvil',email:'Correo electrónico',
 emergency_name:'Nombre del contacto de emergencia',emergency_relation:'Parentesco con el contacto de emergencia',
 emergency_phone:'Teléfono de emergencia',emergency_address:'Dirección del contacto de emergencia'
};
function hiringContractFieldValue(field,data,role){
 const key=hiringContractFieldAliases[field.id]||field.id;
 const value=String(data[key]??'').trim();
 if(['bank_name','bank_account','bank_holder'].includes(key)){
  return /efectivo/i.test(role.payment_method||'')&&!/transferencia/i.test(role.payment_method)
   ?'No aplica · Pago en efectivo':'Por confirmar con RRHH';
 }
 if(key==='allergies')return 'Información reservada a RRHH';
 if(key==='observations')return 'Sin observaciones';
 if(key==='fixed_phone')return value||'No declarado';
 return value||'Pendiente';
}
function hiringContractCheck(doc,paper,result){
 const annexes=(doc.annexes||[]).filter(annex=>annex.included!==false);
 const fields=annexes.filter(annex=>annex.type==='worker_data').flatMap(paper.workerFields)
  .filter(field=>field.type!=='section');
 const required=new Set(['full_name','identity_number','address']);
 const configuration=new Set();
 for(const field of fields){
  const key=hiringContractFieldAliases[field.id]||field.id;
  if(Object.hasOwn(hiringContractFieldLabels,key)){required.add(key);continue;}
  if(!['fixed_phone','bank_name','bank_account','bank_holder','allergies','observations'].includes(key)){
   configuration.add(field.label||'Campo adicional del anexo');
  }
 }
 for(const annex of annexes){
  if(!['worker_data','identity_copy'].includes(annex.type))configuration.add(annex.title||'Anexo adicional');
 }
 const data=result.data||{};
 const present=key=>{
  const value=String(data[key]??'').trim();
  if(key==='identity_number')return /^\d{11}$/.test(value);
  if(key==='birth_date'){
   const date=new Date(value);
   return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(+date)&&date.toISOString().slice(0,10)===value&&value>='1900-01-01'&&date<=new Date();
  }
  if(key==='email')return /^[^ @]+@[^ @]+\.[^ @]+$/.test(value);
  if(key==='mobile'||key==='emergency_phone')return /^\+?[0-9 ()-]{8,24}$/.test(value);
  return value.length>=2;
 };
 const missing=[...required].filter(key=>!present(key)).map(key=>hiringContractFieldLabels[key]);
 const identityAnnex=annexes.some(annex=>annex.type==='identity_copy');
 if(identityAnnex)for(const [key,label] of Object.entries(hiringContractIdentitySides)){
  if(!result.identity_images?.[key])missing.push(label);
 }
 return {missing,configuration:[...configuration],identityAnnex};
}
function hiringContractPending(root,missing,configuration,result){
 const panel=document.createElement('aside');
 panel.className='hiring-contract-pending';
 const title=document.createElement('h1');
 title.textContent='Contrato pendiente de completar';
 panel.append(title);
 if(missing.length){
  const text=document.createElement('p'),list=document.createElement('ul');
  text.textContent='Falta completar estos datos o documentos para imprimir o descargar el contrato.';
  for(const label of missing){const item=document.createElement('li');item.textContent=label;list.append(item);}
  panel.append(text,list);
  if(!result.locked){
   const link=document.createElement('a');link.className='hiring-next-link';
   link.href='/expediente-contratacion.html#token='+result.publicToken;link.textContent='Completar mi expediente';
   panel.append(link);
  }
 }
 if(configuration.length||result.locked){
  const note=document.createElement('p');
  note.textContent=configuration.length?'Solicita a RRHH revisar el anexo: '+configuration.join(', ')+'.':'Solicita a RRHH que habilite la corrección de tu expediente.';
  panel.append(note);
 }
 root.prepend(panel);
}
async function appendHiringIdentityImages(article,images,client){
 const spaces=article.querySelectorAll('.contract-annex-identity .contract-annex-id-space');
 if(!spaces.length)return;
 const figures=await Promise.all(Object.entries(hiringContractIdentitySides).map(async ([key,label])=>{
  const documentInfo=images?.[key];
  if(!documentInfo)return null;
  let {data,error}=await client.storage.from(documentInfo.bucket).download(documentInfo.path);
  if(error&&documentInfo.inherited){
   ({data,error}=await client.storage.from('hr-identity-private').download(documentInfo.inherited));
  }
  if(error||!data)throw Error('No se pudo cargar el '+label.toLowerCase()+'. Recarga la página o consulta con RRHH.');
  const url=await new Promise((resolve,reject)=>{
   const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(data);
  });
  const figure=document.createElement('figure'),image=new Image(),caption=document.createElement('figcaption');
  caption.textContent=label;
  image.alt=label;
  await new Promise((resolve,reject)=>{
   image.onload=resolve;image.onerror=()=>reject(Error('No se pudo leer la imagen del carné. Consulta con RRHH.'));image.src=url;
  });
  figure.append(caption,image);
  return figure;
 }));
 for(const space of spaces){
  if(figures.every(figure=>!figure))return;
  space.classList.add('hiring-identity-images');
  space.replaceChildren(...figures.filter(Boolean).map(figure=>figure.cloneNode(true)));
 }
}
async function renderHiringContractPaperV3(root,result){
 await Promise.all(['contract-paper.css','hiring-contract-paper-v3.css'].map(file=>new Promise((resolve,reject)=>{if([...document.styleSheets].some(s=>s.href?.includes('/assets/'+file)))return resolve();const link=document.createElement('link');link.rel='stylesheet';link.href='/assets/'+file+'?v=20261122-contract-annexes';link.onload=resolve;link.onerror=()=>reject(Error('No se pudo cargar el formato contractual.'));document.head.append(link);})));
 const snapshot=result.contract,doc=structuredClone(snapshot.template),d=result.data||{};
 if(!Array.isArray(doc?.blocks)||!doc.blocks.length)throw Error('No está disponible la plantilla contractual de esta plaza.');
 const logos={...(snapshot.logos||{})};
 const client=result.publicToken?CartelLoad.createClient(sb.supabaseUrl,sb.supabaseKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{'x-hiring-token':result.publicToken}}}):sb;
 // Resolve private presentation assets through token-scoped server responses only.
 for(const key of ['logo_path','watermark_path']){
  const path=doc.presentation?.[key];
  if(path&&!logos[path]){
   const {data,error}=await client.storage.from('hr-role-documents').download(path);
   if(error||!data)throw Error('No está disponible el logotipo de esta versión del contrato.');
   logos[path]=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(data);});
  }
 }
 const paper=createContractPaperV3(snapshot.role,snapshot.nomenclators||[],{logos});
 paper.normalize(doc);
 for(const b of doc.blocks){
  if(b.source!=='candidate')continue;
  // Fill only the original template slots; never create or replace a clause.
  const signature=/firma|disposiciones|conformidad|aceptación/i.test(b.title||'');
  const text=b.use_override?String(b.override_text||''):paper.candidateText(b);
  b.use_override=true;
  b.override_text=signature
   ?text.replace(/(Por EL TRABAJADOR:\nNombre: )_+/,(_,prefix)=>prefix+(d.full_name||'________________')).replace(/(Por EL TRABAJADOR:[\s\S]*?CI: )_+/,(_,prefix)=>prefix+(d.identity_number||'________________'))
   :text.replace(/(Y DE LA OTRA PARTE, )_+/,(_,prefix)=>prefix+(d.full_name||'________________')).replace(/(con número de identidad )_+/,(_,prefix)=>prefix+(d.identity_number||'________________')).replace(/(y domicilio en )_+/,(_,prefix)=>prefix+(d.address||'________________'));
 }
 root.innerHTML='<div class="buttons contract-tools"><button id="contractPrint" disabled>Imprimir</button><button id="contractDownload" disabled>Descargar</button></div><div class="contract-viewport"><article id="contractArticle"></article></div><p id="contractError" role="alert"></p>';
 const article=root.querySelector('#contractArticle');
 const check=result.publicToken&&!result.signed?hiringContractCheck(doc,paper,result):null;
 const blocked=check&&(check.missing.length||check.configuration.length);
 if(result.publicToken&&!result.signed)root.classList.add('hiring-contract-preview-only');
 if(blocked)hiringContractPending(root,check.missing,check.configuration,result);
 // Load images and fonts before measuring so every viewport uses the same canvas.
 await document.fonts.ready;
 await Promise.all(Object.values(logos).concat('/assets/cartel-studio-lettering-black.svg').map(src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=()=>reject(Error('No se pudo cargar la presentación contractual.'));img.src=src;})));
 paper.build(doc,article,field=>result.signed&&!snapshot.signed_identity_images
  ?d[hiringContractFieldAliases[field.id]||field.id]
  :hiringContractFieldValue(field,d,snapshot.role));
 const fit=()=>{const width=article.parentElement.clientWidth,scale=Math.min(1,width/816);article.style.zoom=scale;};
 if(result.identity_images){
  try{await appendHiringIdentityImages(article,result.identity_images,client);}
  catch(error){
   root.querySelector('#contractError').textContent=error.message;
   if(!blocked&&result.publicToken)hiringContractPending(root,[],['Fotocopia del carné de identidad'],result);
   fit();
   return;
  }
 }
 const pages=[...article.querySelectorAll('.contract-paper-page')];
 if(pages.some(p=>{const c=p.querySelector('.contract-page-content');return c.scrollHeight>c.clientHeight+2;}))throw Error('El contenido excede una página de la plantilla. Solicita revisión antes de firmar.');
 fit();window.addEventListener('resize',fit);
 if(blocked)return;
 root.classList.remove('hiring-contract-preview-only');
 const print=root.querySelector('#contractPrint'),download=root.querySelector('#contractDownload');print.disabled=download.disabled=false;
 print.onclick=()=>window.print();
 download.onclick=async()=>{
  download.disabled=true;document.getElementById('contractError').textContent='';
  try{
   if(!window.html2canvas||!window.jspdf?.jsPDF)throw Error('No se pudo cargar el generador PDF. Recarga y vuelve a intentar.');
   const pdf=new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'letter',compress:true});
   const previous=article.style.zoom;article.style.zoom=1;
   try{for(let i=0;i<pages.length;i++){if(i)pdf.addPage('letter','portrait');const canvas=await html2canvas(pages[i],{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false});pdf.addImage(canvas.toDataURL('image/jpeg',.94),'JPEG',0,0,215.9,279.4,undefined,'FAST');}}finally{article.style.zoom=previous;}
   pdf.save('Contrato laboral - '+String(d.full_name||'Trabajador').replace(/[^\p{L}\p{N} _-]/gu,'')+'.pdf');
  }catch(e){document.getElementById('contractError').textContent=e.message;}finally{download.disabled=false;}
 };
}
