-- bulletin_board.complaint_id に UNIQUE 制約を追加
-- 目的：役員承認の重複トリガーで bulletin_board に同じ complaint_id の投稿が
--       複数回 insert されるのを防ぐ（Approval.jsx handleApproval 参照）

-- ① 既存データに重複がないか確認（1件も出なければ②へ進んでOK）
select complaint_id, count(*)
from bulletin_board
group by complaint_id
having count(*) > 1;

-- ② 重複がある場合、どの行を残すか決めてから重複行を削除する例（必要な場合のみ実行）
-- 最も古い1件を残し、それ以外を削除する場合：
-- delete from bulletin_board b
-- using bulletin_board b2
-- where b.complaint_id = b2.complaint_id
--   and b.id <> b2.id
--   and b.created_at > b2.created_at;

-- ③ UNIQUE 制約を追加
alter table bulletin_board
  add constraint bulletin_board_complaint_id_unique unique (complaint_id);
