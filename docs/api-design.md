# mytask-manager API設計 v1.6

[requirements.md](requirements.md) v1.1 と [screen-design.md](screen-design.md) v1.0 に基づく。

## 1. 共通仕様

- ベースURL：`http://localhost:8080/api`
- 形式：JSON（UTF-8）
- タイムゾーン：Asia/Tokyo。「今日」「期限切れ」の判定はすべてサーバー側で行う
- 日付・時刻の書式：

| 種類 | 書式 | 例 |
|---|---|---|
| 日付 | `YYYY-MM-DD` | `2026-10-14` |
| 時刻 | `HH:mm` | `10:00` |
| 日時 | ISO 8601（オフセット付き） | `2026-10-14T09:12:00+09:00` |

- 列挙値：

| 種類 | 値 |
|---|---|
| 優先度 `priority` | `HIGH` / `MEDIUM` / `LOW` |
| ステータス `status` | `TODO` / `IN_PROGRESS` / `DONE` |
| 繰り返しパターン `pattern.type` | `DAILY` / `WEEKLY` / `MONTHLY` |
| 曜日 | `MON` / `TUE` / `WED` / `THU` / `FRI` / `SAT` / `SUN` |

- リクエストはすべて専用のDTOで受ける。`id`・`createdAt` などサーバーが決める項目は、リクエストに含まれていても無視する

### エラーレスポンス

```json
{
  "code": "VALIDATION_ERROR",
  "message": "入力内容に誤りがあります",
  "fieldErrors": [
    { "field": "title", "message": "タイトルは必須です" }
  ]
}
```

| HTTP | code | 発生条件 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | 入力チェックエラー |
| 400 | `NESTED_SUBTASK` | サブタスクの下にサブタスクを作ろうとした |
| 400 | `INVALID_BACKUP` | インポートファイルの形式が不正 |
| 404 | `NOT_FOUND` | 対象が存在しない |
| 403 | `FORBIDDEN` | この PC 以外を指す宛先（Host）、または別のサイトからの更新（下の「接続の制限」） |
| 409 | `SUBTASKS_INCOMPLETE` | 未完了のサブタスクが残る親を、一括完了の指定なしで完了にしようとした |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | POST の Content-Type が application/json でない |
| 500 | `INTERNAL_ERROR` | 想定外のエラー |

### 接続の制限

ログイン機能がないため、次の3つで「この PC の Orbit の画面からの操作」だけを受け付ける（`LocalOnlyRequestFilter`）。

1. サーバーは `127.0.0.1` だけで待ち受ける（同じネットワークの他の PC からは接続できない）
2. 宛先（Host）が `127.0.0.1` / `localhost` 以外のリクエストは、読み取りも含めて拒否する（DNS リバインディング対策）
3. 更新系（GET 以外）で、別のサイトから送られたもの（`Origin` が別のホスト、または `Sec-Fetch-Site` が `same-origin` / `none` 以外）は拒否する。さらに POST は JSON 以外を受け付けない（ブラウザの事前確認なしで送れる「単純なリクエスト」で、別のサイトがインポートや復元を実行するのを防ぐ）

curl などブラウザ以外からのリクエストは `Origin` を付けないので、この PC からなら使える（POST は `Content-Type: application/json` が必要）。

## 2. エンドポイント一覧

| メソッド | パス | 用途 | 使う画面 |
|---|---|---|---|
| GET | `/tasks?view=…` | ビュー別の一覧 | S1 |
| GET | `/tasks/counts` | サイドバーの件数 | 共通 |
| GET | `/tasks/search?q=…` | タイトル・メモの検索 | 検索画面 |
| GET | `/tasks/{id}` | タスク詳細 | S2 |
| POST | `/tasks` | タスク・サブタスクの作成 | S1 クイック追加、S2 |
| PUT | `/tasks/{id}` | タスクの更新（全項目） | S2 保存 |
| PATCH | `/tasks/{id}/status` | ステータスだけを変更 | S1/S2 チェックボックス |
| PATCH | `/tasks/statuses` | 複数タスクのステータスを一括で戻す | 「元に戻す」トースト |
| DELETE | `/tasks/{id}` | タスクの削除（サブタスクも削除） | S2 |
| GET | `/rules` | ルール一覧 | S3 |
| GET | `/rules/{id}` | ルール詳細 | S4 |
| POST | `/rules` | ルールの作成 | S4 |
| PUT | `/rules/{id}` | ルールの更新 | S4 |
| PATCH | `/rules/{id}/active` | 有効/停止の切り替え | S3 |
| DELETE | `/rules/{id}` | ルールの削除 | S4 |
| POST | `/rules/preview` | 次回の生成予定を計算する（保存しない） | S4 |
| GET | `/backup` | JSONエクスポート | S5 |
| POST | `/backup/import?dryRun=true` | インポート内容の検証と件数の確認 | S5 → D3 |
| POST | `/backup/import` | インポートの実行（全置換） | S5 |
| GET | `/backup/auto` | 自動バックアップの保存先と保存済みファイル | S5 |
| GET | `/health` | 疎通確認 | — |

