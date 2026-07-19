import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, XCircle, Clock } from 'lucide-react'
import { cn, getRole } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { ROOT_THEMES, ROOT_THEME_COLORS } from '@/lib/constants'

// ─── 定数 ───────────────────────────────────────────────────────────────────

const STEPS = ['受付', '対応中', '事業責任者確認', '改善報告書', '深掘り', '役員承認', '周知完了']

function statusToStep(status) {
  const map = {
    '受付済': 0,
    '対応中': 1,
    '是正案提出': 2, '是正案差し戻し': 2, '是正案再提出': 2, '是正案承認': 2,
    '改善報告書提出': 3, 'correction_rejected': 3, 'report_rejected': 3, 'supervisor_check': 3,
    '深掘り提出': 5,
    '承認完了': 6,
  }
  return map[status] ?? 0
}

// workflow_version = 2（原因分析・改善報告書を1ステップに統合した新フロー）専用
const NEW_STEPS = ['受付', '対応中', '事業責任者確認', '原因分析・改善報告書', '役員承認', '周知完了']

function newStatusToStep(status) {
  const map = {
    '受付済': 0,
    '対応中': 1,
    '是正案提出': 2, '是正案差し戻し': 2, '是正案再提出': 2, '是正案承認': 2,
    '原因分析提出': 4, '原因分析差し戻し': 4,
    '承認完了': 5,
  }
  return map[status] ?? 0
}

const APPROVER_EMAIL = {
  '斎村 直樹':   'saimura@markan.co.jp',
  '小笠原 久幸': 'ogasahara@markan.co.jp',
  '榮藤 美香':   'jimu@markan.co.jp',
}

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function calcCountdown(submittedAt) {
  if (!submittedAt) return null
  const deadline = new Date(submittedAt).getTime() + 24 * 60 * 60 * 1000
  const remaining = (deadline - Date.now()) / 1000
  const pad = n => String(Math.floor(Math.abs(n))).padStart(2, '0')
  if (remaining < 0) return { label: '期限超過', overdue: true }
  const h = Math.floor(remaining / 3600)
  const m = Math.floor((remaining % 3600) / 60)
  const s = Math.floor(remaining % 60)
  return { label: `${pad(h)}:${pad(m)}:${pad(s)}`, overdue: false }
}

function TimelineEntry({ log }) {
  const isRejected = log.type === 'approval_rejected'
  return (
    <div className={cn('rounded-xl border px-3 py-2.5', isRejected ? 'bg-red-50 border-red-100' : 'bg-stone-50 border-stone-100')}>
      <div className="flex items-center justify-between mb-1">
        <span className={cn('text-xs font-semibold', isRejected ? 'text-red-700' : 'text-gray-600')}>
          {log.author_name || '—'}{isRejected ? 'が差し戻しました' : 'のコメント'}
        </span>
        <span className="text-xs text-gray-400">{fmtDateTime(log.created_at)}</span>
      </div>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{log.content || '（コメントなし）'}</p>
    </div>
  )
}

