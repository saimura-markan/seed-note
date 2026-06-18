-- complaint_deep_analysis に updated_at を追加
-- Supabase SQL Editor で実行してください

ALTER TABLE complaint_deep_analysis
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 既存レコードは created_at で初期化
UPDATE complaint_deep_analysis
  SET updated_at = created_at
  WHERE updated_at IS NULL;

-- UPDATE 時に自動更新するトリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_complaint_deep_analysis_updated_at
  BEFORE UPDATE ON complaint_deep_analysis
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
