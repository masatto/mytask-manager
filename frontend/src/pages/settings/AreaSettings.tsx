import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  AREA_COLORS,
  AREA_COLOR_LABELS,
  MAX_AREAS,
  MAX_AREA_NAME,
  areaKeys,
  createArea,
  deleteArea,
  fetchAreas,
  reorderAreas,
  updateArea,
  type Area,
  type AreaColor,
} from '../../api/areas.ts'
import { ApiRequestError } from '../../api/client.ts'
import { ruleKeys } from '../../api/rules.ts'
import { taskKeys } from '../../api/tasks.ts'
import { AreaDot } from '../../areas/AreaBadge.tsx'
import dialogStyles from '../../components/ConfirmDialog.module.css'
import { onEnter } from '../../lib/keyboard.ts'
import { useToast } from '../../toast/useToast.ts'
import styles from './AreaSettings.module.css'
import pageStyles from './settings.module.css'

/** エラーの表示文。項目のエラーがあればその文、なければ全体の文 */
function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    return error.fieldErrors[0]?.message ?? error.message
  }
  return fallback
}

/** エリアを変えると、一覧の絞り込み・バッジ・件数がすべて変わるので、まとめて取り直す */
function useRefreshAreas() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: areaKeys.all }),
      queryClient.invalidateQueries({ queryKey: taskKeys.all }),
      queryClient.invalidateQueries({ queryKey: ruleKeys.all }),
    ])
}

/**
 * 設定画面「エリア」（screen-design 8章）。追加・名前と色の変更・並べ替え・削除。
 * サイドバーのタブが増えすぎないよう、MAX_AREAS 個まで・名前は MAX_AREA_NAME 文字まで。
 */
export function AreaSettings() {
  const { data, isPending, isError } = useQuery({ queryKey: areaKeys.all, queryFn: fetchAreas })
  const refresh = useRefreshAreas()
  const { showToast } = useToast()
  const [deleting, setDeleting] = useState<Area | null>(null)
  const areas = data?.items ?? []

  const move = async (index: number, delta: number) => {
    const ids = areas.map((a) => a.id)
    ;[ids[index], ids[index + delta]] = [ids[index + delta], ids[index]]
    try {
      await reorderAreas(ids)
    } catch {
      showToast({ message: '並べ替えられませんでした' })
    }
    await refresh()
  }

  return (
    <section className={pageStyles.card} aria-labelledby="area-heading">
      <h2 id="area-heading" className={pageStyles.heading}>
        エリア
      </h2>
      <p className={pageStyles.description}>
        タスクと繰り返しルールを「Project」「Internal」のように分けます。サイドバー上部のタブで切り替えると、
        そのエリアだけを表示します（{MAX_AREAS}個まで）。
      </p>

      {isPending ? (
        <p className={pageStyles.meta}>読み込み中…</p>
      ) : isError ? (
        <p className={pageStyles.meta}>エリアを読み込めませんでした</p>
      ) : (
        <>
          {areas.length > 0 && (
            <ul className={styles.list} aria-label="エリアの一覧">
              {areas.map((area, index) => (
                <AreaRow
                  key={`${area.id}-${area.name}-${area.color}`}
                  area={area}
                  first={index === 0}
                  last={index === areas.length - 1}
                  onMove={(delta) => move(index, delta)}
                  onDelete={() => setDeleting(area)}
                  onSaved={refresh}
                />
              ))}
            </ul>
          )}
          {areas.length < MAX_AREAS ? (
            <AddAreaForm usedColors={areas.map((a) => a.color)} onAdded={refresh} />
          ) : (
            <p className={pageStyles.meta}>エリアは{MAX_AREAS}個までです。増やすときは、使わないエリアを削除してください。</p>
          )}
        </>
      )}

      {deleting && (
        <DeleteAreaDialog
          area={deleting}
          others={areas.filter((a) => a.id !== deleting.id)}
          onClose={() => setDeleting(null)}
          onDeleted={async () => {
            setDeleting(null)
            await refresh()
          }}
        />
      )}
    </section>
  )
}

function ColorSelect({ value, onChange, label }: { value: AreaColor; onChange: (c: AreaColor) => void; label: string }) {
  return (
    <span className={styles.color}>
      <AreaDot color={value} />
      <select
        className={styles.select}
        value={value}
        onChange={(e) => onChange(e.target.value as AreaColor)}
        aria-label={label}
      >
        {AREA_COLORS.map((c) => (
          <option key={c} value={c}>
            {AREA_COLOR_LABELS[c]}
          </option>
        ))}
      </select>
    </span>
  )
}

type AreaRowProps = {
  area: Area
  first: boolean
  last: boolean
  onMove: (delta: number) => void
  onDelete: () => void
  onSaved: () => Promise<unknown>
}

