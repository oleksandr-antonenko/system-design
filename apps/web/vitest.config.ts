import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'web',
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'happy-dom',
    fsModuleCache: false,
    // Сценарные тесты проходят урок целиком: на медленной машине CI под общей
    // нагрузкой пяти секунд по умолчанию им не хватает.
    testTimeout: 30_000,
    setupFiles: ['./src/vitest-setup.ts'],
    server: {
      deps: {
        inline: ['foldkit', '@foldkit/ui', '@foldkit/devtools'],
      },
    },
  },
})
