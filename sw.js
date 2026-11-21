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