## 3. タスクAPI

### 3.1 データ型

**TaskResponse**

| 項目 | 型 | 説明 |
|---|---|---|
| `id` | number | |
| `title` | string | |
| `memo` | string \| null | |
| `dueDate` | string \| null | 日付 |
| `dueTime` | string \| null | 時刻 |
| `priority` | string | |
| `status` | string | |
| `completedAt` | string \| null | 日時。完了のときだけ値を持つ |
| `overdue` | boolean | サーバーが計算する。完了済みのタスクは常に false |
| `parentId` | number \| null | |
| `recurrence` | object \| null | `{ "ruleId": 3, "ruleTitle": "週次の振り返り", "occurrenceDate": "2026-10-12" }`。ルールが削除済みなら `ruleId` と `ruleTitle` は null |
| `createdAt` / `updatedAt` | string | 日時 |

**TaskListItem**（一覧の1行。親タスク単位）

| 項目 | 型 | 説明 |
|---|---|---|
| `task` | TaskResponse | 親タスク |
| `contextOnly` | boolean | true のとき、親自身はビューの条件を満たしていない（薄く表示する） |
| `subtasks` | TaskResponse[] | `contextOnly` が false ならすべてのサブタスク、true なら条件を満たすサブタスクだけ |
| `progress` | object | `{ "done": 1, "total": 3 }`。件数はサブタスク全体で数える |
| `viewDate` / `viewTime` | string \| null | グループ分けと並び順に使う日付・時刻。ビューの条件を満たしたタスク（親・サブタスク）の中で最も早い期限。完了済みビューでは、条件を満たしたタスクの最新の完了日（`viewTime` は null） |
| `viewOverdue` | boolean | 今日ビューで「期限切れ」グループに入れるかどうか |

### 3.2 GET `/tasks?view={view}`

| パラメータ | 値 | 説明 |
|---|---|---|
| `view` | `today` / `upcoming` / `no-due` / `done` | 必須 |
| `offset` | number | `done` のときだけ使う。初期値 0 |
| `limit` | number | `done` のときだけ使う。初期値 100、最大 100 |

**レスポンス**

```json
{
  "items": [ { "task": { }, "contextOnly": false, "subtasks": [], "progress": { "done": 0, "total": 0 }, "viewDate": "2026-10-14", "viewTime": "10:00", "viewOverdue": false } ],
  "hasMore": false
}
```

**ビューの判定**（タスク1件ごとに判定し、親単位にまとめる）

| view | 条件 |
|---|---|
| `today` | 未完了、かつ期限が今日以前 |
| `upcoming` | 未完了、かつ期限が明日以降 |
| `no-due` | 未完了、かつ期限なし |
| `done` | 完了 |

- 期限のないサブタスクは、親の期限で判定する。例えば期限が今日の親の下にある期限なしのサブタスクは、「期限なし」ではなく「今日」として扱う（繰り返しのひな形から作るサブタスクは期限を持たないため、親が「期限なし」ビューにも出てしまうのを防ぐ）

- 並び順はサーバーで確定させて返す。フロントは受け取った順に表示し、`viewDate` でグループ分けするだけにする
- 並び順：
  - `done` 以外：`viewDate`（null は最後）→ `viewTime`（null はその日の最後）→ 優先度 → 作成日時
  - `done`：完了日時の新しい順
- `hasMore` は `done` のときだけ意味を持つ（他のビューは常に false）

### 3.3 GET `/tasks/counts`

```json
{ "today": 5, "overdue": 2, "upcoming": 12, "noDue": 3, "doneToday": 4 }
```

- 件数は、各ビューの `items` の件数と同じ
- `overdue` は、今日ビューのうち `viewOverdue` が true の件数（サイドバーで赤く表示するかの判定に使う）
- `doneToday` は、今日（0:00〜24:00）完了にした親タスクの数。期限に関係なく数える（Today の進み具合の表示に使う）

### 3.4 GET `/tasks/{id}`

TaskResponse に次の項目を加えて返す。

