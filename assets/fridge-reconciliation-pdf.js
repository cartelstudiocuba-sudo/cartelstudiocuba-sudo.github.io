/* Text-based A4 report. No screen HTML, screenshots or oversized UI icons. */
(()=>{'use strict';
function build(d,PDF){const pdf=new PDF({unit:'mm',format:'a4'}),W=182,L=14,B=279;let y=31;
const clean=x=>String(x??'').replace(/[\u0000-\u001f]/g,' ').replace(/[–—]/g,'-'),cash=(n,c='USD')=>Number(n||0).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+c;
const date=x=>x?new Intl.DateTimeFormat('es-CU',{timeZone:'America/Havana',dateStyle:'short',timeStyle:'short'}).format(new Date(x)):'-';
function header(){pdf.setFillColor(24,27,31);pdf.rect(0,0,210,23,'F');pdf.setTextColor(255,218,3);pdf.setFont('helvetica','bold');pdf.setFontSize(12);pdf.text('EL CARTEL STUDIO',L,11);pdf.setTextColor(255);pdf.setFontSize(9);pdf.text('Cuadre de nevera #'+String(d.number).padStart(3,'0'),L,18);pdf.setTextColor(28);}
function space(h){if(y+h>B){pdf.addPage();header();y=31;return true;}return false;}
function text(value,size=9,bold=false){pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);const lines=pdf.splitTextToSize(clean(value),W);for(const line of lines){space(5);pdf.text(line,L,y);y+=5;}y+=1;}
function title(t){space(18);y+=4;pdf.setFillColor(245,222,88);pdf.rect(L,y-4,W,8,'F');pdf.setFont('helvetica','bold');pdf.setFontSize(10);pdf.text(t,L+3,y+1);y+=10;}
function table(head,rows,widths){const draw=(values,heading=false)=>{pdf.setFont('helvetica',heading?'bold':'normal');pdf.setFontSize(8);const cells=values.map((v,i)=>pdf.splitTextToSize(clean(v),widths[i]-5)),h=Math.max(1,...cells.map(c=>c.length))*4+5;if(space(h)&&!heading)draw(head,true);if(heading){pdf.setFillColor(233,235,238);pdf.rect(L,y-3,W,h,'F');}let x=L;cells.forEach((lines,i)=>{pdf.text(lines,x+2,y+1);x+=widths[i];});y+=h;pdf.setDrawColor(210);pdf.line(L,y-3,L+W,y-3);};draw(head,true);if(rows.length)rows.forEach(r=>draw(r));else draw(['Sin registros',...head.slice(1).map(()=>'-')]);y+=3;}
header();text('Preparado por: '+clean(d.created_by_name));text('Enviado: '+date(d.created_at)+'   |   Corte: '+date(d.snapshot.as_of));text('Estado: '+({pending:'Pendiente de recibido',returned:'Devuelto',confirmed:'Confirmado'}[d.status]||d.status),9,true);
if(d.receipt_settlement){title('DINERO RECIBIDO Y CONFIRMADO');table(['Moneda','Recibido'],d.receipt_settlement.received_by_currency.map(t=>[t.currency,cash(t.amount,t.currency)]),[70,112]);text('Tasa de confirmación: 1 USD = '+d.receipt_settlement.rate+' CUP. Conteo de insumos confirmado.',8);}
const s=d.snapshot,totals=new Map();for(const p of s.payments||[]){const c=p.collection,cur=c?.currency||'USD',method=p.method||'cash',k=method+'|'+cur;const row=totals.get(k)||{cur,method,amount:0};row.amount+=Number(c?.amount??p.amount??0);totals.set(k,row);}if(!totals.size)for(const t of s.collection_totals||[])totals.set(t.method+'|'+t.currency,{cur:t.currency,method:t.method,amount:Number(t.amount)});if(!totals.size)for(const method of ['cash','transfer'])if(Number(s[method]))totals.set(method+'|USD',{cur:'USD',method,amount:Number(s[method])});
title('DINERO A RECIBIR');table(['Medio','Moneda','Importe original'],[...totals.values()].map(t=>[t.method==='cash'?'Efectivo':'Transferencia',t.cur,cash(t.amount,t.cur)]),[70,35,77]);
const rows=(d.status==='confirmed'?d.distribution:d.proposed_distribution)||[],group=r=>r.kind==='company'&&(r.key==='company-surplus'||r.basis==='residual')?'surplus':r.kind;
title('DISTRIBUCION DEL PRESUPUESTO');table(['Destino','Importe USD'],[['reserve','Insumos'],['commission','Comisiones'],['company','Utilidad'],['surplus','Remanentes'],['fund','Fondos y otros gastos']].filter(([k])=>rows.some(r=>group(r)===k)).map(([k,label])=>[label,cash(rows.filter(r=>group(r)===k).reduce((n,r)=>n+Number(r.amount||0),0))]),[125,57]);text('Reparto en USD calculado con las fichas de las ventas. Los cobros se reciben en las monedas indicadas arriba.',8);
if(s.cost_settlement){title('INSUMOS RECUPERADOS');table(['Producto / servicio','Cantidad','Recuperado USD'],(s.cost_settlement.products||[]).filter(p=>Number(p.recovered)>0).map(p=>[p.name,String(p.quantity),cash(p.recovered)]),[112,25,45]);}
title('COMISIONES Y OTROS CONCEPTOS');table(['Concepto','Destino','Importe USD'],rows.filter(r=>r.kind!=='reserve').map(r=>[group(r)==='surplus'?'Remanentes de venta y ajuste de centavos':r.name,({commission:'Comisiones',company:'Utilidad',surplus:'Remanentes',fund:'Fondos / gastos'}[group(r)]||r.kind),cash(r.amount)]),[100,42,40]);
title('INVENTARIO AL CORTE');table(['Producto','Unidades esperadas'],(s.stock||[]).map(p=>[p.name,String(p.stock)]),[140,42]);
title('PRODUCTOS VENDIDOS');table(['Producto / servicio','Cantidad','Precio USD','Subtotal USD'],(s.sales||[]).flatMap(sale=>(sale.items||[]).map(i=>[i.name,String(i.quantity),cash(i.price),cash(Number(i.quantity)*Number(i.price))])),[95,22,30,35]);
title('COBROS INCLUIDOS');table(['Persona','Medio','Recibido original'],(s.payments||[]).map(p=>[p.customer_name,p.method==='cash'?'Efectivo':'Transferencia',cash(p.collection?.amount??p.amount,p.collection?.currency||'USD')]),[95,32,55]);
if((s.debts||[]).length){title('DEUDAS AL CORTE');table(['Persona','Saldo pendiente USD'],s.debts.map(p=>[p.name,cash(p.balance)]),[130,52]);text('Las deudas no forman parte del dinero recibido.',8);}
if(d.note||d.manager_note){title('OBSERVACIONES');if(d.note)text('Remitente: '+d.note);if(d.manager_note)text('Manager: '+d.manager_note);}
if(d.confirmed_at)text('Recibido confirmado por '+d.confirmed_by_name+' - '+date(d.confirmed_at),9,true);
const count=pdf.getNumberOfPages();for(let i=1;i<=count;i++){pdf.setPage(i);pdf.setDrawColor(205);pdf.line(L,285,L+W,285);pdf.setFont('helvetica','normal');pdf.setTextColor(95);pdf.setFontSize(8);pdf.text('El Cartel Studio - Cuadre #'+String(d.number).padStart(3,'0'),L,291);pdf.text('Pagina '+i+' de '+count,196,291,{align:'right'});}return pdf;
}
function buildReceipt(d,PDF,width=80){
 if(d.status!=='confirmed')throw Error('El cuadre debe estar confirmado.');
 if(![58,80].includes(width))throw Error('Selecciona el ancho del papel.');
 const margin=4,usable=width-2*margin,lines=[];
 const probe=new PDF({unit:'mm',format:[width,200]});
 const safe=v=>String(v??'').replace(/[\u0000-\u001f]/g,' ');
 const date=v=>v?new Intl.DateTimeFormat('es-CU',{timeZone:'America/Havana',dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—';
 const money=(v,c)=>Number(v||0).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+c;
 function add(text,size=9,bold=false,align='left'){
  probe.setFont('helvetica',bold?'bold':'normal');probe.setFontSize(size);
  for(const line of probe.splitTextToSize(safe(text),usable))lines.push({line,size,bold,align});
 }
 add('EL CARTEL STUDIO',11,true,'center');add('COMPROBANTE DE RECIBIDO',10,true,'center');add('Cuadre #'+String(d.number).padStart(3,'0'),11,true,'center');
 add('Entregado por: '+(d.created_by_name||'—'));add('Corte: '+date(d.snapshot?.as_of||d.created_at));add('Confirmado: '+date(d.confirmed_at));add('Recibido por: '+(d.confirmed_by_name||'—'));
 add('EFECTIVO RECIBIDO',10,true);
 const settlement=d.receipt_settlement;
 if(settlement?.received_by_currency?.length){
  for(const row of settlement.received_by_currency)add(money(row.amount,row.currency),12,true);
  add('Tasa: 1 USD = '+settlement.rate+' CUP');
 }else add('Detalle por moneda no registrado en este cuadre histórico.');
 const transfers=new Map();for(const p of d.snapshot?.payments||[]){if(p.method!=='transfer')continue;const c=p.collection?.currency||'USD';transfers.set(c,(transfers.get(c)||0)+Number(p.collection?.amount??p.amount??0));}
 if(!transfers.size)for(const t of d.snapshot?.collection_totals||[])if(t.method==='transfer')transfers.set(t.currency,Number(t.amount));
 if(transfers.size){add('TRANSFERENCIAS VERIFICADAS',10,true);for(const [c,v] of transfers)add(money(v,c),10,true);}
 if(settlement?.inventory_confirmed)add('Conteo de insumos confirmado.');
 add('Estado: RECIBIDO CONFIRMADO',10,true,'center');add('Firma de quien entrega:');add('________________________');add('Firma de quien recibe:');add('________________________');
 const height=Math.max(110,margin*2+lines.reduce((sum,l)=>sum+l.size*.43+1.5,0)+5),pdf=new PDF({unit:'mm',format:[width,height],orientation:'portrait'});let y=margin+4;
 for(const l of lines){pdf.setFont('helvetica',l.bold?'bold':'normal');pdf.setFontSize(l.size);pdf.text(l.line,l.align==='center'?width/2:margin,y,{align:l.align});y+=l.size*.43+1.5;}
 return pdf;
}
globalThis.CartelReconciliationPDF={build,buildReceipt};})();
