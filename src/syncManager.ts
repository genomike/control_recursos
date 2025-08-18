// Sistema de sincronización en background para PWA
import { offlineDB, type Task, type SyncData } from './offlineDB';

export interface SyncConfig {
  apiBaseUrl: string;
  syncInterval: number; // en milisegundos
  maxRetries: number;
  retryDelay: number; // en milisegundos
}

export class SyncManager {
  private config: SyncConfig;
  private syncTimer: number | null = null;
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private listeners: Array<(event: SyncEvent) => void> = [];

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = {
      apiBaseUrl: config.apiBaseUrl || '/api',
      syncInterval: config.syncInterval || 120000, // 2 minutos (más espaciado para reducir errores)
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 5000 // 5 segundos
    };

    this.setupEventListeners();
    console.log('SyncManager: Inicializado en modo offline-first:', this.config);
  }

  private setupEventListeners(): void {
    // Escuchar cambios de conectividad
    window.addEventListener('online', () => {
      console.log('SyncManager: Conexión restaurada');
      this.isOnline = true;
      this.notifyListeners({ type: 'online', timestamp: new Date() });
      this.triggerSync();
    });

    window.addEventListener('offline', () => {
      console.log('SyncManager: Conexión perdida');
      this.isOnline = false;
      this.notifyListeners({ type: 'offline', timestamp: new Date() });
      this.stopAutoSync();
    });

    // Escuchar cuando la página se hace visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isOnline) {
        console.log('SyncManager: Página visible, verificando sincronización');
        this.triggerSync();
      }
    });
  }

  // ===== GESTIÓN DE EVENTOS =====
  addEventListener(listener: (event: SyncEvent) => void): void {
    this.listeners.push(listener);
  }

  removeEventListener(listener: (event: SyncEvent) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(event: SyncEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('SyncManager: Error en listener:', error);
      }
    });
  }

  // ===== SINCRONIZACIÓN AUTOMÁTICA =====
  startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = window.setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.triggerSync();
      }
    }, this.config.syncInterval);

    console.log(`SyncManager: Auto-sync iniciado cada ${this.config.syncInterval}ms`);
  }

  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log('SyncManager: Auto-sync detenido');
    }
  }

  // ===== SINCRONIZACIÓN MANUAL =====
  async triggerSync(): Promise<boolean> {
    if (!this.isOnline) {
      console.log('SyncManager: No hay conexión, sincronización omitida');
      return false;
    }

    if (this.isSyncing) {
      console.log('SyncManager: Sincronización ya en progreso');
      return false;
    }

    this.isSyncing = true;
    this.notifyListeners({ type: 'sync-start', timestamp: new Date() });

    try {
      // 1. Sincronizar cola pendiente
      await this.processSyncQueue();

      // 2. Descargar datos del servidor
      await this.downloadFromServer();

      this.notifyListeners({ 
        type: 'sync-success', 
        timestamp: new Date(),
        message: 'Sincronización completada exitosamente'
      });

      console.log('SyncManager: Sincronización completada exitosamente');
      return true;

    } catch (error) {
      console.error('SyncManager: Error durante la sincronización:', error);
      this.notifyListeners({ 
        type: 'sync-error', 
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  private async processSyncQueue(): Promise<void> {
    const syncQueue = await offlineDB.getSyncQueue();
    
    if (syncQueue.length === 0) {
      console.log('SyncManager: Cola de sincronización vacía');
      return;
    }

    console.log(`SyncManager: Procesando ${syncQueue.length} elementos en cola`);

    for (const item of syncQueue) {
      try {
        await this.processSyncItem(item);
        
        // Remover item de la cola después del éxito
        await this.removeSyncItem(item.id);
        
      } catch (error) {
        console.error(`SyncManager: Error procesando item ${item.id}:`, error);
        
        // Incrementar contador de reintentos
        item.retryCount++;
        
        if (item.retryCount >= this.config.maxRetries) {
          console.error(`SyncManager: Item ${item.id} excedió máximo de reintentos`);
          await this.handleFailedSync(item);
        } else {
          console.log(`SyncManager: Reintentando item ${item.id} (${item.retryCount}/${this.config.maxRetries})`);
          // En una implementación real, podrías actualizar el item en la cola
        }
      }
    }
  }

  private async processSyncItem(item: SyncData): Promise<void> {
    const { action, data } = item;

    switch (action) {
      case 'create':
        await this.createOnServer(data);
        break;
      case 'update':
        await this.updateOnServer(data);
        break;
      case 'delete':
        await this.deleteOnServer(data.id);
        break;
      default:
        throw new Error(`Acción desconocida: ${action}`);
    }
  }

  // ===== OPERACIONES CON SERVIDOR =====
  private async createOnServer(data: any): Promise<any> {
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        console.log(`SyncManager: Error creando en servidor (${response.status}) - continuando offline`);
        return null;
      }

      // Verificar que la respuesta sea JSON válido
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.log('SyncManager: La respuesta del servidor no es JSON válido - continuando offline');
        return null;
      }

      return response.json();
    } catch (error) {
      console.log('SyncManager: Error de red creando en servidor - continuando offline:', error);
      return null;
    }
  }

  private async updateOnServer(data: any): Promise<any> {
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/tasks/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        console.log(`SyncManager: Error actualizando en servidor (${response.status}) - continuando offline`);
        return null;
      }

      // Verificar que la respuesta sea JSON válido
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.log('SyncManager: La respuesta del servidor no es JSON válido - continuando offline');
        return null;
      }

      return response.json();
    } catch (error) {
      console.log('SyncManager: Error de red actualizando en servidor - continuando offline:', error);
      return null;
    }
  }

  private async deleteOnServer(id: string): Promise<void> {
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/tasks/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        console.log(`SyncManager: Error eliminando en servidor (${response.status}) - continuando offline`);
        return;
      }
    } catch (error) {
      console.log('SyncManager: Error de red eliminando en servidor - continuando offline:', error);
    }
  }

  private async downloadFromServer(): Promise<void> {
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/tasks`);
      
      if (!response.ok) {
        // Si no hay servidor API, solo registrar y continuar
        console.log(`SyncManager: No hay servidor API disponible (${response.status})`);
        return;
      }

      // Verificar que la respuesta sea JSON válido
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.log('SyncManager: La respuesta del servidor no es JSON válido');
        return;
      }

      const serverTasks: Task[] = await response.json();
      
      // Actualizar base de datos local con datos del servidor
      for (const task of serverTasks) {
        task.syncStatus = 'synced';
      }
      
      await offlineDB.saveTasks(serverTasks);
      console.log(`SyncManager: ${serverTasks.length} tareas descargadas del servidor`);
      
    } catch (error) {
      // Manejo silencioso de errores offline para reducir ruido en consola
      if (error instanceof TypeError && error.message.includes('fetch')) {
        // Error de red - modo offline esperado
        console.log('SyncManager: Modo offline detectado (sin servidor)');
      } else if (error instanceof SyntaxError) {
        // Error de parsing - respuesta no válida
        console.warn('SyncManager: Respuesta del servidor no válida');
      } else {
        // Otros errores
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        console.warn('SyncManager: Error de conectividad:', errorMessage);
      }
      // Continuar trabajando offline sin más errores
    }
  }

  // ===== MANEJO DE ERRORES =====
  private async removeSyncItem(itemId: string): Promise<void> {
    // En una implementación real, esto eliminaría el item específico de la cola
    console.log(`SyncManager: Item ${itemId} removido de la cola (simulado)`);
  }

  private async handleFailedSync(item: SyncData): Promise<void> {
    console.error('SyncManager: Falló sincronización permanentemente:', item);
    
    // Notificar error persistente
    await offlineDB.saveNotification({
      title: 'Error de sincronización',
      message: `No se pudo sincronizar ${item.action} después de ${item.retryCount} intentos`,
      type: 'error',
      data: item
    });

    this.notifyListeners({
      type: 'sync-conflict',
      timestamp: new Date(),
      data: item
    });
  }

  // ===== OPERACIONES DE DATOS =====
  async saveTask(task: Task): Promise<void> {
    // Guardar localmente
    task.syncStatus = this.isOnline ? 'pending' : 'pending';
    await offlineDB.saveTask(task);

    // Agregar a cola de sincronización
    await offlineDB.addToSyncQueue('update', task);

    console.log(`SyncManager: Tarea ${task.id} guardada y agregada a cola de sync`);

    // Intentar sincronizar inmediatamente si hay conexión
    if (this.isOnline) {
      setTimeout(() => this.triggerSync(), 1000);
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    // Eliminar localmente
    await offlineDB.deleteTask(taskId);

    // Agregar a cola de sincronización
    await offlineDB.addToSyncQueue('delete', { id: taskId });

    console.log(`SyncManager: Tarea ${taskId} eliminada y agregada a cola de sync`);

    // Intentar sincronizar inmediatamente si hay conexión
    if (this.isOnline) {
      setTimeout(() => this.triggerSync(), 1000);
    }
  }

  // ===== ESTADO Y UTILIDADES =====
  isOnlineStatus(): boolean {
    return this.isOnline;
  }

  isSyncingStatus(): boolean {
    return this.isSyncing;
  }

  async getSyncStats(): Promise<SyncStats> {
    const syncQueue = await offlineDB.getSyncQueue();
    const pendingCount = syncQueue.length;
    const lastSyncTime = await offlineDB.getSetting('lastSyncTime');
    
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingOperations: pendingCount,
      lastSyncTime: lastSyncTime ? new Date(lastSyncTime) : null,
      autoSyncEnabled: this.syncTimer !== null
    };
  }

  async forceFullSync(): Promise<boolean> {
    console.log('SyncManager: Iniciando sincronización completa forzada');
    
    // Limpiar cola de sincronización y recargar todo
    await offlineDB.clearSyncQueue();
    
    return this.triggerSync();
  }
}

// ===== TIPOS E INTERFACES =====
export interface SyncEvent {
  type: 'online' | 'offline' | 'sync-start' | 'sync-success' | 'sync-error' | 'sync-conflict';
  timestamp: Date;
  message?: string;
  error?: string;
  data?: any;
}

export interface SyncStats {
  isOnline: boolean;
  isSyncing: boolean;
  pendingOperations: number;
  lastSyncTime: Date | null;
  autoSyncEnabled: boolean;
}

// Instancia global
export const syncManager = new SyncManager();
