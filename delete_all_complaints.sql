-- ================================================================
-- 全テストデータ削除（Supabase SQL Editor で実行）
-- 子テーブルから順に削除（ON DELETE CASCADE があるため
-- complaints を削除するだけで連鎖削除されるが、明示的に実行）
-- ================================================================

DELETE FROM complaint_approvals;
DELETE FROM complaint_deep_analysis;
DELETE FROM complaint_corrections;
DELETE FROM complaint_logs;
DELETE FROM complaints;

-- 削除確認
SELECT 'complaints'              AS tbl, COUNT(*) FROM complaints
UNION ALL
SELECT 'complaint_logs'          AS tbl, COUNT(*) FROM complaint_logs
UNION ALL
SELECT 'complaint_corrections'   AS tbl, COUNT(*) FROM complaint_corrections
UNION ALL
SELECT 'complaint_deep_analysis' AS tbl, COUNT(*) FROM complaint_deep_analysis
UNION ALL
SELECT 'complaint_approvals'     AS tbl, COUNT(*) FROM complaint_approvals;
