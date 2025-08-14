// Sistema de sincronización en tiempo real entre pestañas/ventanas
export interface SyncMessage {
  type: 'task-created' | 'task-updated' | 'task-deleted' | 'data-changed' | 'force-refresh' | 'ping-response' | 'ping-request';
  data?: any;
  timestamp: number;
  instanceId: string;
}

export class RealTimeSyncManager {
  private broadcastChannel: BroadcastChannel | null = null;
  private instanceId: string;
  private listeners: Map<string, Array<(data: any) => void>> = new Map();

  constructor() {
    this.instanceId = this.generateInstanceId();
    this.setupBroadcastChannel();
    this.setupStorageListener();
    this.setupServiceWorkerListener();
    this.setupUnloadHandler();
    this.setupHeartbeat();
    
    console.log(`🔄 RealTimeSync: Instancia ${this.instanceId.slice(-8)} inicializada`);
    
    // Enviar anuncio de nueva instancia
    setTimeout(() => {
      this.broadcast({
        type: 'data-changed',
        data: { action: 'new-instance-connected' },
        timestamp: Date.now()
      });
    }, 1000);
  }

  private generateInstanceId(): string {
    return `pwa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupBroadcastChannel(): void {
    if ('BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('compass-team-sync');
        
        this.broadcastChannel.addEventListener('message', (event) => {
          const message: SyncMessage = event.data;
          
          // No procesar mensajes de la misma instancia
          if (message.instanceId === this.instanceId) {
            return;
          }
          
          console.log('🔄 RealTimeSync: Mensaje recibido via BroadcastChannel:', message);
          this.handleSyncMessage(message);
        });
        
        console.log('✅ BroadcastChannel configurado');
      } catch (error) {
        console.warn('⚠️ BroadcastChannel no disponible:', error);
      }
    } else {
      console.warn('⚠️ BroadcastChannel no soportado en este navegador');
    }
  }

  private setupStorageListener(): void {
    // Fallback usando localStorage events para navegadores sin BroadcastChannel
    window.addEventListener('storage', (event) => {
      if (event.key === 'compass-team-sync-message' && event.newValue) {
        try {
          const message: SyncMessage = JSON.parse(event.newValue);
          
          // No procesar mensajes de la misma instancia
          if (message.instanceId === this.instanceId) {
            return;
          }
          
          console.log('🔄 RealTimeSync: Mensaje recibido via Storage:', message);
          this.handleSyncMessage(message);
          
          // Limpiar el mensaje después de procesarlo
          setTimeout(() => {
            localStorage.removeItem('compass-team-sync-message');
          }, 100);
          
        } catch (error) {
          console.error('Error procesando mensaje de storage:', error);
        }
      }
    });
    
    console.log('✅ Storage listener configurado');
  }

  private setupServiceWorkerListener(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SYNC_UPDATE') {
          console.log('🔄 RealTimeSync: Mensaje del Service Worker:', event.data);
          
          const message: SyncMessage = {
            type: 'data-changed',
            data: event.data.data,
            timestamp: Date.now(),
            instanceId: 'service-worker'
          };
          
          this.handleSyncMessage(message);
        }
      });
      
      console.log('✅ Service Worker listener configurado');
    }
  }

  private setupUnloadHandler(): void {
    window.addEventListener('beforeunload', () => {
      // Limpiar registro de instancia
      const instanceKey = `instance-${this.instanceId}`;
      localStorage.removeItem(instanceKey);
      
      this.broadcast({
        type: 'force-refresh',
        data: { reason: 'instance-closing' },
        timestamp: Date.now()
      });
    });
  }

  private setupHeartbeat(): void {
    // Actualizar timestamp de esta instancia cada 10 segundos
    const heartbeat = () => {
      const instanceKey = `instance-${this.instanceId}`;
      localStorage.setItem(instanceKey, Date.now().toString());
    };
    
    // Heartbeat inicial
    heartbeat();
    
    // Heartbeat periódico
    setInterval(heartbeat, 10000);
    
    console.log('💓 Heartbeat configurado');
  }

  private handleSyncMessage(message: SyncMessage): void {
    const { type, data } = message;
    
    // 🏓 RESPONDER A PINGS DE OTRAS INSTANCIAS
    if (type === 'ping-request') {
      // Responder inmediatamente al ping
      setTimeout(() => {
        this.broadcast({
          type: 'ping-response',
          data: { 
            checkId: data.checkId, 
            instanceId: this.instanceId,
            timestamp: Date.now()
          },
          timestamp: Date.now()
        });
      }, 100); // Pequeño delay para evitar bucles
      return; // No ejecutar otros listeners para pings
    }
    
    // Ejecutar listeners específicos del tipo
    const typeListeners = this.listeners.get(type) || [];
    typeListeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error en listener de ${type}:`, error);
      }
    });
    
    // Ejecutar listeners globales
    const globalListeners = this.listeners.get('*') || [];
    globalListeners.forEach(listener => {
      try {
        listener({ type, data, timestamp: message.timestamp });
      } catch (error) {
        console.error('Error en listener global:', error);
      }
    });
  }

  // ===== API PÚBLICA =====
  
  /**
   * Enviar mensaje a todas las instancias
   */
  broadcast(message: Omit<SyncMessage, 'instanceId'>): void {
    const fullMessage: SyncMessage = {
      type: message.type,
      data: message.data,
      timestamp: message.timestamp,
      instanceId: this.instanceId
    };
    
    // Enviar via BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(fullMessage);
        console.log('📡 Mensaje enviado via BroadcastChannel:', fullMessage);
      } catch (error) {
        console.error('Error enviando via BroadcastChannel:', error);
      }
    }
    
    // Fallback via localStorage
    try {
      localStorage.setItem('compass-team-sync-message', JSON.stringify(fullMessage));
      console.log('📡 Mensaje enviado via Storage:', fullMessage);
    } catch (error) {
      console.error('Error enviando via Storage:', error);
    }
    
    // Enviar via Service Worker
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({
          type: 'BROADCAST_TO_CLIENTS',
          data: fullMessage
        });
      } catch (error) {
        console.error('Error enviando via Service Worker:', error);
      }
    }
  }

  /**
   * Escuchar cambios específicos
   */
  on(type: string, callback: (data: any) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    
    this.listeners.get(type)!.push(callback);
    console.log(`👂 Listener registrado para: ${type}`);
  }

  /**
   * Dejar de escuchar cambios
   */
  off(type: string, callback: (data: any) => void): void {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      const index = typeListeners.indexOf(callback);
      if (index > -1) {
        typeListeners.splice(index, 1);
        console.log(`🔇 Listener removido para: ${type}`);
      }
    }
  }

  /**
   * Métodos específicos para tareas
   */
  syncTaskCreated(task: any): void {
    this.broadcast({
      type: 'task-created',
      data: task,
      timestamp: Date.now()
    });
  }

  syncTaskUpdated(task: any): void {
    this.broadcast({
      type: 'task-updated', 
      data: task,
      timestamp: Date.now()
    });
  }

  syncTaskDeleted(taskId: string): void {
    this.broadcast({
      type: 'task-deleted',
      data: { id: taskId },
      timestamp: Date.now()
    });
  }

  syncDataChanged(changeType: string, data?: any): void {
    this.broadcast({
      type: 'data-changed',
      data: { changeType, ...data },
      timestamp: Date.now()
    });
  }

  /**
   * Solicitar sincronización completa
   */
  requestFullSync(): void {
    this.broadcast({
      type: 'force-refresh',
      data: { reason: 'manual-sync' },
      timestamp: Date.now()
    });
  }

  /**
   * Obtener ID de esta instancia
   */
  getInstanceId(): string {
    return this.instanceId;
  }

  /**
   * Método simplificado para verificar instancias activas
   */
  async checkActiveInstances(): Promise<number> {
    // Método 1: Usar almacenamiento temporal para contar instancias
    const timestamp = Date.now();
    const instanceKey = `instance-${this.instanceId}`;
    
    try {
      // Registrar esta instancia
      localStorage.setItem(instanceKey, timestamp.toString());
      
      // Limpiar instancias antiguas (más de 30 segundos)
      const cutoff = timestamp - 30000;
      const allKeys = Object.keys(localStorage);
      
      let activeCount = 0;
      allKeys.forEach(key => {
        if (key.startsWith('instance-')) {
          const lastSeen = parseInt(localStorage.getItem(key) || '0');
          if (lastSeen > cutoff) {
            activeCount++;
          } else {
            localStorage.removeItem(key); // Limpiar instancias muertas
          }
        }
      });
      
      console.log(`🔄 Instancias activas detectadas: ${activeCount}`);
      return activeCount;
      
    } catch (error) {
      console.error('Error contando instancias:', error);
      
      // Fallback: usar método ping tradicional
      return this.checkActiveInstancesFallback();
    }
  }

  /**
   * Método fallback usando ping/pong
   */
  private async checkActiveInstancesFallback(): Promise<number> {
    return new Promise((resolve) => {
      const checkId = Math.random().toString(36).substr(2, 9);
      const responses = new Set<string>();
      
      console.log(`🏓 Ping fallback: Verificando instancias (ID: ${checkId})`);
      
      const tempListener = (data: any) => {
        if (data.checkId === checkId && data.instanceId !== this.instanceId) {
          responses.add(data.instanceId);
          console.log(`🏓 Pong recibido de: ${data.instanceId.slice(-8)}`);
        }
      };
      
      this.on('ping-response', tempListener);
      
      this.broadcast({
        type: 'ping-request',
        data: { checkId },
        timestamp: Date.now()
      });
      
      setTimeout(() => {
        this.off('ping-response', tempListener);
        const activeCount = responses.size + 1;
        console.log(`🏓 Ping fallback completado: ${activeCount} instancias`);
        resolve(activeCount);
      }, 1500);
    });
  }

  /**
   * Destruir la instancia
   */
  destroy(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
    
    this.listeners.clear();
    console.log(`🔄 RealTimeSync: Instancia ${this.instanceId} destruida`);
  }
}

// Instancia global
export const realTimeSync = new RealTimeSyncManager();
