const { contextBridge, ipcRenderer } = require('electron');

// Exponer API segura al renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Información de la aplicación
  getVersion: () => ipcRenderer.invoke('app-version'),
  
  // Control de arranque automático
  toggleAutoLaunch: () => ipcRenderer.invoke('toggle-auto-launch'),
  
  // Notificaciones (para integración con el sistema de notificaciones PWA)
  showNotification: (title, options) => {
    // Se puede integrar con el sistema de notificaciones nativo
    return ipcRenderer.invoke('show-notification', { title, options });
  },
  
  // Estado de la aplicación
  isElectron: true,
  platform: process.platform
});

// Log para debugging
console.log('🔗 Preload script cargado - API expuesta a la PWA');
