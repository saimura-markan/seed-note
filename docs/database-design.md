# Seed Note — データベース設計書

> 最終更新：2026-06-15  
> **重要：** このドキュメントはソースコードから逆算した推定スキーマです。  
> Supabase Dashboard で実際のスキーマを確認・照合してください。  
> 「確認済」はコードで使用を確認。「推定」はコードから型を推測。「要確認」はスキーマ不明。

---

## 1. テーブル一覧

| テーブル名 | 用途 | コードでの使用状況 |
|-----------|------|----------------|
| `complaints` | クレーム本体 | 全ページ |
| `complaint_logs` | クレームに紐づくログ（複数種類） | 複数ページ |
| `complaint_corrections` | 改善報告書 | CorrectionSubmit, DeepAnalysisForm, Approval |
| `complaint_deep_analysis` | 深掘り分析 | DeepAnalysisForm, Approval, ComplaintOverview |
| `complaint_approvals` | 役員承認レコード | DeepAnalysisForm, Approval, ComplaintOverview |
| `bulletin_board` | 掲示板投稿 | Dashboard, Approval, seed-bulletin.mjs |
| `profiles` | ユーザープロフィール | Layout, MyPage |
| `companies` | 取引先企業 | DataContext のみ（画面から未使用） |
| `sites` | 現場 | DataContext のみ（画面から未使用） |
| `orders` | 発注 | DataContext のみ（画面から未使用） |

---

## 2. complaints（クレーム本体）

コード内の `select('*')` と各 `update` / `insert` の payload から列を逆算。

| カラム名 | 型（推定） | 確認状況 | 備考 |
|---------|----------|---------|------|
| `id` | uuid | 確認済 | PK、`id.slice(0,8)` で表示 |
| `status` | text | 確認済 | ステータス値一覧は business-flow.md 参照 |
| `received_at` | timestamptz | 確認済 | 受付日時 |
| `client_name` | text | 確認済 | 元請様名 |
| `client_contact` | text | 確認済 | 元請担当者様名 |
| `site_name` | text | 確認済 | 現場名 |
| `worker_name` | text | 確認済 | 現場作業者名 |
| `work_date` | date | 確認済 | 作業に入った日 |
| `category` | text | 確認済 | クレームカテゴリ |
| `content` | text | 確認済 | クレーム詳細内容 |
| `emotion_level` | integer | 確認済 | 感情レベル（1〜5） |
| `deadline_minutes` | integer | 確認済 | 対応期限（分） |
| `response_deadline` | timestamptz | 確認済 | 対応期限（絶対日時） |
| `department` | text | 確認済 | 担当部署 |
| `assignee` | text | 確認済 | 担当者名 |
| `receiver_name` | text | 確認済 | 受付者名 |
| `judgment` | text | 確認済 | '手直し' または '事業責任者' |
| `supervisor_reported_at` | timestamptz | 確認済 | 上司報告日時 |
| `supervisor_comment` | text | 確認済 | 事業責任者コメント（旧方式） |
| `supervisor_approved_at` | timestamptz | 確認済 | 是正案承認日時 |
| `improvement_report` | text | 確認済 | 改善報告書テキスト（旧フィールド・要確認） |
| `improvement_reported_at` | timestamptz | 確認済 | 改善報告書提出日時（旧フィールド・要確認） |
| `created_at` | timestamptz | 確認済 | レコード作成日時 |

**要確認：** `improvement_report` / `improvement_reported_at` は `ComplaintDetail.jsx` に残存しているが、現在の `CorrectionSubmit.jsx` フローでは `complaint_corrections` テーブルを使っており、こちらとの使い分けが不明。

---

## 3. complaint_logs（ログ記録）

| カラム名 | 型（推定） | 確認状況 | 備考 |
|---------|----------|---------|------|
| `id` | uuid | 確認済 | PK |
| `complaint_id` | uuid | 確認済 | FK → complaints.id |
| `type` | text | 確認済 | 種別（下表参照） |
| `content` | text | 確認済 | ログ内容 |
| `created_at` | timestamptz | 確認済 | 記録日時 |

**type の値（コードで確認済）：**

