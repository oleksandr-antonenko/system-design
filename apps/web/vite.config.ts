import { defineConfig } from 'vite'

import { foldkit } from '@foldkit/vite-plugin'
import tailwindcss from '@tailwindcss/vite'

import { prerender } from './build/prerender.ts'

export default defineConfig({
  plugins: [tailwindcss(), foldkit(), prerender()],
  optimizeDeps: {
    entries: ['src/entry.ts'],
  },
  server: {
    port: 5173,
  },
})
