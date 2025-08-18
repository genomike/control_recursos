// Service Worker de producción para PWA completa - VERSION SIMPLIFICADA
const CACHE_NAME = 'compass-team-v6';
const STATIC_CACHE = 'compass-team-static-v6';

// Archivos esenciales
const CORE_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/favicon.png',
  '/cuy_icon.png',
  '/icon-192.png'
];

console.log('SW: Service Worker v6 cargado - CACHE FIRST AGRESIVO');

// Instalación
self.addEventListener('install', (event) => {
  console.log('SW: Instalando Service Worker v6...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('SW: Precargando archivos críticos...');
        return cache.addAll(CORE_FILES);
      })
      .then(() => {
        console.log('SW: ✅ Archivos críticos precargados');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('SW: ❌ Error en instalación:', error);
        return self.skipWaiting();
      })
  );
});

// Activación
self.addEventListener('activate', (event) => {
  console.log('SW: Activando Service Worker v6...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== CACHE_NAME) {
              console.log('SW: 🗑️ Eliminando caché antigua:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('SW: ✅ Service Worker v6 activado');
        return self.clients.claim();
      })
  );
});

// Fetch - ESTRATEGIA CACHE FIRST PARA TODO
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Solo manejar requests del mismo origen
  if (url.origin !== self.location.origin) {
    return;
  }

  // Para API calls (/api/*) - manejar offline gracefully
  if (url.pathname.startsWith('/api/')) {
    console.log('SW: 🔌 API call interceptada:', url.pathname);
    event.respondWith(
      fetch(event.request)
        .then(response => {
          console.log('SW: ✅ API response:', url.pathname, response.status);
          return response;
        })
        .catch(error => {
          console.log('SW: 📡 API offline, devolviendo respuesta vacía:', url.pathname);
          // Devolver respuesta JSON vacía para APIs
          return new Response(JSON.stringify({
            error: 'API no disponible offline',
            offline: true,
            timestamp: new Date().toISOString()
          }), {
            status: 503,
            statusText: 'Service Unavailable - Offline',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache'
            }
          });
        })
    );
    return;
  }

  console.log('SW: 🔍 Interceptando request:', url.pathname);

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          console.log('SW: ✅ Desde caché:', url.pathname);
          return cachedResponse;
        }
        
        // Si no está en caché, intentar fetch
        console.log('SW: 📥 No en caché, descargando:', url.pathname);
        return fetch(event.request)
          .then(response => {
            // Solo cachear respuestas exitosas
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open(STATIC_CACHE)
                .then(cache => {
                  cache.put(event.request, responseClone);
                  console.log('SW: 💾 Cacheado exitosamente:', url.pathname);
                })
                .catch(cacheError => {
                  console.warn('SW: ⚠️ Error cacheando:', url.pathname, cacheError);
                });
            }
            return response;
          })
          .catch(fetchError => {
            console.error('SW: ❌ Fetch falló para:', url.pathname, fetchError);
            
            // Fallback para navegación
            if (event.request.mode === 'navigate' || 
                url.pathname === '/' ||
                event.request.headers.get('Accept')?.includes('text/html')) {
              
              console.log('SW: 🔄 Intentando fallback de navegación...');
              return caches.match('/index.html')
                .then(indexResponse => {
                  if (indexResponse) {
                    console.log('SW: ✅ Sirviendo index.html como fallback');
                    return indexResponse;
                  }
                  
                  // Página offline minimalista
                  console.log('SW: 🚨 Mostrando página offline');
                  return new Response(`
                    <!DOCTYPE html>
                    <html lang="es">
                      <head>
                        <title>Compass Team - Offline</title>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1">
                        <style>
                          body { 
                            font-family: system-ui, sans-serif; margin: 0; padding: 40px;
                            background: #f8f9fa; display: flex; align-items: center; 
                            justify-content: center; min-height: 100vh; text-align: center;
                          }
                          .container { 
                            max-width: 400px; background: white; padding: 40px; 
                            border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                          }
                          h1 { color: #007bff; margin: 0 0 20px 0; }
                          p { color: #6c757d; line-height: 1.5; margin-bottom: 20px; }
                          button { 
                            background: #007bff; color: white; border: none; 
                            padding: 12px 24px; border-radius: 6px; cursor: pointer;
                            font-size: 16px; margin: 5px;
                          }
                          button:hover { background: #0056b3; }
                          .info { font-size: 12px; color: #999; margin-top: 20px; }
                        </style>
                      </head>
                      <body>
                        <div class="container">
                          <h1>📱 Compass Team</h1>
                          <p><strong>Aplicación offline activa</strong></p>
                          <p>No se pudo cargar la aplicación completa. Algunos recursos no están disponibles en caché.</p>
                          <button onclick="location.reload()">🔄 Reintentar</button>
                          <button onclick="clearCacheAndReload()">🗑️ Limpiar caché</button>
                          <div class="info">
                            Service Worker v6 activo<br>
                            Conexión: <span id="status">verificando...</span>
                          </div>
                        </div>
                        <script>
                          // Mostrar estado de conexión
                          function updateStatus() {
                            document.getElementById('status').textContent = navigator.onLine ? 'Online' : 'Offline';
                          }
                          updateStatus();
                          window.addEventListener('online', updateStatus);
                          window.addEventListener('offline', updateStatus);
                          
                          // Función para limpiar caché
                          async function clearCacheAndReload() {
                            try {
                              console.log('Limpiando todas las cachés...');
                              const cacheNames = await caches.keys();
                              await Promise.all(cacheNames.map(name => caches.delete(name)));
                              console.log('Cachés eliminadas, recargando...');
                              location.reload();
                            } catch (e) {
                              console.error('Error limpiando caché:', e);
                              location.reload();
                            }
                          }
                          
                          // Auto-retry si hay conexión
                          setInterval(() => {
                            if (navigator.onLine) {
                              console.log('Conexión detectada, reintentando automáticamente...');
                              location.reload();
                            }
                          }, 10000);
                        </script>
                      </body>
                    </html>
                  `, { 
                    headers: { 
                      'Content-Type': 'text/html',
                      'Cache-Control': 'no-cache'
                    } 
                  });
                });
            }
            
            // Para otros recursos, devolver error
            console.log('SW: ❌ No hay fallback para:', url.pathname);
            return new Response('Recurso no disponible offline', { 
              status: 404,
              statusText: 'Not Found - Offline' 
            });
          });
      })
  );
});

// Mensajes del cliente
self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};
  console.log('SW: Mensaje recibido:', type, data);
  
  if (type === 'SKIP_WAITING') {
    console.log('SW: Forzando activación...');
    self.skipWaiting();
  }
  
  if (type === 'PING') {
    console.log('SW: Respondiendo PING...');
    event.ports[0]?.postMessage({
      type: 'PONG',
      timestamp: Date.now(),
      version: 'v6',
      cacheNames: [STATIC_CACHE]
    });
  }
});

console.log('SW: ✅ Service Worker v6 completamente configurado y listo');
