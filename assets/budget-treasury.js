(()=>{'use strict';
 const el=(tag,t='',cls='')=>{const n=document.createElement(tag);n.textContent=t;if(cls)n.className=cls;return n;};
 const money=(v,c)=>new Intl.NumberFormat('es-CU',{style:'currency',currency:c,currencyDisplay:'code'}).format(Number(v));
 const names={fixed:'Gastos fijos',investment:'Inversiones',supplies:'Insumos',stimulus:'Estímulo',profit:'Utilidad',surplus:'Remanentes'};
 function field(label,input){const l=el('label',label);l.append(input);return l;}
 function options(items){const s=el('select');for(const [v,t] of items){const o=el('option',t);o.value=v;s.append(o);}return s;}
 function approval(request,totals){
  const panel=el('section','','confirmation-section treasury-budget-funding'),fund=options([['','Seleccionar fondo'],...Object.entries(names)]),currency=options([['USD','USD'],['CUP','CUP']]),rate=el('input');
  fund.options[0].disabled=true;fund.required=true;rate.type='number';rate.min='0.01';rate.max='1000000';rate.step='any';rate.value=request.details?.exchange_rate||'';rate.required=true;
  const fields=el('div','','funding-fields'),choices=el('div','','funding-currencies'),preview=el('div','','funding-preview'),notice=el('p','','funding-notice');
  notice.setAttribute('role','status');
  const currencyLabel=el('div','','funding-currency-label');currencyLabel.append(el('span','Moneda de entrega'));currency.hidden=true;
  for(const code of ['USD','CUP']){const choice=el('button',code);choice.type='button';choice.onclick=()=>{currency.value=code;update();};choices.append(choice);}
  currencyLabel.append(currency,choices);
  fields.append(field('Fondo de origen',fund),currencyLabel,field('Tasa · 1 USD = CUP',rate));
  panel.append(el('h3','Origen del presupuesto'),fields,preview,notice);
  let balances=null;
  function tile(label,usd,cup,tone){const box=el('div','','funding-tile '+tone);box.append(el('small',label),el('strong',money(usd,'USD')),el('span','('+money(cup,'CUP')+')'));return box;}
  function calculate(){
   const c=currency.value,r=Number(rate.value),t=totals(request),f=balances?.find(x=>x.code===fund.value);
   if(!(r>0&&r<=1000000))return null;
   const amount=Math.round((c==='USD'?Number(t.USD||0)+Number(t.CUP||0)/r:Number(t.CUP||0)+Number(t.USD||0)*r)*100)/100;
   const reserveUSD=c==='USD'?amount:amount/r,reserveCUP=c==='CUP'?amount:amount*r;
   const currentCUP=f?Number(f.available_CUP)+Number(f.available_USD)*r:null;
   if(!Number.isFinite(amount)||amount<=0||f&&!Number.isFinite(currentCUP))return null;
   return {r,c,amount,reserveUSD,reserveCUP,currentCUP,afterCUP:currentCUP===null?null:currentCUP-reserveCUP};
  }
  function update(){
   Array.from(choices.children).forEach((choice,i)=>choice.setAttribute('aria-pressed',String(currency.value===['USD','CUP'][i])));
   preview.replaceChildren();const info=calculate();
   if(!info){notice.textContent='Introduce una tasa de cambio válida.';return;}
   const {r,c,amount,reserveUSD,reserveCUP,currentCUP,afterCUP}=info;
   preview.append(tile('Disponible actual',currentCUP===null?0:currentCUP/r,currentCUP??0,currentCUP<0?'negative':''));
   if(currentCUP===null){preview.firstChild.replaceChildren(el('small','Disponible actual'),el('strong','—'));}
   preview.append(tile('Reserva a realizar',reserveUSD,reserveCUP,'reservation'));
   preview.append(tile('Disponible tras reserva',afterCUP===null?0:afterCUP/r,afterCUP??0,afterCUP<0?'negative':'positive'));
   if(afterCUP===null){preview.lastChild.replaceChildren(el('small','Disponible tras reserva'),el('strong','—'));}
   notice.classList.toggle('negative',afterCUP!==null&&afterCUP<0);
   notice.textContent=!fund.value?'Selecciona el fondo de origen.':currentCUP===null?'Consultando saldo del fondo…':afterCUP<0?(fund.value==='investment'?'Inversiones quedará con capital pendiente de recuperar.':'Saldo disponible total insuficiente para reservar este presupuesto.'):'Entrega prevista · '+money(amount,c);
  }
  for(const n of [fund,currency,rate])n.addEventListener('input',update);update();
  return {panel,setBalances(rows){balances=rows;update();},values(){const info=calculate();if(!fund.value||!info)throw Error('Selecciona fondo, moneda y tasa.');if(info.currentCUP===null)throw Error('Espera a que se consulte el saldo del fondo.');if(info.afterCUP<0&&fund.value!=='investment')throw Error('Saldo disponible total insuficiente');return {p_fund:fund.value,p_currency:currency.value,p_rate:info.r};}};
 }
 async function photoData(file){if(!file||!file.type.startsWith('image/'))throw Error('Selecciona una fotografía.');const image=await createImageBitmap(file),scale=Math.min(1,1280/Math.max(image.width,image.height)),c=document.createElement('canvas');c.width=Math.round(image.width*scale);c.height=Math.round(image.height*scale);c.getContext('2d').drawImage(image,0,0,c.width,c.height);image.close();return c.toDataURL('image/jpeg',.8);}
 function delivery({request,reservation,rpc,run,refresh}){
  const panel=el('section','','confirmation-section treasury-budget-delivery');panel.append(el('h3',reservation.status==='delivered'?'Recibido confirmado':'Presupuesto reservado'),el('p',(names[reservation.fund]||reservation.fund)+' · '+money(reservation.amount,reservation.currency)));
  if(reservation.status==='delivered'){
   panel.append(el('p','Entrega confirmada · '+new Date(reservation.delivered_at).toLocaleString('es-CU')));
   const evidence=el('button','Ver firma y fotografía','secondary');evidence.type='button';evidence.onclick=()=>run(async()=>{const data=await rpc('treasury_budget_evidence',{p_id:request.id});if(!data)throw Error('No hay evidencia disponible.');const box=el('div','','treasury-evidence');for(const [key,label] of [['signature','Firma'],['photo','Fotografía']]){const value=data[key];if(!value||!/^data:image\/(png|jpeg);base64,/.test(value))continue;const img=el('img');img.alt=label;img.src=value;box.append(el('h4',label),img);}panel.append(box);evidence.disabled=true;});panel.append(evidence);return panel;
  }
  if(!request.canReceive){panel.append(el('p','Pendiente de firma y fotografía del solicitante.'));return panel;}
  panel.append(el('p','Confirma únicamente después de recibir el dinero.'));
  const canvas=el('canvas');canvas.width=640;canvas.height=200;canvas.className='treasury-signature';canvas.setAttribute('aria-label','Firma del solicitante');const ctx=canvas.getContext('2d');ctx.lineWidth=3;ctx.lineCap='round';ctx.strokeStyle='#15202b';let drawing=false,signed=false,point=null;
  function pos(e){const r=canvas.getBoundingClientRect();return[(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height];}
  canvas.onpointerdown=e=>{drawing=true;point=pos(e);canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!drawing)return;const next=pos(e);ctx.beginPath();ctx.moveTo(...point);ctx.lineTo(...next);ctx.stroke();if(Math.hypot(next[0]-point[0],next[1]-point[1])>1)signed=true;point=next;};canvas.onpointerup=canvas.onpointercancel=()=>drawing=false;
  const clear=el('button','Limpiar firma','secondary');clear.type='button';clear.onclick=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);signed=false;};
  const photo=el('input');photo.type='file';photo.accept='image/*';photo.setAttribute('capture','environment');
  const confirm=el('button','Confirmar recepción','success');confirm.type='button';confirm.onclick=()=>run(async()=>{if(!signed||!photo.files[0])throw Error('Se necesita la firma y una fotografía de la entrega.');confirm.disabled=true;try{await rpc('treasury_deliver_budget',{p_id:request.id,p_signature:canvas.toDataURL('image/png'),p_photo:await photoData(photo.files[0])});await refresh();}finally{confirm.disabled=false;}});
  panel.append(field('Firma',canvas),clear,field('Fotografía de la entrega',photo),confirm);return panel;
 }
 window.CartelBudgetTreasury={approval,delivery};
})();
