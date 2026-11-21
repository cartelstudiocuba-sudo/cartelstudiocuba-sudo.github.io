export function openHiringDemo(root, renderForm) {
 const data={
  full_name:'Alex Prueba',
  identity_number:'90010100000',
  nationality:'Cubana',
  municipality:'Habana Vieja',
  address:'Dirección ficticia',
  mobile:'55550000',
  fixed_phone:'70000000',
  email:'alex@example.com',
  alternative_address:'Dirección ficticia',
  emergency_name:'Contacto de prueba',
  emergency_relation:'Otro',
  emergency_phone:'55550001',
  education_level:'Universitario',
  civil_status:'Prefiero no declarar',
  has_children:'Prefiero no declarar',
  care_responsibilities:'No declarado',
  planned_absence:'No declarado'
 };
 const finish=()=>{
  root.innerHTML='<h1 tabindex="-1">Prueba completada</h1><p>Terminaste el recorrido del expediente de demostración. Ya puedes cerrar esta ventana.</p>';
  root.querySelector('h1').focus();
 };
 renderForm(root,{data,role_title:'Plaza de prueba',front:true,back:true,portrait:true},null,false,finish);
 const notice=document.createElement('p');
 notice.className='privacy-note';
 notice.textContent='Demostración. Usa datos ficticios. Al completar este expediente, los datos se descartan.';
 root.querySelector('h1').after(notice);
}
