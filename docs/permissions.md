# Seed Note — 権限管理設計書

> 最終更新：2026-06-15  
> ソースコード解析に基づく記録。Supabase の RLS 設定はコードから確認できないため「要確認」とする。

---

## 1. ロール定義

`utils.js` の `getRole()` と `Layout.jsx` の `ROLE_LABELS` より確認。

| ロール値 | 表示ラベル | 想定する役職 |
|---------|---------|------------|
| `admin` | 管理者 | システム管理者（全権限） |
| `director` | 事業責任者 | 是正案の承認・深掘り分析担当 |
| `executive` | 役員 | 役員承認担当 |
| `manager` | 主任 | 是正案確認・深掘り分析担当 |
| `judgment` | 審査担当 | 対応入力・改善報告書・役員承認担当 |
| `user` | スタッフ | 現場スタッフ（制限が最も少ない） |

---

## 2. ロールの取得方法

```js
// lib/utils.js
export function getRole(user) {
  const meta = user?.app_metadata ?? {}
  return meta.seed_note_role || meta.role || 'user'
}
```

**優先順位：**
1. `user.app_metadata.seed_note_role`（最優先）
2. `user.app_metadata.role`（フォールバック）
3. `'user'`（未設定時のデフォルト）

**設定方法：**
Supabase Dashboard の `Authentication > Users` で `app_metadata` に `{ "seed_note_role": "admin" }` などを手動設定する（推測）。設定 UI・手順は未確認。

---

## 3. ルートレベルのアクセス制御（RoleGuard）

`App.jsx` の `<RoleGuard>` コンポーネントによる制御。ブロック時は `/dashboard` にリダイレクト。

```jsx
function RoleGuard({ user, allow, deny, children }) {
  const role = getRole(user)
  const blocked = deny ? deny.includes(role) : allow ? !allow.includes(role) : false
  if (blocked) return <Navigate to="/dashboard" replace />
  return children
}
```

| パス | allow に含まれるロール |
|-----|---------------------|
| `/complaints/:id/detail` | `admin`, `judgment` |
| `/complaints/:id/correction` | `admin`, `judgment` |
| `/complaints/:id/deep-analysis` | `manager`, `director` |
| `/complaints/:id/approval` | `judgment`, `executive`, `admin` |

**制限なし（全ロールアクセス可）：**
- `/dashboard`
- `/complaints/new`
- `/complaints/:id`
- `/mypage`

---

## 4. 画面内のロール別機能制御

### 4-1. ComplaintOverview.jsx（クレーム詳細概要）

| ロール | 条件 | 表示されるボタン |
|-------|------|---------------|
| `admin` | status: 受付済・対応中・差し戻し | 対応入力 → |
| `admin` | status: 是正案承認 | 改善報告書を作成 → |
| `admin` | status: 改善報告書提出 | 改善報告書を確認 → |
| `manager` | status: 是正案提出・差し戻し | 是正案を確認・承認 → |
| `manager` | status: 是正案承認・改善報告書提出 | 深掘り分析を入力 → |
| `director` | status: 是正案提出・差し戻し | 是正案を確認・承認 → |
| `executive`, `judgment` | status: 深掘り提出 | 役員承認へ → |
| `executive`, `admin` | status: 深掘り提出（未全員承認） | 合同改善報告書を確認する → |
| `director` | status: 是正案提出・差し戻し | 是正案を確認・承認 → （⑤セクションボタン） |

**注記：** ⑤改善報告書セクションの「改善報告書を作成する」ボタンは `['admin', 'manager'].includes(userRole)` で制御。

### 4-2. DeepAnalysisForm.jsx（深掘り分析）

画面自体は `manager`, `director` のみアクセス可。画面内での追加ロール制御はなし（両ロールが同一操作を実行可能）。

### 4-3. Approval.jsx（役員承認）

画面自体は `judgment`, `executive`, `admin` のみアクセス可。  
承認ボタンは承認者名・役職の入力フォームとセットで表示（ロール確認なし）。  
**現状では誰でも誰の名義でも承認可能**（認証と承認者の紐付けなし）。

---

