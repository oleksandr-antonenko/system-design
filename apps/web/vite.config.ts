import { defineConfig } from 'vite'

import { foldkit } from '@foldkit/vite-plugin'
import tailwindcss from '@tailwindcss/vite'

const serverOrigin = `http://127.0.0.1:${process.env['PORT'] ?? '3620'}`

export default defineConfig({
  plugins: [tailwindcss(), foldkit()],
  optimizeDeps: {
    entries: ['src/entry.ts'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': serverOrigin,
    },
  },
})