function ProgressBar({ status, workflowVersion }) {
  const steps = workflowVersion === 2 ? NEW_STEPS : STEPS
  const step = workflowVersion === 2 ? newStatusToStep(status) : statusToStep(status)
  return (
    <div className="bg-white rounded-2xl shadow-sm px-6 py-4 mb-5">
      <div className="flex items-center gap-0">
        {steps.map((s, i) => {
          const done = i < step; const current = i === step
          return (
            <div key={s} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center shrink-0">
                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                  done ? 'bg-emerald-600 border-emerald-600 text-white' :
                  current ? 'bg-white border-emerald-600 text-emerald-700 ring-2 ring-emerald-200' :
                  'bg-white border-stone-200 text-stone-400')}>
                  {done ? '✓' : i + 1}
                </div>
                <span className={cn('text-[10px] mt-1 text-center leading-tight whitespace-nowrap',
                  current ? 'text-emerald-700 font-bold' : done ? 'text-emerald-500' : 'text-stone-400')}>
                  {s}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={cn('flex-1 h-0.5 mx-1 mt-[-14px]', done ? 'bg-emerald-500' : 'bg-stone-200')} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ReadRow({ label, value }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      <p className="text-sm text-gray-800 bg-stone-50 rounded-xl px-4 py-3 leading-relaxed min-h-[2.5rem]">
        {value || <span className="text-gray-400 italic">記録なし</span>}
      </p>
    </div>
  )
}

// ─── メイン ──────────────────────────────────────────────────────────────────

export default function Approval() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [complaint,  setComplaint]  = useState(null)
  const [analysis,   setAnalysis]   = useState(null)
  const [rootAnalysis, setRootAnalysis] = useState(null)
  const [approvals,  setApprovals]  = useState([])
  const [themeStats, setThemeStats] = useState({})
  const [, setTick] = useState(0)

  const [correction,            setCorrection]            = useState(null)
  const [contactLogs,           setContactLogs]           = useState([])
  const [hearingText,           setHearingText]           = useState('')
  const [hearingLog,            setHearingLog]            = useState(null)
  const [supervisorCommentLogs, setSupervisorCommentLogs] = useState([])

  const [comments,           setComments]           = useState({})
  const [saving,             setSaving]             = useState({})
  const [revisionSnapshot,   setRevisionSnapshot]   = useState(null)
  const [negotiationReplies, setNegotiationReplies] = useState([])
  const [loading,            setLoading]            = useState(true)
  const [currentUser,        setCurrentUser]        = useState(null)
  const [rejectModalOpen,    setRejectModalOpen]    = useState(false)
  const [rejectTarget,       setRejectTarget]       = useState(null)
  const [approvalTimeline,       setApprovalTimeline]       = useState([])
  const [showPastTimeline,       setShowPastTimeline]       = useState(false)
  const [newApprovalComment,     setNewApprovalComment]     = useState('')
  const [sendingApprovalComment, setSendingApprovalComment] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUser(data.session?.user ?? null)
    })
  }, [])

  const fetchData = useCallback(async () => {
    const [{ data: c }, { data: deep }, { data: root }, { data: appr }, { data: stats }, { data: logs }, { data: corr }] = await Promise.all([
      supabase.from('complaints').select('*').eq('id', id).maybeSingle(),
      supabase.from('complaint_deep_analysis').select('*').eq('complaint_id', id).order('created_at').limit(1),
      supabase.from('complaint_root_analysis').select('*').eq('complaint_id', id).order('created_at', { ascending: false }).limit(1),
      supabase.from('complaint_approvals').select('*').eq('complaint_id', id).order('sort_order'),
      supabase.from('complaint_deep_analysis').select('root_theme'),
      supabase.from('complaint_logs').select('*').eq('complaint_id', id).order('created_at'),
      supabase.from('complaint_corrections').select('*').eq('complaint_id', id).order('created_at').limit(1),
    ])
    if (c) setComplaint(c)
    if (deep && deep[0]) setAnalysis(deep[0])
    if (root && root[0]) setRootAnalysis(root[0])
    if (appr) {
      setApprovals(appr)
      const init = {}
      appr.forEach(a => { init[a.id] = a.comment || '' })
      setComments(init)
    }
    if (stats) {
      const cnt = {}
      stats.forEach(s => { if (s.root_theme) cnt[s.root_theme] = (cnt[s.root_theme] || 0) + 1 })
      setThemeStats(cnt)
    }
    if (logs) {
      setContactLogs(logs.filter(l => l.type === 'contact'))
      const h = logs.filter(l => l.type === 'hearing').pop()
      if (h) { setHearingText(h.content); setHearingLog(h) }
      setSupervisorCommentLogs(logs.filter(l => l.type === 'supervisor_comment'))
      const snapLog = logs.filter(l => l.type === 'deep_revision_snapshot').pop()
      if (snapLog) { try { setRevisionSnapshot(JSON.parse(snapLog.content)) } catch {} }
      setNegotiationReplies(logs.filter(l => l.type === 'negotiation_reply'))
      setApprovalTimeline(logs.filter(l => l.type === 'approval_rejected' || l.type === 'approval_comment'))
    }
    if (corr && corr[0]) setCorrection(corr[0])
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const handleApproval = async (approvalId, status, type = null) => {
    const approverRow = approvals.find(a => a.id === approvalId)
    setSaving(s => ({ ...s, [approvalId]: true }))
    await supabase.from('complaint_approvals').update({
      status,
      comment:     comments[approvalId] || '',
      approved_at: new Date().toISOString(),
    }).eq('id', approvalId)

    setApprovals(prev => prev.map(a =>
      a.id === approvalId ? { ...a, status, comment: comments[approvalId] || '', approved_at: new Date().toISOString() } : a
    ))

    // 否認時は complaint を差し戻しに
    if (status === 'rejected') {
      const nextStatus = type === 'root_analysis' ? '原因分析差し戻し' : type === 'report' ? 'report_rejected' : '役員再協議'
      await supabase.from('complaints').update({
        status: nextStatus, current_turn_started_at: new Date().toISOString(),
      }).eq('id', id)
      setComplaint(c => ({ ...c, status: nextStatus }))
      setRejectModalOpen(false)
      setRejectTarget(null)

      const { data: logEntry } = await supabase.from('complaint_logs').insert({
        complaint_id: id, type: 'approval_rejected',
        content: comments[approvalId] || '', author_name: approverRow?.approver_name || '',
      }).select().single()
      if (logEntry) setApprovalTimeline(prev => [...prev, logEntry])
    }

    // 全員承認済みなら complaint を完了に
    const updated = approvals.map(a =>
      a.id === approvalId ? { ...a, status } : a
    )
    if (updated.every(a => a.status === 'approved')) {
      await supabase.from('complaints').update({ status: '承認完了', current_turn_started_at: new Date().toISOString() }).eq('id', id)
      setComplaint(c => ({ ...c, status: '承認完了' }))

      // 掲示板に自動投稿（重複防止）
      const { data: existingPost } = await supabase
        .from('bulletin_board').select('id').eq('complaint_id', id).maybeSingle()
      if (!existingPost) {
        const boardContent = complaint.workflow_version === 2 ? {
          site_name:              complaint.site_name,
          description:            complaint.content,
          received_at:            complaint.received_at || complaint.created_at,
          assignee:               complaint.assignee,
          contact_logs:           contactLogs.map(l => ({
            content:           l.content,
            created_at:        l.created_at,
            connected_attempt: l.connected_attempt ?? null,
            missed_calls:      l.missed_calls ?? null,
          })),
          hearing:                hearingText,
          hearing_at:             hearingLog?.created_at ?? null,
          hearing_author:         hearingLog?.author_name ?? null,
          correction_action:      rootAnalysis?.correction,
          correction_author:      rootAnalysis?.author_name || complaint.assignee || null,
          correction_created_at:  rootAnalysis?.created_at ?? null,
          direct_cause:           rootAnalysis?.occurred_event_note,
          improvement:            rootAnalysis?.improvement,
          root_cause:             rootAnalysis?.root_cause,
          root_theme:             rootAnalysis?.root_theme,
          root_detail:            null,
          org_improvement:        rootAnalysis?.improvement,
          action_assignee:        rootAnalysis?.action_assignee,
          action_deadline:        rootAnalysis?.action_deadline,
          action_progress:        rootAnalysis?.action_progress,
          horizontal_departments: rootAnalysis?.horizontal_departments,
          horizontal_content:     null,
          deep_author:            rootAnalysis?.author_name ?? null,
          deep_created_at:        rootAnalysis?.created_at ?? null,
          approved_at:            new Date().toISOString(),
        } : {
          site_name:              complaint.site_name,
          description:            complaint.content,
          received_at:            complaint.received_at || complaint.created_at,
          assignee:               complaint.assignee,
          contact_logs:           contactLogs.map(l => ({
            content:           l.content,
            created_at:        l.created_at,
            connected_attempt: l.connected_attempt ?? null,
            missed_calls:      l.missed_calls ?? null,
          })),
          hearing:                hearingText,
          hearing_at:             hearingLog?.created_at ?? null,
          hearing_author:         hearingLog?.author_name ?? null,
          correction_action:      correction?.correction,
          correction_author:      correction?.author_name || complaint.assignee || null,
          correction_created_at:  correction?.created_at ?? null,
          direct_cause:           correction?.direct_cause,
          improvement:            correction?.improvement,
          root_cause:             analysis?.root_cause,
          root_theme:             analysis?.root_theme,
          root_detail:            analysis?.root_detail,
          org_improvement:        analysis?.org_improvement,
          action_assignee:        analysis?.action_assignee,
          action_deadline:        analysis?.action_deadline,
          action_progress:        analysis?.action_progress,
          horizontal_departments: analysis?.horizontal_departments,
          horizontal_content:     analysis?.horizontal_content,
          deep_author:            analysis?.author_name ?? null,
          deep_created_at:        analysis?.created_at ?? null,
          approved_at:            new Date().toISOString(),
        }
        await supabase.from('bulletin_board').insert({ complaint_id: id, content: boardContent })
      }
    }

    setSaving(s => ({ ...s, [approvalId]: false }))
  }

  const handleApprovalComment = async () => {
    if (!newApprovalComment.trim()) return
    setSendingApprovalComment(true)
    const authorName = Object.entries(APPROVER_EMAIL).find(([, email]) => email === currentUser?.email)?.[0]
      || currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name || currentUser?.email || ''
    const { data, error } = await supabase.from('complaint_logs').insert({
      complaint_id: id, type: 'approval_comment', content: newApprovalComment.trim(), author_name: authorName,
    }).select().single()
    setSendingApprovalComment(false)
    if (error) { alert(`送信に失敗しました: ${error.message}`); return }
    if (data) setApprovalTimeline(prev => [...prev, data])
    setNewApprovalComment('')
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-gray-400">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mr-3" />読み込み中...
    </div>
  )
  if (!complaint) return (
    <div className="px-6 py-12 text-center text-gray-400"><p className="text-4xl mb-3">🌱</p><p>データが見つかりません</p></div>
  )

  const approvedCount = approvals.filter(a => a.status === 'approved').length
  const countdown = calcCountdown(complaint.workflow_version === 2 ? rootAnalysis?.created_at : analysis?.created_at)
  const allApproved = approvals.length > 0 && approvals.every(a => a.status === 'approved')
  const totalTheme = Object.values(themeStats).reduce((s, v) => s + v, 0) || 1
  const userRole = getRole(currentUser)
  const myApproval = approvals.find(a => APPROVER_EMAIL[a.approver_name] === currentUser?.email)
  const canComment = userRole === 'admin' || (!!myApproval && myApproval.status !== 'approved')
  const sortedTimeline = [...approvalTimeline].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const [latestTimelineEntry, ...pastTimelineEntries] = sortedTimeline

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <button onClick={() => navigate(`/complaints/${id}`)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-5 transition-colors">
        <ArrowLeft size={15} /> クレーム詳細に戻る
      </button>

      {/* ヘッダー */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-bold text-gray-900 mb-0.5">🏛 役員承認</p>
            <p className="text-sm text-gray-500">{complaint.client_name} — {complaint.site_name}</p>
          </div>
          {/* カウントダウン */}
          {countdown && !allApproved && (
            <div className={cn('text-right', countdown.overdue ? 'text-red-600' : 'text-gray-700')}>
              <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
                <Clock size={11} />
                <span>承認期限まで</span>
              </div>
              <div className="text-[24px] font-black tabular-nums leading-none">{countdown.label}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">24時間以内に3名の承認が必要です</div>
            </div>
          )}
          {allApproved && (
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
              <CheckCircle size={20} className="text-emerald-600" />
              承認完了
            </div>
          )}
        </div>

        {/* 進捗バー（承認） */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>{approvedCount} / {approvals.length} 名が承認</span>
            <span className="font-bold text-emerald-700">
              あと{approvals.length - approvedCount}名の承認でSeed Noteが完成します
            </span>
          </div>
          <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${approvals.length ? (approvedCount / approvals.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* 合同改善報告書プレビュー（workflow_version = 1 の既存フローのみ） */}
      {complaint.workflow_version !== 2 && analysis && (
        <div className="bg-white rounded-2xl shadow-sm mb-5 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50 flex items-center gap-2">
            <span className="text-sm font-bold text-gray-700">📄 合同改善報告書</span>
            <span className="text-xs text-gray-400">役員に提出される内容</span>
          </div>
          <div className="p-5 space-y-5 text-sm">

            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 border-b border-stone-100 pb-1">■ クレーム概要</p>
              <div className="space-y-1.5 text-gray-700">
                <p>・発生日：{fmtDateTime(complaint.created_at)}</p>
                <p>・現場：{complaint.site_name || '—'}</p>
                <p>・クレーム内容：{complaint.content || '—'}</p>
                <p>・感情レベル：Lv.{complaint.emotion_level || '—'}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 border-b border-stone-100 pb-1">■ 対応の顛末</p>
              <div className="space-y-1.5 text-gray-700">
                <p>・初回連絡：{contactLogs[0]
                  ? `${contactLogs[0].content}（${fmtDateTime(contactLogs[0].created_at)}）`
                  : '記録なし'}</p>
                <p>・作業者聞き取り：{hearingText || '記録なし'}</p>
                <p>・対応案：{correction?.correction || '—'}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 border-b border-stone-100 pb-1">■ 事業責任者確認</p>
              <div className="space-y-1.5 text-gray-700">
                <p>・結果：承認</p>
                <p>・コメント：{supervisorCommentLogs.length > 0
                  ? supervisorCommentLogs[0].content
                  : (complaint.supervisor_comment || '—')}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 border-b border-stone-100 pb-1">■ 改善報告書（管理者）</p>
              <div className="space-y-1.5 text-gray-700">
                <p>・直接原因：{correction?.direct_cause || '—'}</p>
                <p>・是正処置：{correction?.correction || '—'}</p>
                <p>・運用改善案：{correction?.improvement || '—'}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 border-b border-stone-100 pb-1">■ 深掘り分析（事業責任者）</p>
              {revisionSnapshot && (
                <div className="text-xs bg-yellow-50 border border-yellow-300 rounded-xl px-3 py-2 mb-2 text-yellow-800 font-semibold">
                  🔄 修正再提出済み — 変更箇所を黄色でハイライトしています
                </div>
              )}
              <div className="space-y-1.5 text-gray-700">
                {[
                  { label: '真因', cur: analysis.root_cause, prev: revisionSnapshot?.root_cause },
                  { label: '組織改善案', cur: analysis.org_improvement, prev: revisionSnapshot?.org_improvement },
                  { label: '真因カテゴリー', cur: analysis.root_theme, prev: revisionSnapshot?.root_theme },
                  { label: '真因詳細', cur: analysis.root_detail, prev: revisionSnapshot?.root_detail },
                  { label: '横展開 周知内容', cur: analysis.horizontal_content, prev: revisionSnapshot?.horizontal_content },
                  { label: '担当者', cur: analysis.action_assignee, prev: revisionSnapshot?.action_assignee },
                  { label: '期限', cur: analysis.action_deadline, prev: revisionSnapshot?.action_deadline },
                  { label: '進捗', cur: analysis.action_progress, prev: revisionSnapshot?.action_progress },
                ].map(({ label, cur, prev }) => {
                  const changed = revisionSnapshot && prev !== undefined && prev !== cur
                  return (
                    <div key={label}>
                      <span className={cn('inline', changed ? 'bg-yellow-100 rounded px-1' : '')}>
                        ・{label}：{cur || '—'}
                      </span>
                      {changed && (
                        <span className="ml-2 text-xs text-yellow-700">（変更前: {prev || '空白'}）</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ① 事業責任者の深掘り結果（読み取り専用・workflow_version = 1 の既存フローのみ） */}
      {complaint.workflow_version !== 2 && analysis && (
        <div className="bg-white rounded-2xl shadow-sm mb-5 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50">
            <span className="text-sm font-bold text-gray-700">① 事業責任者の深掘り結果</span>
          </div>
          <div className="p-5">
            <ReadRow label="真因" value={analysis.root_cause} />
            <ReadRow label="横展開" value={analysis.horizontal_expansion} />
            <ReadRow label="組織改善案" value={analysis.org_improvement} />
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">根源テーマ</p>
              <span className={cn(
                'inline-block text-xs font-bold px-3 py-1.5 rounded-full text-white',
                ROOT_THEME_COLORS[analysis.root_theme] || 'bg-stone-400'
              )}>
                {analysis.root_theme || '—'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ① 原因分析・改善報告書（読み取り専用・workflow_version = 2 の新フロー専用） */}
      {complaint.workflow_version === 2 && rootAnalysis && (
        <div className="bg-white rounded-2xl shadow-sm mb-5 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50">
            <span className="text-sm font-bold text-gray-700">① 原因分析・改善報告書</span>
          </div>
          <div className="p-5">
            <ReadRow label="発生した事象" value={rootAnalysis.occurred_event_note} />
            <ReadRow label="実施した是正措置" value={rootAnalysis.correction} />
            <ReadRow label="真因" value={rootAnalysis.root_cause} />
            <ReadRow label="改善策" value={rootAnalysis.improvement} />
            <ReadRow label="横展開対象部署" value={Array.isArray(rootAnalysis.horizontal_departments) ? rootAnalysis.horizontal_departments.join('・') : ''} />
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">真因カテゴリー</p>
              <span className={cn(
                'inline-block text-xs font-bold px-3 py-1.5 rounded-full text-white',
                ROOT_THEME_COLORS[rootAnalysis.root_theme] || 'bg-stone-400'
              )}>
                {rootAnalysis.root_theme || '—'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 再協議：directorの返答ログ */}
      {negotiationReplies.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-5">
          <p className="text-sm font-bold text-blue-700 mb-3">💬 事業責任者からの返答</p>
          {negotiationReplies.map((r, i) => (
            <div key={i} className="bg-white rounded-xl border border-blue-100 px-4 py-3 mb-2 last:mb-0">
              <p className="text-sm text-gray-700">{r.content}</p>
              <p className="text-xs text-gray-400 mt-1">{fmtDateTime(r.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      {/* ② 役員承認（3名） */}
      <div className="space-y-4 mb-5">
        {approvals.map((appr, i) => {
          const done     = appr.status === 'approved'
          const rejected = appr.status === 'rejected'
          const pending  = appr.status === 'pending'
          const isMyCard = currentUser?.email === APPROVER_EMAIL[appr.approver_name]
          const displayRole = appr.approver_name === '斎村' ? '専務取締役' : appr.approver_role
          return (
            <div key={appr.id} className={cn(
              'bg-white rounded-2xl shadow-sm overflow-hidden border-l-4',
              done ? 'border-l-emerald-400' : rejected ? 'border-l-red-400' : 'border-l-stone-200'
            )}>
              <div className="px-5 py-4">
                {/* 役員情報 */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-900 text-[15px]">{appr.approver_name}</p>
                    <p className="text-xs text-gray-400">{displayRole}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {done && (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                        <CheckCircle size={12} /> 承認済み
                      </span>
                    )}
                    {rejected && (
                      <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-3 py-1 rounded-full">
                        <XCircle size={12} /> 差し戻し
                      </span>
                    )}
                    {pending && (
                      <span className="text-xs font-bold text-stone-500 bg-stone-100 px-3 py-1 rounded-full">
                        未承認
                      </span>
                    )}
                  </div>
                </div>

                {/* 承認済みの場合はコメント表示 */}
                {(done || rejected) && appr.comment && (
                  <p className="text-sm text-gray-600 bg-stone-50 rounded-xl px-3 py-2.5 mb-3">
                    {appr.comment}
                  </p>
                )}
                {(done || rejected) && appr.approved_at && (
                  <p className="text-xs text-gray-400 mb-2">{fmtDateTime(appr.approved_at)}</p>
                )}

                {/* 未承認の場合は入力フォーム（自分のカードのみ） */}
                {pending && isMyCard && (
                  <div className="space-y-2">
                    <textarea
                      value={comments[appr.id] || ''}
                      onChange={e => setComments(prev => ({ ...prev, [appr.id]: e.target.value }))}
                      rows={2}
                      placeholder="コメント（任意）"
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproval(appr.id, 'approved')}
                        disabled={saving[appr.id]}
                        className="flex-1 h-10 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                        <CheckCircle size={14} />
                        {saving[appr.id] ? '処理中...' : '承認する'}
                      </button>
                      <button
                        onClick={() => { setRejectTarget(appr.id); setRejectModalOpen(true) }}
                        disabled={saving[appr.id]}
                        className="flex-1 h-10 rounded-xl border-2 border-red-200 text-red-700 bg-red-50 hover:bg-red-100 text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                        <XCircle size={14} />
                        差し戻す
                      </button>
                    </div>
                  </div>
                )}
                {pending && !isMyCard && (
                  <p className="text-xs text-gray-400 italic">このカードへの操作権限がありません</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ②.5 差し戻し履歴・コメント */}
      <div className="bg-white rounded-2xl shadow-sm mb-5 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50">
          <span className="text-sm font-bold text-gray-700">💬 差し戻し履歴・コメント</span>
        </div>
        <div className="p-5">
          {sortedTimeline.length === 0 && (
            <p className="text-sm text-gray-400 italic mb-4">まだ履歴はありません</p>
          )}
          {latestTimelineEntry && (
            <div className="space-y-2 mb-4">
              <TimelineEntry log={latestTimelineEntry} />
              {pastTimelineEntries.length > 0 && (
                <>
                  <button
                    onClick={() => setShowPastTimeline(v => !v)}
                    className="text-xs text-gray-400 hover:text-gray-600 font-semibold"
                  >
                    {showPastTimeline ? '過去の履歴を閉じる' : `過去の履歴を表示（${pastTimelineEntries.length}件）`}
                  </button>
                  {showPastTimeline && pastTimelineEntries.map(log => <TimelineEntry key={log.id} log={log} />)}
                </>
              )}
            </div>
          )}
          {canComment && (
            <div className="space-y-2 pt-3 border-t border-stone-100">
              <textarea
                value={newApprovalComment}
                onChange={e => setNewApprovalComment(e.target.value)}
                rows={2}
                placeholder="コメントを入力してください"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition resize-none"
              />
              <button
                onClick={handleApprovalComment}
                disabled={sendingApprovalComment || !newApprovalComment.trim()}
                className="px-4 h-9 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                {sendingApprovalComment ? '送信中...' : 'コメントする'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ③ 今月の根源テーマ集計 */}
      <div className="bg-white rounded-2xl shadow-sm mb-8 p-5">
        <p className="text-sm font-bold text-gray-800 mb-4">📊 今月の根源テーマ集計</p>
        <div className="space-y-3">
          {ROOT_THEMES.map(theme => {
            const count = themeStats[theme] || 0
            const pct   = Math.round((count / totalTheme) * 100)
            return (
              <div key={theme}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{theme}</span>
                  <span className="text-xs font-bold text-gray-500">{count}件</span>
                </div>
                <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', ROOT_THEME_COLORS[theme] || 'bg-stone-400')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 完了時のメッセージ */}
      {allApproved && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center mb-8">
          <div className="text-4xl mb-3">🌱</div>
          <p className="font-bold text-emerald-800 text-lg mb-1">Seed Note が完成しました</p>
          <p className="text-sm text-emerald-600 mb-4">このクレームは組織の成長の種になりました。</p>
          <button onClick={() => navigate('/dashboard')}
            className="px-6 py-2.5 rounded-xl bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 transition-colors">
            ダッシュボードへ戻る
          </button>
        </div>
      )}

      {rejectModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-80 space-y-4 shadow-xl">
            <p className="font-bold text-gray-800 text-center">差し戻し先を選択してください</p>
            {complaint.workflow_version === 2 ? (
              <button
                onClick={() => handleApproval(rejectTarget, 'rejected', 'root_analysis')}
                className="w-full py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-sm font-bold text-gray-700 transition-colors"
              >
                原因分析・改善報告書に戻す
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleApproval(rejectTarget, 'rejected', 'deep_analysis')}
                  className="w-full py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-sm font-bold text-gray-700 transition-colors"
                >
                  深掘り分析に戻す
                </button>
                <button
                  onClick={() => handleApproval(rejectTarget, 'rejected', 'report')}
                  className="w-full py-3 rounded-xl bg-red-50 hover:bg-red-100 text-sm font-bold text-red-700 transition-colors"
                >
                  改善報告書に戻す
                </button>
              </>
            )}
            <button
              onClick={() => { setRejectModalOpen(false); setRejectTarget(null) }}
              className="w-full py-2 text-xs text-gray-400 hover:text-gray-600"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
