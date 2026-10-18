// Navigation is an aid; every database operation independently enforces RLS/RPC.
document.documentElement.dataset.accessPending='true';
const CartelAccess={
 async load(client){
  const entries=await Promise.all(['inventario_insumos','rrhh','usuarios_roles'].map(async module=>{const r=await client.rpc('system_has_permission',{module,operation:'read'});if(r.error)throw r.error;return [module,!!r.data];}));
  return Object.fromEntries(entries);
 },
 applyDashboard(access){
  const hide=selector=>document.querySelectorAll(selector).forEach(n=>n.style.setProperty('display','none','important'));
  if(!access.rrhh){document.querySelector('[data-menu="rh"]')?.parentElement.style.setProperty('display','none','important');hide('.module.rh, .stats .stat:first-child');}
  if(!access.usuarios_roles)hide('a[href="/usuarios-permisos.html"]');
  if(!access.inventario_insumos){document.querySelector('[data-menu="inv"]')?.parentElement.style.setProperty('display','none','important');hide('.module.inv');}
  if(!access.rrhh){
   // Other modules have no delegated server permission in this release.
   document.querySelectorAll('[data-menu]').forEach(b=>{if(b.dataset.menu!=='inv')b.parentElement.style.setProperty('display','none','important');});
   hide('[data-soon],.module.cat,.module.plan,.module.fin,.module.proj,.lower');
   document.querySelectorAll('#inv [data-soon]').forEach(n=>n.style.display='none');
   const greeting=document.querySelector('.hero h1');if(greeting)greeting.textContent='Cartel Gestión';
   const profile=document.querySelector('.profile');if(profile)profile.textContent='Acceso por roles';
  }
  delete document.documentElement.dataset.accessPending;
 }
};
