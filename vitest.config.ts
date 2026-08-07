import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globalsSetup: true,
    exclude: [/node_modules/, /\.next\//, /dist/],
    coverage: {
      reports: true,
      exclude: [/node_modules/, /\.next\//, /dist/],
      include: ['src/app/**/*.ts', 'src/app/**/*.tsx', 'src/lib/**/*.ts', 'src/lib/**/*.tsx'],
    },
    reporters: ['default', 'html'],
    setupFiles: ['src/setupTests.ts', './vitest.setup.ts'],
    projectGlobs: [{
      pattern: '**/__tests__/**/*.ts',
      ignore: ['**/__tests__/e2e/**/*.ts'],
    }],
    testTimeout: 120000,
    maxParallelWorkers: process.env.CI !== undefined ? Math.min(
      process.env.CI ? parseInt(process.env.CI) : 4,
      require('os').cpus().length
    ) : 4,
    snapshotResolution: 'export',
  },
  resolveSpecifier: './vitest.resolve.js',
  mockClearTimeouts: true,
  restoreMocks: true,
});