import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
      // Unit coverage measures the deterministic domain and AI-safety layer.
      // React route behavior is exercised separately by Playwright in CI.
      include: [
        'src/app/data/**/*.ts',
        'src/app/lib/**/*.ts',
        'src/app/utils/**/*.ts',
        'src/app/components/**/*.ts',
        'supabase/functions/_shared/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        'src/app/lib/db/database.types.ts',
      ],
      thresholds: {
        statements: 65,
        branches: 70,
        functions: 60,
        lines: 65,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
