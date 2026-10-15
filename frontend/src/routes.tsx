import { Navigate, type RouteObject } from 'react-router'
import { Layout } from './components/Layout.tsx'
import { RulesPage } from './pages/RulesPage.tsx'
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
      { path: '/rules', element: <RulesPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/today" replace /> },
    ],
  },
]
