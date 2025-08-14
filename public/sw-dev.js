// Service Worker para desarrollo - versión simplificada
const CACHE_NAME = 'compass-team-dev-v1';

// Solo interceptar en producción
if (location.hostname !== 'localhost') {
  self.addEventListener('install', (event) => {
    console.log('SW: Instalando en producción');
    event.waitUntil(self.skipWaiting());
  });

  self.addEventListener('activate', (event) => {
    console.log('SW: Activando en producción');
    event.waitUntil(self.clients.claim());
  });

  self.addEventListener('fetch', (event) => {
    // Estrategia básica para producción
    event.respondWith(fetch(event.request));
  });
} else {
  console.log('SW: Ejecutándose en localhost - modo desarrollo');
}
