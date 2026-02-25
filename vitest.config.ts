import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@client': path.resolve(__dirname, './src/client'),
      '@server': path.resolve(__dirname, './src/server'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  test: {
    include: [
      'src/**/*.test.ts',
      'src/**/*.property.test.ts',
      'src/__tests__/**/*.test.ts',
      'src/__tests__/**/*.property.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.property.test.ts',
        'src/__tests__/**',
        'src/vite-env.d.ts',
      ],
    },
    environment: 'node',
    globals: true,
  },
});
