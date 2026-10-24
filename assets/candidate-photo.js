/* Profile photos only. Identity documents and other uploads must not use this helper. */
window.CandidatePhoto = (() => {
  const limit = 8 * 1024 * 1024, target = 150 * 1024;
  const pending = new WeakMap();
  async function prepare(original) {
    if (!original || !original.size || original.size > limit) throw Error('La foto debe ocupar entre 1 byte y 8 MB.');
    const bytes = new Uint8Array(await original.slice(0, 64).arrayBuffer());
    const ascii = String.fromCharCode(...bytes);
    const type = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg'
      : bytes.slice(0,8).join(',') === '137,80,78,71,13,10,26,10' ? 'image/png'
      : ascii.slice(0,4) === 'RIFF' && ascii.slice(8,12) === 'WEBP' ? 'image/webp'
      : ascii.slice(4,8) === 'ftyp' && /heic|heix|hevc|hevx|mif1|msf1/.test(ascii.slice(8)) ? 'image/heic' : '';
    if (!type || (original.type && !['image/jpeg','image/png','image/webp','image/heic','image/heif','image/heic-sequence','image/heif-sequence'].includes(original.type))) throw Error('Selecciona una fotografía JPEG, PNG, WebP o HEIC válida.');
    const file = new File([original], original.name, {type});
    const url = URL.createObjectURL(file), image = new Image();
    try {
      // HTML image decoding applies EXIF once, including mirrored orientations.
      await new Promise((resolve,reject) => {image.onload=resolve;image.onerror=()=>reject(Error('No se pudo leer la foto. Si es HEIC, conviértela a JPEG o usa un navegador compatible.'));image.src=url;});
      const w=image.naturalWidth,h=image.naturalHeight;
      if (!w || !h || w*h>80000000) throw Error('La resolución de la fotografía es demasiado grande. Usa una imagen de hasta 80 megapíxeles.');
      const canvas=document.createElement('canvas');
      const scale=Math.min(1,800/Math.max(w,h));
      canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
      const ctx=canvas.getContext('2d');
      let best=file, fallback=false;
      try {
        if(!ctx)throw Error('Canvas no disponible');
        ctx.drawImage(image,0,0,canvas.width,canvas.height);
        const encode=(mime,q)=>new Promise(resolve=>canvas.toBlob(resolve,mime,q));
        let blob=await encode('image/webp',.78);
        // PNG fallback preserves transparency when WebP encoding is unavailable.
        if (!blob || blob.type!=='image/webp') blob=await encode(type==='image/jpeg' || type==='image/heic'?'image/jpeg':'image/png',.78);
        if(blob && blob.size<best.size)best=blob;
        if(blob?.type==='image/webp' && best.size>target){
          for(const quality of [.72,.66]){const next=await encode('image/webp',quality);if(next?.size<best.size)best=next;if(best.size<=target)break;}
        }
      } catch (_) {fallback=true;}
      const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic'}[best.type];
      return {file:new File([best],'perfil.'+ext,{type:best.type}),extension:ext,width:best===file?w:canvas.width,height:best===file?h:canvas.height,originalSize:file.size,fallback:fallback||best===file};
    } finally {URL.revokeObjectURL(url);}
  }
  function selection(input) {
    const file=input.files?.[0];
    if(!file)return Promise.resolve(null);
    const old=pending.get(input);
    if(old?.original===file)return old.promise;
    const promise=prepare(file);pending.set(input,{original:file,promise});return promise;
  }
  async function preview(input,img,placeholder,status){
    const original=input.files?.[0];if(!original)return;
    status.textContent='Preparando fotografía…';
    try{
      const result=await selection(input);
      if(input.files?.[0]!==original || !input.isConnected)return;
      if(img.dataset.localPhoto)URL.revokeObjectURL(img.dataset.localPhoto);
      const url=URL.createObjectURL(result.file);img.dataset.localPhoto=url;img.src=url;img.style.display='block';placeholder.style.display='none';
      img.onload=()=>{URL.revokeObjectURL(url);delete img.dataset.localPhoto;};
      status.textContent='Foto lista · '+Math.ceil(result.file.size/1024)+' KB. Se guardará al continuar.'+(result.fallback?' Se conserva el original.':'');
    }catch(error){if(input.files?.[0]!==original)return;input.value='';status.textContent=error.message;}
  }
  return {prepare,selection,preview};
})();
