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
      // バックエンドは 127.0.0.1 だけで待ち受けるので、localhost（IPv6 の ::1 になることがある）ではなく明示する
      '/api': `http://127.0.0.1:${apiPort}`,
    },
  },
  build: {
    // 自分の PC から読み込むアプリなので、ファイルを分割しなくてよい（500KB 超の警告を出さない）
    chunkSizeWarningLimit: 1024,
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
