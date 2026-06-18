-- complaint_deep_analysis への追加カラム
-- Supabase SQL Editor で実行してください

ALTER TABLE complaint_deep_analysis
  ADD COLUMN IF NOT EXISTS root_detail text DEFAULT '';

ALTER TABLE complaint_deep_analysis
  ADD COLUMN IF NOT EXISTS horizontal_departments jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS horizontal_content text DEFAULT '',
  ADD COLUMN IF NOT EXISTS action_assignee text DEFAULT '',
  ADD COLUMN IF NOT EXISTS action_deadline date,
  ADD COLUMN IF NOT EXISTS action_progress text DEFAULT '未着手';
