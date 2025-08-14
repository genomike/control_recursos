// Sistema de notificaciones offline para PWA
export interface NotificationData {
  id: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  timestamp: Date;
  delivered: boolean;
  persistent: boolean;
}

export class OfflineNotifications {
  private isSupported: boolean;
  private permission: NotificationPermission = 'default';
  private registeredNotifications: Map<string, NotificationData> = new Map();

  constructor() {
    this.isSupported = 'Notification' in window && 'serviceWorker' in navigator;
    this.permission = this.isSupported ? Notification.permission : 'denied';
    this.loadStoredNotifications();
    
    console.log('OfflineNotifications: Inicializado', {
      supported: this.isSupported,
      permission: this.permission
    });
  }

  // ===== GESTIÓN DE PERMISOS =====
  async requestPermission(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('OfflineNotifications: Notificaciones no soportadas');
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    try {
      this.permission = await Notification.requestPermission();
      console.log('OfflineNotifications: Permiso solicitado:', this.permission);
      return this.permission === 'granted';
    } catch (error) {
      console.error('OfflineNotifications: Error solicitando permiso:', error);
      return false;
    }
  }

  // ===== NOTIFICACIONES INMEDIATAS =====
  async showNotification(
    title: string, 
    options: {
      body?: string;
      icon?: string;
      badge?: string;
      tag?: string;
      data?: any;
      requireInteraction?: boolean;
      silent?: boolean;
    } = {}
  ): Promise<boolean> {
    if (!await this.requestPermission()) {
      console.warn('OfflineNotifications: Sin permisos para mostrar notificación');
      return false;
    }

    try {
      // Usar Service Worker si está disponible
      const registration = await navigator.serviceWorker.ready;
      
      const notificationOptions = {
        body: options.body || '',
        icon: options.icon || '/pwa-192x192.png',
        badge: options.badge || '/pwa-144x144.png',
        tag: options.tag || 'default',
        data: options.data || {},
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false,
        timestamp: Date.now()
      };

      await registration.showNotification(title, notificationOptions);
      
      console.log('OfflineNotifications: Notificación mostrada:', title);
      return true;
    } catch (error) {
      console.error('OfflineNotifications: Error mostrando notificación:', error);
      
      // Fallback a notificación directa
      try {
        new Notification(title, {
          body: options.body,
          icon: options.icon || '/pwa-192x192.png',
          tag: options.tag,
          data: options.data
        });
        return true;
      } catch (fallbackError) {
        console.error('OfflineNotifications: Error en fallback:', fallbackError);
        return false;
      }
    }
  }

  // ===== NOTIFICACIONES PROGRAMADAS =====
  async scheduleNotification(
    id: string,
    title: string,
    body: string,
    scheduledTime: Date,
    options: {
      icon?: string;
      badge?: string;
      tag?: string;
      data?: any;
      persistent?: boolean;
    } = {}
  ): Promise<boolean> {
    const notificationData: NotificationData = {
      id,
      title,
      body,
      icon: options.icon || '/pwa-192x192.png',
      badge: options.badge || '/pwa-144x144.png',
      tag: options.tag || id,
      data: options.data || {},
      timestamp: scheduledTime,
      delivered: false,
      persistent: options.persistent || false
    };

    this.registeredNotifications.set(id, notificationData);
    await this.saveStoredNotifications();

    const delay = scheduledTime.getTime() - Date.now();
    
    if (delay <= 0) {
      // Mostrar inmediatamente si la fecha ya pasó
      return this.deliverScheduledNotification(id);
    } else {
      // Programar para el futuro
      setTimeout(() => {
        this.deliverScheduledNotification(id);
      }, delay);
      
      console.log(`OfflineNotifications: Notificación programada para ${scheduledTime.toLocaleString()}`);
      return true;
    }
  }

  private async deliverScheduledNotification(id: string): Promise<boolean> {
    const notification = this.registeredNotifications.get(id);
    if (!notification || notification.delivered) {
      return false;
    }

    const success = await this.showNotification(notification.title, {
      body: notification.body,
      icon: notification.icon,
      badge: notification.badge,
      tag: notification.tag,
      data: notification.data,
      requireInteraction: notification.persistent
    });

    if (success) {
      notification.delivered = true;
      if (!notification.persistent) {
        this.registeredNotifications.delete(id);
      }
      await this.saveStoredNotifications();
    }

    return success;
  }

