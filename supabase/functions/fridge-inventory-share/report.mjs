import {regular,bold} from './fonts.mjs';
export const status=p=>p.stock===0?'Agotado':p.stock<=p.minimum?'Reponer':'En nivel';
export function buildReport(Pdf,snapshot,rows){
 const pdf=new Pdf({unit:'pt',format:'letter'}),w=612,h=792,margin=36;
 pdf.addFileToVFS('Cartel-Regular.ttf',regular);pdf.addFont('Cartel-Regular.ttf','Cartel','normal');pdf.addFileToVFS('Cartel-Bold.ttf',bold);pdf.addFont('Cartel-Bold.ttf','Cartel','bold');pdf.setFont('Cartel');
 const ordered=[...rows].sort((a,b)=>(a.stock===0?0:a.stock<=a.minimum?1:2)-(b.stock===0?0:b.stock<=b.minimum?1:2)||a.name.localeCompare(b.name,'es'));
 const stamp=new Intl.DateTimeFormat('es-ES',{timeZone:'America/Havana',dateStyle:'short',timeStyle:'short'}).format(new Date(snapshot.as_of));
 const text=(value,x,y,size=9,bold=false)=>{pdf.setFont('Cartel',bold?'bold':'normal');pdf.setFontSize(size);pdf.setTextColor(25,32,40);pdf.text(String(value),x,y);};
 const header=()=>{text('EL CARTEL STUDIO',36,38,12,true);text('Inventario',36,68,27,true);text('Nevera Audiovisual',36,90,13);pdf.setDrawColor(190);pdf.line(36,106,576,106);};header();
 text('CORTE DEL INVENTARIO',36,130,8,true);text(stamp+' · La Habana',36,147,10);text('A SOLICITUD DE',330,130,8,true);const requester=pdf.splitTextToSize(snapshot.requested_by,240);pdf.text(requester,330,147);
 const metrics=[['PRODUCTOS',rows.length],['UNIDADES',rows.reduce((s,p)=>s+p.stock,0)],['POR REPONER',rows.filter(p=>p.stock>0&&p.stock<=p.minimum).length],['AGOTADOS',rows.filter(p=>p.stock===0).length]];
 metrics.forEach(([label,value],i)=>{const x=36+i*138;pdf.setFillColor(243,245,247);pdf.roundedRect(x,177,126,51,7,7,'F');text(label,x+11,193,8,true);text(value,x+11,217,21,true);});
 text('Existencias por producto',36,254,13,true);text('Alcance: '+rows.length+' de '+snapshot.products.length+' productos.',36,271,8);
 let y=287;const tableHead=()=>{pdf.setFillColor(255,218,3);pdf.rect(36,y,540,24,'F');text('Producto',44,y+16,9,true);text('Existencias',365,y+16,8,true);text('Mínimo',443,y+16,8,true);text('Estado',501,y+16,8,true);y+=24;};tableHead();
 ordered.forEach((p,i)=>{const lines=pdf.splitTextToSize(p.name+(p.active===false?' (Inactivo)':''),310),height=Math.max(23,lines.length*11+10);if(y+height>701){pdf.addPage();header();y=125;tableHead();}if(i%2===0){pdf.setFillColor(247,248,250);pdf.rect(36,y,540,height,'F');}pdf.setFont('Cartel','normal');pdf.setFontSize(9);pdf.setTextColor(25,32,40);pdf.text(lines,44,y+15);text(p.stock,392,y+15,9,true);text(p.minimum,455,y+15);text(status(p),501,y+15,8,true);y+=height;});
 for(let page=1;page<=pdf.getNumberOfPages();page++){pdf.setPage(page);text('Los datos corresponden al corte indicado; no incluyen movimientos posteriores.',36,739,8);pdf.setDrawColor(210);pdf.line(36,751,576,751);text('Siempre positivo',36,770,11,true);text('Página '+page+' de '+pdf.getNumberOfPages(),500,770,8);}
 return new Uint8Array(pdf.output('arraybuffer'));
}
export function message(snapshot,url){const d=new Date(snapshot.as_of),date=d.toLocaleDateString('es-ES',{timeZone:'America/Havana'}),time=d.toLocaleTimeString('es-ES',{timeZone:'America/Havana',hour:'2-digit',minute:'2-digit'});return 'Hola. Acá te envío la actualización del inventario de la *Nevera Audiovisual de El Cartel Studio*.\n\n• *Fecha:* '+date+'\n• *Hora del corte:* '+time+' · La Habana\n• *A solicitud de:* '+snapshot.requested_by+'\n\nEl PDF incluye las existencias por producto y señala cuáles están agotados o necesitan reposición.\n\n• *Descargar inventario:*\n'+url+'\n\nLa información corresponde al momento indicado en el reporte.\nEnlace disponible durante 7 días.\n\n*El Cartel Studio · Siempre positivo*';}
