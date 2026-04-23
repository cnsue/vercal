import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: '资产追踪',
        short_name: '资产',
        description: '每日资产快照记录与趋势分析',
        theme_color: '#1a3a2a',
        background_color: '#f5f5f0',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'zh-CN',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
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
