import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ErrorBoundary } from '../components/ErrorBoundary.tsx'
import { useDayChange } from './useDayChange.ts'

describe('useDayChange', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test('日付が変わると新しい日付を返し、データをすべて取り直す', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 15, 23, 59, 30))
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useDayChange(), { wrapper })
    expect(result.current).toBe('2026-10-15')

    // 0:00 を過ぎてから最初の確認（1分ごと）で切り替わる
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current).toBe('2026-10-16')
    expect(invalidate).toHaveBeenCalledTimes(1)

    // 同じ日のうちは何もしない
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(invalidate).toHaveBeenCalledTimes(1)
  })
})

describe('ErrorBoundary', () => {
  test('表示中のエラーで真っ白にせず、メッセージと再読み込みを出す', () => {
    const Broken = () => {
      throw new Error('想定外のデータ')
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('画面を表示できませんでした')
    expect(screen.getByText('想定外のデータ')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '再読み込み' })).toBeInTheDocument()
  })
})
