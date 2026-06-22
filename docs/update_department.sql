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
  -- 呼び出し元が admin ロールであることを確認
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND seed_note_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'permission denied: admin role required';
  END IF;

  UPDATE profiles
  SET    department = p_department
  WHERE  name = p_name;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ユーザーが見つかりません: %', p_name;
  END IF;
END;
$$;

-- 全認証ユーザーへの付与を取り消し、service_role のみに制限
REVOKE EXECUTE ON FUNCTION admin_update_department(text, text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION admin_update_department(text, text) TO service_role;

-- ── 使用例 ──────────────────────────────────────────────────────────────────
-- Supabase SQL Editor（postgres権限）から直接実行する場合は
-- RLS をバイパスできるため以下のシンプルなUPDATEが最も安全：
--
-- UPDATE profiles SET department = '工事部' WHERE name = '立花 香織';
