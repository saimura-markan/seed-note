# Seed Note 障害復旧手順書

> 作成日: 2026-06-15  
> ステータス凡例: ✅ 確認済み / ⚠️ 要確認

---

## ⚠️ 共有インフラ注意事項（最重要）

**E-Li と Seed Note は同一の Supabase プロジェクトを共有している。**

| 共有しているサービス | 影響 |
|---|---|
| Supabase PostgreSQL | テーブルが混在している |
| Supabase Auth | ユーザー認証基盤が共通 |
| Supabase Storage | バケットが共通 |
| Supabase RLS | ポリシー変更が両システムに波及 |

以下の作業は **E-Li・Seed Note 双方への影響** が生じる可能性がある。

- DBテーブルの削除・変更
- RLSポリシーの追加・変更・削除
- Supabase Auth の認証設定変更
- Storage バケットの削除・ポリシー変更
- SQLマイグレーションの実行

**復旧作業・構成変更時は、作業完了後に E-Li と Seed Note の両方の動作確認を必須とする。**

---

## 環境変数一覧

### ローカル開発（`.env.local`）✅ 確認済み

| 変数名 | 用途 | 管理場所 |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase プロジェクト URL | `.env.local`（Gitに含まれない） |
| `VITE_SUPABASE_ANON_KEY` | Supabase 匿名キー（RLS適用） | `.env.local`（Gitに含まれない） |

> `.env.local` は `.gitignore` に含まれており GitHub には存在しない。  
> 実値は Supabase Dashboard → Settings → API で確認する。

### Vercel 環境変数 ⚠️ 要確認

| 変数名 | 用途 |
|---|---|
| `VITE_SUPABASE_URL` | 本番ビルド用 Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | 本番ビルド用 Supabase 匿名キー |

> Vercel Dashboard → プロジェクト `seed-note` → Settings → Environment Variables で確認・設定する。  
> `VITE_` プレフィックスがないと Vite ビルド時に参照されないため注意。

### スクリプト実行時のみ（CLI引数で渡す）✅ 確認済み

| 変数名 | 用途 | 渡し方 |
|---|---|---|
| `SERVICE_KEY` | Supabase サービスロールキー（掲示板一括投稿用） | `SERVICE_KEY="eyJ..." node scripts/seed-bulletin.mjs` |

> サービスロールキーは `.env.local` に含めず、スクリプト実行時にのみ一時的に渡す。  
> **コードにもGitにも含まれていない。** Supabase Dashboard → Settings → API → `service_role` で確認する。

### Anthropic API（未使用）✅ 確認済み

`@anthropic-ai/sdk` はインストール済みだが、現時点でコード上に API キーの参照・設定箇所はない。  
AI機能を実装する際は `ANTHROPIC_API_KEY` の設定が必要になる。

---

## Supabase バックアップ手順

### 注意：E-Li と同一プロジェクトのため、バックアップは両システムのデータを含む

### テーブルデータのエクスポート ⚠️ 自動バックアップ設定は要確認

Supabase の自動バックアップはプランによる。手動で定期エクスポートすること。

```
Supabase Dashboard → Table Editor → 各テーブルを開く
→ 右上「Export」→「Download as CSV」
```

または SQL Editor で実行：

```sql
-- Seed Note 関連テーブル
SELECT * FROM complaints          ORDER BY created_at DESC;
SELECT * FROM complaint_logs      ORDER BY created_at DESC;
SELECT * FROM complaint_corrections ORDER BY created_at DESC;
SELECT * FROM complaint_deep_analysis ORDER BY created_at DESC;
SELECT * FROM complaint_approvals ORDER BY created_at DESC;
SELECT * FROM bulletin_board      ORDER BY created_at DESC;
SELECT * FROM profiles;

-- E-Li 関連テーブル（同一プロジェクトのため同時に確認）
SELECT * FROM orders    ORDER BY created_at DESC;
SELECT * FROM companies ORDER BY id;
SELECT * FROM sites     ORDER BY created_at DESC;
SELECT * FROM messages  ORDER BY created_at DESC;
SELECT * FROM cases     ORDER BY created_at DESC;
SELECT * FROM staff     ORDER BY created_at DESC;
```

### スキーマ（テーブル定義）のバックアップ ✅ 確認済み

Seed Note のスキーマは以下で管理されている。

| ファイル | 内容 |
|---|---|
| `create_complaints_tables.sql` | 全テーブル定義（初期作成） |
| `docs/database-design.md` | ALTER TABLE 履歴（後から追加したカラム） |

GitHub が生きていればスキーマは常に復元可能。  
ただし `docs/database-design.md` のスキーマはコードから逆算した推定値であるため、**Supabase Dashboard の実スキーマと定期的に照合すること。**

---

## GitHub PAT 漏洩時の対応手順

