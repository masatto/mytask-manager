/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 転送先のバックエンドのポート。E2E テストでは普段使いのアプリと衝突しないよう別のポートを指定する
const apiPort = process.env.MYTASK_API_PORT ?? '8080'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // /api をバックエンドへ転送する。同一オリジンになるのでCORS設定は不要
    proxy: {
      '/api': `http://localhost:${apiPort}`,
    },
  },
  test: {
    environment: 'jsdom',
    // Testing Library の自動クリーンアップを有効にするために必要
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    // e2e/ は Playwright で実行するので含めない
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
