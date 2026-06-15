-- ターン開始時刻カラム追加
-- ステータス変更のたびに current_turn_started_at = now() を記録する
ALTER TABLE complaints ADD COLUMN current_turn_started_at timestamptz DEFAULT now();