### 現在の状況 ✅ 確認済み

`.git/config` にPersonal Access Token（PAT）が**平文で埋め込まれている。**

```
# /Users/saimuranaoki/Documents/seed-note/.git/config
[remote "origin"]
    url = https://saimura-markan:ghp_****@github.com/saimura-markan/seed-note.git
```

| 確認項目 | 状況 |
|---|---|
| 保存場所 | `/Users/saimuranaoki/Documents/seed-note/.git/config` |
| トークンの有効性 | 有効（2026-06-15時点で確認） |
| 権限スコープ | `repo`（全リポジトリの読み取り・書き込み・削除） |
| GitHub への Push | `.git/` はGit管理外のため漏洩なし |
| 有効期限 | ⚠️ 要確認（GitHub Dashboard で確認する） |

### 漏洩・紛失・盗難時の即時対応

**Step 1: PAT を即座に失効させる（5分以内に実施）**

```
GitHub → Settings → Developer settings
→ Personal access tokens → Tokens (classic) または Fine-grained tokens
→ 該当トークンを選択 → 「Delete」または「Revoke」
```

**Step 2: .git/config からトークンを除去する**

```bash
cd ~/Documents/seed-note

# URLからトークンを除去（認証情報なしのHTTPS URLに戻す）
git remote set-url origin https://github.com/saimura-markan/seed-note.git

# 設定を確認（トークンが消えていることを確認）
cat .git/config
```

**Step 3: 新しいPATを発行する**

```
GitHub → Settings → Developer settings → Personal access tokens
→ Generate new token
→ スコープ: repo（最小限の必要スコープのみ選択）
→ 有効期限を設定（無期限は避ける）
```

**Step 4: 新しいPATを安全な方法で設定する**

```bash
# 方法A: macOS キーチェーンを使う（推奨）
git remote set-url origin https://github.com/saimura-markan/seed-note.git
git push  # プロンプトでID・PATを入力 → キーチェーンに自動保存

# 方法B: .netrc に保存（.gitignore 対象外のため注意）
# 方法C: git credential store（平文保存のため非推奨）
```

> **推奨：** `.git/config` への直接埋め込みは行わない。macOS キーチェーンまたは GitHub CLI（`gh auth login`）を使う。

---

## GitHub 復旧手順

### 状況：リポジトリが失われた場合

**リポジトリURL（確認済み）:**

```
https://github.com/saimura-markan/seed-note.git
```

**Step 1: ローカルのコードが無事か確認する**

```bash
ls ~/Documents/seed-note/src/
git -C ~/Documents/seed-note log --oneline -5
```

**Step 2: 新しいリポジトリを作成する**

```
GitHub → New repository
名前: seed-note（または任意）
Visibility: Private（推奨）
```

**Step 3: リモートを新しいリポジトリに変更してプッシュする**

```bash
cd ~/Documents/seed-note
git remote set-url origin https://github.com/saimura-markan/【新リポジトリ名】.git
git push -u origin main
```

**Step 4: Vercel の Git 連携を更新する**

```
Vercel Dashboard → seed-note プロジェクト → Settings → Git
→ Disconnect → 新しいリポジトリを再接続
```

### 消滅するもの・残るもの

| 項目 | 状況 |
|---|---|
| `src/` 全ファイル | ✅ ローカルに残る |
| `docs/` 全ファイル | ✅ ローカルに残る |
| `create_complaints_tables.sql` | ✅ ローカルに残る |
| `.env.local`（環境変数） | ✅ ローカルに残る（.gitignore対象） |
| `dist/`（ビルド成果物） | ✅ ローカルに残る（Vercelにも残る） |
| Supabase上のデータ | ✅ Supabaseサーバーに残る |
| Vercel本番デプロイ | ✅ Vercelサーバーに残る |

---

## Vercel 復旧手順

### 本番URL ✅ 確認済み

```
https://seed-note-seven.vercel.app
```

### デプロイ方法 ✅ 確認済み

```bash
# 本番デプロイ（git pushは使用しない）
cd ~/Documents/seed-note
npm run build      # ビルド確認
npx vercel --prod  # 本番デプロイ
```

> `git push` による自動デプロイは設定されていない可能性がある。⚠️ 要確認（Vercel Dashboard → Git Integration で確認する）

### 状況：Vercel プロジェクトが失われた場合

**Step 1: Vercel に再ログインする**

```bash
npx vercel login
```

**Step 2: プロジェクトを再リンクする**

```bash
cd ~/Documents/seed-note
npx vercel link
# → 既存プロジェクトを選択、またはNew Projectで再作成
```

**Step 3: 環境変数を再設定する**

```
Vercel Dashboard → プロジェクト → Settings → Environment Variables
→ VITE_SUPABASE_URL    = （Supabase Dashboard → Settings → API で確認）
→ VITE_SUPABASE_ANON_KEY = （同上）
```

