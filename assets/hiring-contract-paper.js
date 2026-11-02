// Data binding only: contractual prose and layout come from contract-paper.js.
async function renderHiringContractPaper(root,result){
 await Promise.all(['contract-paper.css','hiring-contract-paper.css'].map(file=>new Promise((resolve,reject)=>{if([...document.styleSheets].some(s=>s.href?.includes('/assets/'+file)))return resolve();const link=document.createElement('link');link.rel='stylesheet';link.href='/assets/'+file+'?v=20261102-2';link.onload=resolve;link.onerror=()=>reject(Error('No se pudo cargar el formato contractual.'));document.head.append(link);})));
 const snapshot=result.contract,doc=structuredClone(snapshot.template),d=result.data||{};
 if(!Array.isArray(doc?.blocks)||!doc.blocks.length)throw Error('No está disponible la plantilla contractual de esta plaza.');
 const logos={...(snapshot.logos||{})};
 const token=new URLSearchParams(location.hash.slice(1)).get('token');
 const client=CartelLoad.createClient('https://jhumvctocphyiwhszeaz.supabase.co','sb_publishable_ZHV-5dlsjfamQpfUOsgumg_G-vN84Gn',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{'x-hiring-token':token}}});
 // Resolve private presentation assets through token-scoped server responses only.
 for(const key of ['logo_path','watermark_path']){
  const path=doc.presentation?.[key];
  if(path&&!logos[path]){
   const {data,error}=await client.storage.from('hr-role-documents').download(path);
   if(error||!data)throw Error('No está disponible el logotipo de esta versión del contrato.');
   logos[path]=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(data);});
  }
 }
 const paper=createContractPaper(snapshot.role,snapshot.nomenclators||[],{logos});
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
 const article=document.getElementById('contractArticle');
 // Load images and fonts before measuring so every viewport uses the same canvas.
 await document.fonts.ready;
 await Promise.all(Object.values(logos).concat('/assets/cartel-studio-lettering-black.svg').map(src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=()=>reject(Error('No se pudo cargar la presentación contractual.'));img.src=src;})));
 paper.build(doc,article);
 const aliases={ci:'identity_number',cell:'mobile',phone_fixed:'fixed_phone'};
 (doc.annexes||[]).filter(a=>a.included!==false).forEach((annex,i)=>{
  if(annex.type!=='worker_data')return;
  const table=article.querySelectorAll('.contract-annex-page')[i]?.querySelector('tbody');
  if(!table)return;
  const fields=annex.fields||[];
  [...table.rows].forEach((row,j)=>{if(fields[j]?.type!=='section'&&row.cells[1])row.cells[1].textContent=d[aliases[fields[j]?.id]||fields[j]?.id]||'\u00a0';});
 });
 const pages=[...article.querySelectorAll('.contract-paper-page')];
 if(pages.some(p=>{const c=p.querySelector('.contract-page-content');return c.scrollHeight>c.clientHeight+2;}))throw Error('El contenido excede una página de la plantilla. Solicita revisión antes de firmar.');
 const fit=()=>{const width=article.parentElement.clientWidth,scale=Math.min(1,width/816);article.style.zoom=scale;};fit();window.addEventListener('resize',fit);
 const print=document.getElementById('contractPrint'),download=document.getElementById('contractDownload');print.disabled=download.disabled=false;
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