/** 1つのエリア。名前か色を変えると「保存」が押せるようになる（Enter でも保存） */
function AreaRow({ area, first, last, onMove, onDelete, onSaved }: AreaRowProps) {
  const [name, setName] = useState(area.name)
  const [color, setColor] = useState<AreaColor>(area.color)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()
  const dirty = name.trim() !== area.name || color !== area.color

  const save = async () => {
    if (!dirty || saving) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updateArea(area.id, { name: name.trim(), color })
      showToast({ message: 'エリアを保存しました' })
      await onSaved()
    } catch (e) {
      setError(errorMessage(e, '保存できませんでした'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className={styles.item}>
      <div className={styles.row}>
        <input
          className={styles.nameInput}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onEnter(() => void save())}
          maxLength={MAX_AREA_NAME}
          aria-label={`「${area.name}」の名前`}
          aria-invalid={error ? true : undefined}
        />
        <ColorSelect value={color} onChange={setColor} label={`「${area.name}」の色`} />
        {dirty && (
          <button type="button" className={styles.primary} onClick={save} disabled={saving || name.trim() === ''}>
            保存
          </button>
        )}
        <span className={styles.count}>
          タスク {area.taskCount}・ルール {area.ruleCount}
        </span>
        <span className={styles.actions}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => onMove(-1)}
            disabled={first}
            aria-label={`「${area.name}」を上へ`}
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => onMove(1)}
            disabled={last}
            aria-label={`「${area.name}」を下へ`}
          >
            ↓
          </button>
          <button type="button" className={styles.deleteButton} onClick={onDelete} aria-label={`「${area.name}」を削除`}>
            削除
          </button>
        </span>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </li>
  )
}

/** 新しいエリア。色は、まだ使っていない色から選んでおく */
function AddAreaForm({ usedColors, onAdded }: { usedColors: AreaColor[]; onAdded: () => Promise<unknown> }) {
  const nextColor = AREA_COLORS.find((c) => !usedColors.includes(c)) ?? 'gray'
  const [name, setName] = useState('')
  const [color, setColor] = useState<AreaColor | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  const add = async () => {
    if (name.trim() === '' || saving) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createArea({ name: name.trim(), color: color ?? nextColor })
      showToast({ message: `エリア「${name.trim()}」を追加しました` })
      setName('')
      setColor(null)
      await onAdded()
    } catch (e) {
      setError(errorMessage(e, '追加できませんでした'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.add}>
      <div className={styles.row}>
        <input
          className={styles.nameInput}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onEnter(() => void add())}
          maxLength={MAX_AREA_NAME}
          placeholder="新しいエリアの名前（例：案件A）"
          aria-label="新しいエリアの名前"
        />
        <ColorSelect value={color ?? nextColor} onChange={setColor} label="新しいエリアの色" />
        <button type="button" className={styles.primary} onClick={add} disabled={saving || name.trim() === ''}>
          追加
        </button>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

type DeleteAreaDialogProps = {
  area: Area
  others: Area[]
  onClose: () => void
  onDeleted: () => Promise<unknown>
}

/** 削除の確認。タスクやルールがあれば、移動先（ほかのエリアか未分類）を選ぶ */
function DeleteAreaDialog({ area, others, onClose, onDeleted }: DeleteAreaDialogProps) {
  const [moveTo, setMoveTo] = useState(others[0] ? String(others[0].id) : '')
  const [deleting, setDeleting] = useState(false)
  const { showToast } = useToast()
  const hasItems = area.taskCount > 0 || area.ruleCount > 0

  const confirm = async () => {
    setDeleting(true)
    try {
      await deleteArea(area.id, moveTo === '' ? null : Number(moveTo))
      showToast({ message: `エリア「${area.name}」を削除しました` })
      await onDeleted()
    } catch (e) {
      showToast({ message: errorMessage(e, '削除できませんでした') })
      setDeleting(false)
    }
  }

  return (
    <div className={dialogStyles.backdrop} onClick={onClose}>
      <div
        className={dialogStyles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-label={`エリア「${area.name}」を削除しますか？`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <p className={dialogStyles.message}>エリア「{area.name}」を削除しますか？</p>
        {hasItems && (
          <>
            <p className={dialogStyles.detail}>
              タスク {area.taskCount}件・繰り返しルール {area.ruleCount}件があります。移動先を選んでください。
            </p>
            <label className={styles.moveTo}>
              移動先
              <select className={styles.select} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                {others.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.name}
                  </option>
                ))}
                <option value="">未分類（「すべて」でだけ表示）</option>
              </select>
            </label>
          </>
        )}
        <div className={dialogStyles.actions}>
          <button type="button" className={dialogStyles.cancel} onClick={onClose} autoFocus>
            キャンセル
          </button>
          <button
            type="button"
            className={`${dialogStyles.confirm} ${dialogStyles.danger}`}
            onClick={confirm}
            disabled={deleting}
          >
            削除
          </button>
        </div>
      </div>
    </div>
  )
}
