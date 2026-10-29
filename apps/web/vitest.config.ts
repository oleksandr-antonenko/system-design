import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'web',
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'happy-dom',
    fsModuleCache: false,
    setupFiles: ['./src/vitest-setup.ts'],
    server: {
      deps: {
        inline: ['foldkit', '@foldkit/ui', '@foldkit/devtools'],
      },
    },
  },
})
