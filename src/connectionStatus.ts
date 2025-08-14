// Indicador de estado de conexión para PWA
export class ConnectionStatus {
  private indicator: HTMLElement | null = null;
  private isOnline: boolean = navigator.onLine;
  private listeners: Array<(isOnline: boolean) => void> = [];

  constructor() {
    this.createIndicator();
    this.setupEventListeners();
    this.updateStatus();
  }

  private createIndicator(): void {
    this.indicator = document.createElement('div');
    this.indicator.id = 'connection-status';
    this.indicator.className = 'connection-status';
    
    // Estilos CSS inline para que funcione sin archivos CSS adicionales
    this.indicator.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 2000;
      padding: 8px 16px;
      text-align: center;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.3s ease;
      transform: translateY(-100%);
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;

    document.body.appendChild(this.indicator);
  }

  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.updateStatus();
      this.notifyListeners(true);
      
      // Auto-ocultar después de 3 segundos cuando vuelve la conexión
      setTimeout(() => {
        this.hide();
      }, 3000);
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.updateStatus();
      this.notifyListeners(false);
    });

    // Verificar conexión cada 30 segundos
    setInterval(() => {
      this.checkConnection();
    }, 30000);
  }

  private async checkConnection(): Promise<void> {
    try {
      // Intentar hacer una petición a un endpoint que existe
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('/favicon.png', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      
      const wasOnline = this.isOnline;
      this.isOnline = response.ok;
      
      if (wasOnline !== this.isOnline) {
        this.updateStatus();
        this.notifyListeners(this.isOnline);
      }
    } catch (error) {
      const wasOnline = this.isOnline;
      this.isOnline = false;
      
      if (wasOnline !== this.isOnline) {
        this.updateStatus();
        this.notifyListeners(this.isOnline);
      }
    }
  }

  private updateStatus(): void {
    if (!this.indicator) return;

    if (this.isOnline) {
      this.indicator.textContent = '✅ Conectado - Datos sincronizados';
      this.indicator.style.backgroundColor = '#d4edda';
      this.indicator.style.color = '#155724';
      this.indicator.style.borderBottom = '1px solid #c3e6cb';
    } else {
      this.indicator.textContent = '📱 Sin conexión - Trabajando offline';
      this.indicator.style.backgroundColor = '#f8d7da';
      this.indicator.style.color = '#721c24';
      this.indicator.style.borderBottom = '1px solid #f5c6cb';
    }

    this.show();
  }

  private show(): void {
    if (this.indicator) {
      this.indicator.style.transform = 'translateY(0)';
    }
  }

  private hide(): void {
    if (this.indicator) {
      this.indicator.style.transform = 'translateY(-100%)';
    }
  }

  public forceShow(): void {
    this.updateStatus();
  }

  public forceHide(): void {
    this.hide();
  }

  public getStatus(): boolean {
    return this.isOnline;
  }

  public addListener(listener: (isOnline: boolean) => void): void {
    this.listeners.push(listener);
  }

  public removeListener(listener: (isOnline: boolean) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(isOnline: boolean): void {
    this.listeners.forEach(listener => {
      try {
        listener(isOnline);
      } catch (error) {
        console.error('ConnectionStatus: Error en listener:', error);
      }
    });
  }

  public destroy(): void {
    if (this.indicator) {
      this.indicator.remove();
      this.indicator = null;
    }
    this.listeners = [];
  }
}

// Instancia global
export const connectionStatus = new ConnectionStatus();
