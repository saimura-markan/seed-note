-- profiles テーブルにふりがなカラムを追加
-- Supabase SQL Editor で実行してください

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name_kana TEXT;
