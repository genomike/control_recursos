# 🔧 Gestor de Recursos PWA

Una aplicación web progresiva (PWA) desarrollada con React, TypeScript y Bootstrap para gestionar recursos con almacenamiento local persistente.

## ✨ Características

### 📱 PWA (Progressive Web App)
- **Instalable**: Se puede instalar en el dispositivo como una aplicación nativa
- **Offline**: Funciona sin conexión a internet gracias al service worker
- **Cache inteligente**: Los datos persisten incluso al cerrar y reabrir la aplicación
- **Responsive**: Diseño adaptable a cualquier dispositivo

### 🎯 Funcionalidades Principales

#### ➕ Gestión de Recursos
- **Agregar recursos**: Caja de texto con botón "Añadir" para crear nuevos recursos
- **Lista visual**: Cada recurso se muestra en una tarjeta individual
- **Eliminar recursos**: Botón de eliminar (🗑️) en cada recurso

#### 📝 Control de Estado
- **Checkbox "Ocupado"**: Indica si el recurso está disponible o en uso
- **Área de texto**: 3 líneas para guardar detalles del recurso
- **Autoguardado**: El texto se guarda automáticamente al escribir
- **Auto-uncheck**: El checkbox se desmarca automáticamente al vaciar el texto

#### 📚 Historial Inteligente
- **Historial FIFO**: Máximo 3 entradas en orden FIFO (First In, First Out)
- **Texto tachado**: Las entradas del historial aparecen tachadas
- **Solo lectura**: El historial no es editable
- **Persistencia**: Se mantiene al cerrar y reabrir la aplicación

### 💾 Almacenamiento Local
- **LocalStorage**: Todos los datos se guardan localmente en el navegador
- **Persistencia**: Los datos persisten entre sesiones
- **Sin servidor**: No requiere conexión a internet para funcionar

## 🚀 Instalación y Uso

### Instalación del Proyecto
```bash
npm install
```

### Desarrollo
```bash
npm run dev
```

### Construcción para Producción
```bash
npm run build
```

### Vista Previa
```bash
npm run preview
```

### Servir con Python (alternativo)
```bash
python -m http.server 4173 --directory dist
```

## 🛠️ Tecnologías Utilizadas

- **React 19** - Framework de interfaz de usuario
- **TypeScript** - Tipado estático para JavaScript
- **Vite** - Build tool y bundler
- **Bootstrap 5** - Framework CSS para diseño responsive
- **React Bootstrap** - Componentes de Bootstrap para React
- **Vite PWA Plugin** - Configuración automática de PWA
- **Workbox** - Service worker para cache y funcionalidad offline

## 📦 Estructura del Proyecto

```
src/
├── App.tsx          # Componente principal con toda la lógica
├── App.css          # Estilos personalizados
├── main.tsx         # Punto de entrada de la aplicación
└── index.css        # Estilos globales

public/
├── pwa-192x192.png  # Icono PWA 192x192
├── pwa-512x512.png  # Icono PWA 512x512
└── vite.svg         # Favicon

dist/                # Archivos de producción (generados)
├── sw.js           # Service Worker
├── manifest.webmanifest # Manifiesto PWA
└── assets/         # Assets optimizados
```

## 🎨 Diseño y UX

- **Bootstrap**: Diseño moderno y responsive
- **Cards**: Cada recurso en su propia tarjeta visual
- **Colores semánticos**: Verde para disponible, amarillo para ocupado
- **Iconos**: Emojis para mejor experiencia visual
- **Animaciones**: Transiciones suaves en hover
- **Mobile-first**: Optimizado para dispositivos móviles

## 📱 Como Instalar la PWA

1. Abre la aplicación en tu navegador
2. Busca el botón "📱 Instalar App" en la esquina superior derecha
3. Haz clic en el botón y confirma la instalación
4. La aplicación se instalará como una app nativa en tu dispositivo

## 🔧 Configuración PWA

La aplicación está configurada como PWA con:
- Manifiesto web completo
- Service Worker para cache offline
- Iconos optimizados para diferentes tamaños
- Configuración de tema y colores
- Estrategias de cache para recursos estáticos

## 🚀 Funcionalidades Avanzadas

### Persistencia de Datos
Todos los recursos y su estado se guardan automáticamente en localStorage:
- Nombre del recurso
- Estado de ocupado/disponible
- Texto actual
- Historial de textos anteriores

### Gestión de Historial
Implementa un sistema FIFO (First In, First Out) para el historial:
- Máximo 3 entradas por recurso
- Al agregar una nueva entrada, la más antigua se elimina
- Todas las entradas aparecen tachadas para indicar que son históricas

### Responsive Design
Diseño completamente responsive que se adapta a:
- Móviles (xs)
- Tablets (md)
- Laptops (lg)
- Pantallas grandes (xl)

## 🎯 Casos de Uso

Esta aplicación es perfecta para:
- Gestión de salas de reuniones
- Control de equipos de oficina
- Seguimiento de herramientas
- Gestión de espacios compartidos
- Control de recursos en tiempo real

## 📄 Licencia

Este proyecto está bajo la licencia MIT.
