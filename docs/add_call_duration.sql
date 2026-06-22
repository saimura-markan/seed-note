-- complaintsテーブルに通話時間カラムを追加
-- Supabase SQL Editor で実行してください

ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS call_duration_seconds integer;
