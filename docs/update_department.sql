-- profiles.department を管理者権限で更新するRPCファンクション
-- SECURITY DEFINER により RLS をバイパスして実行される
-- Supabase SQL Editor で実行してください

CREATE OR REPLACE FUNCTION admin_update_department(
  p_name      text,
  p_department text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET    department = p_department
  WHERE  name = p_name;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ユーザーが見つかりません: %', p_name;
  END IF;
END;
$$;

-- 実行権限を認証済みユーザーに付与（管理者のみ呼び出し想定）
GRANT EXECUTE ON FUNCTION admin_update_department(text, text) TO authenticated;

-- ── 使用例 ──────────────────────────────────────────────────────────────────
-- 立花香織の部署を「工事部」に変更する場合：
-- SELECT admin_update_department('立花 香織', '工事部');
--
-- または Supabase SQL Editor では RLS が無効なので直接 UPDATE も可：
-- UPDATE profiles SET department = '工事部' WHERE name = '立花 香織';
