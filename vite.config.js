import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/finance-dashboard/',
  plugins: [
    vue(),

    VitePWA({
      registerType: 'autoUpdate',

      includeAssets: [
        'favicon-32x32.png',
        'apple-touch-icon.png',
      ],

      manifest: {
        name: 'Мои финансы',
        short_name: 'Финансы',
        description:
          'Личный финансовый дашборд и планировщик распределения дохода.',

        lang: 'ru',
        start_url: './',
        scope: './',

        display: 'standalone',
        orientation: 'portrait',

        background_color: '#f4f7fb',
        theme_color: '#5b6df6',

        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      workbox: {
        cleanupOutdatedCaches: true,

        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,webmanifest}',
        ],
      },
    }),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(
        new URL('./src', import.meta.url),
      ),
    },
  },
})