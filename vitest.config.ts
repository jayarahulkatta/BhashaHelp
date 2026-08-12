import { defineConfig } from 'vitest/config';
import os from 'os';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['node_modules', '.next', 'dist'],
      include: ['src/app/**/*.ts', 'src/app/**/*.tsx', 'src/lib/**/*.ts', 'src/lib/**/*.tsx'],
    },
    reporters: ['default', 'html'],
    setupFiles: ['src/setupTests.ts', './vitest.setup.ts'],
    include: ['**/__tests__/**/*.ts'],
    exclude: ['node_modules', '.next', 'dist', '**/__tests__/e2e/**'],
    testTimeout: 120000,
    pool: 'threads',
    maxWorkers: process.env.CI ? Math.min(parseInt(process.env.CI) || 4, os.cpus().length) : 4,
    clearMocks: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
});
