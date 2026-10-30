import { defineConfig } from 'vite'

import { foldkit } from '@foldkit/vite-plugin'
import tailwindcss from '@tailwindcss/vite'

import { lessonChunkCheck, lessonChunkName } from './build/lessonChunks.ts'
import { lessonIndex } from './build/lessonIndex.ts'

export default defineConfig({
  plugins: [lessonIndex(), tailwindcss(), foldkit(), lessonChunkCheck()],
  optimizeDeps: {
    entries: ['src/entry.ts'],
  },
  build: {
    rolldownOptions: {
      output: {
        // One file per lesson, loaded when the lesson opens. Only the lesson's
        // own modules go there: what it imports from the app stays shared.
        codeSplitting: {
          groups: [
            {
              name: lessonChunkName([]),
              includeDependenciesRecursively: false,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
  },
})
