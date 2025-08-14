import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    // Plugin para servir archivos PWA con MIME types correctos
    {
      name: 'pwa-dev-support',
      configureServer(server) {
        // Service Workers con MIME type correcto
        server.middlewares.use('/sw-dev.js', (_req, res, next) => {
          res.setHeader('Content-Type', 'application/javascript')
          next()
        })
        server.middlewares.use('/service-worker.js', (_req, res, next) => {
          res.setHeader('Content-Type', 'application/javascript')
          next()
        })
        // Manifest con MIME type correcto
        server.middlewares.use('/manifest.json', (_req, res, next) => {
          res.setHeader('Content-Type', 'application/json')
          next()
        })
      }
    }
  ],
  server: {
    port: 5174,
    host: true
  },
  preview: {
    port: 4173,
    host: true
  },
  publicDir: 'public'
})
