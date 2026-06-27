-- complaint_corrections に入力者名を追加
ALTER TABLE complaint_corrections
  ADD COLUMN IF NOT EXISTS author_name text DEFAULT NULL;
