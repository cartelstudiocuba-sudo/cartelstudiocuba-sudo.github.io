// Process locally; only the resized image is uploaded to private HR storage.
async function prepareIdentityPhoto(file){
 if(!file||file.size>20*1024*1024||!['image/jpeg','image/png'].includes(file.type))throw Error('Usa fotos JPG o PNG de hasta 20 MB. Se comprimirán automáticamente.');
 const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());
 const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const png=[137,80,78,71,13,10,26,10].every((value,i)=>bytes[i]===value);
 if(!(file.type==='image/jpeg'?jpeg:png))throw Error('El archivo no contiene una imagen válida.');
 const url=URL.createObjectURL(file),img=new Image();
 try{
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('No se pudo leer la foto. Usa otra imagen JPG o PNG.'));img.src=url;});
  if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>40000000)throw Error('La foto supera 40 megapíxeles. Reduce su tamaño antes de adjuntarla.');
  const scale=Math.min(1,1800/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('No se pudo preparar la foto.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
  const result=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.88));
  if(!result||result.size>5242880)throw Error('No se pudo reducir la foto a 5 MB. Adjunta una imagen menor.');
  return result;
 }finally{URL.revokeObjectURL(url);}
}
