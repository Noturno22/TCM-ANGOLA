import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Subpath aliases MUST come before bare package names:
      // object-form aliases prefix-match, so '@tira/ai' alone would
      // rewrite '@tira/ai/solver' into '<index.ts>/solver'.
      '@tira/engine/': path.resolve(__dirname, './packages/engine/src') + '/',
      '@tira/ai/': path.resolve(__dirname, './packages/ai/src') + '/',
      '@tira/engine': path.resolve(__dirname, './packages/engine/src/index.ts'),
      '@tira/ai': path.resolve(__dirname, './packages/ai/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/lib/**/*.test.ts', 'packages/**/*.test.ts'],
    testTimeout: 30000,
  },
});
