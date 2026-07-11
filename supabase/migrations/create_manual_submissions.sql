-- ============================================================
-- マニュアル提出機能（2026-07-11）
--
-- 新規追加のみ。既存テーブルには一切変更を加えない。
-- 共有Supabase（wxjmqrxaqrujsvgzknwy）のため、バケット名は
-- E-Li(site-images, order-images) / MK Daily(未使用) と衝突しないことを
-- 確認済み。「manuals」は汎用的すぎるため「seed-manuals」を使用する。
--
-- 実行方法: このファイルの内容をコピーし、Supabase SQL Editorに貼って
-- 手動実行してください（Claude Codeターミナルからは実行していません）。
-- ============================================================

-- ============================================================
-- 1. Storageバケット作成（非公開）
-- ============================================================
insert into storage.buckets (id, name, public)
values ('seed-manuals', 'seed-manuals', false)
on conflict (id) do nothing;

-- ============================================================
-- 2. manual_submissions テーブル
-- ============================================================
create table if not exists manual_submissions (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references complaints(id) on delete cascade,
  storage_path text not null,
  file_name text not null,        -- 元ファイル名（表示・DL時のファイル名に使う）
  file_size bigint,               -- バイト数（表示用）
  mime_type text,                 -- アイコン出し分け用（任意）
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_manual_submissions_complaint_id
  on manual_submissions (complaint_id);

alter table manual_submissions enable row level security;

-- 閲覧：ログインユーザー全員
create policy "manuals_select_all_authenticated"
  on manual_submissions for select
  to authenticated
  using (true);

-- 提出：authenticated全員に許可し、uploaded_byを本人に固定。
-- 「担当者本人 or director以上」の制御はUI側で行う
-- （action_assigneeがユーザーIDと紐づいていないため、RLSでは厳密に表現できない）
create policy "manuals_insert_authenticated"
  on manual_submissions for insert
  to authenticated
  with check (uploaded_by = auth.uid());

-- 削除：本人がアップした分、または director以上
create policy "manuals_delete_own_or_superior"
  on manual_submissions for delete
  to authenticated
  using (
    uploaded_by = auth.uid()
    or (auth.jwt() -> 'app_metadata' ->> 'seed_note_role')
       in ('director', 'executive', 'admin')
  );

-- ============================================================
-- 3. Storage RLS（storage.objects）
-- ============================================================

create policy "storage_manuals_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'seed-manuals');

create policy "storage_manuals_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'seed-manuals');

create policy "storage_manuals_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'seed-manuals'
    and (
      owner = auth.uid()
      or (auth.jwt() -> 'app_metadata' ->> 'seed_note_role')
         in ('director', 'executive', 'admin')
    )
  );

-- ============================================================
-- 4. 確認クエリ（実行後に確認）
-- ============================================================
-- SELECT id, name, public FROM storage.buckets WHERE id = 'seed-manuals';
-- SELECT policyname, cmd FROM pg_policies WHERE tablename IN ('manual_submissions', 'objects');
