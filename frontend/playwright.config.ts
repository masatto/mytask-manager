import { defineConfig } from '@playwright/test'
import { existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * E2E テスト（npm run e2e）。
 * バックエンドとフロントエンドを専用のポートと空の一時DBで起動するので、普段使いのアプリ（8080/5173）と
 * そのデータには触れない。ポートが使用中なら起動に失敗して止まる（別のサーバーにつながることはない）。
 */
const API_PORT = 18080
const WEB_PORT = 15173

// 設定ファイルはワーカーごとにも読み込まれるので、一時DBの場所は環境変数で共有する
process.env.MYTASK_E2E_DATA_DIR ??= mkdtempSync(join(tmpdir(), 'mytask-e2e-'))
const dataDir = process.env.MYTASK_E2E_DATA_DIR

/** start.bat と同じく、JAVA_HOME がなければ Temurin JDK 21 を探す */
function javaHome(): string | undefined {
  if (process.env.JAVA_HOME) {
    return process.env.JAVA_HOME
  }
  const base = 'C:\\Program Files\\Eclipse Adoptium'
  const jdk = existsSync(base) ? readdirSync(base).find((d) => d.startsWith('jdk-21')) : undefined
  return jdk ? join(base, jdk) : undefined
}

const JAVA_HOME = javaHome()

export default defineConfig({
  testDir: './e2e',
  // 1つのバックエンドを共有するので、順番に実行する
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    // ブラウザのダウンロードを不要にするため、Windows に入っている Edge を使う
    channel: 'msedge',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `.\\mvnw.cmd -q spring-boot:run "-Dspring-boot.run.arguments=--server.port=${API_PORT} --mytask.data-dir=${dataDir}"`,
      cwd: '../backend',
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: JAVA_HOME ? { JAVA_HOME } : {},
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { MYTASK_API_PORT: String(API_PORT) },
    },
  ],
})
