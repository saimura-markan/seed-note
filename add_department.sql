-- profiles テーブルに department カラムを追加
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department TEXT;
