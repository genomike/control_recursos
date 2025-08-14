// Service Worker para desarrollo - versión mejorada y estable con sincronización
const CACHE_NAME = 'compass-team-dev-v2';

console.log('SW Dev: Service Worker de desarrollo cargado');

// 🔄 SISTEMA DE SINCRONIZACIÓN EN TIEMPO REAL
let broadcastChannel = null;

try {
  broadcastChannel = new BroadcastChannel('compass-team-sync');
  console.log('SW Dev: BroadcastChannel inicializado');
} catch (error) {
  console.warn('SW Dev: BroadcastChannel no disponible:', error);
}

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
  const { type, data } = event.data || {};
  
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // 🔄 MANEJO DE MENSAJES DE SINCRONIZACIÓN
  if (type === 'BROADCAST_TO_CLIENTS') {
    console.log('SW Dev: Reenviando mensaje a todos los clientes:', data);
    
    // Enviar mensaje a todos los clientes conectados
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'SYNC_UPDATE',
          data: data
        });
      });
    });
    
    // También enviar via BroadcastChannel si está disponible
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage(data);
      } catch (error) {
        console.warn('SW Dev: Error enviando via BroadcastChannel:', error);
      }
    }
  }
  
  // Responder con estado del service worker
  if (type === 'PING') {
    event.ports[0]?.postMessage({
      type: 'PONG',
      timestamp: Date.now(),
      cacheNames: [CACHE_NAME]
    });
  }
});

// 🔄 LISTENER PARA BROADCASTCHANNEL
if (broadcastChannel) {
  broadcastChannel.addEventListener('message', (event) => {
    console.log('SW Dev: Mensaje recibido en BroadcastChannel:', event.data);
    
    // Reenviar a todos los clientes
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'SYNC_UPDATE',
          data: event.data
        });
      });
    });
  });
}

console.log('SW Dev: Configurado para desarrollo');
