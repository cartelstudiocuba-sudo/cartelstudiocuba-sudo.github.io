const demoData={
 full_name:'Alex Prueba',
 identity_number:'90010100000',
 nationality:'Cubana',
 municipality:'Habana Vieja',
 address:'Dirección ficticia',
 mobile:'55550000',
 fixed_phone:'70000000',
 email:'alex@example.com',
 alternative_address:'Dirección ficticia',
 education_level:'Universitario',
 civil_status:'Prefiero no declarar',
 has_children:'Prefiero no declarar',
 care_responsibilities:'No declarado',
 planned_absence:'No declarado'
};
const demoRole='Gestor Técnico';
const demoContract={
 role:{title:demoRole,payment_method:'Según disponibilidad'},
 template:{
  title:'Contrato de trabajo · Demostración',
  blocks:[
   {id:'demo-intro',title:'Ejemplo de contratación',source:'custom',text:'Este documento es un ejemplo para verificar el recorrido, el anexo de datos y la incorporación de las imágenes en el PDF.'},
   {id:'demo-worker',title:'Identificación del trabajador',source:'candidate'},
   {id:'demo-signatures',title:'Conformidad y firmas',source:'candidate'}
  ],
  annexes:[
   {type:'worker_data',title:'Datos del trabajador contratado'},
   {type:'identity_copy',title:'Fotocopia del carné de identidad'}
  ]
 }
};
function demoNotice(){
 const note=document.createElement('p');
 note.className='privacy-note hiring-demo-notice';
 note.textContent='Demostración. Lo que introduzcas se usa solo en esta página. Puedes usar datos e imágenes ficticios para probar el recorrido.';
 return note;
}
function loadScript(path){
 return new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='/assets/'+path;
  script.onload=resolve;
  script.onerror=()=>reject(Error('No se pudo cargar el visor de demostración. Recarga e inténtalo de nuevo.'));
  document.head.append(script);
 });
}
export async function openHiringDemoContract(root,data=demoData,images={}){
 if(typeof renderHiringContractPaperV3!=='function'){
  await Promise.all([
   'vendor/jspdf-2.5.2.umd.min.js','vendor/html2canvas-1.4.1.min.js','trial-closure-document.js',
   'contract-paper-v3.js?v=1','hiring-contract-paper-v3.js?v=demo2'
  ].map(loadScript));
 }
 root.classList.remove('hiring-candidate-form-surface');
 await renderHiringContractPaperV3(root,{demo:true,contract:demoContract,data,identity_images:images});
 root.prepend(demoNotice());
}
export function openHiringDemo(root,renderForm){
 const finish=(form,pending)=>{
  const data=Object.fromEntries([...new FormData(form)].filter(([,value])=>typeof value==='string'));
  const images={front:pending.front,back:pending.back};
  root.innerHTML='<h1 tabindex="-1">Prueba completada</h1><p>El expediente de demostración está listo para generar el contrato de prueba.</p>';
  root.prepend(demoNotice());
  const view=document.createElement('button');
  view.type='button';view.textContent='Ver y descargar mi contrato';
  view.onclick=async()=>{
   view.disabled=true;
   try{await openHiringDemoContract(root,data,images);window.scrollTo(0,0);}
   catch(error){view.disabled=false;root.append(document.createTextNode(error.message));}
  };
  root.append(view);
  root.querySelector('h1').focus();
 };
 renderForm(root,{data:demoData,role_title:demoRole,requires_emergency_address:true,front:false,back:false,portrait:false},null,false,finish);
 root.querySelector('h1').after(demoNotice());
}
