import { useSystemInfo } from '../../hooks/useBackup.ts'
import { formatDateTime } from '../../lib/date.ts'
import styles from './settings.module.css'

/** このアプリについて：古いアプリが動いたままになっていないかを、バージョンとビルド日時で確かめられるようにする */
export function AboutSection() {
  const { data, isError } = useSystemInfo()

  return (
    <section className={styles.card} aria-labelledby="about-heading">
      <h2 id="about-heading" className={styles.heading}>
        このアプリについて
      </h2>
      {isError ? (
        <p className={styles.description}>情報を取得できませんでした</p>
      ) : !data ? (
        <p className={styles.description}>読み込み中…</p>
      ) : (
        <dl className={styles.about}>
          <dt>バージョン</dt>
          <dd>Orbit {data.version}</dd>
          <dt>ビルド日時</dt>
          <dd>{data.buildTime ? formatDateTime(data.buildTime) : '—'}</dd>
        </dl>
      )}
    </section>
  )
}
