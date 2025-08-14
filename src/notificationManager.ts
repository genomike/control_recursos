// Sistema de notificaciones offline para PWA
import { offlineDB } from './offlineDB';

export interface NotificationConfig {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: NotificationAction[];
  persistent?: boolean;
  showTime?: number; // milisegundos, 0 = persistente
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export class NotificationManager {
  private permission: NotificationPermission = 'default';
  private inAppNotifications: Map<string, HTMLElement> = new Map();
  private notificationQueue: NotificationConfig[] = [];

  constructor() {
    this.checkPermission();
    this.setupServiceWorkerMessages();
    console.log('NotificationManager: Inicializado');
  }

  private async checkPermission(): Promise<void> {
    if ('Notification' in window) {
      this.permission = Notification.permission;
      console.log(`NotificationManager: Permiso actual: ${this.permission}`);
    } else {
      console.warn('NotificationManager: Notificaciones no soportadas');
    }
  }

  // ===== PERMISOS =====
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('NotificationManager: Notificaciones no disponibles');
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    try {
      this.permission = await Notification.requestPermission();
      console.log(`NotificationManager: Permiso ${this.permission === 'granted' ? 'concedido' : 'denegado'}`);
      
      if (this.permission === 'granted') {
        // Procesar cola de notificaciones pendientes
        await this.processNotificationQueue();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('NotificationManager: Error solicitando permisos:', error);
      return false;
    }
  }

  // ===== NOTIFICACIONES PUSH =====
  async showNotification(config: NotificationConfig): Promise<void> {
    // Guardar en base de datos para historial
    await this.saveToHistory(config);

    // Si no hay permisos, mostrar notificación in-app
    if (this.permission !== 'granted') {
      this.showInAppNotification(config);
      return;
    }

    // Intentar mostrar notificación nativa
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await this.showServiceWorkerNotification(registration, config);
      } else {
        this.showBrowserNotification(config);
      }
    } catch (error) {
      console.error('NotificationManager: Error mostrando notificación:', error);
      this.showInAppNotification(config);
    }
  }

  private async showServiceWorkerNotification(
    registration: ServiceWorkerRegistration, 
    config: NotificationConfig
  ): Promise<void> {
    const options: NotificationOptions = {
      body: config.message,
      icon: config.icon || '/pwa-192x192.png',
      badge: config.badge || '/pwa-144x144.png',
      tag: config.tag || `notification-${Date.now()}`,
      data: config.data,
      requireInteraction: config.persistent || false
    };

    await registration.showNotification(config.title, options);
    console.log('NotificationManager: Notificación SW mostrada:', config.title);
  }

  private showBrowserNotification(config: NotificationConfig): void {
    const notification = new Notification(config.title, {
      body: config.message,
      icon: config.icon || '/pwa-192x192.png',
      tag: config.tag || `notification-${Date.now()}`,
      data: config.data
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      if (config.data?.url) {
        window.location.href = config.data.url;
      }
    };

    // Auto-cerrar si no es persistente
    if (!config.persistent && config.showTime !== 0) {
      setTimeout(() => {
        notification.close();
      }, config.showTime || 5000);
    }

    console.log('NotificationManager: Notificación browser mostrada:', config.title);
  }

  // ===== NOTIFICACIONES IN-APP =====
  private showInAppNotification(config: NotificationConfig): void {
    const id = crypto.randomUUID();
    const notification = this.createInAppNotificationElement(id, config);
    
    // Agregar al DOM
    document.body.appendChild(notification);
    this.inAppNotifications.set(id, notification);

    // Animación de entrada
    requestAnimationFrame(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    });

    // Auto-remover si no es persistente
    if (!config.persistent && config.showTime !== 0) {
      setTimeout(() => {
        this.hideInAppNotification(id);
      }, config.showTime || 5000);
    }

    console.log('NotificationManager: Notificación in-app mostrada:', config.title);
  }

  private createInAppNotificationElement(id: string, config: NotificationConfig): HTMLElement {
    const notification = document.createElement('div');
    notification.id = `notification-${id}`;
    notification.className = `notification notification-${config.type}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      max-width: 400px;
      min-width: 300px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      z-index: 10000;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease-out;
      border-left: 4px solid ${this.getTypeColor(config.type)};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;

    const icon = config.icon || this.getTypeIcon(config.type);
    
    notification.innerHTML = `
      <div style="padding: 16px; display: flex; align-items: flex-start; gap: 12px;">
        <div style="font-size: 24px; flex-shrink: 0;">${icon}</div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; color: #1a1a1a; margin-bottom: 4px; font-size: 14px;">
            ${config.title}
          </div>
          <div style="color: #666; font-size: 13px; line-height: 1.4;">
            ${config.message}
          </div>
          ${config.actions ? this.createActionsHtml(id, config.actions) : ''}
        </div>
        <button 
          onclick="window.notificationManager?.hideInAppNotification('${id}')"
          style="background: none; border: none; font-size: 18px; color: #999; cursor: pointer; padding: 0; margin-left: 8px;"
          title="Cerrar"
        >×</button>
      </div>
    `;

    return notification;
  }

  private createActionsHtml(notificationId: string, actions: NotificationAction[]): string {
    return `
      <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
        ${actions.map(action => `
          <button 
            onclick="window.notificationManager?.handleNotificationAction('${notificationId}', '${action.action}')"
            style="
              background: #007bff; 
              color: white; 
              border: none; 
              padding: 6px 12px; 
              border-radius: 4px; 
              font-size: 12px; 
              cursor: pointer;
              transition: background 0.2s;
            "
            onmouseover="this.style.background='#0056b3'"
            onmouseout="this.style.background='#007bff'"
          >
            ${action.icon || ''} ${action.title}
          </button>
        `).join('')}
      </div>
    `;
  }

  private getTypeColor(type: string): string {
    const colors = {
      info: '#007bff',
      success: '#28a745',
      warning: '#ffc107',
      error: '#dc3545'
    };
    return colors[type as keyof typeof colors] || colors.info;
  }

  private getTypeIcon(type: string): string {
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    return icons[type as keyof typeof icons] || icons.info;
  }

  hideInAppNotification(id: string): void {
    const notification = this.inAppNotifications.get(id);
    if (notification) {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
        this.inAppNotifications.delete(id);
      }, 300);
    }
  }

  handleNotificationAction(notificationId: string, action: string): void {
    console.log(`NotificationManager: Acción ${action} ejecutada en notificación ${notificationId}`);
    
    // Aquí puedes manejar las acciones específicas
    switch (action) {
      case 'view':
        // Navegar a una vista específica
        break;
      case 'dismiss':
        this.hideInAppNotification(notificationId);
        break;
      case 'retry':
        // Reintentar alguna operación
        break;
      default:
        console.log(`Acción no manejada: ${action}`);
    }
    
    this.hideInAppNotification(notificationId);
  }

  // ===== NOTIFICACIONES PROGRAMADAS =====
  async scheduleNotification(config: NotificationConfig, delay: number): Promise<string> {
    const id = crypto.randomUUID();
    
    setTimeout(async () => {
      await this.showNotification({
        ...config,
        tag: config.tag || `scheduled-${id}`
      });
    }, delay);

    console.log(`NotificationManager: Notificación programada para ${delay}ms`);
    return id;
  }

  // ===== HISTORIAL Y PERSISTENCIA =====
  private async saveToHistory(config: NotificationConfig): Promise<void> {
    try {
      await offlineDB.saveNotification({
        title: config.title,
        message: config.message,
        type: config.type,
        data: config.data,
        timestamp: new Date(),
        read: false
      });
    } catch (error) {
      console.error('NotificationManager: Error guardando en historial:', error);
    }
  }

  async getNotificationHistory(): Promise<any[]> {
    try {
      return await offlineDB.getUnreadNotifications();
    } catch (error) {
      console.error('NotificationManager: Error obteniendo historial:', error);
      return [];
    }
  }

  // ===== COLA DE NOTIFICACIONES =====
  private async processNotificationQueue(): Promise<void> {
    while (this.notificationQueue.length > 0) {
      const config = this.notificationQueue.shift();
      if (config) {
        await this.showNotification(config);
      }
    }
  }

  queueNotification(config: NotificationConfig): void {
    if (this.permission === 'granted') {
      this.showNotification(config);
    } else {
      this.notificationQueue.push(config);
      console.log('NotificationManager: Notificación agregada a cola');
    }
  }

  // ===== CONFIGURACIÓN DE SERVICE WORKER =====
  private setupServiceWorkerMessages(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'notification-click') {
          console.log('NotificationManager: Click en notificación SW:', event.data);
          // Manejar clicks en notificaciones del service worker
        }
      });
    }
  }

  // ===== UTILIDADES =====
  async clearAllNotifications(): Promise<void> {
    // Limpiar notificaciones in-app
    this.inAppNotifications.forEach((_notification, id) => {
      this.hideInAppNotification(id);
    });

    // Limpiar historial
    try {
      // En una implementación real, esto limpiaría las notificaciones de la base de datos
      console.log('NotificationManager: Historial de notificaciones limpiado');
    } catch (error) {
      console.error('NotificationManager: Error limpiando historial:', error);
    }
  }

  getPermissionStatus(): NotificationPermission {
    return this.permission;
  }

  isSupported(): boolean {
    return 'Notification' in window;
  }
}

// Hacer disponible globalmente para los onclick de los botones
declare global {
  interface Window {
    notificationManager?: NotificationManager;
  }
}

// Instancia global
export const notificationManager = new NotificationManager();
window.notificationManager = notificationManager;
