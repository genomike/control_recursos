import { useState, useEffect, useCallback } from 'react';
import { realTimeSync } from './realTimeSync';
import { offlineDB } from './offlineDB';
import type { Task } from './offlineDB';

export interface UseRealTimeSyncOptions {
  autoRefresh?: boolean;
  enableNotifications?: boolean;
}

export const useRealTimeSync = (options: UseRealTimeSyncOptions = {}) => {
  const { autoRefresh = true, enableNotifications = true } = options;
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [activeInstances, setActiveInstances] = useState(1);
  const [connectionStatus] = useState('connected');

  // Cargar tareas iniciales
  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const loadedTasks = await offlineDB.getTasks();
      setTasks(loadedTasks);
      setLastSync(new Date());
    } catch (error) {
      console.error('Error cargando tareas:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Crear nueva tarea
  const createTask = useCallback(async (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTask: Task = {
      ...taskData,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: 'pending'
    };

    try {
      await offlineDB.saveTask(newTask);
      
      // Actualizar estado local inmediatamente
      setTasks(prev => [...prev, newTask]);
      
      // La sincronización en tiempo real se maneja automáticamente en offlineDB
      
      if (enableNotifications) {
        console.log('✅ Tarea creada y sincronizada con otras pestañas');
      }
      
      return newTask;
    } catch (error) {
      console.error('Error creando tarea:', error);
      throw error;
    }
  }, [enableNotifications]);

  // Actualizar tarea existente
  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    try {
      const currentTasks = await offlineDB.getTasks();
      const existingTask = currentTasks.find(t => t.id === taskId);
      
      if (!existingTask) {
        throw new Error(`Tarea ${taskId} no encontrada`);
      }

      const updatedTask: Task = {
        ...existingTask,
        ...updates,
        id: taskId,
        updatedAt: new Date(),
        syncStatus: 'pending'
      };

      await offlineDB.saveTask(updatedTask);
      
      // Actualizar estado local inmediatamente
      setTasks(prev => prev.map(task => 
        task.id === taskId ? updatedTask : task
      ));
      
      if (enableNotifications) {
        console.log('✅ Tarea actualizada y sincronizada con otras pestañas');
      }
      
      return updatedTask;
    } catch (error) {
      console.error('Error actualizando tarea:', error);
      throw error;
    }
  }, [enableNotifications]);

  // Eliminar tarea
  const deleteTask = useCallback(async (taskId: string) => {
    try {
      await offlineDB.deleteTask(taskId);
      
      // Actualizar estado local inmediatamente
      setTasks(prev => prev.filter(task => task.id !== taskId));
      
      if (enableNotifications) {
        console.log('✅ Tarea eliminada y sincronizada con otras pestañas');
      }
    } catch (error) {
      console.error('Error eliminando tarea:', error);
      throw error;
    }
  }, [enableNotifications]);

  // Marcar/desmarcar como completada
  const toggleTaskCompletion = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      await updateTask(taskId, { completed: !task.completed });
    }
  }, [tasks, updateTask]);

  // Forzar sincronización completa
  const forceSync = useCallback(async () => {
    await loadTasks();
    realTimeSync.requestFullSync();
    
    if (enableNotifications) {
      console.log('🔄 Sincronización completa solicitada');
    }
  }, [loadTasks, enableNotifications]);

  // Configurar listeners para sincronización en tiempo real
  useEffect(() => {
    // Handler para tareas creadas
    const handleTaskCreated = (data: Task) => {
      console.log('📥 Tarea creada en otra instancia:', data);
      setTasks(prev => {
        // Evitar duplicados
        const exists = prev.some(task => task.id === data.id);
        if (exists) return prev;
        
        return [...prev, data];
      });
      
      if (enableNotifications && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('📝 Nueva tarea creada', {
          body: data.title,
          icon: '/pwa-192x192.png'
        });
      }
    };

    // Handler para tareas actualizadas
    const handleTaskUpdated = (data: Task) => {
      console.log('📝 Tarea actualizada en otra instancia:', data);
      setTasks(prev => prev.map(task => 
        task.id === data.id ? { ...data } : task
      ));
    };

    // Handler para tareas eliminadas
    const handleTaskDeleted = (data: { id: string }) => {
      console.log('🗑️ Tarea eliminada en otra instancia:', data.id);
      setTasks(prev => prev.filter(task => task.id !== data.id));
    };

    // Handler para cambios generales
    const handleDataChanged = (data: any) => {
      console.log('🔄 Datos cambiados en otra instancia:', data);
      if (autoRefresh) {
        loadTasks();
      }
    };

    // Handler para refresh forzado
    const handleForceRefresh = (data: any) => {
      console.log('🔄 Refresh forzado desde otra instancia:', data);
      if (autoRefresh) {
        loadTasks();
      }
    };

    // Registrar listeners
    realTimeSync.on('task-created', handleTaskCreated);
    realTimeSync.on('task-updated', handleTaskUpdated);
    realTimeSync.on('task-deleted', handleTaskDeleted);
    realTimeSync.on('data-changed', handleDataChanged);
    realTimeSync.on('force-refresh', handleForceRefresh);

    // Cleanup
    return () => {
      realTimeSync.off('task-created', handleTaskCreated);
      realTimeSync.off('task-updated', handleTaskUpdated);
      realTimeSync.off('task-deleted', handleTaskDeleted);
      realTimeSync.off('data-changed', handleDataChanged);
      realTimeSync.off('force-refresh', handleForceRefresh);
    };
  }, [autoRefresh, enableNotifications, loadTasks]);

  // Cargar datos iniciales
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Verificar instancias activas periódicamente
  useEffect(() => {
    const checkInstances = async () => {
      try {
        const count = await realTimeSync.checkActiveInstances();
        setActiveInstances(count);
        console.log(`🔄 Instancias activas actualizadas: ${count}`);
      } catch (error) {
        console.error('Error verificando instancias activas:', error);
      }
    };

    // Verificar inmediatamente
    checkInstances();
    
    // Verificar cada 10 segundos
    const interval = setInterval(checkInstances, 10000);
    
    // También verificar cuando se reciben mensajes de otras instancias
    const handleAnyMessage = () => {
      setTimeout(checkInstances, 500); // Delay pequeño para evitar spam
    };
    
    realTimeSync.on('data-changed', handleAnyMessage);
    realTimeSync.on('ping-request', handleAnyMessage);
    
    return () => {
      clearInterval(interval);
      realTimeSync.off('data-changed', handleAnyMessage);
      realTimeSync.off('ping-request', handleAnyMessage);
    };
  }, []);

  return {
    // Estado
    tasks,
    isLoading,
    lastSync,
    activeInstances,
    connectionStatus,
    
    // Acciones
    createTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    forceSync,
    loadTasks,
    
    // Información
    instanceId: realTimeSync.getInstanceId()
  };
};
