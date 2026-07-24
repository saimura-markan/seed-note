-- ============================================================
-- Seed Note 専用の候補除外フラグ profiles.seed_note_excluded を追加
--
-- 背景:
--   public.profiles は E-Li / MK Daily / Seed Note が同一 Supabase
--   プロジェクト上で共有しているテーブル。auth.users への INSERT で
--   発火する handle_new_user トリガーにより、他システム側のテスト・
--   お客様登録でも profiles 行が作られるため、実在の従業員ではない
--   アカウントが Seed Note の ComplaintNew.jsx（担当者・事業責任者
--   プルダウン）の候補に混ざる。
--
--   MK Daily の is_active は使わない。除外対象（インフォ・本部太郎）は
--   MK Daily 側でテストに使い続けるため is_active=true を維持する必要が
--   あり、is_active を落とすと MK Daily の集計に影響してしまう。そこで
--   Seed Note 専用の独立した除外列を設ける。
--
-- 対象:
--   インフォ  7893dda8-bee1-4e6f-8cd4-3514ef5db2e4  info@markan.co.jp
--   本部 太郎 85c7d6bb-a4a0-4914-8d8f-66584ff7788c  saimura0314@docomo.ne.jp
--
-- 冪等性: ADD COLUMN IF NOT EXISTS + id 直指定 UPDATE のため再実行しても安全
-- 実行順: ① 列追加 → ② 事前確認 → ③ UPDATE → ④ 事後確認
-- ============================================================

-- ----------------------------------------------------------------
-- ① 列追加
--   NOT NULL DEFAULT false により既存行は全て false（候補に残る）
-- ----------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS seed_note_excluded boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.seed_note_excluded IS
  'Seed Note 専用。true にすると担当者・事業責任者プルダウン等の候補から除外される。'
  '他システム経由で混入したシステム・テストアカウントを外すための手動フラグ。'
  'MK Daily の is_active とは独立（あちらのテスト運用に影響させないため）。';


-- ----------------------------------------------------------------
-- ② 事前確認: 対象2件だけが引っかかることを確認する
--    2行、かつ name が「インフォ」「本部 太郎」であることを目視確認してから
--    ③ に進むこと。1行でも想定外の人が出たら中止する。
-- ----------------------------------------------------------------
SELECT
  p.id,
  p.name,
  p.department,
  p.seed_note_role,
  p.seed_note_excluded,
  u.email
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.id IN (
  '7893dda8-bee1-4e6f-8cd4-3514ef5db2e4',  -- インフォ
  '85c7d6bb-a4a0-4914-8d8f-66584ff7788c'   -- 本部 太郎
);

-- 参考: 除外前に候補として並ぶ人の一覧（ComplaintNew.jsx と同じ条件）
-- この時点では 15 件。③ 実行後に 13 件へ減る。件数を控えておく。
SELECT p.id, p.name, p.department, p.seed_note_role
FROM public.profiles p
WHERE p.seed_note_excluded = false
  AND p.seed_note_role IN ('staff', 'manager', 'director', 'executive', 'admin')
ORDER BY p.name;


-- ----------------------------------------------------------------
-- ③ 除外フラグを立てる（②で対象2件を確認してから実行）
-- ----------------------------------------------------------------
UPDATE public.profiles
SET seed_note_excluded = true
WHERE id IN (
  '7893dda8-bee1-4e6f-8cd4-3514ef5db2e4',  -- インフォ
  '85c7d6bb-a4a0-4914-8d8f-66584ff7788c'   -- 本部 太郎
)
AND seed_note_excluded = false;
-- 期待値: UPDATE 2


-- ----------------------------------------------------------------
-- ④ 事後確認
-- ----------------------------------------------------------------
-- 対象2件が true になったか
SELECT p.id, p.name, p.seed_note_role, p.seed_note_excluded
FROM public.profiles p
WHERE p.id IN (
  '7893dda8-bee1-4e6f-8cd4-3514ef5db2e4',
  '85c7d6bb-a4a0-4914-8d8f-66584ff7788c'
);

-- 候補一覧から2件が消えて 13 件になったか（②の参考クエリと同じ条件）
SELECT count(*) AS candidate_count
FROM public.profiles p
WHERE p.seed_note_excluded = false
  AND p.seed_note_role IN ('staff', 'manager', 'director', 'executive', 'admin');


-- ----------------------------------------------------------------
-- 切り戻し（誤って除外した場合）
-- ----------------------------------------------------------------
-- UPDATE public.profiles SET seed_note_excluded = false
-- WHERE id IN (
--   '7893dda8-bee1-4e6f-8cd4-3514ef5db2e4',
--   '85c7d6bb-a4a0-4914-8d8f-66584ff7788c'
-- );
