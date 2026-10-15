import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { todayKey } from '../lib/date.ts'

const CHECK_INTERVAL_MS = 60_000

/**
 * 日付が変わったことを検知して、画面を「今日」に合わせ直す。
 *
 * 開いたまま日付をまたぐと、「今日」の見出しや期限切れの判定、0時に生成された繰り返しタスクが古いままになる。
 * 1分ごと（とタブに戻ったとき）に日付を確かめ、変わっていればデータをすべて取り直し、
 * 返した日付を state に持つことで画面全体を描き直させる（PC のスリープ明けにも対応する）。
 */
export function useDayChange(): string {
  const queryClient = useQueryClient()
  const [day, setDay] = useState(todayKey)

  useEffect(() => {
    const check = () => {
      const now = todayKey()
      if (now !== day) {
        setDay(now)
        void queryClient.invalidateQueries()
      }
    }
    const timer = setInterval(check, CHECK_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        check()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [day, queryClient])

  return day
}
