/* Pure read model. No writes, authorization changes or demo values. */
(function(root){
 'use strict';
 const day=value=>{if(!value)return null;const d=new Date(value.length===10?value+'T12:00:00Z':value);return Number.isNaN(+d)?null:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Havana',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);};
 function build(data,options={}){
  const today=day(options.now||new Date().toISOString()),year=today.slice(0,4),month=Number(today.slice(5,7));
  const quarter=new Date(Date.UTC(Number(year),month-3,1)).toISOString().slice(0,10);
  const start=({month:today.slice(0,7)+'-01',quarter,year:year+'-01-01',all:'0000-01-01'})[options.period||'month'];
  const inPeriod=value=>{const d=day(value);return !!d&&d>=start&&d<=today;};
  const roles=new Map((data.roles||[]).map(r=>[r.id,r]));
  const cycles=new Map((data.cycles||[]).map(c=>[c.id,c]));
  const vacancies=new Map((data.vacancies||[]).map(v=>[v.id,v]));
  const departments=new Map((data.departments||[]).map(d=>[d.id,d.name]));
  const roleFor=x=>roles.get(x.role_id)||roles.get(cycles.get(x.recruitment_cycle_id)?.role_id)||roles.get(cycles.get(vacancies.get(x.vacancy_id)?.recruitment_cycle_id)?.role_id)||roles.get(x.vacancy_id);
  const departmentFor=x=>{const r=roleFor(x);return r?.department_id||r?.area||'__none';};
  const departmentName=x=>departments.get(x)||((data.roles||[]).find(r=>r.area===x)?.area)||'Sin departamento';
  // With a department filter, unresolved joins must never be attributed to another area.
  const matches=x=>!options.department||departmentFor(x)===options.department;
  const candidates=(data.candidates||[]).filter(matches),candidateMap=new Map(candidates.map(c=>[c.id,c]));
  const cohort=candidates.filter(c=>inPeriod(c.submitted_at));
  const employees=(data.employees||[]).filter(matches),active=employees.filter(e=>e.status==='active');
  const trials=(data.trials||[]).filter(t=>!t.superseded_at&&candidateMap.has(t.candidate_id));
  const route={};for(const e of data.events||[]){const r=route[e.trial_id]||={decision:null,notified:false};if(['message_opened','training_step_back'].includes(e.action)&&typeof e.payload?.decision==='string'){r.decision=e.payload.decision;r.notified=false;}else if(e.action==='training_notification_confirmed')r.notified=true;else if(e.action==='training_notification_back')r.notified=false;}
  const trainingIds=new Set(trials.filter(t=>route[t.id]?.decision==='continue'&&route[t.id]?.notified).map(t=>t.candidate_id));
  const training=candidates.filter(c=>c.status==='trial'&&trainingIds.has(c.id));
  const activeCycles=(data.cycles||[]).filter(c=>c.status==='active'&&(!c.opens_at||c.opens_at<=today)&&(!c.closes_at||c.closes_at>=today)&&matches(c));
  const openRoles=new Set(activeCycles.map(c=>c.role_id).filter(Boolean));
  const occupiedRoles=new Set(active.map(e=>roleFor(e)?.id).filter(Boolean));
  const interviews=(data.interviews||[]).filter(i=>candidateMap.has(i.candidate_id));
  const completed=interviews.filter(i=>i.completed_at&&inPeriod(i.completed_at));
  const hires=employees.filter(e=>inPeriod(e.hired_at));
  const durations=hires.map(e=>{const c=candidateMap.get(e.candidate_id);const d=(Date.parse(e.hired_at)-Date.parse(c?.submitted_at))/86400000;return Number.isFinite(d)&&d>=0?d:null;}).filter(x=>x!==null);
  const advanced=cohort.filter(c=>['preselected','interview_scheduled','interviewed','trial','training','hired'].includes(c.status)).length;
  const stage=c=>trainingIds.has(c.id)&&c.status==='trial'?'training':c.status;
  const stages=[['Captación',['new','reviewed']],['Preselección',['preselected']],['Entrevistas',['interview_scheduled','interviewed']],['Período de prueba',['trial']],['Adiestramiento',['training']],['Contratados',['hired']],['Cantera / no seleccionados',['talent_pool','not_selected']]];
  const funnel=stages.map(([label,states])=>({label,value:cohort.filter(c=>states.includes(stage(c))).length}));
  const grouped=new Map();for(const e of active){const d=departmentFor(e);grouped.set(d,(grouped.get(d)||0)+1);}
  const distribution=[...grouped].map(([id,value])=>({label:departmentName(id),value})).sort((a,b)=>b.value-a.value);
  const months=[];for(let n=5;n>=0;n--){const key=new Date(Date.UTC(Number(year),month-1-n,1)).toISOString().slice(0,7);months.push({key,label:key.slice(5)+'/'+key.slice(2,4),value:hires.filter(e=>day(e.hired_at)?.startsWith(key)).length});}
  const contracts=(data.contracts||[]).filter(c=>active.some(e=>e.id===c.employee_id));
  const horizon=new Date(today+'T12:00:00Z');horizon.setUTCDate(horizon.getUTCDate()+30);const until=horizon.toISOString().slice(0,10);
  const renewals=contracts.filter(c=>c.signed&&day(c.end)&&day(c.end)<=until).sort((a,b)=>String(a.end).localeCompare(String(b.end)));
  const knownEnds=contracts.filter(c=>day(c.end));
  const agenda=interviews.filter(i=>!i.completed_at&&i.interview_date>=today&&!['absent','cancelled','no_show'].includes(i.attendance_status)).map(i=>({candidate_id:i.candidate_id,title:candidateMap.get(i.candidate_id)?.full_name||'Candidatura',date:i.interview_date,detail:'Entrevista · '+(i.interview_time?.slice(0,5)||'Hora por confirmar')}));
  for(const t of trials)if(t.start_date>=today&&['agreement_sent','agreement_accepted'].includes(t.stage))agenda.push({candidate_id:t.candidate_id,title:candidateMap.get(t.candidate_id)?.full_name||'Candidatura',date:t.start_date,detail:'Inicio de período de prueba'});
  agenda.sort((a,b)=>a.date.localeCompare(b.date));
  const attention=[];for(const c of candidates){if(c.status==='new')attention.push({candidate_id:c.id,title:c.full_name,detail:'Revisar candidatura'});else if(c.status==='interviewed')attention.push({candidate_id:c.id,title:c.full_name,detail:'Decidir siguiente etapa'});}
  for(const t of trials){if(['pending_confirmation','pending_agreement','evaluation_pending'].includes(t.stage))attention.push({candidate_id:t.candidate_id,title:candidateMap.get(t.candidate_id)?.full_name||'Candidatura',detail:t.stage==='evaluation_pending'?'Evaluación pendiente':'Documentación de prueba pendiente'});}
  const pendingContracts=contracts.filter(c=>!c.signed);for(const c of pendingContracts)attention.push({employee_id:c.employee_id,title:active.find(e=>e.id===c.employee_id)?.full_name||'Trabajador',detail:'Revisar contrato y documentación'});
  const unavailable=data.unavailable||[];
  const available=(...keys)=>!keys.some(k=>unavailable.includes(k));
  const joins=['roles','cycles','vacancies'];
  const ok=(...keys)=>available(...keys,...(options.department?joins:[]));
  return {today,start,candidates,cohort,employees,active,training,activeCycles,openRoles,occupiedRoles,completed,hires,durations,advanced,funnel,distribution,months,contracts,renewals,knownEnds,agenda,attention,pendingContracts,unavailable,ok,departmentName,roleFor,departmentFor,metrics:{candidates:ok('candidates')?candidates.length:null,plazas:ok('cycles','roles')?openRoles.size:null,active:ok('employees')?active.length:null,interviews:ok('interviews','candidates')?completed.length:null,training:ok('candidates','trials','events')?training.length:null,renewals:ok('employees','contracts')&&active.length===contracts.length&&(!active.length||knownEnds.length)?renewals.length:null,time:ok('employees','candidates')&&durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:null,advance:ok('candidates')&&cohort.length?100*advanced/cohort.length:null}};
 }
 const api={build,day};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HrDashboardModel=api;
})(typeof window==='undefined'?globalThis:window);
