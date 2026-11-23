const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const assert=require('node:assert/strict');

(async()=>{
 const dom=new JSDOM('<!doctype html><main id="sheet">Ficha del candidato</main>',{
  url:'https://gestion.elcartelstudio.com/rrhh.html?candidate=A',
  runScripts:'outside-only'
 });
 try{
  const {window:w}=dom,d=w.document;
  const hiring={trial_id:'T',candidate_id:'A',expires_at:'2099-01-01T00:00:00Z',revision:1,data:{full_name:'Persona simulada'}};
  const operations=[];
  let popupBlocked=true,notifyFailed=true,prepared=false;
  let opened='',onboarding=false;
  w.candidates=[{id:'A',full_name:'Persona simulada',status:'trial'}];
  w.trialPeriodsByCandidate={A:{id:'T',stage:'training'}};
  w.dashboardCandidateRoleName=()=> 'Plaza simulada';
  w.candidatePhone=()=> '5312345678';
  w.preserveCandidateSheet=id=>assert.equal(id,'A');
  w.refreshCandidateAfterStatusChange=async()=>assert.equal(w.candidates[0].status,'hired');
  w.openSystemOnboarding=id=>{assert.equal(id,'A');onboarding=true;};
  w.open=()=>popupBlocked?null:{location:{replace:url=>{opened=url;}},close(){}};
  w.sb={
   from:()=>({
    select(){return this;},eq(){return this;},
    single:async()=>({data:structuredClone(hiring)}),
    then(resolve,reject){return Promise.resolve({data:prepared?[structuredClone(hiring)]:[]}).then(resolve,reject);}
   }),
   rpc:async(name,args)=>{
    if(name==='hr_prepare_hiring'){prepared=true;return {data:{expires_at:hiring.expires_at}};}
    operations.push(args);
    if(args.p_action==='notify'){
     if(notifyFailed)return {error:{message:'Conexión interrumpida'}};
     hiring.notified_at='now';
    }else{
     assert.equal(args.p_action,'validate_and_advance');
     assert.equal(args.p_revision,hiring.revision);
     assert(hiring.submitted_at);
     hiring.verified_at='now';
     w.candidates[0].status='hired';
    }
    return {data:null};
   }
  };
  w.eval(fs.readFileSync('assets/hiring.js','utf8'));
  const route=()=>[...d.querySelectorAll('.hiring-step-route button')];
  const button=name=>[...d.querySelectorAll('button')].find(item=>item.textContent===name);
  await w.openHiringPreparationNotification('A');
  assert.deepEqual([...d.querySelectorAll('[role=tab]')].map(tab=>tab.textContent),['Datos','Documentos','Contrato']);
  assert(route()[0].matches('.is-current'));
  assert(route()[1].disabled&&route()[2].disabled);
  assert.equal(button('Enviar mensaje al candidato'),undefined);
  await button('Continuar').onclick();
  assert(route()[0].matches('.is-complete')&&route()[1].matches('.is-current'));
  assert.equal(d.querySelector('.hiring-send-card').nextElementSibling.className,'hiring-send-message');
  const editor=d.querySelector('textarea.hiring-message');
  editor.value+='\nTexto adicional';
  await button('Enviar mensaje al candidato').onclick();
  assert.equal(operations.length,0);
  popupBlocked=false;
  await button('Enviar mensaje al candidato').onclick();
  assert.match(decodeURIComponent(opened),/Texto adicional/);
  assert.match(decodeURIComponent(opened),/expediente-contratacion\.html#token=/);
  assert(route()[1].matches('.is-current'));
  assert.equal(w.candidates[0].status,'trial');
  notifyFailed=false;
  const retry=button('Reintentar registrar apertura');
  await retry.onclick({currentTarget:retry});
  assert(route()[1].matches('.is-complete')&&route()[2].matches('.is-current'));
  assert.match(d.querySelector('#hiringNotificationOverlay').textContent,/Esperando datos/);
  assert.equal(button('Confirmar validación'),undefined);
  assert.equal(onboarding,false);
  hiring.submitted_at='now';
  hiring.revision=2;
  hiring.data.full_name='Datos recibidos de prueba';
  await button('Actualizar estado').onclick();
  assert.match(d.querySelector('#hiringNotificationOverlay').textContent,/Datos recibidos de prueba/);
  const validate=button('Confirmar validación');
  await validate.onclick({currentTarget:validate});
  assert.equal(onboarding,true);
  assert.equal(d.querySelector('#hiringNotificationOverlay'),null);
  assert.deepEqual(operations.map(operation=>operation.p_action),['notify','notify','validate_and_advance']);
  console.log('PASS: revisión, WhatsApp, reintento, espera, validación e inserción en sistema');
 }finally{dom.window.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
