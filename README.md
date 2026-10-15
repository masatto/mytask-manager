# mytask-manager

自分専用のタスク管理アプリ。PC のブラウザで使い、データは自分の PC の中だけに保存する。

- **今日やること**が一目でわかる：今日／今後／期限なし／完了済みの4つのビュー。期限切れは赤で強調
- **期限と優先度で並ぶ**：期限は「日付のみ」「日付＋時刻」の両方に対応
- **サブタスク**（1階層）：進捗表示、未完了が残る親の一括完了
- **繰り返しタスク**：毎日／毎週（曜日指定）／毎月（日付・末日）。日付が来たら自動で生成
- **バックアップ**：JSON でエクスポート／インポート

## 必要なもの

| もの | 備考 |
|---|---|
| Windows 10/11 | `start.bat` / `stop.bat` は Windows 用 |
| JDK 21 | [Eclipse Temurin 21](https://adoptium.net/) を推奨（`winget install EclipseAdoptium.Temurin.21.JDK`）。`JAVA_HOME` がなくても `C:\Program Files\Eclipse Adoptium\jdk-21*` を自動で探す |
| Node.js 24 以上 | フロントエンドの起動に使う |

Maven のインストールは不要（同梱の `mvnw` を使う）。

## 使い方

### 起動と終了

- **起動**：`start.bat` をダブルクリックする。バックエンドとフロントエンドが最小化されたウィンドウで立ち上がり、準備ができるとブラウザで http://localhost:5173/ が開く（初回は依存関係のダウンロードで数分かかる）
- **終了**：`stop.bat` をダブルクリックする（「mytask-manager backend」「mytask-manager frontend」の2つのウィンドウを閉じても同じ）

起動中に PC の日付が変わると、0時に繰り返しタスクが生成される。アプリを止めていた日の分は、次に起動したときに**直近の1回分だけ**生成される。

### ログイン時に自動で起動する（任意）

1. `Win + R` で `shell:startup` を開く
2. `start.bat` のショートカットをそのフォルダーに置く

ブラウザも毎回開くので、不要なら `start.bat` の最後の `start "" http://localhost:5173/` の行を消す。

### データの保存場所

```
%USERPROFILE%\.mytask-manager\data\mytask.mv.db
```

リポジトリの外に置いているので、`git clean` やリポジトリの作り直しでは消えない。
場所を変えたいときは、バックエンドの起動引数で `--mytask.data-dir=<フォルダー>` を指定する。

### バックアップ

画面左の「設定」から行う。

- **エクスポート**：`mytask-manager-YYYYMMDD-HHmm.json` がダウンロードされる。タスク・サブタスク・繰り返しルールを ID ごと保存する。定期的に取っておくこと
- **インポート**：ファイルを選ぶと、まず中身を検証して件数を表示する。確認すると**現在のデータをすべて置き換える**。不正なファイルは理由を表示して取り込まない

> **H2 のバージョンを上げるとき**：H2 のデータファイルはメジャーバージョン間で互換性がない。`backend/pom.xml` の `h2.version` を上げる前に必ずエクスポートし、上げたあと（空の DB で起動して）インポートで戻す。

## 開発

| 用途 | コマンド | 場所 |
|---|---|---|
| バックエンドの起動 | `.\mvnw.cmd spring-boot:run`（ポート 8080） | `backend/` |
| バックエンドのテスト | `.\mvnw.cmd test` | `backend/` |
| フロントエンドの起動 | `npm run dev`（ポート 5173、`/api` を 8080 へ転送） | `frontend/` |
| フロントエンドのテスト | `npm test`（Vitest） | `frontend/` |
| 型チェック・ビルド | `npm run build` | `frontend/` |
| lint | `npm run lint`（oxlint） | `frontend/` |
| E2E テスト | `npm run e2e`（Playwright） | `frontend/` |

- **テスト用の DB**：バックエンドのテストはメモリ上の DB を使う（`src/test/resources/config/application.yml`）。普段使いのデータには触れない
- **E2E テストの実行環境**：バックエンド（18080）とフロントエンド（15173）を、空の一時 DB（OS の一時フォルダーの `mytask-e2e-*`）で自動起動する
  - 普段使いのアプリを起動したままでも実行できる
  - ブラウザは Windows の Edge を使うので、ダウンロードは不要
- **日時を固定したテスト**：「今日」「期限切れ」「繰り返しの生成」は `java.time.Clock` を注入しているので、テストでは日時を固定・移動して確認できる（`MutableClock`）

## 構成

```
mytask-manager/
├── start.bat / stop.bat   起動・終了
├── docs/                  要件定義・設計書
├── backend/               Spring Boot 4 / Java 21 / Spring Data JPA / H2 / Flyway
│   └── src/main/java/com/masatto/mytask/
│       ├── task/          タスク（一覧の組み立て・ステータスの連動）
│       ├── rule/          繰り返しルール（発生日の計算・生成処理）
│       ├── backup/        エクスポート／インポート
│       ├── common/        共通エラー形式・ヘルスチェック
│       └── config/        Clock・スケジューラー
└── frontend/              React 19 / TypeScript / Vite / TanStack Query / React Hook Form + Zod / React Router
    ├── src/
    │   ├── api/           API の型と呼び出し
    │   ├── hooks/         データ取得・更新、未保存の変更の確認
    │   ├── components/    一覧の行・詳細パネル・ルール編集・ダイアログ
    │   ├── pages/         各画面
    │   └── lib/           日付・グループ分け・繰り返しの表示
    └── e2e/               Playwright の E2E テスト
```

## 設計ドキュメント

| 文書 | 内容 |
|---|---|
| [docs/requirements.md](docs/requirements.md) | 要件定義 |
| [docs/screen-design.md](docs/screen-design.md) | 画面設計（画面一覧・ワイヤーフレーム・ダイアログ） |
| [docs/api-design.md](docs/api-design.md) | API 設計（エンドポイント・DTO・生成処理・バックアップ形式） |
| [docs/db-design.md](docs/db-design.md) | DB 設計（テーブル・制約） |
| [docs/implementation-plan.md](docs/implementation-plan.md) | 実装計画（フェーズ分割） |

## 主な設計判断

| 判断 | 理由 |
|---|---|
| 「今日」「期限切れ」の判定と並び順はサーバーで確定させる | 表示ロジックをフロントに散らさない。フロントは受け取った順に並べ、日付で見出しを付けるだけ |
| リクエストは専用の DTO で受ける（Entity を直接受けない） | クライアントが送った `id` で既存データが上書きされる穴を作らないため |
| 期限のないサブタスクは親の期限でビューを判定する | 繰り返しのひな形から作るサブタスクは期限を持たないため。そのままだと親が「期限なし」にも出てしまう |
| 繰り返しは「最後に生成した発生日」で判定する | 逃した回を大量に作らない（直近の1件だけ）／生成済みのタスクを削除しても作り直さない |
| サブタスクの入れ子は DB の複合外部キーでも禁止する | アプリのチェックをすり抜けても、データが壊れないようにするため（db-design 3.4） |
| Flyway でスキーマを管理し、Hibernate は `validate` のみ | 長く使う実データを、自動のスキーマ変更から守るため |
| インポートの検証は「実際に取り込んでからロールバック」で行う | 参照関係だけでなく DB の制約違反まで、確認ダイアログを出す前に検出できる |
| 未保存の変更は、すべての画面遷移で確認する（`useBlocker`） | パネルの切り替え・サイドバー・ブラウザの戻るのどれでも、編集内容を黙って失わないため |
