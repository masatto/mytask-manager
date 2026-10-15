import { Component, type ErrorInfo, type ReactNode } from 'react'
import styles from './ErrorBoundary.module.css'

type ErrorBoundaryProps = { children: ReactNode }
type ErrorBoundaryState = { error: Error | null }

/**
 * 画面の表示中に予期しないエラーが起きたとき、真っ白にせず、メッセージと再読み込みのボタンを出す。
 * データはサーバーに保存されているので、再読み込みで元に戻る。
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Orbit: 画面の表示中にエラーが起きました', error, info.componentStack)
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }
    return (
      <div className={styles.box} role="alert">
        <h1 className={styles.title}>画面を表示できませんでした</h1>
        <p className={styles.text}>
          予期しないエラーが起きました。データは保存されているので、再読み込みで元に戻ります。
        </p>
        <pre className={styles.detail}>{this.state.error.message}</pre>
        <button type="button" className={styles.button} onClick={() => window.location.reload()}>
          再読み込み
        </button>
      </div>
    )
  }
}
