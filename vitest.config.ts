import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@dogfood/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
      '@dogfood/database': path.resolve(__dirname, 'packages/database/src/index.ts'),
      '@dogfood/judging-engine': path.resolve(__dirname, 'packages/judging-engine/src/index.ts'),
      '@dogfood/fixture-importer': path.resolve(__dirname, 'packages/fixture-importer/src/index.ts'),
    },
  },
});