| 項目 | 型 | 説明 |
|---|---|---|
| `parent` | object \| null | `{ "id": 1, "title": "…" }`。サブタスクのときだけ |
| `subtasks` | TaskResponse[] | 親のときだけ。並び順は作成順 |

### 3.5 POST `/tasks`

```json
{
  "title": "API設計書を書く",
  "memo": null,
  "dueDate": "2026-10-14",
  "dueTime": null,
  "priority": "MEDIUM",
  "parentId": null
}
```

| 項目 | 必須 | 入力チェック |
|---|---|---|
| `title` | ○ | 前後の空白を除いて 1〜200 文字 |
| `memo` | | 10,000 文字まで |
| `dueDate` | | |
| `dueTime` | | `dueDate` がないときは指定できない |
| `priority` | | 省略時は `MEDIUM` |
| `parentId` | | 存在するタスクであること。そのタスクがサブタスクなら `NESTED_SUBTASK` |

- ステータスは常に `TODO` で作成する
- 完了済みの親にサブタスクを追加した場合は、親を `IN_PROGRESS` に戻す（3.7 の差し戻しと同じ考え方）
- レスポンス：201 と TaskResponse

### 3.6 PUT `/tasks/{id}`

- リクエストは POST の項目から `parentId` を除き、`status` を加えたもの。全項目を送る（送らなかった項目は null として扱う）
- 親子関係は変更できない
- ステータスの変更に伴う動作は 3.7 と同じ。ただし、未完了のサブタスクが残る親を `DONE` にする場合は 409 を返す（S2 では、保存の前にフロント側で D1 を出し、3.7 の一括完了を使う）
- レスポンス：200 と TaskResponse

### 3.7 PATCH `/tasks/{id}/status`

```json
{ "status": "DONE", "completeSubtasks": true }
```

- `completeSubtasks` は省略できる（省略時は false）
- 親を `DONE` にするとき、未完了のサブタスクが残っている場合：
  - `completeSubtasks` が false なら 409 `SUBTASKS_INCOMPLETE` を返す。レスポンスに `"incompleteCount": 2` を含める
  - true ならサブタスクもまとめて `DONE` にする
- `DONE` にしたら `completedAt` に現在日時を入れる。`DONE` 以外に戻したら null にする
- 完了済みの親の下で、サブタスクを未完了に戻した場合は、親を `IN_PROGRESS` に戻す
- レスポンス：今回の操作で状態が変わったすべてのタスク（「元に戻す」で使う）

```json
{
  "changed": [
    { "id": 10, "previousStatus": "TODO", "status": "DONE" },
    { "id": 11, "previousStatus": "IN_PROGRESS", "status": "DONE" }
  ]
}
```

### 3.8 PATCH `/tasks/statuses`

「元に戻す」で、3.7 の `changed` を逆向きにまとめて適用するためのエンドポイント。

```json
{ "changes": [ { "id": 10, "status": "TODO" }, { "id": 11, "status": "IN_PROGRESS" } ] }
```

- 1トランザクションで適用する。1件でも存在しないIDがあれば、全体を 404 にする
- 3.7 の連動（一括完了・親の差し戻し）は行わない。指定されたとおりに設定する
- レスポンス：204

### 3.9 DELETE `/tasks/{id}`

- 親を削除するとサブタスクも削除する
- 繰り返しから生成されたタスクを削除しても、同じ回は再生成しない（5章を参照）
- レスポンス：204

### 3.10 GET `/tasks/search?q={語}`

- タイトルまたはメモに語を含むタスクを探す（部分一致・大文字小文字を区別しない）。`%` `_` もそのままの文字として扱う
- 親・サブタスク、完了済みも対象。行のまとめ方は 3.2 と同じ（サブタスクだけが一致した親は `contextOnly`）
- 並び順：未完了の行（3.2 の並び順）→ 完了済みの行（完了日時の新しい順）。同じ親が両方に出るときは未完了側だけ
- 最大100行。超えたときは `hasMore: true`
- `q` が空または100文字を超える場合は 400 `VALIDATION_ERROR`

## 4. 繰り返しルールAPI

### 4.1 データ型

**RuleRequest**（POST / PUT 共通）

```json
{
  "title": "週次の振り返り",
  "memo": null,
  "priority": "MEDIUM",
  "dueTime": null,
  "pattern": { "type": "WEEKLY", "daysOfWeek": ["MON"], "dayOfMonth": null },
  "startDate": "2026-10-14",
  "endDate": null,
  "active": true,
  "subtaskTemplates": [
    { "title": "アウトプット確認", "priority": "MEDIUM" },
    { "title": "来週の計画", "priority": "MEDIUM" }
  ]
}
```

