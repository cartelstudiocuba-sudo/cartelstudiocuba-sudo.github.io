/* Carta layout shared by the role sheet and the public capability view. */
// Compare in Carta layout pixels, independently of preview scaling.
// Pagination reserves 30px; verification requires 28px, allowing fractional rounding.
function roleContentPageOverflows(content, clearance=28) {
 const page=content?.closest('.contract-paper-page'),footer=page?.querySelector('.contract-paper-footer'),last=content?.lastElementChild;
 if(!page||!footer||!last)return false;
 // Older engines may retain a scroll offset on an overflow:hidden paper.
 page.scrollTop=0;
 const scale=page.getBoundingClientRect().height/page.offsetHeight;
 if(!Number.isFinite(scale)||scale<=0)throw Error('No se pudo medir el documento. Vuelve a intentarlo.');
 return (last.getBoundingClientRect().bottom-footer.getBoundingClientRect().top)/scale > -clearance;
}
function appendRoleContentPiece(node, getContent, addPage, overflows) {
 let content=getContent(); content.append(node);
 if(!overflows())return;
 node.remove();
 if(content.children.length)content=addPage();
 content.append(node);
 while(overflows()){
  const source=node.cloneNode(true),walker=document.createTreeWalker(source,NodeFilter.SHOW_TEXT),texts=[];
  while(walker.nextNode())texts.push(walker.currentNode);
  const total=texts.reduce((n,t)=>n+t.length,0);
  const fragment=(start,end)=>{
   const locate=offset=>{for(const t of texts){if(offset<=t.length)return [t,offset];offset-=t.length;}return [source,source.childNodes.length];};
   const range=document.createRange(),a=locate(start),b=locate(end);
   range.setStart(...a);range.setEnd(...b);const part=source.cloneNode(false);part.append(range.cloneContents());return part;
  };
  let lo=0,hi=total;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);node.replaceChildren(...fragment(0,mid).childNodes);if(overflows())hi=mid-1;else lo=mid;}
  if(!lo)throw Error('No se pudo ajustar un bloque del contenido a la página.');
  // Prefer a paragraph/line boundary, then a word; a long unbroken word still advances.
  const text=source.textContent,prefix=text.slice(0,lo);
  const line=prefix.lastIndexOf('\n'),word=prefix.search(/\s+\S*$/u);
  let cut=line>lo/2?line+1:word>lo/2?word+1:lo;
  // Never divide a UTF-16 surrogate pair between pages.
  if(cut<total&&/[\uD800-\uDBFF]/u.test(text[cut-1])&&/[\uDC00-\uDFFF]/u.test(text[cut]))cut--;
  if(!cut)throw Error('No se pudo dividir el bloque del documento.');
  node.replaceChildren(...fragment(0,cut).childNodes);
  if(overflows())throw Error('El contenido excede el área imprimible.');
  const rest=fragment(cut,total);content=addPage();node=rest;content.append(node);
 }
}
function roleContentWarnings(){
 const warnings=[];
 for(const [key,label] of [['title','Nombre'],['description','Descripción'],['area','Área'],['direct_manager','Subordinación'],['work_days','Días'],['schedule','Horario'],['compensation','Salario']])
  if(!String(role[key]??'').trim())warnings.push(label+': sin completar en la ficha.');
 const wc=role.work_content||{};
 const visit=(value,path)=>{
  if(typeof value==='string'&&/por definir|pendiente|completar|texto de ejemplo|orientativo/i.test(value))warnings.push(path+': revisar texto orientativo.');
  else if(Array.isArray(value))value.forEach((v,i)=>visit(v,path+' '+(i+1)));
  else if(value&&typeof value==='object')Object.entries(value).forEach(([k,v])=>visit(v,path+' / '+k));
 };
 visit(wc,'Contenido');
 for(const key of ['title','description','area','direct_manager','work_days','schedule','compensation'])visit(role[key],key);
 (wc.protocol_blocks||[]).forEach((p,i)=>{if(!String(p.objective||'').trim()||!(p.steps||[]).some(s=>String(s).trim()))warnings.push('Protocolo '+(i+1)+': contenido incompleto.');});
 (evaluationMaster().criteria||[]).forEach((c,i)=>{if(Number(c.weight||0)===0)warnings.push('Indicador '+(i+1)+': ponderación 0%.');});
 return [...new Set(warnings)];
}
function showRoleContentWarnings(box){
 if(document.documentElement.classList.contains('training-public'))return;
 const notes=roleContentWarnings();if(!notes.length)return;
 const details=document.createElement('details'),summary=document.createElement('summary');
 details.className='role-content-warnings';summary.textContent='Revisión interna de la ficha: '+notes.length+' avisos (no bloquean el PDF)';
 details.append(summary);const list=document.createElement('ul');
 notes.forEach(note=>{const li=document.createElement('li');li.textContent=note;list.append(li);});details.append(list);box.prepend(details);
}
function verifyRoleContentPages(pages,expected){
 const contents=[...pages.querySelectorAll('.doc-info-content')];
 if(contents.map(c=>c.textContent).join('')!==expected)throw Error('No se pudo verificar la integridad del contenido. Vuelve a generar el documento.');
 for(const content of contents){
  if(roleContentPageOverflows(content))throw Error('El contenido excede el área imprimible. Vuelve a generar el documento.');
 }
 pages.dataset.integrity='verified';
}
