'use strict';
// One normalization for saved templates, public acts, previews and their PDF output.
function cleanTrialClosureTemplate(doc){
 if(!doc||doc.key!=='trial_close'||!Array.isArray(doc.blocks))return doc;
 const blocks=doc.blocks.filter(b=>b.id!=='tcl10').map(b=>{
  const clean=value=>typeof value==='string'?value.replace(/(?:\\n|\n)*Resumen de asuntos pendientes u observaciones:[\s\S]*$/i,'').replace(/\s*De existir alguna excepción o asunto económico pendiente, deberá quedar expresamente consignado en la cláusula «Asuntos pendientes u observaciones» de esta acta\./g,''):value;
  return {...b,text:clean(b.text),override_text:clean(b.override_text)};
 });
 return {...doc,blocks};
}
