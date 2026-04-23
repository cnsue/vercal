import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'favicon-96x96.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Coinsight',
        short_name: 'Coinsight',
        description: '每日资产快照记录与趋势分析',
        theme_color: '#1a3a2a',
        background_color: '#f5f5f0',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'zh-CN',
        icons: [
          { src: '/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(openexchangerates\.org|api\.frankfurter\.app)\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'exchange-rate-cache', expiration: { maxAgeSeconds: 3600 } }
          }
        ]
      }
    })
  ]
})
