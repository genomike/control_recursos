// Sistema de base de datos offline para PWA
import { realTimeSync } from './realTimeSync';

export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high';
  category?: string;
  syncStatus: 'synced' | 'pending' | 'conflict';
}

export interface SyncData {
  id: string;
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: Date;
  retryCount: number;
}

class OfflineDB {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'CompassTeamPWA';
  private readonly version = 1;

  async init(): Promise<void> {
    // Si ya está inicializada, no hacer nada
    if (this.db) {
      console.log('OfflineDB: Base de datos ya inicializada');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(this.dbName, this.version);

        request.onerror = () => {
          console.error('OfflineDB: Error abriendo la base de datos', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          this.db = request.result;
          console.log('OfflineDB: Base de datos inicializada correctamente');
          resolve();
        };

        request.onupgradeneeded = (event) => {
          try {
            const db = (event.target as IDBOpenDBRequest).result;
            console.log('OfflineDB: Creando/actualizando esquema de base de datos');

            // Store para tareas
            if (!db.objectStoreNames.contains('tasks')) {
              const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
              taskStore.createIndex('completed', 'completed', { unique: false });
              taskStore.createIndex('priority', 'priority', { unique: false });
              taskStore.createIndex('dueDate', 'dueDate', { unique: false });
              taskStore.createIndex('syncStatus', 'syncStatus', { unique: false });
              console.log('OfflineDB: Store de tareas creado');
            }

            // Store para datos de sincronización pendientes
            if (!db.objectStoreNames.contains('syncQueue')) {
              const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
              syncStore.createIndex('timestamp', 'timestamp', { unique: false });
              syncStore.createIndex('action', 'action', { unique: false });
              console.log('OfflineDB: Store de sincronización creado');
            }

            // Store para configuración de la app
            if (!db.objectStoreNames.contains('settings')) {
              db.createObjectStore('settings', { keyPath: 'key' });
              console.log('OfflineDB: Store de configuración creado');
            }

            // Store para notificaciones offline
            if (!db.objectStoreNames.contains('notifications')) {
              const notifStore = db.createObjectStore('notifications', { keyPath: 'id' });
              notifStore.createIndex('timestamp', 'timestamp', { unique: false });
              notifStore.createIndex('read', 'read', { unique: false });
              console.log('OfflineDB: Store de notificaciones creado');
            }
          } catch (upgradeError) {
            console.error('OfflineDB: Error en upgrade de base de datos:', upgradeError);
            reject(upgradeError);
          }
        };
      } catch (initError) {
        console.error('OfflineDB: Error iniciando IndexedDB:', initError);
        reject(initError);
      }
    });
  }

  // ===== OPERACIONES DE TAREAS =====
  async saveTasks(tasks: Task[]): Promise<void> {
    if (!this.db) throw new Error('Base de datos no inicializada');

    const transaction = this.db.transaction(['tasks'], 'readwrite');
    const store = transaction.objectStore('tasks');

    const promises = tasks.map(task => {
      return new Promise<void>((resolve, reject) => {
        const request = store.put({
          ...task,
          updatedAt: new Date(),
          syncStatus: task.syncStatus || 'pending'
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });

    await Promise.all(promises);
    console.log(`OfflineDB: ${tasks.length} tareas guardadas`);
    
    // 🔄 SINCRONIZACIÓN EN TIEMPO REAL
    tasks.forEach(task => {
      realTimeSync.syncTaskUpdated(task);
    });
  }

  async getTasks(): Promise<Task[]> {
    // Verificación de seguridad mejorada
    if (!this.db) {
      console.warn('OfflineDB: Base de datos no inicializada, intentando inicializar...');
      try {
        await this.init();
      } catch (error) {
        console.error('OfflineDB: Error inicializando base de datos:', error);
        return []; // Retornar array vacío en lugar de error
      }
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(['tasks'], 'readonly');
        const store = transaction.objectStore('tasks');
        const request = store.getAll();

        request.onsuccess = () => {
          try {
            const tasks = request.result.map(task => ({
              ...task,
              createdAt: new Date(task.createdAt),
              updatedAt: new Date(task.updatedAt),
              dueDate: task.dueDate ? new Date(task.dueDate) : undefined
            }));
            console.log(`OfflineDB: ${tasks.length} tareas recuperadas`);
            resolve(tasks);
          } catch (mapError) {
            console.error('OfflineDB: Error procesando tareas:', mapError);
            resolve([]); // Retornar array vacío en caso de error
          }
        };

        request.onerror = () => {
          console.error('OfflineDB: Error en request getTasks:', request.error);
          resolve([]); // Retornar array vacío en lugar de rechazar
        };
        
        transaction.onerror = () => {
          console.error('OfflineDB: Error en transacción getTasks:', transaction.error);
          resolve([]); // Retornar array vacío en lugar de rechazar
        };
        
      } catch (transactionError) {
        console.error('OfflineDB: Error creando transacción:', transactionError);
        resolve([]); // Retornar array vacío en lugar de rechazar
      }
    });
  }

  async saveTask(task: Task): Promise<void> {
    await this.saveTasks([task]);
    
    // 🔄 SINCRONIZACIÓN EN TIEMPO REAL
    realTimeSync.syncTaskCreated(task);
  }

  async deleteTask(taskId: string): Promise<void> {
    if (!this.db) throw new Error('Base de datos no inicializada');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['tasks'], 'readwrite');
      const store = transaction.objectStore('tasks');
      const request = store.delete(taskId);

      request.onsuccess = () => {
        console.log(`OfflineDB: Tarea ${taskId} eliminada`);
        
        // 🔄 SINCRONIZACIÓN EN TIEMPO REAL
        realTimeSync.syncTaskDeleted(taskId);
        
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ===== OPERACIONES DE SINCRONIZACIÓN =====
  async addToSyncQueue(action: 'create' | 'update' | 'delete', data: any): Promise<void> {
    if (!this.db) throw new Error('Base de datos no inicializada');

    const syncData: SyncData = {
      id: crypto.randomUUID(),
      action,
      data,
      timestamp: new Date(),
      retryCount: 0
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const request = store.add(syncData);

      request.onsuccess = () => {
        console.log(`OfflineDB: Acción ${action} agregada a cola de sincronización`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getSyncQueue(): Promise<SyncData[]> {
    if (!this.db) throw new Error('Base de datos no inicializada');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readonly');
      const store = transaction.objectStore('syncQueue');
      const request = store.getAll();

      request.onsuccess = () => {
        const syncData = request.result.map(item => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
        resolve(syncData);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearSyncQueue(): Promise<void> {
    if (!this.db) throw new Error('Base de datos no inicializada');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const request = store.clear();

      request.onsuccess = () => {
        console.log('OfflineDB: Cola de sincronización limpiada');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ===== CONFIGURACIÓN =====
  async setSetting(key: string, value: any): Promise<void> {
    if (!this.db) throw new Error('Base de datos no inicializada');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put({ key, value, updatedAt: new Date() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSetting(key: string): Promise<any> {
    if (!this.db) throw new Error('Base de datos no inicializada');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result?.value);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ===== NOTIFICACIONES OFFLINE =====
  async saveNotification(notification: any): Promise<void> {
    if (!this.db) throw new Error('Base de datos no inicializada');

    const notif = {
      ...notification,
      id: notification.id || crypto.randomUUID(),
      timestamp: new Date(),
      read: false
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['notifications'], 'readwrite');
      const store = transaction.objectStore('notifications');
      const request = store.put(notif);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getUnreadNotifications(): Promise<any[]> {
    if (!this.db) throw new Error('Base de datos no inicializada');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['notifications'], 'readonly');
      const store = transaction.objectStore('notifications');
      const index = store.index('read');
      const request = index.getAll(IDBKeyRange.only(false));

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ===== UTILIDADES =====
  async getStorageUsage(): Promise<{ used: number; quota: number; percentage: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentage = quota > 0 ? (used / quota) * 100 : 0;
      
      return { used, quota, percentage };
    }
    
    return { used: 0, quota: 0, percentage: 0 };
  }

  async clearAllData(): Promise<void> {
    if (!this.db) throw new Error('Base de datos no inicializada');

    const storeNames = ['tasks', 'syncQueue', 'settings', 'notifications'];
    const transaction = this.db.transaction(storeNames, 'readwrite');

    const promises = storeNames.map(storeName => {
      return new Promise<void>((resolve, reject) => {
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });

    await Promise.all(promises);
    console.log('OfflineDB: Todos los datos eliminados');
  }
}

// Instancia global
export const offlineDB = new OfflineDB();
