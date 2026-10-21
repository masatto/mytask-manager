import { estimateOverrun, formatEstimate, parseEstimate, sumEstimates, tidyEstimateText } from './estimate.ts'

describe('tidyEstimateText', () => {
  it('読める入力は「1h30m」の形にそろえ、空は空のまま', () => {
    expect(tidyEstimateText('90')).toBe('1h30m')
    expect(tidyEstimateText(' 2時間 ')).toBe('2h')
    expect(tidyEstimateText('')).toBe('')
  })

  it('読めない入力は null（入力をそのまま残すため）', () => {
    expect(tidyEstimateText('2日')).toBeNull()
  })
})

describe('estimateOverrun', () => {
  it('サブタスクの合計が親を超えた分を返す', () => {
    expect(estimateOverrun(480, 630)).toBe(150)
  })

  it('超えていない・どちらかが未設定なら null', () => {
    expect(estimateOverrun(480, 480)).toBeNull()
    expect(estimateOverrun(480, 300)).toBeNull()
    expect(estimateOverrun(null, 300)).toBeNull()
    expect(estimateOverrun(undefined, 300)).toBeNull()
    expect(estimateOverrun(480, null)).toBeNull()
  })
})

describe('parseEstimate', () => {
  it.each([
    ['90', 90],
    ['90m', 90],
    ['90分', 90],
    ['2h', 120],
    ['1.5h', 90],
    ['1h30m', 90],
    ['1h30', 90],
    ['1時間30分', 90],
    ['２Ｈ', 120],
    [' 1h 30m ', 90],
  ])('「%s」は %d 分', (text, minutes) => {
    expect(parseEstimate(text)).toEqual({ ok: true, minutes })
  })

  it('空なら未設定', () => {
    expect(parseEstimate('  ')).toEqual({ ok: true, minutes: null })
  })

  it.each(['abc', 'h', '1d', '-5', '1h30m15', '0', '0h', '10000', '167h'])('「%s」は誤り', (text) => {
    expect(parseEstimate(text).ok).toBe(false)
  })
})

describe('formatEstimate', () => {
  it.each([
    [45, '45m'],
    [60, '1h'],
    [90, '1h30m'],
    [630, '10h30m'],
  ])('%d 分は %s', (minutes, text) => {
    expect(formatEstimate(minutes)).toBe(text)
  })

  it('未設定は空文字', () => {
    expect(formatEstimate(null)).toBe('')
  })

  it('表示した文字列を読み直すと同じ分になる', () => {
    for (const minutes of [1, 59, 60, 61, 125, 9999]) {
      expect(parseEstimate(formatEstimate(minutes))).toEqual({ ok: true, minutes })
    }
  })
})

describe('sumEstimates', () => {
  it('目安のあるものだけを合計する', () => {
    expect(sumEstimates([{ estimateMinutes: 30 }, { estimateMinutes: null }, { estimateMinutes: 45 }])).toBe(75)
  })

  it('1件もなければ null', () => {
    expect(sumEstimates([{ estimateMinutes: null }])).toBeNull()
    expect(sumEstimates([])).toBeNull()
  })
})
