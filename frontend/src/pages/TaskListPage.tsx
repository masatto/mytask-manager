import { VIEWS, type ViewKey } from '../views.ts'
import styles from './Page.module.css'

type TaskListPageProps = {
  view: ViewKey
}

// Phase 1 でタスク一覧を実装する
export function TaskListPage({ view }: TaskListPageProps) {
  const label = VIEWS.find((v) => v.key === view)?.label

  return (
    <section>
      <h1 className={styles.title}>{label}</h1>
    </section>
  )
}
