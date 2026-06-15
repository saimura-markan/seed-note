# 🌱 Seed Note — クレーム管理・組織学習システム

> **クレームは、成長の種。**  
> 記録し、分析し、組織を育てる。

清掃・解体・産廃業界の現場向けクレーム管理システム。クレームを個人責任で終わらせず、記録・分析・共有し、組織学習につなげることを目的とする。

**本番 URL：** https://seed-note-seven.vercel.app  
**デプロイ：** `npx vercel --prod`（Vercel）

---

## 目次

1. [システム概要](#1-システム概要)
2. [システム目的](#2-システム目的)
3. [技術スタック](#3-技術スタック)
4. [ローカル起動方法](#4-ローカル起動方法)
5. [環境変数](#5-環境変数)
6. [Supabase 構成](#6-supabase-構成)
7. [主要機能](#7-主要機能)
8. [画面構成](#8-画面構成)
9. [docs フォルダの説明](#9-docs-フォルダの説明)
10. [引継ぎ時の注意点](#10-引継ぎ時の注意点)

---

## 1. システム概要

Seed Note は React + Supabase で構築された SPA（シングルページアプリケーション）。

クレームが発生してから「承認完了・掲示板公開」に至るまでの一連のワークフローをデジタル管理する。担当者・事業責任者・役員という3階層のロールに応じて操作できる画面が分かれており、各ステップで入力された情報が最終的に「合同改善報告書」として蓄積される。

```
クレーム受付
    ↓
連絡・聞き取り記録（現場スタッフ）
    ↓
是正案提出（現場スタッフ）→ 承認/差し戻し（事業責任者）
    ↓
改善報告書 提出（現場スタッフ）← ソクラテス式対話で思考を深める
    ↓
深掘り分析（事業責任者）← ソクラテス式対話 + 真因カテゴリー分類
    ↓
役員承認（役員3名）
    ↓
承認完了 → 掲示板に自動公開
```

---

## 2. システム目的

| 目的 | 内容 |
|-----|------|
| 記録する | クレームをリアルタイムに記録。対応期限タイマーで初動を促す |
| 分析する | ソクラテス式対話で現象原因・真因を深掘りし、8分類で傾向を把握する |
| 学習する | 承認完了した案件を掲示板で組織全体に公開・共有する |
| 成長する | 真因対策の担当者・期限・進捗を管理し、再発防止を追跡する |

**将来構想（未実装）：** 部門別傾向分析・AI分析（`@anthropic-ai/sdk` 導入済み）・未然防止の仕組み化

---

## 3. 技術スタック

| カテゴリ | 技術 | バージョン |
|---------|------|----------|
| フロントエンド | React | 18.3.1 |
| ルーティング | React Router DOM | 6.28.0 |
| バックエンド / DB | Supabase | 2.49.4 |
| ビルドツール | Vite | 6.0.5 |
| スタイリング | TailwindCSS | 3.4.17 |
| アイコン | Lucide React | 0.468.0 |
| UI 基盤 | Radix UI (react-slot) | 1.1.0 |
| ユーティリティ | clsx + tailwind-merge | — |
| AI SDK | @anthropic-ai/sdk | 0.104.1 ※未使用 |
| デプロイ | Vercel | — |

---

## 4. ローカル起動方法

### 前提条件

- Node.js 20 以上
- Supabase プロジェクト（既存のものを流用）

### 手順

```bash
# 1. リポジトリをクローン（またはディレクトリに移動）
cd ~/Documents/seed-note

# 2. 依存パッケージをインストール
npm install

# 3. 環境変数を設定（後述）
cp .env.local.example .env.local
# → .env.local を編集

# 4. 開発サーバーを起動
npm run dev

# → http://localhost:5173 でアクセス可能
```

### ビルド

```bash
npm run build    # dist/ に本番ビルドを生成
npm run preview  # ビルド結果をローカルで確認
```

### 本番デプロイ

```bash
npx vercel --prod
```

---

## 5. 環境変数

`.env.local` ファイルをプロジェクトルートに作成する。

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...（アノンキー）
```

| 変数名 | 説明 | 取得場所 |
|-------|------|---------|
| `VITE_SUPABASE_URL` | Supabase プロジェクトの URL | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | 公開用の匿名キー（RLS が適用される） | Supabase Dashboard → Settings → API |

> **注意：** `VITE_` プレフィックスがないと Vite でビルドした際に参照できない。

**Vercel の環境変数設定：**  
Vercel Dashboard → プロジェクト → Settings → Environment Variables に同じ2変数を登録する。

**サービスロールキー（スクリプト用）：**  
`scripts/seed-bulletin.mjs` を実行する際のみ必要。`.env.local` には含めず、実行時に引数で渡す。

```bash
SERVICE_KEY="eyJ...（サービスロールキー）" node scripts/seed-bulletin.mjs
```

---

## 6. Supabase 構成

### 6-1. プロジェクト情報

| 項目 | 値 |
|-----|---|
| プロジェクト URL | `https://wxjmqrxaqrujsvgzknwy.supabase.co` |
| リージョン | 要確認 |
| Auth 方式 | メール＋パスワード |

### 6-2. テーブル一覧

| テーブル名 | 用途 |
|-----------|------|
| `complaints` | クレーム本体（ステータス・受付情報・感情レベル等） |
| `complaint_logs` | クレームに紐づくログ（連絡・聞き取り・是正案・コメント等） |
| `complaint_corrections` | 改善報告書（直接原因・是正処置・運用改善案・ソクラテス回答） |
| `complaint_deep_analysis` | 深掘り分析（真因・カテゴリー・横展開・真因対策） |
| `complaint_approvals` | 役員承認レコード（3名分） |
| `bulletin_board` | 掲示板投稿（承認完了時に自動 insert。content は jsonb） |
| `profiles` | ユーザープロフィール（名前・ふりがな・電話番号） |
| `companies` / `sites` / `orders` | 取引先・現場・発注（DataContext に接続済みだが現在は画面から未使用） |

### 6-3. complaint_logs の type 値

| type | 意味 |
|------|------|
| `contact` | お客様への連絡記録 |
| `hearing` | 作業者からの聞き取り |
| `report` | 上司への是正案報告 |
| `supervisor_comment` | 事業責任者のコメント・承認記録 |
| `correction_rejected` | 改善報告書の否認理由 |
| `deep_approved` | 合同改善報告書の役員提出記録 |

### 6-4. スキーマ変更の履歴（後から追加したカラム）

開発途中に以下の `ALTER TABLE` を Supabase SQL Editor で手動実行している。

```sql
-- ソクラテス対話の回答保存
ALTER TABLE complaint_corrections
  ADD COLUMN IF NOT EXISTS socratic_answers jsonb DEFAULT '{}';

-- 深掘り分析の拡張フィールド
ALTER TABLE complaint_deep_analysis
  ADD COLUMN IF NOT EXISTS root_detail text DEFAULT '';

ALTER TABLE complaint_deep_analysis
  ADD COLUMN IF NOT EXISTS horizontal_departments jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS horizontal_content text DEFAULT '',
  ADD COLUMN IF NOT EXISTS action_assignee text DEFAULT '',
  ADD COLUMN IF NOT EXISTS action_deadline date,
  ADD COLUMN IF NOT EXISTS action_progress text DEFAULT '未着手';
```

### 6-5. RLS（Row Level Security）

**現時点でコードからは確認できない。** 引継ぎ後に Supabase Dashboard で以下を確認・設定すること。

- 各テーブルで RLS が有効か
- `bulletin_board` がアノンキーで SELECT できるか（できない場合、掲示板が表示されない）
- スタッフ（`user` ロール）が他人のクレームを参照・変更できないか

### 6-6. ユーザーのロール設定方法

Supabase Dashboard → Authentication → Users → 対象ユーザー → Edit → `Raw app_metadata` に設定する。

```json
{
  "seed_note_role": "admin"
}
```

設定可能なロール値：`admin` / `director` / `executive` / `manager` / `judgment` / `user`

---

## 7. 主要機能

### 7-1. クレーム受付と対応期限タイマー

クレーム登録時に感情レベル（1〜5）を選択すると対応期限が自動設定される。ダッシュボードのカードにリアルタイムカウントダウンが表示される。

| 感情レベル | 対応期限 |
|-----------|---------|
| Lv.1 穏やか | 60分 |
| Lv.2 気になる | 60分 |
| Lv.3 注意 | 60分 |
| Lv.4 緊張 | 30分 |
| Lv.5 最高緊張 | 15分 |

### 7-2. ソクラテス式対話（2箇所）

思考の深化を促すために、以下の2箇所でソクラテス式対話を実装している。

**① 改善報告書（CorrectionSubmit.jsx）：現象原因の深掘り**
- 直接原因を入力すると自動起動
- Q1「なぜ起きたか」→ Q2「2度と起きないために何が必要か」→ 最終確認
- 対話の回答は `socratic_answers`（jsonb）として DB に保存・再提出時に復元される

**② 深掘り分析（DeepAnalysisForm.jsx）：真因の深掘り**
- 改善報告書承認後に起動
- Q1「なぜ起きたか（仕組み・体制の観点）」→ Q2「なぜ仕組みとして防げなかったか」→ 最終確認
- **対話の回答は現在 DB に保存されない（ページリロードで消える）→ 未実装**

### 7-3. 真因カテゴリー分類（8分類）

深掘り分析で選択する。

`教育不足` / `標準化不足` / `ルール未整備` / `システム不備` / `顧客確認不足` / `引継ぎ不足` / `マネジメント不足` / `人員配置問題`

### 7-4. 横展開・真因対策

深掘り分析の一部。

- **横展開：** 対象部署（チェックボックス複数選択）・周知内容
- **真因対策：** 担当者・期限（残日数カウントダウン表示）・進捗（未着手/進行中/完了）

### 7-5. 役員承認（3名固定）

`DeepAnalysisForm.jsx` の `APPROVERS` 定数に以下の3名がハードコードされており、深掘り分析提出時に `complaint_approvals` テーブルに自動 insert される。

| 順序 | 氏名 | 役職 |
|-----|------|------|
| 0 | 山口 誠 | 代表取締役 |
| 1 | 佐々木 隆 | 取締役 工事部長 |
| 2 | 川上 直美 | 取締役 品質管理責任者 |

承認者を変更する場合は `src/pages/DeepAnalysisForm.jsx` の `APPROVERS` 定数を編集する。

### 7-6. 掲示板（改善報告書掲示板）

全員承認完了時に `Approval.jsx` が自動で `bulletin_board` テーブルに insert する。重複チェックあり（同一 `complaint_id` が既に存在する場合はスキップ）。

Dashboard の下部に「🌱 改善報告書掲示板」として表示される。フィルター機能：
- キーワード検索（クレーム内容・現場名・真因・組織対策が対象）
- 真因カテゴリーフィルター（8分類・複数選択可）
- 期間フィルター（全て / 直近1ヶ月 / 3ヶ月 / 6ヶ月 / 1年以内）

**既存の承認済みクレームを一括投稿するスクリプト：**

```bash
SERVICE_KEY="eyJ..." node scripts/seed-bulletin.mjs
```

---

## 8. 画面構成

| パス | ファイル | 画面名 | アクセス |
|-----|---------|-------|---------|
| `/login` | `Login.jsx` | ログイン | 未認証のみ |
| `/dashboard` | `Dashboard.jsx` | ダッシュボード + 掲示板 | 全員 |
| `/complaints/new` | `ComplaintNew.jsx` | 新規クレーム受付 | 全員 |
| `/complaints/:id` | `ComplaintOverview.jsx` | クレーム詳細（概要） | 全員 |
| `/complaints/:id/detail` | `ComplaintDetail.jsx` | 聞き取り・対応入力 | admin, judgment |
| `/complaints/:id/correction` | `CorrectionSubmit.jsx` | 改善報告書 | admin, judgment |
| `/complaints/:id/deep-analysis` | `DeepAnalysisForm.jsx` | 深掘り分析 | manager, director |
| `/complaints/:id/approval` | `Approval.jsx` | 役員承認 | judgment, executive, admin |
| `/mypage` | `MyPage.jsx` | マイページ | 全員 |

### ロール別 アクセス可能な画面

| ロール | 追加でアクセスできる画面 |
|-------|----------------------|
| `admin` | `/detail` `/correction` `/approval` |
| `director` | `/deep-analysis` |
| `executive` | `/approval` |
| `manager` | `/deep-analysis` |
| `judgment` | `/detail` `/correction` `/approval` |
| `user` | 追加なし（全員アクセス可の画面のみ） |

---

## 9. docs フォルダの説明

`docs/` フォルダに設計ドキュメントを格納している。すべてコードを実装時点で解析した内容に基づく。

| ファイル | 内容 |
|---------|------|
| `docs/system-overview.md` | 技術スタック・アーキテクチャ・既知の不整合・将来構想 |
| `docs/business-flow.md` | クレーム登録〜承認完了の全フロー・ソクラテス対話フロー・ステータス遷移表・掲示板自動投稿フロー |
| `docs/screens.md` | 全9画面の詳細（入力項目・ロール別ボタン・ナビゲーション構造） |
| `docs/database-design.md` | 全テーブルの推定スキーマ・bulletin_board jsonb 構造・RLS 確認事項・ALTER TABLE 履歴 |
| `docs/permissions.md` | 6ロールの定義・ルートガード設定・権限マトリクス・現状の課題 |
| `docs/disaster-recovery.md` | 障害復旧手順・環境変数一覧・GitHub PAT漏洩対応・月次バックアップ運用ルール |

> **注意：** `database-design.md` のスキーマはコードから逆算した推定値。Supabase Dashboard の実スキーマと照合して差異があれば更新すること。

---

## 10. 引継ぎ時の注意点

### ✅ まず確認すること（Supabase Dashboard）

1. **RLS の設定状況を全テーブルで確認する**  
   特に `bulletin_board` がアノンキーで SELECT できないと掲示板が表示されない。

2. **ユーザーのロール設定を確認する**  
   `app_metadata.seed_note_role` が正しく設定されているか確認する。  
   設定がない場合、全員が `user` 扱いになり操作できない画面が発生する。

3. **実際のテーブルスキーマと `docs/database-design.md` を照合する**  
   `ALTER TABLE` で後から追加したカラムが本当に存在するか確認する。

---

### ⚠️ 既知の不整合・バグ

| 場所 | 内容 |
|-----|------|
| `Approval.jsx` の `ROOT_THEME_COLORS` | 旧4分類（`標準化不足・教育不足・報告不足・顧客視点不足`）のまま。現行の8分類と不整合のため「今月の根源テーマ集計グラフ」が正しく機能しない可能性がある |
| `Dashboard.jsx` の `isMine` | 常に `false`。「自分の担当」タブが全件表示と同一になる |
| `DeepAnalysisForm.jsx` のソクラテス回答 | `rootAnswers` は DB に保存されない。ページを離れると回答が消える |
| `ProgressBar` の重複定義 | `ComplaintDetail` / `ComplaintOverview` / `Approval` で同一コードが3重に定義されている |
| `correction_rejected` ステータス | `STATUS_ORDER` 配列に含まれていないため、ダッシュボードのステータスフィルターに表示されない |
| 「周知完了」ステータス | ProgressBar にステップとして表示されているが、このステータスへの遷移ロジックが存在しない |

---

### 📌 ハードコードされている値

変更時はコードを直接編集する必要がある。

| 項目 | ファイル | 定数名 |
|-----|---------|-------|
| 役員承認者3名（氏名・役職） | `DeepAnalysisForm.jsx` | `APPROVERS` |
| 担当部署→担当者の自動入力マップ | `ComplaintNew.jsx` | `DEPARTMENTS` |
| 真因カテゴリー8分類 | `DeepAnalysisForm.jsx` | `ROOT_THEMES` |
| 横展開 対象部署 | `DeepAnalysisForm.jsx` | `DEPARTMENTS` |
| 感情レベル別対応期限 | `ComplaintNew.jsx` | `EMOTION_LEVELS` |
| ステータスフィルター一覧 | `Dashboard.jsx` | `STATUS_FILTERS` |

---

### 🚧 未実装の機能

| 機能 | 補足 |
|-----|------|
| 新規アカウント登録 UI | ログイン画面にボタンはあるが処理なし |
| パスワードリセット | ログイン画面にボタンはあるが処理なし |
| 通知（メール・プッシュ） | ステータス変更時の通知なし |
| 「周知完了」ステータスへの遷移 | ProgressBar 表示のみ |
| 深掘りソクラテス対話の永続化 | DB 保存・復元ロジックが未実装 |
| スタッフの「自分の担当」絞り込み | `isMine` 常に `false` |
| 役員承認者の管理画面 | APPROVERS 定数の変更のみで対応 |
| 部門別傾向分析 | 構想のみ・画面なし |
| AI 分析 | SDK 導入済み（`@anthropic-ai/sdk`）・実装なし |

---

### 📁 残存しているが未使用のファイル

以下のページファイルとコンテキストは存在するが `App.jsx` にルート登録されていない。削除するか今後の機能拡張で使用するか判断が必要。

- `src/pages/Companies.jsx`
- `src/pages/Sites.jsx`
- `src/pages/Orders.jsx`
- `src/pages/Connection.jsx`
- `src/contexts/DataContext.jsx`（companies / sites / orders を保持。現在のルート画面では未使用）

---

### 🔧 開発上のルール・慣習

- スタイルは TailwindCSS のユーティリティクラスのみ。`cn()` ヘルパーで条件付き結合
- Supabase の DB 操作はすべてフロントの各ページコンポーネント内に直書き（API レイヤーなし）
- ステータス値は日本語文字列（`'受付済'` `'承認完了'` など）を直接 DB に保存
- デプロイは必ず `npx vercel --prod`（`npm run build` + git push は不使用）
- SQL の変更（ALTER TABLE 等）は Supabase Dashboard の SQL Editor で手動実行後、`docs/database-design.md` に記録する
- コメントは最小限。コード上の意図が自明でない箇所にのみ記述