| type 値 | 意味 | 記録箇所 |
|---------|------|---------|
| `contact` | お客様への連絡記録 | ComplaintDetail |
| `hearing` | 作業者からの聞き取り | ComplaintDetail |
| `report` | 上司への報告内容 | ComplaintDetail |
| `supervisor_comment` | 事業責任者のコメント | DeepAnalysisForm |
| `correction_rejected` | 改善報告書の否認理由 | DeepAnalysisForm |
| `deep_approved` | 合同改善報告書の役員提出記録 | DeepAnalysisForm |

---

## 4. complaint_corrections（改善報告書）

| カラム名 | 型（推定） | 確認状況 | 備考 |
|---------|----------|---------|------|
| `id` | uuid | 確認済 | PK |
| `complaint_id` | uuid | 確認済 | FK → complaints.id |
| `direct_cause` | text | 確認済 | 直接原因 |
| `correction` | text | 確認済 | 是正処置 |
| `improvement` | text | 確認済 | 運用改善案 |
| `socratic_answers` | jsonb | 確認済 | ソクラテス対話の回答 `{ q1, q2, retry }` |
| `created_at` | timestamptz | 確認済 | 提出日時 |

**socratic_answers の構造：**
```json
{
  "q1": "なぜ起きたかの回答",
  "q2": "2度と起きないためにすることの回答",
  "retry": "足りなかったものの回答（任意）"
}
```

---

## 5. complaint_deep_analysis（深掘り分析）

| カラム名 | 型（推定） | 確認状況 | 備考 |
|---------|----------|---------|------|
| `id` | uuid | 確認済 | PK |
| `complaint_id` | uuid | 確認済 | FK → complaints.id |
| `root_cause` | text | 確認済 | 真因 |
| `root_theme` | text | 確認済 | 真因カテゴリー（8分類） |
| `root_detail` | text | 確認済 | 真因詳細（ALTER TABLE で追加） |
| `org_improvement` | text | 確認済 | 組織改善案 |
| `horizontal_departments` | jsonb | 確認済 | 横展開対象部署（配列）例：`["解体部","清掃部"]` |
| `horizontal_content` | text | 確認済 | 横展開 周知内容（ALTER TABLE で追加） |
| `action_assignee` | text | 確認済 | 真因対策 担当者（ALTER TABLE で追加） |
| `action_deadline` | date | 確認済 | 真因対策 期限（ALTER TABLE で追加） |
| `action_progress` | text | 確認済 | 真因対策 進捗（`未着手` / `進行中` / `完了`）（ALTER TABLE で追加） |
| `created_at` | timestamptz | 確認済 | 提出日時 |

**注記：** `root_detail`, `horizontal_departments`, `horizontal_content`, `action_assignee`, `action_deadline`, `action_progress` は後から `ALTER TABLE` で追加されたカラム。

---

## 6. complaint_approvals（役員承認）

| カラム名 | 型（推定） | 確認状況 | 備考 |
|---------|----------|---------|------|
| `id` | uuid | 確認済 | PK |
| `complaint_id` | uuid | 確認済 | FK → complaints.id |
| `approver_name` | text | 確認済 | 承認者名（ハードコード） |
| `approver_role` | text | 確認済 | 承認者役職（ハードコード） |
| `sort_order` | integer | 確認済 | 表示順（0〜2） |
| `status` | text | 確認済 | `pending` / `approved` / `rejected` |
| `comment` | text | 確認済 | 承認コメント（任意） |
| `approved_at` | timestamptz | 確認済 | 承認日時 |

**ハードコードされた承認者（DeepAnalysisForm.jsx の APPROVERS 定数）：**

| sort_order | approver_name | approver_role |
|-----------|---------------|---------------|
| 0 | 山口 誠 | 代表取締役 |
| 1 | 佐々木 隆 | 取締役 工事部長 |
| 2 | 川上 直美 | 取締役 品質管理責任者 |

---

## 7. bulletin_board（掲示板）

**スキーマは要確認（コードから逆算した推定）**

| カラム名 | 型（推定） | 確認状況 | 備考 |
|---------|----------|---------|------|
| `id` | uuid | 推定 | PK |
| `complaint_id` | uuid | 確認済 | FK → complaints.id（重複チェックに使用） |
| `content` | jsonb | 確認済 | 全情報を1オブジェクトに格納（下記参照） |
| `created_at` | timestamptz | 推定 | ソート・期間フィルターに使用 |