  // ===== GESTIÓN DE NOTIFICACIONES EXISTENTES =====
  async cancelNotification(id: string): Promise<boolean> {
    const notification = this.registeredNotifications.get(id);
    if (!notification) {
      return false;
    }

    this.registeredNotifications.delete(id);
    await this.saveStoredNotifications();

    // Intentar cancelar notificación activa si tiene tag
    try {
      const registration = await navigator.serviceWorker.ready;
      const notifications = await registration.getNotifications({ tag: notification.tag });
      notifications.forEach(n => n.close());
    } catch (error) {
      console.warn('OfflineNotifications: No se pudo cancelar notificación activa:', error);
    }

    console.log('OfflineNotifications: Notificación cancelada:', id);
    return true;
  }

  async getScheduledNotifications(): Promise<NotificationData[]> {
    return Array.from(this.registeredNotifications.values())
      .filter(n => !n.delivered)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async clearAllNotifications(): Promise<void> {
    this.registeredNotifications.clear();
    await this.saveStoredNotifications();
    
    // Limpiar notificaciones activas
    try {
      const registration = await navigator.serviceWorker.ready;
      const notifications = await registration.getNotifications();
      notifications.forEach(n => n.close());
    } catch (error) {
      console.warn('OfflineNotifications: No se pudieron limpiar notificaciones activas:', error);
    }
  }

  // ===== PERSISTENCIA =====
  private async saveStoredNotifications(): Promise<void> {
    try {
      const data = Array.from(this.registeredNotifications.entries()).map(([id, notification]) => [
        id,
        {
          ...notification,
          timestamp: notification.timestamp.toISOString()
        }
      ]);
      
      localStorage.setItem('pwa-notifications', JSON.stringify(data));
    } catch (error) {
      console.error('OfflineNotifications: Error guardando notificaciones:', error);
    }
  }

  private async loadStoredNotifications(): Promise<void> {
    try {
      const stored = localStorage.getItem('pwa-notifications');
      if (!stored) return;

      const data = JSON.parse(stored);
      const now = Date.now();

      for (const [id, notificationData] of data) {
        const notification: NotificationData = {
          ...notificationData,
          timestamp: new Date(notificationData.timestamp)
        };

        // Solo cargar notificaciones futuras no entregadas
        if (!notification.delivered && notification.timestamp.getTime() > now) {
          this.registeredNotifications.set(id, notification);
          
          // Re-programar la notificación
          const delay = notification.timestamp.getTime() - now;
          setTimeout(() => {
            this.deliverScheduledNotification(id);
          }, delay);
        }
      }

      console.log(`OfflineNotifications: ${this.registeredNotifications.size} notificaciones cargadas`);
    } catch (error) {
      console.error('OfflineNotifications: Error cargando notificaciones:', error);
    }
  }

  // ===== NOTIFICACIONES PREDEFINIDAS =====
  async showSyncSuccessNotification(): Promise<boolean> {
    return this.showNotification('✅ Sincronización completada', {
      body: 'Todos los datos han sido sincronizados correctamente',
      tag: 'sync-success',
      silent: true
    });
  }

  async showSyncErrorNotification(error: string): Promise<boolean> {
    return this.showNotification('❌ Error de sincronización', {
      body: `Error: ${error}`,
      tag: 'sync-error',
      requireInteraction: true
    });
  }

  async showOfflineModeNotification(): Promise<boolean> {
    return this.showNotification('📱 Modo offline activo', {
      body: 'Trabajando sin conexión. Los cambios se sincronizarán cuando vuelva la conexión.',
      tag: 'offline-mode',
      silent: true
    });
  }

  async showTaskReminderNotification(taskTitle: string, dueTime: string): Promise<boolean> {
    return this.showNotification('⏰ Recordatorio de tarea', {
      body: `"${taskTitle}" - Vence: ${dueTime}`,
      tag: 'task-reminder',
      requireInteraction: true,
      data: { type: 'task-reminder', taskTitle }
    });
  }

  // ===== UTILIDADES =====
  getPermissionStatus(): NotificationPermission {
    return this.permission;
  }

  isNotificationSupported(): boolean {
    return this.isSupported;
  }

  async getActiveNotifications(): Promise<Notification[]> {
    try {
      const registration = await navigator.serviceWorker.ready;
      return await registration.getNotifications();
    } catch (error) {
      console.error('OfflineNotifications: Error obteniendo notificaciones activas:', error);
      return [];
    }
  }
}

// Instancia global
export const offlineNotifications = new OfflineNotifications();
