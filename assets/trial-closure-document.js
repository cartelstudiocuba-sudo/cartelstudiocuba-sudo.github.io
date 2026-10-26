'use strict';
function cleanTrialClosureTemplate(doc){
 if(!doc||doc.key!=='trial_close'||!Array.isArray(doc.blocks))return doc;
 const clean=(value,id)=>{
  if(typeof value!=='string'||id!=='tcl10')return value;
  const marker='Resumen de asuntos pendientes u observaciones:';
  const at=value.indexOf(marker);
  return at<0?value:value.slice(0,at).replace(/(?:\\\\n|\\n|\\s)+$/g,'');
 };
 return {...doc,blocks:doc.blocks.map(b=>({...b,text:clean(b.text,b.id),override_text:clean(b.override_text,b.id)}))};
}
