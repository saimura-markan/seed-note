-- Seed Note ユーザーロール設定用SQLテンプレート
-- 使い方：UIDとroleを変更してSupabase SQL Editorで実行
--
-- ロール一覧：
--   staff     : 一般スタッフ
--   manager   : 管理者（主任クラス）
--   director  : 事業責任者
--   executive : 役員（小笠原・榮藤）
--   admin     : システム管理者（斎村・中田・info）

UPDATE auth.users
SET raw_app_meta_data =
  COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"seed_note_role": "staff"}'::jsonb
WHERE id = 'ここにUIDを貼り付ける';

-- 設定確認用
SELECT id, email, raw_app_meta_data
FROM auth.users
WHERE id = 'ここにUIDを貼り付ける';
