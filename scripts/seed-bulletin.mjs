import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wxjmqrxaqrujsvgzknwy.supabase.co'
const SUPABASE_KEY = process.env.SERVICE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4am1xcnhhcXJ1anN2Z3prbnd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTk3NDAsImV4cCI6MjA5NDc3NTc0MH0.LL0r59vLn_Wn92rzObZjhTIox-XBz7EPzv2WJ9Z0jOk'

if (!process.env.SERVICE_KEY) {
  console.warn('⚠ SERVICE_KEY 未設定。アノンキーで試みますが RLS により読み取れない可能性があります。')
  console.warn('  実行方法: SERVICE_KEY="eyJ..." node scripts/seed-bulletin.mjs\n')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { transport: class { constructor() {} on() {} connect() {} disconnect() {} } },
})

async function run() {
  // 実在するステータスを確認
  const { data: allStatuses } = await supabase
    .from('complaints')
    .select('id, status, site_name')
  console.log('全クレームのステータス一覧:')
  allStatuses?.forEach(c => console.log(`  [${c.id.slice(0,8)}] ${c.status} / ${c.site_name}`))

  // 1. 承認完了の全クレームを取得
  const { data: complaints, error: cErr } = await supabase
    .from('complaints')
    .select('*')
    .eq('status', '承認完了')
  if (cErr) { console.error('complaints fetch error:', cErr); process.exit(1) }
  console.log(`\n承認完了クレーム: ${complaints.length}件`)

  let inserted = 0
  let skipped  = 0

  for (const complaint of complaints) {
    const id = complaint.id

    // 重複チェック
    const { data: existing } = await supabase
      .from('bulletin_board')
      .select('id')
      .eq('complaint_id', id)
      .maybeSingle()
    if (existing) {
      console.log(`  SKIP [${id}] ${complaint.site_name} — 既に掲載済み`)
      skipped++
      continue
    }

    // 関連データを並列取得
    const [
      { data: contactLogs },
      { data: hearingLogs },
      { data: svCommentLogs },
      { data: corrections },
      { data: deepList },
    ] = await Promise.all([
      supabase.from('complaint_logs').select('*').eq('complaint_id', id).eq('type', 'contact').order('created_at'),
      supabase.from('complaint_logs').select('*').eq('complaint_id', id).eq('type', 'hearing').order('created_at'),
      supabase.from('complaint_logs').select('*').eq('complaint_id', id).eq('type', 'supervisor_comment').order('created_at'),
      supabase.from('complaint_corrections').select('*').eq('complaint_id', id).order('created_at').limit(1),
      supabase.from('complaint_deep_analysis').select('*').eq('complaint_id', id).order('created_at').limit(1),
    ])

    const hearingText  = hearingLogs?.[0]?.content ?? ''
    const svText       = svCommentLogs?.[0]?.content ?? (svCommentLogs?.length === 0 ? complaint.supervisor_comment : '') ?? ''
    const correction   = corrections?.[0]  ?? null
    const analysis     = deepList?.[0]     ?? null

    const payload = {
      complaint_id: id,
      content: {
        site_name:              complaint.site_name,
        description:            complaint.content,
        received_at:            complaint.received_at || complaint.created_at,
        assignee:               complaint.assignee,
        contact_logs:           (contactLogs ?? []).map(l => ({ content: l.content, created_at: l.created_at })),
        hearing:                hearingText,
        supervisor_comment:     svText,
        correction_action:      correction?.correction   ?? null,
        direct_cause:           correction?.direct_cause ?? null,
        improvement:            correction?.improvement  ?? null,
        root_cause:             analysis?.root_cause     ?? null,
        root_theme:             analysis?.root_theme     ?? null,
        root_detail:            analysis?.root_detail    ?? null,
        org_improvement:        analysis?.org_improvement ?? null,
        action_assignee:        analysis?.action_assignee ?? null,
        action_deadline:        analysis?.action_deadline ?? null,
        action_progress:        analysis?.action_progress ?? null,
        horizontal_departments: analysis?.horizontal_departments ?? [],
        horizontal_content:     analysis?.horizontal_content ?? null,
      },
    }

    const { error: insErr } = await supabase.from('bulletin_board').insert(payload)
    if (insErr) {
      console.error(`  ERROR [${id}] ${complaint.site_name}:`, insErr.message)
    } else {
      console.log(`  INSERT [${id}] ${complaint.site_name || '（現場名なし）'}`)
      inserted++
    }
  }

  console.log(`\n完了 — 新規投稿: ${inserted}件 / スキップ: ${skipped}件`)
}

run()
