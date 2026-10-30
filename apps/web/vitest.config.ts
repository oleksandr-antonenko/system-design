import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'web',
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'happy-dom',
    fsModuleCache: false,
    // Тест ленты шагов (lesson/timeline.test.ts) читает styles.css как текст
    // (`?raw`); без этого Vitest отдаёт вместо любого CSS пустую строку.
    css: { include: [/src\/styles\.css/] },
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
