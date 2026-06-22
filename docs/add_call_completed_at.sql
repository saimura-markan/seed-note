-- complaintsテーブルに主任引継時刻カラムを追加
-- Supabase SQL Editor で実行してください

ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS call_completed_at timestamptz;
