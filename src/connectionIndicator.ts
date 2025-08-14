// Indicador de estado de conexión para PWA
import { syncManager, type SyncStats } from './syncManager';

export interface ConnectionStatus {
  isOnline: boolean;
  connectionType: string;
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

export class ConnectionIndicator {
  private indicator: HTMLElement | null = null;
  private isVisible: boolean = false;
  private currentStatus: ConnectionStatus;
  private updateInterval: number | null = null;

  constructor() {
    this.currentStatus = this.getCurrentStatus();
    this.init();
    console.log('ConnectionIndicator: Inicializado');
  }

  private init(): void {
    this.createIndicator();
    this.setupEventListeners();
    this.updateIndicator();
    this.startPeriodicUpdates();
  }

  private createIndicator(): void {
    // Evitar duplicados
    if (document.getElementById('connection-indicator')) {
      return;
    }

    this.indicator = document.createElement('div');
    this.indicator.id = 'connection-indicator';
    this.indicator.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: #333;
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      z-index: 9999;
      opacity: 0;
      transition: all 0.3s ease;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      max-width: 90vw;
      backdrop-filter: blur(10px);
    `;

    document.body.appendChild(this.indicator);
    console.log('ConnectionIndicator: Elemento creado');
  }

  private setupEventListeners(): void {
    // Eventos de conectividad
    window.addEventListener('online', () => {
      this.handleConnectionChange();
      this.showTemporaryMessage('Conexión restaurada', 'success');
    });

    window.addEventListener('offline', () => {
      this.handleConnectionChange();
      this.showTemporaryMessage('Sin conexión - Modo offline', 'warning');
    });

    // Eventos de Network Information API (si está disponible)
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      connection.addEventListener('change', () => {
        this.handleConnectionChange();
      });
    }

    // Eventos del sync manager
    syncManager.addEventListener((event) => {
      this.handleSyncEvent(event);
    });

    // Mostrar/ocultar al hacer hover (solo en desktop)
    if (window.matchMedia('(hover: hover)').matches) {
      this.setupHoverInteraction();
    }
  }

  private setupHoverInteraction(): void {
    if (!this.indicator) return;

    // Crear área de hover más grande
    const hoverArea = document.createElement('div');
    hoverArea.style.cssText = `
      position: fixed;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 200px;
      height: 50px;
      z-index: 9998;
      pointer-events: auto;
    `;

    hoverArea.addEventListener('mouseenter', () => {
      this.showIndicator();
    });

    hoverArea.addEventListener('mouseleave', () => {
      if (!this.shouldStayVisible()) {
        this.hideIndicator();
      }
    });

    document.body.appendChild(hoverArea);
  }

  private getCurrentStatus(): ConnectionStatus {
    const connection = (navigator as any).connection;
    
    return {
      isOnline: navigator.onLine,
      connectionType: connection?.type || 'unknown',
      effectiveType: connection?.effectiveType || 'unknown',
      downlink: connection?.downlink || 0,
      rtt: connection?.rtt || 0,
      saveData: connection?.saveData || false
    };
  }

  private handleConnectionChange(): void {
    this.currentStatus = this.getCurrentStatus();
    this.updateIndicator();
    
    console.log('ConnectionIndicator: Estado actualizado:', this.currentStatus);
  }

  private async handleSyncEvent(event: any): Promise<void> {
    switch (event.type) {
      case 'sync-start':
        this.showTemporaryMessage('Sincronizando...', 'info');
        break;
      case 'sync-success':
        this.showTemporaryMessage('Sincronización completa', 'success');
        break;
      case 'sync-error':
        this.showTemporaryMessage('Error de sincronización', 'error');
        break;
    }
  }

  private async updateIndicator(): Promise<void> {
    if (!this.indicator) return;

    const status = this.currentStatus;
    const syncStats = await syncManager.getSyncStats();
    
    const { icon, color, text } = this.getStatusDisplay(status, syncStats);
    
    this.indicator.innerHTML = `
      <span style="font-size: 14px;">${icon}</span>
      <span>${text}</span>
      ${this.getAdditionalInfo(status, syncStats)}
    `;
    
    this.indicator.style.background = color;
    
    // Mostrar automáticamente si hay problemas
    if (!status.isOnline || syncStats.pendingOperations > 0) {
      this.showIndicator();
    } else if (this.shouldStayVisible()) {
      // Mantener visible si el usuario interactuó recientemente
    } else {
      setTimeout(() => this.hideIndicator(), 3000);
    }
  }

  private getStatusDisplay(status: ConnectionStatus, syncStats: SyncStats): { icon: string; color: string; text: string } {
    if (!status.isOnline) {
      return {
        icon: '🔴',
        color: '#dc3545',
        text: 'Sin conexión'
      };
    }

    if (syncStats.isSyncing) {
      return {
        icon: '🔄',
        color: '#007bff',
        text: 'Sincronizando...'
      };
    }

    if (syncStats.pendingOperations > 0) {
      return {
        icon: '⏳',
        color: '#ffc107',
        text: `${syncStats.pendingOperations} pendiente${syncStats.pendingOperations > 1 ? 's' : ''}`
      };
    }

    // Determinar calidad de conexión
    const quality = this.getConnectionQuality(status);
    const qualityConfig = {
      excellent: { icon: '🟢', color: '#28a745', text: 'Excelente' },
      good: { icon: '🟡', color: '#28a745', text: 'Buena' },
      fair: { icon: '🟠', color: '#ffc107', text: 'Regular' },
      poor: { icon: '🔴', color: '#fd7e14', text: 'Lenta' }
    };

    return qualityConfig[quality];
  }

  private getConnectionQuality(status: ConnectionStatus): 'excellent' | 'good' | 'fair' | 'poor' {
    if (status.effectiveType === '4g' && status.downlink > 10) return 'excellent';
    if (status.effectiveType === '4g' || status.downlink > 5) return 'good';
    if (status.effectiveType === '3g' || status.downlink > 1) return 'fair';
    return 'poor';
  }

  private getAdditionalInfo(status: ConnectionStatus, syncStats: SyncStats): string {
    const details: string[] = [];

    // Información de conexión
    if (status.isOnline) {
      if (status.effectiveType !== 'unknown') {
        details.push(`${status.effectiveType.toUpperCase()}`);
      }
      if (status.downlink > 0) {
        details.push(`${status.downlink.toFixed(1)} Mbps`);
      }
    }

    // Información de sincronización
    if (syncStats.lastSyncTime) {
      const timeSinceSync = Date.now() - syncStats.lastSyncTime.getTime();
      const minutesAgo = Math.floor(timeSinceSync / 60000);
      if (minutesAgo < 60) {
        details.push(`Sync: ${minutesAgo}m`);
      }
    }

    // Modo ahorro de datos
    if (status.saveData) {
      details.push('💾 Ahorro');
    }

    return details.length > 0 ? `<span style="opacity: 0.7; font-size: 11px;"> • ${details.join(' • ')}</span>` : '';
  }

  private showIndicator(): void {
    if (this.indicator && !this.isVisible) {
      this.indicator.style.opacity = '1';
      this.indicator.style.transform = 'translateX(-50%) translateY(0)';
      this.isVisible = true;
    }
  }

  private hideIndicator(): void {
    if (this.indicator && this.isVisible) {
      this.indicator.style.opacity = '0';
      this.indicator.style.transform = 'translateX(-50%) translateY(-10px)';
      this.isVisible = false;
    }
  }

  private shouldStayVisible(): boolean {
    // Mantener visible si hay problemas o actividad de sync
    return !this.currentStatus.isOnline || 
           syncManager.isSyncingStatus() || 
           (syncManager.getSyncStats().then(stats => stats.pendingOperations > 0) as any);
  }

  public showTemporaryMessage(message: string, type: 'info' | 'success' | 'warning' | 'error', duration: number = 3000): void {
    if (!this.indicator) return;

    const colors = {
      info: '#007bff',
      success: '#28a745',
      warning: '#ffc107',
      error: '#dc3545'
    };

    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };

    // Guardar estado actual
    const originalContent = this.indicator.innerHTML;
    const originalBackground = this.indicator.style.background;

    // Mostrar mensaje temporal
    this.indicator.innerHTML = `
      <span style="font-size: 14px;">${icons[type]}</span>
      <span>${message}</span>
    `;
    this.indicator.style.background = colors[type];

    this.showIndicator();

    // Restaurar después del tiempo especificado
    setTimeout(() => {
      if (this.indicator) {
        this.indicator.innerHTML = originalContent;
        this.indicator.style.background = originalBackground;
        
        // Solo ocultar si no hay razones para mantener visible
        if (!this.shouldStayVisible()) {
          setTimeout(() => this.hideIndicator(), 1000);
        }
      }
    }, duration);
  }

  private startPeriodicUpdates(): void {
    // Actualizar cada 30 segundos
    this.updateInterval = window.setInterval(() => {
      this.handleConnectionChange();
    }, 30000);
  }

  public destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.indicator) {
      this.indicator.remove();
      this.indicator = null;
    }

    console.log('ConnectionIndicator: Destruido');
  }

  // ===== API PÚBLICA =====
  public getCurrentConnectionStatus(): ConnectionStatus {
    return { ...this.currentStatus };
  }

  public async getDetailedStatus(): Promise<{ connection: ConnectionStatus; sync: SyncStats }> {
    const syncStats = await syncManager.getSyncStats();
    return {
      connection: this.getCurrentConnectionStatus(),
      sync: syncStats
    };
  }

  public forceUpdate(): void {
    this.handleConnectionChange();
  }

  public show(): void {
    this.showIndicator();
  }

  public hide(): void {
    this.hideIndicator();
  }
}

// Instancia global
export const connectionIndicator = new ConnectionIndicator();
