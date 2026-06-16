-- ================================================================
-- complaints 関連テーブルの全データ削除
-- Supabase SQL Editor で実行してください
--
-- 削除順序（外部キー制約：子テーブル → 親テーブルの順）
--   1. complaint_approvals      (complaint_id → complaints.id)
--   2. complaint_deep_analysis  (complaint_id → complaints.id)
--   3. complaint_corrections    (complaint_id → complaints.id)
--   4. complaint_logs           (complaint_id → complaints.id)
--   5. complaints               (親テーブル)
-- ================================================================

DELETE FROM complaint_approvals;
DELETE FROM complaint_deep_analysis;
DELETE FROM complaint_corrections;
DELETE FROM complaint_logs;
DELETE FROM complaints;

-- 削除確認（全テーブルが 0 件になっていることを確認）
SELECT 'complaints'              AS table_name, COUNT(*) AS remaining FROM complaints
UNION ALL
SELECT 'complaint_logs'          AS table_name, COUNT(*) AS remaining FROM complaint_logs
UNION ALL
SELECT 'complaint_corrections'   AS table_name, COUNT(*) AS remaining FROM complaint_corrections
UNION ALL
SELECT 'complaint_deep_analysis' AS table_name, COUNT(*) AS remaining FROM complaint_deep_analysis
UNION ALL
SELECT 'complaint_approvals'     AS table_name, COUNT(*) AS remaining FROM complaint_approvals;
