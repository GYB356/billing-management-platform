import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    exclude: ['**/__tests__/**', '**/node_modules/**', '**/k6-tests/**', '**/src/test/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
});
