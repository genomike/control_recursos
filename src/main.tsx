import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import App from './App.tsx'
import { PWAInstaller, registerSW } from './pwaInstaller'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Inicializar PWA para Vite
registerSW();
const pwaInstaller = new PWAInstaller();

// Hacer el instalador disponible globalmente para debugging
(window as any).pwaInstaller = pwaInstaller;
