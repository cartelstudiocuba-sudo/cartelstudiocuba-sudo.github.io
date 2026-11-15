/* One deterministic Letter artwork for preview and the approved 300 dpi JPEG. */
(function(root){'use strict';
const WIDTH=2550,HEIGHT=3300,DPI=300,PUBLIC_URL='https://gestion.elcartelstudio.com/carta-menu.html',IMAGE_URL='https://jhumvctocphyiwhszeaz.supabase.co/functions/v1/fridge-menu-image';
const family='Barlow Condensed',DESIGN='elegant-v3',ARTWORK_URL='/assets/menu/elegant-background-v3.jpg';let fontsPromise,artwork;
function ready(){if(typeof document==='undefined'||!document.fonts||!root.Image)return Promise.reject(Error('No se pudo cargar el diseño para imprimir.'));return fontsPromise||(fontsPromise=Promise.all([document.fonts.load('700 100px "Barlow Condensed"').then(f=>{if(!f.length)throw Error('No se pudo cargar la tipografía.');}),new Promise((resolve,reject)=>{const img=new root.Image();img.onload=()=>{if(!img.naturalWidth)return reject(Error('Diseño no válido.'));artwork=img;resolve();};img.onerror=()=>reject(Error('No se pudo cargar el diseño. Reintenta antes de exportar.'));img.src=ARTWORK_URL;})]).catch(e=>{fontsPromise=null;artwork=null;throw e;}));}
function imageUrl(id,download=false){return IMAGE_URL+(id?'?version='+encodeURIComponent(id):'')+(download?(id?'&':'?')+'download=1':'');}
function qr(canvas,url=PUBLIC_URL,factory=root.qrcode){if(!factory)throw Error('No se pudo cargar el generador QR.');const code=factory(0,'M');code.addData(url);code.make();const n=code.getModuleCount(),ctx=canvas.getContext('2d'),size=Math.min(canvas.width,canvas.height),unit=Math.floor(size/(n+8)),offset=Math.floor((size-n*unit)/2);if(unit<1)throw Error('El QR no cabe.');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(code.isDark(y,x))ctx.fillRect(offset+x*unit,offset+y*unit,unit,unit);return code;}
function wrap(ctx,text,width){const lines=[];let line='';for(const word of String(text).split(/\s+/)){if(ctx.measureText(line+(line?' ':'')+word).width<=width){line+=(line?' ':'')+word;continue;}if(line)lines.push(line);line='';for(const char of word){if(ctx.measureText(line+char).width>width&&line){lines.push(line);line='';}line+=char;}}if(line)lines.push(line);return lines;}
const PRODUCT_AREA={left:620,right:1940,top:1230,bottom:2580};
function layout(ctx,products){
 let last;
 // Prefer the largest readable size. Tighten spacing only when the list needs it.
 for(let size=144;size>=56;size-=2){
  ctx.font='700 '+size+'px "'+family+'"';
  const priceWidth=Math.max(0,...products.map(p=>ctx.measureText('$'+Number(p.price).toFixed(2)).width)),nameWidth=Math.min(1180,PRODUCT_AREA.right-PRODUCT_AREA.left-priceWidth-85);
  for(const compact of [false,true]){
   const lineHeight=size*1.12,gap=size*(compact ? .12 : .30),sectionGap=size*(compact ? .20 : .30),ascent=size*.88,descent=size*.24;
   const rows=products.map((p,i)=>({p,separate:i>0&&p.category!==products[i-1].category,lines:wrap(ctx,String(p.name),Math.max(1,nameWidth))}));
   const height=rows.reduce((n,r,i)=>n+r.lines.length*lineHeight+(i?gap+(r.separate?sectionGap:0):0),0),available=PRODUCT_AREA.bottom-PRODUCT_AREA.top;
   const overflow=height>available||nameWidth<200||rows.some(r=>r.lines.length>2);
   let cursor=PRODUCT_AREA.top+Math.max(0,(available-height)/2);
   for(let i=0;i<rows.length;i++){const row=rows[i];if(i){const spacing=gap+(row.separate?sectionGap:0);row.ruleY=cursor+spacing/2;cursor+=spacing;}row.top=cursor;row.baseline=cursor+ascent;row.bottom=cursor+row.lines.length*lineHeight;cursor=row.bottom;}
   last={size,rows,height,nameWidth,priceWidth,lineHeight,ascent,descent,compact,overflow};
   if(!overflow)return last;
  }
 }
 return last;
}
function roundRect(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);}
function tracked(c,text,x,y,spacing){const widths=[...text].map(ch=>c.measureText(ch).width),total=widths.reduce((a,b)=>a+b,0)+spacing*(widths.length-1);let at=x-total/2;[...text].forEach((ch,i)=>{c.fillText(ch,at,y);at+=widths[i]+spacing;});}
function render(canvas,snapshot,{qrFactory=root.qrcode,link=PUBLIC_URL,background=artwork}={}){
 if(!background)throw Error('Espera a que termine de cargar el diseño de la carta.');
 canvas.width=WIDTH;canvas.height=HEIGHT;const c=canvas.getContext('2d');if(!c)throw Error('El navegador no permite generar la carta.');const products=snapshot.products||[];c.fillStyle='#fff';c.fillRect(0,0,WIDTH,HEIGHT);c.save();roundRect(c,0,0,WIDTH,HEIGHT,75);c.clip();c.drawImage(background,0,0,WIDTH,HEIGHT);
 const fit=layout(c,products);c.font='700 '+fit.size+'px "'+family+'"';c.fillStyle='#111';c.textAlign='left';
 if(!fit.overflow){for(const row of fit.rows){if(row.separate){c.strokeStyle='#111';c.lineWidth=2;c.beginPath();c.moveTo(585,row.ruleY);c.lineTo(1965,row.ruleY);c.stroke();}row.lines.forEach((line,i)=>c.fillText(line,PRODUCT_AREA.left,row.baseline+i*fit.lineHeight));c.textAlign='right';c.fillText('$'+Number(row.p.price).toFixed(2),PRODUCT_AREA.right,row.baseline);c.textAlign='left';}}
 if(fit.overflow||!products.length){c.textAlign='center';c.font='700 65px "'+family+'"';c.fillText(fit.overflow?'La selección no cabe en una hoja':'Selecciona los productos',WIDTH/2,1900);c.fillText(fit.overflow?'Reduce la selección para ver la carta completa':'de la carta',WIDTH/2,1980);}
 // Rounded white card surrounds the untouched square QR and its full quiet zone.
 c.fillStyle='#fff';roundRect(c,785,2820,980,390,65);c.fill();
 const qcanvas=canvas.ownerDocument?canvas.ownerDocument.createElement('canvas'):null;
 if(qcanvas){qcanvas.width=qcanvas.height=350;qr(qcanvas,link,qrFactory);c.drawImage(qcanvas,810,2840);}else{const code=qrFactory(0,'M');code.addData(link);code.make();const n=code.getModuleCount(),u=Math.floor(350/(n+8)),o=Math.floor((350-n*u)/2);c.fillStyle='#fff';c.fillRect(810,2840,350,350);c.fillStyle='#000';for(let r=0;r<n;r++)for(let col=0;col<n;col++)if(code.isDark(r,col))c.fillRect(810+o+col*u,2840+o+r*u,u,u);}
 c.strokeStyle='#111';c.lineWidth=3;c.beginPath();c.moveTo(1210,2885);c.lineTo(1210,3145);c.stroke();c.fillStyle='#111';c.textAlign='left';c.font='700 95px "'+family+'"';c.fillText('Carta',1280,2985);c.fillText('digital',1280,3090);
 c.strokeStyle='#111';c.lineWidth=2;c.beginPath();c.moveTo(745,2705);c.lineTo(895,2705);c.moveTo(1655,2705);c.lineTo(1805,2705);c.stroke();
 c.font='700 49px "'+family+'"';tracked(c,'PRECIOS EN USD',WIDTH/2,2725,9);c.restore();return {...fit,count:products.length,renderedCount:fit.overflow?0:products.length};
}
function dpi(bytes){const a=new Uint8Array(bytes);if(a[0]!==255||a[1]!==216)throw Error('JPEG no válido');let p=2;while(p+16<a.length&&a[p]===255){const marker=a[p+1],len=a[p+2]*256+a[p+3];if(marker===224&&a[p+4]===74&&a[p+5]===70&&a[p+6]===73&&a[p+7]===70){a[p+11]=1;a[p+12]=1;a[p+13]=44;a[p+14]=1;a[p+15]=44;return a;}if(marker===218||len<2)break;p+=len+2;}
 // Add a JFIF density segment when the browser's encoder omitted one.
 const segment=Uint8Array.from([255,224,0,16,74,70,73,70,0,1,1,1,1,44,1,44,0,0]),out=new Uint8Array(a.length+segment.length);out.set(a.slice(0,2));out.set(segment,2);out.set(a.slice(2),20);return out;
}
async function jpeg(canvas){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.95));if(!blob)throw Error('No se pudo generar el JPG.');return new Blob([dpi(await blob.arrayBuffer())],{type:'image/jpeg'});}
function printMessage(version){const s=version.snapshot;return 'Carta menú de El Cartel Studio · versión '+version.number+'\n\nDescargar JPG: '+imageUrl(version.id,true)+'\n\nMedida final: 21,59 cm de ancho × 27,94 cm de alto (8,5 × 11 pulgadas), vertical.\nMaterial: cartulina Bristol o similar de 180–220 g/m².\nImpresión a una sola cara, full color, acabado '+s.finish+'.\nCorte con esquinas redondeadas.\nImprimir al 100 %, tamaño real, sin ajustar a página.\n\nCarta digital: '+PUBLIC_URL;}
const api={WIDTH,HEIGHT,DPI,DESIGN,ARTWORK_URL,PRODUCT_AREA,PUBLIC_URL,IMAGE_URL,ready,imageUrl,qr,render,layout,dpi,jpeg,printMessage};root.CartelFridgeMenuRender=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
