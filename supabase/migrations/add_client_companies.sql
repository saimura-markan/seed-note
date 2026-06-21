-- 元請会社マスタ
CREATE TABLE IF NOT EXISTS client_companies (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE client_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON client_companies
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
