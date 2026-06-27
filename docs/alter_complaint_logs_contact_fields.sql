-- contact_logs に不通回数・接続回数を追加
-- connected_attempt: 何回目の試みか（1始まり）
-- missed_calls: その時点までの不通回数（自分が繋がらず=含む、自分が接続=含まない）
ALTER TABLE complaint_logs
  ADD COLUMN IF NOT EXISTS connected_attempt integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS missed_calls integer DEFAULT NULL;