**content jsonb の構造（Approval.jsx の insert payload より）：**

```json
{
  "site_name": "現場名",
  "description": "クレーム内容（complaints.content）",
  "received_at": "受付日時",
  "assignee": "担当者名",
  "contact_logs": [
    { "content": "連絡内容", "created_at": "日時" }
  ],
  "hearing": "聞き取り内容",
  "correction_action": "是正処置",
  "direct_cause": "直接原因",
  "improvement": "運用改善案",
  "root_cause": "真因",
  "root_theme": "真因カテゴリー",
  "root_detail": "真因詳細",
  "org_improvement": "組織改善案",
  "action_assignee": "真因対策 担当者",
  "action_deadline": "真因対策 期限",
  "action_progress": "真因対策 進捗",
  "horizontal_departments": ["部署名"],
  "horizontal_content": "横展開 周知内容"
}
```

---

## 8. profiles（ユーザープロフィール）

| カラム名 | 型（推定） | 確認状況 | 備考 |
|---------|----------|---------|------|
| `id` | uuid | 確認済 | PK（Supabase Auth の user.id と一致） |
| `name` | text | 確認済 | 氏名（「姓 名」形式） |
| `name_kana` | text | 確認済 | ふりがな（「せい めい」形式） |
| `phone` | text | 確認済 | 携帯電話番号 |

---

## 9. companies / sites / orders

DataContext.jsx で `select('*').limit(500)` されているが、列の詳細は不明。

| テーブル | 確認状況 |
|---------|---------|
| `companies` | 要確認（列定義不明） |
| `sites` | 要確認（列定義不明） |
| `orders` | 要確認（列定義不明） |

---

## 10. テーブル間のリレーション

```
complaints (id)
    │
    ├──< complaint_logs        (complaint_id)
    ├──< complaint_corrections (complaint_id)
    ├──< complaint_deep_analysis (complaint_id)
    ├──< complaint_approvals   (complaint_id)
    └──< bulletin_board        (complaint_id)

auth.users (id)
    │
    └──< profiles              (id)
```

---

## 11. RLS（Row Level Security）の確認状況

**コードから判断できない事項。Supabase Dashboard での確認が必要。**

| テーブル | RLS 有効化 | ポリシー内容 |
|---------|-----------|------------|
| `complaints` | 要確認 | 要確認 |
| `complaint_logs` | 要確認 | 要確認 |
| `complaint_corrections` | 要確認 | 要確認 |
| `complaint_deep_analysis` | 要確認 | 要確認 |
| `complaint_approvals` | 要確認 | 要確認 |
| `bulletin_board` | 要確認 | 要確認（アノンキーで読み取れないとフロントから表示不可） |
| `profiles` | 要確認 | 要確認 |
| `companies` | 要確認 | 要確認 |
| `sites` | 要確認 | 要確認 |
| `orders` | 要確認 | 要確認 |

**懸念事項：**

1. `bulletin_board` は Dashboard でアノンキーを使って SELECT している。RLS で全ユーザーへの READ を許可していない場合、掲示板が表示されない。
2. RLS が設定されていない場合、フロントのロールチェックを回避すれば全データへアクセス可能。
3. スクリプト（`seed-bulletin.mjs`）ではサービスロールキーを使用しており RLS をバイパスしている。

---

## 12. 実行済みの ALTER TABLE（開発履歴より）

```sql
-- complaint_corrections への追加
ALTER TABLE complaint_corrections
  ADD COLUMN IF NOT EXISTS socratic_answers jsonb DEFAULT '{}';

-- complaint_deep_analysis への追加
ALTER TABLE complaint_deep_analysis
  ADD COLUMN IF NOT EXISTS root_detail text DEFAULT '';

ALTER TABLE complaint_deep_analysis
  ADD COLUMN IF NOT EXISTS horizontal_departments jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS horizontal_content text DEFAULT '',
  ADD COLUMN IF NOT EXISTS action_assignee text DEFAULT '',
  ADD COLUMN IF NOT EXISTS action_deadline date,
  ADD COLUMN IF NOT EXISTS action_progress text DEFAULT '未着手';
```
