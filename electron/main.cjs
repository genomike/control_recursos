const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, Notification } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Variables globales
let mainWindow = null;
let tray = null;
let isQuiting = false;

// Configuración de la aplicación
const isDev = process.env.NODE_ENV === 'development';
const APP_URL = isDev ? 'http://localhost:5174' : `file://${path.join(__dirname, '../dist/index.html')}`;

console.log('🚀 Compass Team Electron iniciando...');
console.log('Modo:', isDev ? 'Desarrollo' : 'Producción');
console.log('URL:', APP_URL);

// Configurar arranque automático
const AutoLaunch = require('auto-launch');
const autoLauncher = new AutoLaunch({
  name: 'Compass Team',
  path: app.getPath('exe'),
  isHidden: true // Iniciar minimizado
});

// Función para crear la ventana principal
function createMainWindow() {
  // Configuración de la ventana
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '../public/app-icon-256.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: !isDev,
      preload: path.join(__dirname, 'preload.cjs')
    },
    show: false, // No mostrar inmediatamente
    titleBarStyle: 'default',
    autoHideMenuBar: false
  });

  // Cargar la aplicación
  mainWindow.loadURL(APP_URL);

  // Abrir DevTools en desarrollo
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Manejar cierre de ventana
  mainWindow.on('close', (event) => {
    if (!isQuiting) {
      event.preventDefault();
      mainWindow.hide();
      
      // Mostrar notificación de que sigue ejecutándose
      if (Notification.isSupported()) {
        new Notification({
          title: 'Compass Team',
          body: 'La aplicación sigue ejecutándose en segundo plano. Haz clic en el icono de la bandeja para abrirla.',
          icon: path.join(__dirname, '../public/pwa-192x192.png')
        }).show();
      }
    }
  });

  // Mostrar ventana cuando esté lista
  mainWindow.once('ready-to-show', () => {
    console.log('✅ Ventana principal lista');
    
    // Solo mostrar si no es arranque automático oculto
    if (!process.argv.includes('--hidden')) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Manejar enlaces externos
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return mainWindow;
}

// Función para crear el System Tray
function createTray() {
  // Crear icono del tray
  const trayIcon = nativeImage.createFromPath(path.join(__dirname, '../public/app-icon-256.png'));
  trayIcon.setTemplateImage(true);
  
  tray = new Tray(trayIcon);
  
  // Tooltip del tray
  tray.setToolTip('Compass Team - Gestión de Recursos');
  
  // Menú contextual del tray
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir Compass Team',
      type: 'normal',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createMainWindow();
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Arranque automático',
      type: 'checkbox',
      checked: false,
      click: async (menuItem) => {
        try {
          if (menuItem.checked) {
            await autoLauncher.enable();
            console.log('✅ Arranque automático habilitado');
          } else {
            await autoLauncher.disable();
            console.log('❌ Arranque automático deshabilitado');
          }
        } catch (error) {
          console.error('Error configurando arranque automático:', error);
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Acerca de',
      type: 'normal',
      click: () => {
        const aboutWindow = new BrowserWindow({
          width: 400,
          height: 300,
          resizable: false,
          minimizable: false,
          maximizable: false,
          parent: mainWindow,
          modal: true,
          icon: path.join(__dirname, '../public/pwa-192x192.png')
        });
        
        aboutWindow.loadURL(`data:text/html,
          <html>
            <head><title>Acerca de Compass Team</title></head>
            <body style="font-family: Arial; padding: 20px; text-align: center;">
              <img src="${path.join(__dirname, '../public/pwa-192x192.png')}" width="64" height="64">
              <h2>Compass Team</h2>
              <p>Gestión de Recursos del Equipo de Desarrollo</p>
              <p>Versión 1.0.0</p>
              <p>Progressive Web App con Electron</p>
            </body>
          </html>
        `);
        
        aboutWindow.setMenuBarVisibility(false);
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Salir',
      type: 'normal',
      click: () => {
        isQuiting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  
  // Doble clic para abrir/minimizar
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createMainWindow();
    }
  });

  console.log('✅ System Tray creado');
  
  // Verificar estado inicial del arranque automático
  autoLauncher.isEnabled().then((isEnabled) => {
    const menu = tray.getContextMenu();
    menu.items[2].checked = isEnabled; // Actualizar checkbox
    tray.setContextMenu(menu);
    console.log('🔧 Arranque automático:', isEnabled ? 'Habilitado' : 'Deshabilitado');
  }).catch(console.error);
}

// Eventos de la aplicación
app.whenReady().then(() => {
  console.log('🎯 Electron listo, creando interfaz...');
  
  // Crear System Tray primero
  createTray();
  
  // Crear ventana principal
  createMainWindow();
  
  // Configurar auto-updater en producción
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

// Salir cuando todas las ventanas estén cerradas (excepto en macOS)
app.on('window-all-closed', () => {
  // En macOS, mantener la app corriendo incluso sin ventanas
  if (process.platform !== 'darwin' && !tray) {
    app.quit();
  }
});

app.on('activate', () => {
  // En macOS, recrear ventana cuando se hace clic en el dock
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// Prevenir múltiples instancias
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('❌ Otra instancia ya está ejecutándose');
  app.quit();
} else {
  app.on('second-instance', () => {
    // Si alguien trata de ejecutar otra instancia, enfocar nuestra ventana
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Manejar protocolo personalizado (opcional)
app.setAsDefaultProtocolClient('compass-team');

// Eventos IPC (comunicación con el renderer)
ipcMain.handle('app-version', () => {
  return app.getVersion();
});

ipcMain.handle('toggle-auto-launch', async () => {
  try {
    const isEnabled = await autoLauncher.isEnabled();
    if (isEnabled) {
      await autoLauncher.disable();
      return false;
    } else {
      await autoLauncher.enable();
      return true;
    }
  } catch (error) {
    console.error('Error toggle auto-launch:', error);
    return null;
  }
});

console.log('🎉 Compass Team Electron configurado completamente');

// Exportar para testing
module.exports = { createMainWindow, createTray };
