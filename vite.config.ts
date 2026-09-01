/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Deploying to GitHub Pages serves from a subpath
// (https://<user>.github.io/here-to-stay/). Set BASE_PATH=/here-to-stay/ for that
// build; local dev/preview keep '/'. Router basename and PWA scope derive from it.
const base = process.env.BASE_PATH ?? '/'

// App version (from package.json) and build timestamp, baked in at build time
// and surfaced in Settings. CI can override the timestamp via BUILD_TIME.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
const appVersion = pkg.version as string
const buildTime = process.env.BUILD_TIME ?? new Date().toISOString()

// https://vite.dev/config/
export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt' surfaces a "new version available — reload" UI instead of
      // swapping silently, so updates never change the app mid-session.
      registerType: 'prompt',
      includeAssets: ['favicon-48.png', 'apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: 'Health Goals Tracker',
        short_name: 'Health',
        description: 'Personal weight and workout tracker',
        theme_color: '#111827',
        background_color: '#111827',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: false,
  },
})
