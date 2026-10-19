import { Outlet, useLocation } from 'react-router'
import { AreaProvider } from '../areas/AreaContext.tsx'
import { useDayChange } from '../hooks/useDayChange.ts'
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts.ts'
import { ErrorBoundary } from './ErrorBoundary.tsx'
import { Sidebar } from './Sidebar.tsx'
import styles from './Layout.module.css'

export function Layout() {
  useGlobalShortcuts()
  // 日付が変わったら、各画面を「今日」で作り直させる（key に入れる）
  const day = useDayChange()
  const { pathname } = useLocation()

  return (
    <AreaProvider>
      <div className={styles.layout}>
        <Sidebar />
        <main className={styles.main}>
          {/* ページを移ればエラー表示を解除する */}
          <ErrorBoundary key={pathname}>
            <div key={day} className={styles.page}>
              <Outlet />
            </div>
          </ErrorBoundary>
        </main>
      </div>
    </AreaProvider>
  )
}