| 項目 | 入力チェック |
|---|---|
| `title` | 1〜200 文字 |
| `pattern.daysOfWeek` | `WEEKLY` のとき必須（1つ以上）。それ以外のときは null |
| `pattern.dayOfMonth` | `MONTHLY` のとき必須。1〜31、または `-1`（末日）。それ以外のときは null |
| `startDate` | 必須 |
| `endDate` | 指定する場合は `startDate` 以降 |
| `subtaskTemplates` | 20件まで。並び順は配列の順 |

**RuleResponse**：RuleRequest の項目に、次の項目を加えたもの。

| 項目 | 型 | 説明 |
|---|---|---|
| `id` | number | |
| `nextOccurrence` | string \| null | 次に生成する日付。停止中または終了済みなら null |
| `lastGeneratedDate` | string \| null | 最後に生成した発生日 |
| `createdAt` / `updatedAt` | string | 日時 |

### 4.2 各エンドポイント

| エンドポイント | 動作 |
|---|---|
| GET `/rules` | 一覧を作成順で返す。`{ "items": RuleResponse[] }` |
| GET `/rules/{id}` | RuleResponse を返す |
| POST `/rules` | 201 と RuleResponse。保存した直後に、そのルールの生成処理（5章）を実行する |
| PUT `/rules/{id}` | 200 と RuleResponse。変更は次回生成分から反映する。保存後に生成処理を実行する（例：曜日に今日を追加すると、今日の分がすぐ出る。生成済みの回は作り直さない） |
| PATCH `/rules/{id}/active` | `{ "active": false }` を受け取る。200 と RuleResponse。再開（true）したときは生成処理を実行し、停止中に逃した回のうち直近の1件を生成する |
| DELETE `/rules/{id}` | 204。生成済みのタスクは残し、ルールへの参照だけを外す |
| POST `/rules/preview` | RuleRequest の `pattern`・`startDate`・`endDate` だけを使う。今日以降の発生日を最大3件、`{ "occurrences": ["2026-10-19", "2026-10-26", "2026-11-02"] }` で返す |

## 5. 繰り返しタスクの生成処理（API外の動作）

**実行タイミング**

- 毎日 0:00（`@Scheduled(cron = "0 0 0 * * *", zone = "Asia/Tokyo")`）
- アプリ起動時（`ApplicationReadyEvent`）
- ルールを作成した直後（そのルールだけを対象にする）

**手順**（有効なルールごとに行う）

1. 今日以前の発生日のうち、最も新しい日 `d` を求める（`startDate` 以降、`endDate` 以前の範囲で）
2. `d` が存在しない場合や、`d` が `lastGeneratedDate` 以前の場合は何もしない
3. ひな形から、期限日 `d`（期限時刻はひな形の値）の親タスクと、サブタスクを作成する
4. ルールの `lastGeneratedDate` を `d` に更新する

**補足**

- 手順1の「最も新しい日だけ」によって、停止中に逃した回は直近の1件だけが生成される（要件 F4）
- `lastGeneratedDate` で判定するので、生成されたタスクをユーザーが削除しても再生成されない
- 二重生成の最終防止策として、`(rule_id, occurrence_date)` に一意制約をかける
- 生成したタスクには `occurrenceDate` を記録する（サブタスクには記録しない）

## 6. バックアップAPI

### 6.1 GET `/backup`

```json
{
  "format": "mytask-manager-backup",
  "version": 1,
  "exportedAt": "2026-10-14T21:00:00+09:00",
  "tasks": [ ],
  "rules": [ ]
}
```

- タスクとルールを、IDも含めてそのまま出力する
- ファイル名を指定するため、`Content-Disposition: attachment; filename="mytask-manager-20261014-2100.json"` を付けて返す

### 6.2 POST `/backup/import`

- リクエスト本文：6.1 の JSON
- `dryRun=true` のとき：検証だけを行い、次の形で件数を返す。何も保存しない

```json
{ "current": { "tasks": 120, "rules": 4 }, "incoming": { "tasks": 85, "rules": 3 } }
```

- `dryRun` なしのとき：1トランザクションで、全データを削除してからインポートする。レスポンスは 204
- 次のいずれかに当てはまる場合は、400 `INVALID_BACKUP` を返す
  - `format` または `version` が一致しない
  - 参照先のない `parentId` がある
  - サブタスクが入れ子になっている

### 6.3 GET `/backup/auto`（自動バックアップ）

