// Service Worker para desarrollo - versión mejorada y estable
const CACHE_NAME = 'compass-team-dev-v2';

console.log('SW Dev: Service Worker de desarrollo cargado');

self.addEventListener('install', (event) => {
  console.log('SW Dev: Instalando...');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('SW Dev: Activando...');
  event.waitUntil(self.clients.claim());
});

// En desarrollo, ser más conservador con el caché
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Solo interceptar recursos estáticos básicos
  if (url.origin === self.location.origin && 
      (url.pathname.endsWith('.png') || 
       url.pathname.endsWith('.jpg') || 
       url.pathname.endsWith('.svg') ||
       url.pathname.includes('manifest.json'))) {
    
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log('SW Dev: Desde caché:', event.request.url);
          return cachedResponse;
        }
        
        return fetch(event.request).then((response) => {
          // Solo cachear si es exitoso
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('SW Dev: Configurado para desarrollo');
