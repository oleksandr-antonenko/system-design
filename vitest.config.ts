import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['apps/web', 'apps/server'],
    passWithNoTests: true,
    // Кеш модулей Vitest не замечает новые папки уроков, которые реестр
    // собирает через import.meta.glob, и молча пропускает их тесты контента.
    fsModuleCache: false,
  },
})
