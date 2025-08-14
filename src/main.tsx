import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import App from './App.tsx'
import { PWAInstaller, registerSW } from './pwaInstaller'

// Importar sistemas PWA mejorados
import { offlineDB } from './offlineDB'
import { syncManager } from './syncManager'
import { offlineNotifications } from './offlineNotifications'
import { connectionStatus } from './connectionStatus'

// Inicializar sistemas PWA
// Inicializar sistemas PWA
async function initializePWA() {
  try {
    console.log('🚀 Inicializando sistemas PWA...');
    
    // 1. Inicializar base de datos offline con timeout
    const dbPromise = Promise.race([
      offlineDB.init(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB timeout')), 5000))
    ]);
    
    await dbPromise;
    console.log('✅ Base de datos offline inicializada');
    
    // 2. Configurar notificaciones (no bloquear si falla)
    try {
      await offlineNotifications.requestPermission();
      console.log('✅ Sistema de notificaciones configurado');
    } catch (notifError) {
      console.warn('⚠️ Notificaciones no disponibles:', notifError);
    }
    
    // 3. Iniciar sincronización automática
    syncManager.startAutoSync();
    console.log('✅ Sincronización automática iniciada');
    
    // 4. El indicador de conexión se inicia automáticamente
    console.log('✅ Indicador de conexión activo');
    
    // 5. Configurar eventos de sincronización (con protección de errores)
    syncManager.addEventListener((event) => {
      try {
        console.log('📡 Evento de sincronización:', event);
        
        if (event.type === 'sync-success') {
          offlineNotifications.showSyncSuccessNotification().catch(() => {});
        } else if (event.type === 'sync-error') {
          offlineNotifications.showSyncErrorNotification(event.error || 'Error desconocido').catch(() => {});
        } else if (event.type === 'offline') {
          offlineNotifications.showOfflineModeNotification().catch(() => {});
        }
      } catch (eventError) {
        console.warn('Error en evento de sincronización:', eventError);
      }
    });
    
    // 6. Mostrar notificación de bienvenida si es primera vez (con delay)
    const isFirstTime = !localStorage.getItem('pwa-initialized');
    if (isFirstTime) {
      setTimeout(() => {
        offlineNotifications.showNotification('¡Bienvenido a Compass Team!', {
          body: 'Tu aplicación está lista para trabajar offline. Puedes instalarla en tu dispositivo.',
          tag: 'welcome',
          requireInteraction: false // Cambiar a false para no bloquear
        }).catch(() => {}); // Silenciar errores de notificación
      }, 3000); // Aumentar delay
      
      localStorage.setItem('pwa-initialized', 'true');
    }
    
    console.log('🎉 Todos los sistemas PWA inicializados correctamente');
    
  } catch (error) {
    console.error('❌ Error inicializando sistemas PWA:', error);
    
    // Mostrar notificación de error solo si las notificaciones están disponibles
    setTimeout(() => {
      try {
        offlineNotifications.showNotification('⚠️ PWA Modo Limitado', {
          body: 'La aplicación funciona pero algunas características offline están limitadas.',
          tag: 'warning',
          requireInteraction: false
        }).catch(() => {
          // Si las notificaciones fallan, mostrar en consola
          console.warn('PWA iniciada en modo limitado');
        });
      } catch {
        console.warn('PWA iniciada en modo limitado');
      }
    }, 2000);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Inicializar PWA para Vite
registerSW();
const pwaInstaller = new PWAInstaller();

// Inicializar sistemas PWA mejorados
initializePWA();

// Hacer disponibles globalmente para debugging
(window as any).pwaInstaller = pwaInstaller;
(window as any).offlineDB = offlineDB;
(window as any).syncManager = syncManager;
(window as any).offlineNotifications = offlineNotifications;
(window as any).connectionStatus = connectionStatus;
