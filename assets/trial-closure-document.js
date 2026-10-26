'use strict';
// Preserve every original clause; remove only the trailing observations field.
function cleanTrialClosureTemplate(doc){
 if(!doc||doc.key!=='trial_close'||!Array.isArray(doc.blocks))return doc;
 const clean=(value,id)=>{
  if(typeof value!=='string'||id!=='tcl10')return value;
  return value.replace(/(?:\\\\n|\\n)\\s*(?:\\\\n|\\n)\\s*Resumen de asuntos pendientes u observaciones:[\\s\\S]*$/i,'').trim();
 };
 return {...doc,blocks:doc.blocks.map(b=>({...b,text:clean(b.text,b.id),override_text:clean(b.override_text,b.id)}))};
}