```json
{
  "directory": "C:\\Users\\me\\.mytask-manager\\backups",
  "keep": 14,
  "files": [ { "name": "mytask-manager-auto-20261015.json", "size": 4096, "createdAt": "2026-10-15T00:05:00+09:00" } ]
}
```

- 保存処理はアプリ起動時と毎日0:05に実行する。その日のファイル（`mytask-manager-auto-YYYYMMDD.json`）が既にあれば何もしない
- 内容は 6.1 と同じ形式。一時ファイルに書いてから置き換えるので、書きかけのファイルは残らない
- 自動バックアップのファイル名に合うものだけを数え、新しい順に14件を残して古いものを削除する（フォルダー内のほかのファイルには触れない）
- 保存先は `mytask.backup-dir`（初期値 `%USERPROFILE%\.mytask-manager\backups`）

### 6.4 POST `/backup/auto/{name}/import`（自動バックアップから復元）

- `name` は 6.3 の `files[].name`。中身を 6.2 と同じ方法で取り込む（`dryRun=true` なら検証と件数の確認だけ）
- 自動バックアップのファイル名（`orbit-auto-YYYYMMDD.json` など）に合わない名前、保存先フォルダーの外を指す名前、存在しないファイルは 404 `NOT_FOUND`

### 6.5 自動バックアップのコピー先と「今すぐバックアップ」

| メソッド | パス | 内容 |
|---|---|---|
| PUT | `/backup/auto/mirror` | `{ "mirrorDirectory": "C:\\Users\\me\\OneDrive\\Orbit" }`（null・空で解除）。存在して書き込める絶対パスのフォルダーで、保存先とは別であること（違えば 400 `VALIDATION_ERROR`、field は `mirrorDirectory`）。設定するとすぐに今あるバックアップを写す。返すのは 6.3 の状態 |
| POST | `/backup/auto/run` | 今日の自動バックアップを今の内容で作り直し、コピー先にも写す。返すのは 6.3 の状態 |

- 6.3 の状態に `mirrorDirectory`（未設定なら null）と `mirrorError`（直近のコピーの失敗理由。成功なら null）、`mirrorFiles`（コピー先にある自動バックアップ。形は `files` と同じ・新しい順。未設定なら空）を加える
- コピー先にも、自動バックアップのファイル名に合うものだけを新しい順に14件残す。コピーに失敗しても、バックアップ自体（保存先への保存）は成功として扱う
- 設定は DB の外（`mytask.settings-file`、初期値は `データの保存先\settings.json`）に置く。DB を復元しても設定が巻き戻らないようにするため

### 6.6 GET `/system`（このアプリについて）

```json
{ "version": "1.0.0", "buildTime": "2026-10-15T16:53:16+09:00", "dataDirectory": "C:\\Users\\me\\.mytask-manager\\data", "backupDirectory": "C:\\Users\\me\\.mytask-manager\\backups", "logFile": "C:\\Users\\me\\.mytask-manager\\logs\\orbit.log" }
```

- `logFile` はログを書き出しているファイル（`logging.file.name`）。ファイルに残さない起動（開発用）では null

- `buildTime` は実際にビルドした日時（古いアプリが動いたままになっていないかの確認用）

## 7. 決定事項

1. 完了済みの親の下でサブタスクを未完了に戻したら、親を「進行中」に戻す
2. 生成されたタスクを削除しても、同じ回は再生成しない
3. ルールを作成した直後に、今日以前の直近の発生日があれば、すぐにタスクを生成する（例：月曜にルールを作ると、その日の分がすぐ出る。開始日が過去なら、過去の直近の回も出る）
4. ルールを削除したとき、生成済みのタスクは残して「繰り返し」表示だけを消す

## 変更履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-10-14 | 1.0 | 初版 |
| 2026-10-15 | 1.1 | Phase 2 の実装に合わせて `viewDate` の定義を明確化。完了済みの親へのサブタスク追加時の動作を追記 |
| 2026-10-15 | 1.2 | 期限のないサブタスクは親の期限でビューを判定。ルールの更新・再開時にも生成処理を実行 |
| 2026-10-15 | 1.3 | 検索（3.10）と自動バックアップ（6.3）を追加 |
| 2026-10-15 | 1.4 | 件数に `doneToday` を追加（3.3）。自動バックアップからの復元（6.4）を追加 |
| 2026-10-15 | 1.5 | 接続の制限（別のサイトからの操作・DNS リバインディングの拒否）と 403・415 を追加 |
| 2026-10-15 | 1.6 | 今日完了ビュー（`view=done-today`）、自動バックアップのコピー先と今すぐバックアップ（6.5）、`/system`（6.6）を追加 |
