'use strict';
// Keep the original clauses and their numbering; remove only the requested observation label.
function cleanTrialClosureTemplate(doc){
 if(!doc||doc.key!=='trial_close'||!Array.isArray(doc.blocks))return doc;
 const clean=value=>typeof value==='string'?value.replace(/Resumen de asuntos pendientes u observaciones:\\s*(?:Ninguna|Sin asuntos pendientes ni excepciones declaradas\\.)?/gi,'').trim():value;
 return {...doc,blocks:doc.blocks.map(b=>({...b,text:clean(b.text),override_text:clean(b.override_text)}))};
}
