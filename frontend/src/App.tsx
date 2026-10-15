import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { routes } from './routes.tsx'
import { ToastProvider } from './toast/ToastProvider.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 開いたままでも、期限切れへの変化や0時に生成された繰り返しタスクが反映されるよう、1分ごとに取り直す
      // （タブが裏にある間は止まり、戻ったときに取り直す）
      refetchInterval: 60_000,
    },
  },
})
const router = createBrowserRouter(routes)

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  )
}
