-- ① complaints（クレーム本体）
CREATE TABLE IF NOT EXISTS complaints (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  received_at      timestamptz DEFAULT now(),
  client_name      text DEFAULT '',
  client_contact   text DEFAULT '',
  site_name        text DEFAULT '',
  worker_name      text DEFAULT '',
  category         text DEFAULT '',
  content          text NOT NULL DEFAULT '',
  emotion_level    int  NOT NULL DEFAULT 3 CHECK (emotion_level BETWEEN 1 AND 5),
  deadline_minutes int  NOT NULL DEFAULT 60,
  response_deadline timestamptz,
  department       text DEFAULT '',
  assignee         text DEFAULT '',
  receiver_name    text DEFAULT '',
  judgment         text DEFAULT '',   -- '手直し' | '事業責任者'
  status           text DEFAULT '受付済',
  created_at       timestamptz DEFAULT now()
);

-- ② complaint_logs（連絡記録・聞き取りログ）
CREATE TABLE IF NOT EXISTS complaint_logs (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id uuid REFERENCES complaints(id) ON DELETE CASCADE,
  type         text NOT NULL DEFAULT 'contact',  -- 'contact' | 'hearing'
  content      text NOT NULL DEFAULT '',
  created_at   timestamptz DEFAULT now()
);

-- ③ complaint_corrections（是正案）
CREATE TABLE IF NOT EXISTS complaint_corrections (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id   uuid REFERENCES complaints(id) ON DELETE CASCADE,
  direct_cause   text DEFAULT '',
  correction     text DEFAULT '',
  improvement    text DEFAULT '',
  ai_hint        text DEFAULT '',
  created_at     timestamptz DEFAULT now()
);

-- ④ complaint_deep_analysis（深掘り分析）
CREATE TABLE IF NOT EXISTS complaint_deep_analysis (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id         uuid REFERENCES complaints(id) ON DELETE CASCADE,
  root_cause           text DEFAULT '',
  horizontal_expansion text DEFAULT '',
  org_improvement      text DEFAULT '',
  root_theme           text DEFAULT '',
  created_at           timestamptz DEFAULT now()
);

-- ⑤ complaint_approvals（役員承認）
CREATE TABLE IF NOT EXISTS complaint_approvals (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id   uuid REFERENCES complaints(id) ON DELETE CASCADE,
  approver_name  text NOT NULL DEFAULT '',
  approver_role  text DEFAULT '',
  sort_order     int  DEFAULT 0,
  approved_at    timestamptz,
  comment        text DEFAULT '',
  status         text DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  created_at     timestamptz DEFAULT now()
);

-- RLS 有効化
ALTER TABLE complaints              ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_corrections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_deep_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_approvals     ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーに全操作を許可
CREATE POLICY "auth_all" ON complaints              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON complaint_logs          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON complaint_corrections   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON complaint_deep_analysis FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON complaint_approvals     FOR ALL TO authenticated USING (true) WITH CHECK (true);
