'use strict';
// Shared by both administration entry points; never supplies candidate identity.
function trialClosureRepresentativeEditor(container,representative={},trial={}){
 const form=document.createElement('form');form.className='closure-representative-form';
 const fields=[['name','Nombre y apellidos','text'],['ci','Carné de identidad','text'],['position','Cargo','text'],['address','Dirección de la sede','textarea'],['start_date','Fecha de inicio','date'],['end_date','Fecha de fin','date'],['observations','Asuntos pendientes u observaciones','textarea']];
 for(const [key,title,type] of fields){const label=document.createElement('label');label.textContent=title;label.style.display='block';const input=document.createElement(type==='textarea'?'textarea':'input');input.name=key;if(type!=='textarea')input.type=type;input.required=key!=='observations';input.maxLength=key==='ci'?11:4000;if(key==='ci'){input.pattern='[0-9]{11}';input.inputMode='numeric'}input.value=representative[key]||(key==='start_date'?trial.start_date||'':'');input.style.cssText='display:block;width:100%;box-sizing:border-box;padding:10px;margin:6px 0 12px;font:inherit';label.append(input);form.append(label)}
 form.onsubmit=e=>e.preventDefault();container.append(form);
 return {form,save:async()=>{if(!form.reportValidity())throw Error('Completa los datos del acta.');const values=Object.fromEntries(new FormData(form));if(values.end_date<values.start_date)throw Error('La fecha de fin no puede ser anterior al inicio.');const {error}=await sb.rpc('hr_set_trial_closure_representative',{p_trial:trial.id,p_representative:values});if(error)throw Error(error.message);return values}};
}
