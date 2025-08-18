// PWA Installation Manager para Vite
export class PWAInstaller {
  private deferredPrompt: any = null;
  private isInstalled: boolean = false;

  constructor() {
    this.init();
  }

  private init(): void {
    // Detectar si ya está instalada
    this.checkIfInstalled();
    
    // Escuchar el evento beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      console.log('PWA: Evento beforeinstallprompt detectado');
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton();
    });

    // Escuchar cuando se instala la app
    window.addEventListener('appinstalled', () => {
      console.log('PWA: App instalada exitosamente');
      this.isInstalled = true;
      this.hideInstallButton();
      this.deferredPrompt = null;
    });
  }

  private checkIfInstalled(): void {
    // Verificar si está en modo standalone (instalada)
    if (window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true) {
      this.isInstalled = true;
      console.log('PWA: App ejecutándose en modo instalado');
    }
  }

  public async installApp(): Promise<boolean> {
    if (!this.deferredPrompt) {
      console.log('PWA: No hay prompt de instalación disponible');
      return false;
    }

    try {
      // Mostrar el prompt de instalación
      this.deferredPrompt.prompt();
      
      // Esperar la respuesta del usuario
      const result = await this.deferredPrompt.userChoice;
      
      if (result.outcome === 'accepted') {
        console.log('PWA: Usuario aceptó la instalación');
        return true;
      } else {
        console.log('PWA: Usuario rechazó la instalación');
        return false;
      }
    } catch (error) {
      console.error('PWA: Error durante la instalación:', error);
      return false;
    } finally {
      this.deferredPrompt = null;
    }
  }

  private showInstallButton(): void {
    // Crear botón de instalación si no existe
    if (!document.getElementById('pwa-install-button')) {
      const installButton = document.createElement('button');
      installButton.id = 'pwa-install-button';
      installButton.innerHTML = '📱 Instalar App';
      installButton.className = 'btn btn-primary position-fixed';
      installButton.style.cssText = `
        bottom: 20px;
        right: 20px;
        z-index: 1000;
        border-radius: 50px;
        padding: 10px 20px;
        box-shadow: 0 4px 12px rgba(0,123,255,0.3);
        animation: pulse 2s infinite;
      `;
      
      installButton.addEventListener('click', () => {
        this.installApp();
      });
      
      document.body.appendChild(installButton);
      console.log('PWA: Botón de instalación mostrado');
      
      // Agregar animación CSS
      this.addPulseAnimation();
    }
  }

  private addPulseAnimation(): void {
    if (!document.getElementById('pwa-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'pwa-pulse-style';
      style.textContent = `
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  private hideInstallButton(): void {
    const button = document.getElementById('pwa-install-button');
    if (button) {
      button.remove();
      console.log('PWA: Botón de instalación ocultado');
    }
  }

  public isInstallable(): boolean {
    return this.deferredPrompt !== null;
  }

  public isAppInstalled(): boolean {
    return this.isInstalled;
  }
}

// Service Worker registration específico para Vite
export function registerSW(): void {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        // Intentar primero el SW de producción (funciona mejor offline)
        let swUrl = '/service-worker.js';
        let registration;
        
        try {
          console.log('PWA: Intentando registrar SW de producción para mejor soporte offline');
          registration = await navigator.serviceWorker.register(swUrl, { scope: '/' });
        } catch (prodError) {
          // Si falla el de producción, usar el de desarrollo
          console.log('PWA: SW de producción no disponible, usando SW de desarrollo');
          swUrl = '/sw-dev.js';
          registration = await navigator.serviceWorker.register(swUrl, { scope: '/' });
        }
        
        console.log('PWA: Service Worker registrado exitosamente:', registration.scope);
        
        // Manejar updates 
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('PWA: Nueva versión disponible. Recarga para actualizar.');
                showUpdateNotification();
              }
            });
          }
        });
        
      } catch (error) {
        console.error('PWA: Error registrando Service Worker:', error);
        console.warn('PWA: SW registro falló. Intentando enfoque alternativo...');
        await registerDevSW();
      }
    });
  } else {
    console.warn('PWA: Service Workers no soportados en este navegador');
  }
}

// Función alternativa para modo desarrollo
async function registerDevSW(): Promise<void> {
  try {
    // Crear un service worker en línea para desarrollo
    const swCode = `
      console.log('PWA Dev SW: Iniciado');
      self.addEventListener('install', () => {
        console.log('PWA Dev SW: Instalado');
        self.skipWaiting();
      });
      self.addEventListener('activate', () => {
        console.log('PWA Dev SW: Activado');
        self.clients.claim();
      });
    `;
    
    const swBlob = new Blob([swCode], { type: 'application/javascript' });
    const swUrl = URL.createObjectURL(swBlob);
    
    const registration = await navigator.serviceWorker.register(swUrl, {
      scope: '/'
    });
    
    console.log('PWA: Service Worker de desarrollo registrado:', registration.scope);
    
    // Limpiar el URL object después del registro
    URL.revokeObjectURL(swUrl);
    
  } catch (error) {
    console.warn('PWA: No se pudo registrar SW alternativo:', error);
    console.info('PWA: Para funcionalidad completa usa "npm run preview"');
  }
}

function showUpdateNotification(): void {
  // Crear notificación de actualización
  const notification = document.createElement('div');
  notification.className = 'alert alert-info position-fixed';
  notification.style.cssText = `
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1001;
    min-width: 300px;
    text-align: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    border-radius: 8px;
  `;
  notification.innerHTML = `
    <strong>¡Nueva versión disponible!</strong><br>
    <button class="btn btn-sm btn-primary mt-2" onclick="window.location.reload()">
      Actualizar ahora
    </button>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-ocultar después de 10 segundos
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 10000);
}
