# Seed Note — システム全体概要

> 最終更新：2026-06-15  
> ソースコード解析に基づく記録。推測・未確認事項は明示。

---

## 1. プロダクト概要

**Seed Note（シードノート）** は、清掃・解体・産廃業界の現場向けクレーム管理システム。

**思想：クレームは、成長の種。**

クレームを個人責任で終わらせず、記録・分析・共有し、組織学習につなげることを目的とする。

---

## 2. 技術スタック

| カテゴリ | 技術 | バージョン | 備考 |
|---------|------|----------|------|
| フロントエンド | React | 18.3.1 | JSX、関数コンポーネント |
| ルーティング | React Router DOM | 6.28.0 | SPA、BrowserRouter |
| バックエンド / DB | Supabase | 2.49.4 | PostgreSQL、Auth、RLS |
| ビルド | Vite | 6.0.5 | ESM、`type: "module"` |
| スタイリング | TailwindCSS | 3.4.17 | — |
| アイコン | Lucide React | 0.468.0 | — |
| UI 基盤 | Radix UI (react-slot) | 1.1.0 | 部分的に使用 |
| ユーティリティ | clsx + tailwind-merge | — | `cn()` 関数として使用 |
| AI SDK | @anthropic-ai/sdk | 0.104.1 | **インストール済みだが未使用（未実装）** |
| デプロイ | Vercel | — | `npx vercel --prod` で本番デプロイ |

---

## 3. アーキテクチャ

```
[ブラウザ]
    │
    │  React SPA (Vite)
    │
    ├── App.jsx          ← 認証制御 / ルーティング
    ├── Layout.jsx       ← ヘッダー共通（ロール表示・ログアウト）
    │
    ├── pages/           ← 各画面コンポーネント
    ├── components/      ← 共通UIコンポーネント
    ├── contexts/        ← DataContext（現在は companies/sites/orders のみ・実質未使用）
    └── lib/
        ├── supabase.js  ← Supabase クライアント初期化
        └── utils.js     ← cn() / getRole()

    │  HTTPS
    ▼
[Supabase]
    ├── PostgreSQL       ← complaints / logs / corrections / deep_analysis / approvals / bulletin_board / profiles
    ├── Auth             ← メール+パスワード認証
    └── RLS              ← 設定状況は未確認（コードから判断不可）
```

---

## 4. 認証フロー

```
未ログイン → /login → supabase.auth.signInWithPassword()
                         │
                         ├── 成功 → App.jsx の user state にセット → /dashboard へリダイレクト
                         └── 失敗 → エラーメッセージ表示

ロール取得（utils.js / getRole）:
  user.app_metadata.seed_note_role  ← 優先
    → user.app_metadata.role         ← フォールバック
      → 'user'                        ← デフォルト
```

**コードで確認できないこと：**
- `seed_note_role` の設定はSupabase Dashboard 上で手動で行うと推測（設定手順は未確認）
- セッション持続性の設定（`rememberMe` チェックボックスは UI 上存在するが Supabase に渡されていない）

---

## 5. フォルダ構成

```
seed-note/
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── index.css
│   ├── lib/
│   │   ├── supabase.js
│   │   └── utils.js
│   ├── contexts/
│   │   └── DataContext.jsx         ← companies/sites/orders を保持（現在は画面から未接続）
│   ├── components/
│   │   ├── Layout.jsx
│   │   ├── StatusBadge.jsx         ← 定義あり・使用箇所は未確認
│   │   └── ui/
│   │       ├── badge.jsx
│   │       ├── button.jsx
│   │       ├── card.jsx
│   │       ├── input.jsx
│   │       └── table.jsx
│   └── pages/
│       ├── Login.jsx
│       ├── Dashboard.jsx
│       ├── ComplaintNew.jsx
│       ├── ComplaintOverview.jsx
│       ├── ComplaintDetail.jsx
│       ├── CorrectionSubmit.jsx
│       ├── DeepAnalysisForm.jsx
│       ├── Approval.jsx
│       ├── MyPage.jsx
│       ├── Companies.jsx           ← ルート未登録（残存コード）
│       ├── Sites.jsx               ← ルート未登録（残存コード）
│       ├── Orders.jsx              ← ルート未登録（残存コード）
│       └── Connection.jsx          ← ルート未登録（残存コード）
├── docs/                           ← 設計ドキュメント（このファイル）
├── scripts/
│   └── seed-bulletin.mjs          ← 手動一括投稿スクリプト（Node.js）
├── public/
│   ├── seed-note-logo.png
│   └── seed-note-bg.png
├── .env.local                      ← VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
└── package.json
```

---

## 6. 環境変数

| 変数名 | 用途 | 設定ファイル |
|-------|------|------------|
| `VITE_SUPABASE_URL` | Supabase プロジェクト URL | `.env.local` / Vercel 環境変数 |
| `VITE_SUPABASE_ANON_KEY` | Supabase 匿名キー（RLS 適用） | `.env.local` / Vercel 環境変数 |
| サービスロールキー | DB 直接操作（スクリプト用） | `.env.local` に含まれていない。スクリプト実行時に引数で渡す |

---

## 7. 将来構想（ユーザーコメントより）

以下は実装未着手。コード上の根拠なし。

- 真因分析の高度化
- 部門別傾向分析
- AI 分析（@anthropic-ai/sdk は導入済み）
- 再発防止・未然防止の仕組み化

---

## 8. 既知の課題・不整合

| 項目 | 内容 |
|-----|------|
| `ProgressBar` の重複 | `ComplaintDetail`・`ComplaintOverview`・`Approval` で同一コードが重複定義 |
| `ROOT_THEME_COLORS`（Approval.jsx） | 古い4分類のまま。DeepAnalysisForm の8分類と不整合 |
| `isMine` フラグ | Dashboard で常に `false`。スタッフの「自分の担当」フィルターが機能しない |
| 深掘りソクラテス対話の永続化 | DeepAnalysisForm の rootAnswers は DB 保存なし。リロードで消える |
| `DataContext` | companies/sites/orders を保持するが、現在のルート登録済み画面では未使用 |
| 未使用ページ4件 | Companies / Sites / Orders / Connection がルート未登録で残存 |
