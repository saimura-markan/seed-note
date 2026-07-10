-- ============================================================
-- クレーム写真添付機能（2026-07-10）
--
-- 新規追加のみ。既存テーブルには一切変更を加えない。
-- 共有Supabase（wxjmqrxaqrujsvgzknwy）のため、バケット名・テーブル名は
-- E-Li / MK Dailyと衝突しないよう complaint- プレフィックスを使用。
--
-- 実行方法: このファイルの内容をコピーし、Supabase SQL Editorに貼って
-- 手動実行してください（Claude Codeターミナルからは実行していません）。
-- ============================================================

-- ============================================================
-- 1. Storageバケット作成（非公開）
-- ============================================================
insert into storage.buckets (id, name, public)
values ('complaint-photos', 'complaint-photos', false)
on conflict (id) do nothing;

-- ============================================================
-- 2. complaint_photos テーブル
-- ============================================================
create table if not exists complaint_photos (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references complaints(id) on delete cascade,
  storage_path text not null,        -- 例: '{complaint_id}/{uuid}.jpg'
  file_name text,                    -- 元ファイル名（表示用・任意）
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_complaint_photos_complaint_id
  on complaint_photos (complaint_id);

alter table complaint_photos enable row level security;

-- 閲覧：ログインユーザー全員
create policy "photos_select_all_authenticated"
  on complaint_photos for select
  to authenticated
  using (true);

-- 添付：全ロール（ログインしていれば可）。uploaded_by は本人に固定。
create policy "photos_insert_authenticated"
  on complaint_photos for insert
  to authenticated
  with check (uploaded_by = auth.uid());

-- 削除：自分がアップした分のみ、または admin
create policy "photos_delete_own_or_admin"
  on complaint_photos for delete
  to authenticated
  using (
    uploaded_by = auth.uid()
    or (auth.jwt() -> 'app_metadata' ->> 'seed_note_role') = 'admin'
  );

-- ============================================================
-- 3. Storage RLS（storage.objects）
-- ============================================================

-- 閲覧：認証済みユーザー全員
create policy "storage_photos_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'complaint-photos');

-- アップロード：認証済みユーザー
create policy "storage_photos_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'complaint-photos');

-- 削除：自分がアップしたオブジェクト、または admin
create policy "storage_photos_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'complaint-photos'
    and (
      owner = auth.uid()
      or (auth.jwt() -> 'app_metadata' ->> 'seed_note_role') = 'admin'
    )
  );

-- ============================================================
-- 4. 確認クエリ（実行後に確認）
-- ============================================================
-- SELECT id, name, public FROM storage.buckets WHERE id = 'complaint-photos';
-- SELECT policyname, cmd FROM pg_policies WHERE tablename IN ('complaint_photos', 'objects');