**Step 4: 再デプロイする**

```bash
npm run build
npx vercel --prod
```

---

## Supabase 復旧手順

### ⚠️ 最重要：E-Li と Seed Note は同一 Supabase プロジェクトを共有している

Supabase プロジェクトを失った場合、**E-Li と Seed Note の両方が同時に停止する。**

### 状況：Supabase プロジェクトが失われた場合

**Step 1: 新しい Supabase プロジェクトを作成する**

```
https://supabase.com → New Project
リージョン: Northeast Asia（Tokyo）⚠️ 現プロジェクトのリージョンは要確認
```

**Step 2: 新しい接続情報を取得する**

```
Supabase Dashboard → Settings → API
→ Project URL をコピー
→ anon public キーをコピー
→ service_role キーをコピー（スクリプト用）
```

**Step 3: Seed Note のスキーマを復元する**

以下の順番で SQL Editor に貼り付けて実行する。

```
1. create_complaints_tables.sql  ← 全テーブル定義
2. docs/database-design.md 記載の ALTER TABLE  ← 後から追加したカラム
```

**後から追加したカラム（`docs/database-design.md` より）:**

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

> **E-Li のスキーマ復元も必要。** E-Li の `docs/disaster-recovery.md` に記載の SQL（29ファイル）も実行する。

**Step 4: ユーザーを再作成する**

```
Supabase Dashboard → Authentication → Users → Invite
→ 各ユーザーのメールアドレスを入力
```

ロールを再設定する（SQL Editor）：

```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"seed_note_role":"admin"}'::jsonb
WHERE email = '対象メールアドレス';
```

設定可能なロール値: `admin` / `director` / `executive` / `manager` / `judgment` / `user`

**Step 5: 環境変数を新しい接続情報に更新する**

```bash
# .env.local を更新
VITE_SUPABASE_URL=https://【新しいプロジェクトID】.supabase.co
VITE_SUPABASE_ANON_KEY=【新しいAnonキー】
```

```
# Vercel 環境変数も更新
Vercel Dashboard → Settings → Environment Variables → 同じ2変数を更新
```

**Step 6: 再ビルド・再デプロイする**

```bash
npm run build
npx vercel --prod
```

**Step 7: E-Li も同様に対応する**

`index.html` 310〜311行目の接続情報を更新してデプロイする（E-Li の disaster-recovery.md 参照）。

### 復旧所要時間の目安

| 条件 | 目安 |
|---|---|
| コード・スキーマのみ復旧（データなし） | 2〜4時間 |
| CSVバックアップからデータ復旧あり | 4〜8時間 |
| データバックアップなしでゼロから | 過去データは消滅 |

---

## Resend について

**Seed Note では Resend を使用していない。** ✅ 確認済み

メール送信機能は現時点で未実装のため、Resend の復旧手順は不要。  
将来的にメール通知を実装する場合は、E-Li の `docs/disaster-recovery.md` の Resend セクションを参照する。

---

## 月次バックアップ運用ルール

現時点で定まった運用ルールはない。以下を推奨する。

### 月次実施（毎月1日を目安）

| 作業 | 方法 |
|---|---|
| DBテーブルのCSVエクスポート | Supabase Dashboard → Table Editor → Export |
| スキーマの実態確認 | Supabase Dashboard と `docs/database-design.md` の照合 |
| コードが GitHub に Push されているか確認 | `git log --oneline -3` |
| Vercel 本番が最新状態か確認 | 本番URL にアクセスして動作確認 |

### 変更作業の前に必ず実施

| 作業 | 理由 |
|---|---|
| DBテーブルのCSVエクスポート | RLS変更・マイグレーション前の保険 |
| E-Li の動作確認 | 同一Supabaseのため変更が波及する |

### 確認が必要な項目 ⚠️

- [ ] Supabase の自動バックアップが有効か（Supabase Dashboard → Settings → Backups で確認）
- [ ] Vercel の Git 自動デプロイが設定されているか（Vercel Dashboard → Git Integration で確認）
- [ ] GitHub PAT の有効期限（GitHub → Settings → Developer settings → Tokens で確認）

---

## 復旧後の確認チェックリスト

```
[ ] ログイン画面が表示される
[ ] ログインできる（テストアカウントで確認）
[ ] ダッシュボードが表示される（クレーム一覧・掲示板）
[ ] 新規クレームを登録できる
[ ] クレーム詳細が表示される
[ ] 改善報告書が提出できる
[ ] 深掘り分析が表示される（manager/director ロールで確認）
[ ] 役員承認画面が表示される（judgment/executive ロールで確認）
[ ] 掲示板に公開される（承認完了後）
[ ] E-Li（https://hacchu-kanri-v2.vercel.app）も正常動作するか確認
```
