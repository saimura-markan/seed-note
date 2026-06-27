-- complaint_deep_analysis に入力者名を追加
ALTER TABLE complaint_deep_analysis
  ADD COLUMN IF NOT EXISTS author_name text DEFAULT NULL;