## 5. ロール別 操作権限マトリクス

| 操作 | admin | director | manager | executive | judgment | user |
|-----|:-----:|:--------:|:-------:|:---------:|:--------:|:----:|
| クレーム一覧閲覧 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| クレーム詳細閲覧 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| クレーム新規受付 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 連絡・聞き取り記録 | ✅ | — | — | — | ✅ | — |
| 対応判断・上司報告 | ✅ | — | — | — | ✅ | — |
| 是正案確認・承認/否認 | — | ✅ | ✅ | — | — | — |
| 改善報告書 作成・提出 | ✅ | — | — | — | ✅ | — |
| 改善報告書 確認・深掘り | — | ✅ | ✅ | — | — | — |
| 深掘り分析 提出 | — | ✅ | ✅ | — | — | — |
| 役員承認 | ✅ | — | — | ✅ | ✅ | — |
| 掲示板閲覧 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| マイページ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**凡例：** ✅ = 可能、— = 不可（または未定義）

---

## 6. 現在の権限管理の課題

### 6-1. フロントのみの制御（重大）

ルートガードとボタン制御はすべてフロントエンドのみ。

- ブラウザの DevTools から直接 API を叩けば RLS がない限りデータ改ざん可能
- RLS の設定状況が不明なため、現時点でのセキュリティ強度は不明

### 6-2. スタッフ（user）の制限が実質なし

```js
// Dashboard.jsx
const displayed = tabFiltered.filter(...)
// isMine は常に false
```

- `user` ロールはすべてのクレームを閲覧可能
- 「自分の担当のみ」フィルターは UI 上は存在するが未実装
- RLS で自分の担当クレームのみ見せるポリシーがあれば解決できるが、現在は未確認

### 6-3. 承認者と認証ユーザーの紐付けなし

- `complaint_approvals` の `approver_name` はハードコードされた固定値
- Approval.jsx は `judgment`, `executive`, `admin` ならば誰でも承認ボタンを操作可能
- 「山口 誠」名義の承認が実際には別の人により行われる可能性がある

### 6-4. `judgment` ロールの位置づけが不明確

コード上では以下の混在あり：
- `allow: ['judgment', 'executive', 'admin']` で executive と同列に扱う箇所
- `allow: ['admin', 'judgment']` で admin と同列に扱う箇所

役割定義が曖昧なまま実装されている。

---

## 7. RLS（Row Level Security）確認状況

**コードから判断できない。すべて要確認。**

### 確認が必要な項目

| 確認項目 | 期待する設定 |
|---------|-----------|
| `complaints` の SELECT ポリシー | 自分の担当（assignee）のみ、または全件 |
| `complaints` の INSERT ポリシー | 認証済みユーザーのみ |
| `complaints` の UPDATE ポリシー | ロール別に更新可能なカラムを制限 |
| `complaint_logs` のポリシー | 認証済みユーザーのみ |
| `complaint_corrections` のポリシー | 認証済みユーザーのみ |
| `complaint_deep_analysis` のポリシー | 認証済みユーザーのみ |
| `complaint_approvals` のポリシー | 認証済みユーザーのみ |
| `bulletin_board` の SELECT ポリシー | 全ユーザー（アノンキーでも読み取れるか） |
| `bulletin_board` の INSERT ポリシー | 認証済みユーザーのみ |
| `profiles` のポリシー | 本人のみ更新可 |

### 確認方法

Supabase Dashboard → プロジェクト → Authentication → Policies  
各テーブルの RLS が ON になっているか、どのポリシーが設定されているかを確認。

---

## 8. 将来的な権限強化の論点（現時点では未実装）

| 課題 | 対応案 |
|-----|-------|
| スタッフが全クレームを閲覧できる | RLS で `assignee = auth.jwt()->>'email'` 等の制限を追加 |
| 承認者とログインユーザーの紐付け | `complaint_approvals` に `user_id` を追加し、RLS で制御 |
| ロール設定の UI がない | Supabase Dashboard 操作を管理者に委ねている現状 |
| `judgment` ロールの定義 | `executive` との違いを明文化し、コードを整理 |
