import { parseQuickAdd } from './quickAddParser.ts'

// 2026-10-14 は水曜日
const TODAY = '2026-10-14'
const parse = (input: string) => parseQuickAdd(input, TODAY)

describe('parseQuickAdd', () => {
  test('日付・時刻・優先度を読み取り、残りをタイトルにする', () => {
    expect(parse('明日 15:00 歯医者 !高')).toEqual({
      title: '歯医者',
      dueDate: '2026-10-15',
      dueTime: '15:00',
      priority: 'HIGH',
    })
  })

  test('語の順番は自由で、タイトルの語どうしのスペースは残す', () => {
    expect(parse('API 設計書を書く !低 金曜')).toEqual({
      title: 'API 設計書を書く',
      dueDate: '2026-10-16',
      dueTime: undefined,
      priority: 'LOW',
    })
  })

  test('何も読み取れなければ全体がタイトル', () => {
    expect(parse('  本棚の整理  ')).toEqual({ title: '本棚の整理', dueDate: undefined, dueTime: undefined, priority: undefined })
  })

  test.each([
    ['今日', '2026-10-14'],
    ['きょう', '2026-10-14'],
    ['明日', '2026-10-15'],
    ['あさって', '2026-10-16'],
    ['3日後', '2026-10-17'],
    ['水曜', '2026-10-14'], // 今日が水曜なら今日
    ['月曜日', '2026-10-19'],
    ['来週', '2026-10-19'],
    ['来週水曜', '2026-10-21'],
    ['来週日曜', '2026-10-25'],
    ['10/20', '2026-10-20'],
    ['10月20日', '2026-10-20'],
    ['1/5', '2027-01-05'], // 過ぎた日付は翌年
    ['2026-12-01', '2026-12-01'],
    ['2027/2/3', '2027-02-03'],
  ])('日付「%s」→ %s', (word, expected) => {
    expect(parse(`t ${word}`).dueDate).toBe(expected)
  })

  test.each([
    ['15:00', '15:00'],
    ['9:05', '09:05'],
    ['9時', '09:00'],
    ['9時半', '09:30'],
    ['21時15分', '21:15'],
  ])('時刻「%s」→ %s', (word, expected) => {
    expect(parse(`t ${word}`).dueTime).toBe(expected)
  })

  test('全角の数字や記号、全角スペースも使える', () => {
    expect(parse('明日　１５：００　歯医者　！高')).toEqual({
      title: '歯医者',
      dueDate: '2026-10-15',
      dueTime: '15:00',
      priority: 'HIGH',
    })
  })

  test('存在しない日付や時刻はタイトルとして残す', () => {
    expect(parse('2/30 25:00 t')).toMatchObject({ title: '2/30 25:00 t', dueDate: undefined, dueTime: undefined })
  })

  test('語の一部だけが一致してもタイトルとして残す', () => {
    expect(parse('明日の準備 金曜日の会議資料')).toMatchObject({ title: '明日の準備 金曜日の会議資料', dueDate: undefined })
  })

  test('同じ種類の2語目はタイトルとして残す', () => {
    expect(parse('明日 今日のふりかえり 今日')).toMatchObject({ title: '今日のふりかえり 今日', dueDate: '2026-10-15' })
  })

  test('優先度は英字でも書ける', () => {
    expect(parse('t !h').priority).toBe('HIGH')
    expect(parse('t !M').priority).toBe('MEDIUM')
    expect(parse('t !low').priority).toBe('LOW')
    expect(parse('t !急ぎ')).toMatchObject({ title: 't !急ぎ', priority: undefined })
  })
})
