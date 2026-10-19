import '@testing-library/jest-dom/vitest'

// 選んだエリアなど、ブラウザに保存する値をテストごとに消す
afterEach(() => {
  localStorage.clear()
})
