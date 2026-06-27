-- complaint_logs に入力者名を追加（聞き取り記録などの入力者を保存するため）
ALTER TABLE complaint_logs
  ADD COLUMN IF NOT EXISTS author_name text DEFAULT NULL;
