import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  envDir: '../',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: { environment: 'jsdom', globals: true, include: ['src/**/*.{test,spec}.{ts,tsx}'] },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: process.env.BACKEND_PROXY_URL || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
