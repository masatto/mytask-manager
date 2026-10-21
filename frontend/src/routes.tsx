import { Navigate, type RouteObject } from 'react-router'
import { Layout } from './components/Layout.tsx'
import { PlanImportPage } from './pages/PlanImportPage.tsx'
import { ProgressPage } from './pages/ProgressPage.tsx'
import { RulesPage } from './pages/RulesPage.tsx'
import { SearchPage } from './pages/SearchPage.tsx'
import { SettingsPage } from './pages/SettingsPage.tsx'
import { TaskListPage } from './pages/TaskListPage.tsx'
import { VIEWS } from './views.ts'

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Navigate to="/today" replace /> },
      ...VIEWS.map((view) => ({
        path: view.path,
        // ビューごとに別インスタンスにして、入力中の内容などを持ち越さない
        element: <TaskListPage key={view.key} view={view.key} />,
      })),
      { path: '/search', element: <SearchPage /> },
      { path: '/rules', element: <RulesPage /> },
      { path: '/progress', element: <ProgressPage /> },
      { path: '/plan', element: <PlanImportPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/today" replace /> },
    ],
  },
]
