const managementShells = new Set(['/dashboard.html', '/rrhh.html', '/rrhh-20261101.html']);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !managementShells.has(url.pathname)) return;

  // Revalidate installed-app entry points without changing the visible URL.
  url.searchParams.set('_cartel_fresh', Date.now().toString(36));
  event.respondWith(
    fetch(url, { cache: 'no-store', credentials: 'same-origin', redirect: 'manual' })
      .catch(() => fetch(request))
  );
});

self.addEventListener('push', event => {
 let payload={};try{payload=event.data?.json()||{};}catch{}
 const id=payload.id;
 const safeId=typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id)?id:'';
 event.waitUntil(self.registration.showNotification('Cartel Gestión',{
  body:typeof payload.title==='string'&&typeof payload.body==='string'?(payload.title+' · '+payload.body).slice(0,180):'Tienes una nueva notificación. Abre Gestión para consultarla.',
  icon:'/assets/cartel-minimal-any-192.png',badge:'/assets/cartel-minimal-any-192.png',
  tag:safeId||'cartel-notice',data:{id:safeId}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const id=event.notification.data?.id;
 const url=new URL('/dashboard.html',self.location.origin);
 if(typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id))url.searchParams.set('notice',id);
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){
   const current=new URL(client.url);
   if(client.frameType==='nested'||current.origin!==url.origin||current.pathname!==url.pathname)continue;
   try{
    const navigated=await client.navigate(url.href);
    if(navigated){await navigated.focus();return;}
   }catch{}
  }
  return self.clients.openWindow(url.href);
 })());
});
