/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // /api をバックエンドへ転送する。同一オリジンになるのでCORS設定は不要
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  test: {
    environment: 'jsdom',
    // Testing Library の自動クリーンアップを有効にするために必要
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
  },
})
