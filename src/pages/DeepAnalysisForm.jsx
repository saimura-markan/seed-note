import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const ROOT_THEMES  = ['教育不足', '標準化不足', 'ルール未整備', 'システム不備', '顧客確認不足', '引継ぎ不足', 'マネジメント不足', '人員配置問題']
const DEPARTMENTS  = ['工事部解体課', '工事部産廃課', '清掃部清掃１課', '清掃部清掃２課', '環境リサイクル部', '本部']

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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

export default function DeepAnalysisForm() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [complaint,             setComplaint]             = useState(null)
  const [correction,            setCorrection]            = useState(null)
  const [contactLogs,           setContactLogs]           = useState([])
  const [hearingText,           setHearingText]           = useState('')
  const [reportLog,             setReportLog]             = useState(null)
  const [supervisorComment,     setSupervisorComment]     = useState('')
  const [supervisorCommentLogs, setSupervisorCommentLogs] = useState([])
  const [newComment,            setNewComment]            = useState('')
  const [sendingComment,        setSendingComment]        = useState(false)
  const [approving,             setApproving]             = useState(false)
  const [approvalAction,        setApprovalAction]        = useState(null) // null | 'reject' | 'approve'

  // 深掘りフォーム
  const [existing,       setExisting]       = useState(null)
  const [rootCause,      setRootCause]      = useState('')
  const [orgImprove,     setOrgImprove]     = useState('')
  const [rootTheme,      setRootTheme]      = useState('')
  const [rootDetail,     setRootDetail]     = useState('')
  // 横展開
  const [horizDepts,     setHorizDepts]     = useState([])
  const [horizContent,   setHorizContent]   = useState('')
  // 真因対策
  const [actionAssignee, setActionAssignee] = useState('')
  const [actionDeadline, setActionDeadline] = useState('')
  const [actionProgress, setActionProgress] = useState('未着手')
  const [submitting,     setSubmitting]     = useState(false)
  const [loading,        setLoading]        = useState(true)
  const [currentUser,    setCurrentUser]    = useState(null)
  const [, setTick]                 = useState(0)

  // ソクラテス対話（真因）
  // phase: q1 | q2 | final_check | retry | complete
  const [rootPhase,   setRootPhase]   = useState('q1')
  const [rootAnswers, setRootAnswers] = useState({ q1: '', q2: '', retry: '' })
  const [rootInputs,  setRootInputs]  = useState({ q1: '', q2: '', retry: '' })

  const setRootInput = (key, val) => setRootInputs(prev => ({ ...prev, [key]: val }))

  const submitRootQ1 = () => {
    if (!rootInputs.q1.trim()) return
    setRootAnswers(prev => ({ ...prev, q1: rootInputs.q1.trim() }))
    setRootPhase('q2')
  }
  const editRootQ1 = () => {
    setRootInputs(prev => ({ ...prev, q1: rootAnswers.q1, q2: '', retry: '' }))
    setRootAnswers({ q1: '', q2: '', retry: '' })
    setRootPhase('q1')
  }
  const submitRootQ2 = () => {
    if (!rootInputs.q2.trim()) return
    setRootAnswers(prev => ({ ...prev, q2: rootInputs.q2.trim() }))
    setRootPhase('final_check')
  }
  const editRootQ2 = () => {
    setRootInputs(prev => ({ ...prev, q2: rootAnswers.q2, retry: '' }))
    setRootAnswers(prev => ({ ...prev, q2: '', retry: '' }))
    setRootPhase('q2')
  }
  const handleRootFinalYes = () => {
    const parts = []
    if (rootAnswers.q1) parts.push(rootAnswers.q1)
    if (rootAnswers.q2) parts.push(rootAnswers.q2)
    if (rootAnswers.retry) parts.push(rootAnswers.retry)
    setRootCause(parts.join('\n'))
    setRootPhase('complete')
  }
  const submitRootRetry = () => {
    if (!rootInputs.retry.trim()) return
    setRootAnswers(prev => ({ ...prev, retry: rootInputs.retry.trim() }))
    setRootPhase('final_check')
  }

  // 改善報告書の承認/否認
  const [correctionApproved,  setCorrectionApproved]  = useState(false)
  const [showCorrReject,      setShowCorrReject]       = useState(false)
  const [corrRejectReason,    setCorrRejectReason]     = useState('')
  const [corrRejecting,       setCorrRejecting]        = useState(false)

  // 深掘り分析の承認/否認
  const [showDeepReject, setShowDeepReject] = useState(false)
  const [deepRejectReason, setDeepRejectReason] = useState('')
  const [deepActing, setDeepActing] = useState(false)
  const [deepEditMode, setDeepEditMode] = useState(false)
  const [deepSent, setDeepSent] = useState(false)
  const [rejectedApprovals, setRejectedApprovals] = useState([])

  // 是正案再提出（manager の返答）
  const [latestCorrectionReply, setLatestCorrectionReply] = useState(null)

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const fetchData = useCallback(async () => {
    const [{ data: c }, { data: logs }, { data: corr }, { data: deep }, { data: appr }] = await Promise.all([
      supabase.from('complaints').select('*').eq('id', id).maybeSingle(),
      supabase.from('complaint_logs').select('*').eq('complaint_id', id).order('created_at'),
      supabase.from('complaint_corrections').select('*').eq('complaint_id', id).order('created_at').limit(1),
      supabase.from('complaint_deep_analysis').select('*').eq('complaint_id', id).order('created_at').limit(1),
      supabase.from('complaint_approvals').select('*').eq('complaint_id', id).order('sort_order'),
    ])
    if (c) { setComplaint(c); setSupervisorComment(c.supervisor_comment || '') }
    if (logs) {
      setContactLogs(logs.filter(l => l.type === 'contact'))
      const h = logs.filter(l => l.type === 'hearing').pop()
      if (h) setHearingText(h.content)
      const r = logs.filter(l => l.type === 'report').pop()
      if (r) setReportLog(r)
      setSupervisorCommentLogs(logs.filter(l => l.type === 'supervisor_comment'))
      const replyLog = logs.filter(l => l.type === 'correction_reply').pop()
      if (replyLog) setLatestCorrectionReply(replyLog)
    }
    if (corr && corr[0]) setCorrection(corr[0])
    if (deep && deep[0]) {
      setExisting(deep[0])
      setRootCause(deep[0].root_cause || '')
      setOrgImprove(deep[0].org_improvement || '')
      setRootTheme(deep[0].root_theme || '')
      setRootDetail(deep[0].root_detail || '')
      setHorizDepts(Array.isArray(deep[0].horizontal_departments) ? deep[0].horizontal_departments : [])
      setHorizContent(deep[0].horizontal_content || '')
      setActionAssignee(deep[0].action_assignee || '')
      setActionDeadline(deep[0].action_deadline || '')
      setActionProgress(deep[0].action_progress || '未着手')
    }
    // statusが深掘り提出済みでdepAnalysisデータがない場合、改善報告書確認ステップをスキップ
    if (c && c.status === '深掘り提出' && !(deep && deep[0])) {
      setCorrectionApproved(true)
    }
    if (appr) setRejectedApprovals(appr.filter(a => a.status === 'rejected'))
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUser(data.session?.user ?? null)
    })
  }, [])

  // ── 対応案 承認 ──
  const handleApprove = async () => {
    setApproving(true)
    const now = new Date().toISOString()
    const commentContent = supervisorComment.trim() || '承認'

    if (complaint.judgment === '手直し') {
      const { error } = await supabase.from('complaints').update({
        status: '改善報告書提出', supervisor_approved_at: now, supervisor_comment: supervisorComment, current_turn_started_at: now,
      }).eq('id', id)
      if (error) { setApproving(false); alert(`承認に失敗しました: ${error.message}`); return }
      const { error: e } = await supabase.from('complaint_logs').insert({ complaint_id: id, type: 'supervisor_comment', content: commentContent })
      if (e) console.error('[handleApprove 手直し]', e.message)
      setApproving(false)
      navigate(`/complaints/${id}`)
      return
    }

    const { error } = await supabase.from('complaints').update({
      status: '是正案承認', supervisor_approved_at: now, supervisor_comment: supervisorComment, current_turn_started_at: now,
    }).eq('id', id)
    if (error) { alert(`承認に失敗しました: ${error.message}`); setApproving(false); return }
    const { error: e } = await supabase.from('complaint_logs').insert({ complaint_id: id, type: 'supervisor_comment', content: commentContent })
    if (e) console.error('[handleApprove]', e.message)
    setApproving(false)
    await fetchData()
  }

  // ── 対応案 否認 ──
  const handleReject = async () => {
    if (!supervisorComment.trim()) { alert('差し戻しコメントを入力してください'); return }
    setApproving(true)
    const { error } = await supabase.from('complaints').update({ status: '是正案差し戻し', supervisor_comment: supervisorComment, current_turn_started_at: new Date().toISOString() }).eq('id', id)
    if (error) { alert(`差し戻しに失敗しました: ${error.message}`); setApproving(false); return }
    const { error: e } = await supabase.from('complaint_logs').insert({ complaint_id: id, type: 'supervisor_comment', content: `差し戻し: ${supervisorComment.trim()}` })
    if (e) console.error('[handleReject]', e.message)
    setApproving(false)
    await fetchData()
  }

  // ── 改善報告書 否認 ──
  const handleCorrectionReject = async () => {
    if (!corrRejectReason.trim()) return
    setCorrRejecting(true)
    await supabase.from('complaint_logs').insert({ complaint_id: id, type: 'correction_rejected', content: corrRejectReason.trim() })
    await supabase.from('complaints').update({ status: 'correction_rejected', current_turn_started_at: new Date().toISOString() }).eq('id', id)
    setCorrRejecting(false)
    navigate(`/complaints/${id}`)
  }

  // ── 深掘り分析 提出 ──
  const canSubmit = rootCause.trim() && orgImprove.trim() && rootTheme && rootDetail.trim()
    && horizDepts.length > 0 && horizContent.trim()
    && actionAssignee.trim() && actionDeadline

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    const payload = {
      complaint_id: id,
      root_cause: rootCause, org_improvement: orgImprove, root_theme: rootTheme, root_detail: rootDetail,
      horizontal_departments: horizDepts, horizontal_content: horizContent,
      action_assignee: actionAssignee, action_deadline: actionDeadline || null, action_progress: actionProgress,
      author_name: currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name || null,
    }
    if (existing) {
      if (complaint.status === '役員再協議') {
        await supabase.from('complaint_logs').insert({
          complaint_id: id, type: 'deep_revision_snapshot',
          content: JSON.stringify({
            root_cause: existing.root_cause || '', root_theme: existing.root_theme || '',
            root_detail: existing.root_detail || '', org_improvement: existing.org_improvement || '',
            horizontal_departments: existing.horizontal_departments || [],
            horizontal_content: existing.horizontal_content || '',
            action_assignee: existing.action_assignee || '',
            action_deadline: existing.action_deadline || '',
            action_progress: existing.action_progress || '',
          })
        })
        await supabase.from('complaint_approvals')
          .update({ status: 'pending', comment: '', approved_at: null })
          .eq('complaint_id', id)
          .eq('status', 'rejected')
      }
      await supabase.from('complaint_deep_analysis').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('complaint_deep_analysis').insert(payload)
    }
    const APPROVERS = [
      { approver_name: '斎村 直樹',   approver_role: '専務取締役',           sort_order: 0 },
      { approver_name: '小笠原 久幸', approver_role: '取締役 工事部長',      sort_order: 1 },
      { approver_name: '榮藤 美香',   approver_role: '取締役 品質管理責任者', sort_order: 2 },
    ]
    const { data: existingApprovals } = await supabase.from('complaint_approvals').select('id').eq('complaint_id', id)
    if (!existingApprovals || existingApprovals.length === 0) {
      await supabase.from('complaint_approvals').insert(APPROVERS.map(a => ({ complaint_id: id, ...a, status: 'pending' })))
    }
    await supabase.from('complaints').update({ status: '深掘り提出', current_turn_started_at: new Date().toISOString() }).eq('id', id)
    setSubmitting(false)
    setDeepEditMode(false)
    await fetchData()
  }

  // ── 深掘り分析 承認（合同改善報告書として役員へ） ──
  const handleDeepApprove = async () => {
    setDeepActing(true)
    await supabase.from('complaint_logs').insert({ complaint_id: id, type: 'deep_approved', content: '合同改善報告書を役員に提出しました' })
    setDeepActing(false)
    setDeepSent(true)
  }

  // ── 深掘り分析 否認（差し戻し） ──
  const handleDeepReject = async () => {
    if (!deepRejectReason.trim()) return
    setDeepActing(true)
    await supabase.from('complaint_logs').insert({ complaint_id: id, type: 'deep_rejected', content: deepRejectReason.trim() })
    await supabase.from('complaint_approvals').delete().eq('complaint_id', id)
    if (existing) await supabase.from('complaint_deep_analysis').delete().eq('id', existing.id)
    const { error } = await supabase.from('complaints').update({ status: 'correction_rejected', current_turn_started_at: new Date().toISOString() }).eq('id', id)
    setDeepActing(false)
    if (error) { alert(`差し戻しに失敗しました: ${error.message}`); return }
    navigate(`/complaints/${id}`)
  }

  // ── 対応案承認済み コメント追加 ──
  const handleSupervisorComment = async () => {
    if (!newComment.trim()) return
    setSendingComment(true)
    const { data, error } = await supabase.from('complaint_logs').insert({ complaint_id: id, type: 'supervisor_comment', content: newComment.trim() }).select().single()
    setSendingComment(false)
    if (error) { alert(`送信に失敗しました: ${error.message}`); return }
    if (data) setSupervisorCommentLogs(prev => [...prev, data])
    setNewComment('')
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-gray-400">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mr-3" />読み込み中...
    </div>
  )
  if (!complaint) return (
    <div className="px-6 py-12 text-center text-gray-400"><p className="text-4xl mb-3">🌱</p><p>データが見つかりません</p></div>
  )

  const taCls = 'w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition resize-none'
  const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5'
  const guideCls = 'text-xs text-gray-400 mb-2 italic'
  const isApprovalPhase = ['是正案提出', '是正案再提出'].includes(complaint.status)
  const isRevision = complaint.status === '役員再協議'

  // タイマー（改善報告書の提出日時から24時間）
  const isDeepSubmitted = !!existing || complaint.status === '深掘り提出'
  const timerBase = correction?.created_at || complaint.supervisor_reported_at
  const TimerBanner = timerBase ? (() => {
    if (isDeepSubmitted) {
      const startMs = new Date(timerBase).getTime()
      const endMs = existing?.created_at ? new Date(existing.created_at).getTime() : Date.now()
      const totalMin = Math.floor((endMs - startMs) / 60000)
      const h = Math.floor(totalMin / 60); const m = totalMin % 60
      const elapsed = h > 0 ? `${h}時間${m}分` : `${m}分`
      return (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3 mb-5">
          <span className="text-xs font-semibold text-emerald-700">✅ 深掘り分析 提出済み</span>
          <span className="text-sm font-bold text-emerald-800">所要時間 {elapsed}</span>
        </div>
      )
    }
    const deadline = new Date(timerBase).getTime() + 24 * 60 * 60 * 1000
    const remaining = Math.floor((deadline - Date.now()) / 1000)
    const pad = n => String(Math.floor(Math.abs(n))).padStart(2, '0')
    if (remaining <= 0) {
      const over = -remaining
      return (
        <div className="flex items-center gap-3 bg-red-50 border border-red-300 rounded-2xl px-5 py-3 mb-5">
          <AlertTriangle size={16} className="text-red-600 shrink-0" />
          <span className="text-xs font-semibold text-red-700">提出期限超過</span>
          <span className="text-lg font-black tabular-nums text-red-700">
            +{pad(over / 3600)}:{pad((over % 3600) / 60)}:{pad(over % 60)}
          </span>
        </div>
      )
    }
    const h = pad(remaining / 3600); const m = pad((remaining % 3600) / 60); const s = pad(remaining % 60)
    const isRed = remaining < 6 * 3600; const isOrange = !isRed && remaining < 12 * 3600
    const bg    = isRed ? 'bg-red-50 border-red-300' : isOrange ? 'bg-orange-50 border-orange-300' : 'bg-amber-50 border-amber-200'
    const label = isRed ? 'text-red-700' : isOrange ? 'text-orange-700' : 'text-amber-700'
    const value = isRed ? 'text-red-700' : isOrange ? 'text-orange-800' : 'text-amber-800'
    return (
      <div className={`flex items-center gap-3 border rounded-2xl px-5 py-3 mb-5 ${bg}`}>
        {isRed && <AlertTriangle size={16} className="text-red-600 shrink-0" />}
        <span className={`text-xs font-semibold ${label}`}>{isRed ? '⚠️ 残り時間わずか' : isOrange ? '注意：残り時間' : '提出期限まで'}</span>
        <span className={`text-lg font-black tabular-nums ${value}`}>残り {h}:{m}:{s}</span>
      </div>
    )
  })() : null

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <button onClick={() => navigate(`/complaints/${id}`)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-5 transition-colors">
        <ArrowLeft size={15} /> クレーム詳細に戻る
      </button>

      {TimerBanner}

      {/* ヘッダー */}
      {!(isApprovalPhase && complaint.judgment === '手直し') && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
          <p className="text-lg font-bold text-gray-900 mb-0.5">
            {isApprovalPhase ? '✅ 対応案の確認・承認'
              : (complaint.status === '改善報告書提出' || (complaint.status === '是正案承認' && correction)) ? '📋 改善報告書（現象原因の特定）の確認・深掘り分析'
              : complaint.status === '深掘り提出' ? '🔍 深掘り分析の確認'
              : '🔍 深掘り・学習'}
          </p>
          <p className="text-sm text-gray-500">{complaint.client_name} — {complaint.site_name}</p>
        </div>
      )}

      {/* ── 対応案承認フェーズ ── */}
      {isApprovalPhase && (
        <>
          {complaint.status === '是正案再提出' && latestCorrectionReply && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 mb-4">
              <p className="text-xs font-semibold text-blue-700 mb-1">管理者からの返答（再提出）</p>
              <p className="text-sm text-gray-700 leading-relaxed">{latestCorrectionReply.content}</p>
              <p className="text-xs text-gray-400 mt-1.5">{fmtDateTime(latestCorrectionReply.created_at)}</p>
            </div>
          )}

          {complaint.judgment !== '手直し' && (
            <>
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5">
                <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800 leading-relaxed">
                  テキストだけでは伝わらない部分があります。<strong>必ず管理者と直接会話・電話で状況を確認してから</strong>判断してください。
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50">
                  <span className="text-sm font-bold text-gray-700">① 管理者の対応案</span>
                </div>
                <div className="p-5">
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2">お客様への連絡記録</p>
                    {contactLogs.length === 0
                      ? <p className="text-sm text-gray-400 italic">記録なし</p>
                      : contactLogs.map(log => (
                        <div key={log.id} className={cn('flex items-center gap-2 text-sm px-3 py-2 rounded-lg mb-1',
                          log.content === '繋がらず' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800')}>
                          <span>{log.content === '繋がらず' ? '🔴' : '✅'}</span>
                          <span className="flex-1">{log.content}</span>
                          <span className="text-xs text-gray-400">{fmtDateTime(log.created_at)}</span>
                        </div>
                      ))
                    }
                  </div>
                  <ReadRow label="作業者からの聞き取り" value={hearingText} />
                  {correction && (
                    <>
                      <ReadRow label="直接原因" value={correction.direct_cause} />
                      <ReadRow label="是正処置" value={correction.correction} />
                      <ReadRow label="運用改善案" value={correction.improvement} />
                    </>
                  )}
                </div>
              </div>

              {complaint.judgment && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl mb-4 overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-amber-200">
                    <span className="text-sm font-bold text-amber-900">📋 管理者からの報告</span>
                  </div>
                  <div className="p-5 space-y-3">
                    <p className="text-sm font-semibold text-amber-800">事業責任者へ確認</p>
                    {reportLog && (
                      <div className="bg-white rounded-xl px-4 py-3 text-sm text-gray-700 border border-amber-100 leading-relaxed">
                        {reportLog.content}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-100">
              <span className="text-sm font-bold text-gray-800">
                {complaint.judgment === '手直し' ? '事業責任者コメント' : '② 対応案の確認・承認'}
              </span>
            </div>
            <div className="p-5 space-y-3">
              {complaint.judgment === '手直し' ? (
                <>
                  <div>
                    <label className={labelCls}>コメント（任意）</label>
                    <textarea value={supervisorComment} onChange={e => setSupervisorComment(e.target.value)}
                      rows={3} placeholder="コメントを入力してください（任意）" className={taCls} />
                  </div>
                  <button type="button" onClick={handleApprove} disabled={approving}
                    className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm disabled:opacity-40">
                    {approving ? '処理中...' : '送信'}
                  </button>
                </>
              ) : approvalAction === null ? (
                <div className="flex gap-3">
                  <button type="button" onClick={() => setApprovalAction('reject')}
                    className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm">
                    否認（差し戻し）
                  </button>
                  <button type="button" onClick={() => setApprovalAction('approve')}
                    className="flex-1 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm">
                    承認
                  </button>
                </div>
              ) : approvalAction === 'reject' ? (
                <>
                  <div>
                    <label className={labelCls}>差し戻しのコメント <span className="text-red-500">*</span></label>
                    <textarea value={supervisorComment} onChange={e => setSupervisorComment(e.target.value)}
                      rows={3} placeholder="差し戻しの理由を入力してください" className={taCls} />
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => { setApprovalAction(null); setSupervisorComment('') }}
                      className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-gray-600 hover:bg-stone-50">
                      キャンセル
                    </button>
                    <button type="button" onClick={handleReject} disabled={approving || !supervisorComment.trim()}
                      className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm disabled:opacity-40">
                      {approving ? '処理中...' : '差し戻す'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className={labelCls}>コメント（任意）</label>
                    <textarea value={supervisorComment} onChange={e => setSupervisorComment(e.target.value)}
                      rows={3} placeholder="承認コメントを入力してください（任意）" className={taCls} />
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => { setApprovalAction(null); setSupervisorComment('') }}
                      className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-gray-600 hover:bg-stone-50">
                      キャンセル
                    </button>
                    <button type="button" onClick={handleApprove} disabled={approving}
                      className="flex-1 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm disabled:opacity-40">
                      {approving ? '処理中...' : '承認する'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── 対応案差し戻し済み ── */}
      {complaint.status === '是正案差し戻し' && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-4 mb-4">
          <p className="text-sm font-bold text-orange-800">⚠️ 対応案を差し戻し済みです</p>
          <p className="text-sm text-orange-700 mt-1">管理者の修正・再提出をお待ちください。</p>
          {complaint.supervisor_comment && (
            <div className="mt-3 bg-white rounded-xl px-4 py-3 text-sm text-gray-700 border border-orange-100">
              <p className="text-xs font-semibold text-gray-500 mb-1">差し戻しコメント</p>
              {complaint.supervisor_comment}
            </div>
          )}
        </div>
      )}

      {/* ── 対応案承認済み：コメントセクション（改善報告書未提出の場合のみ） ── */}
      {complaint.status === '是正案承認' && !correction && (
        <>
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 mb-4 flex items-center gap-2">
            <span className="text-green-700 font-bold text-sm">✅ 対応案を承認済み</span>
            {complaint.supervisor_comment && (
              <span className="text-xs text-green-600">— {complaint.supervisor_comment}</span>
            )}
          </div>
          <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-100">
              <span className="text-sm font-bold text-gray-800">事業責任者コメント</span>
            </div>
            <div className="p-5 space-y-3">
              {supervisorCommentLogs.length > 0 && (
                <div className="space-y-2">
                  {supervisorCommentLogs.map(log => (
                    <div key={log.id} className="bg-stone-50 rounded-xl px-4 py-3">
                      <p className="text-sm text-gray-700 leading-relaxed">{log.content}</p>
                      <p className="text-xs text-gray-400 mt-1.5">{fmtDateTime(log.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <label className={labelCls}>コメントを追加{supervisorCommentLogs.length === 0 ? '' : '（追記）'}</label>
                <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                  rows={3} placeholder="コメントを入力してください" className={taCls} />
              </div>
              <button type="button" onClick={handleSupervisorComment}
                disabled={sendingComment || !newComment.trim()}
                className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm disabled:opacity-40">
                {sendingComment ? '送信中...' : 'コメントを送信'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── 改善報告書提出フェーズ ── */}
      {(complaint.status === '改善報告書提出' || (complaint.status === '是正案承認' && correction) || (complaint.status === '深掘り提出' && !existing) || deepEditMode) && (
        <>
          {/* 改善報告書の内容 */}
          {correction && (
            <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50">
                <span className="text-sm font-bold text-gray-700">📋 改善報告書（現象原因の特定）の内容</span>
                <span className="text-xs text-gray-400 ml-2">提出日時：{fmtDateTime(correction.created_at)}</span>
              </div>
              <div className="p-5">
                <ReadRow label="直接原因" value={correction.direct_cause} />
                <ReadRow label="是正処置" value={correction.correction} />
                <ReadRow label="運用改善案" value={correction.improvement} />
              </div>
            </div>
          )}

          {/* 改善報告書の承認/否認 */}
          {!correctionApproved && (
            <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-stone-100">
                <span className="text-sm font-bold text-gray-800">改善報告書（現象原因の特定）の確認</span>
              </div>
              <div className="p-5 space-y-3">
                {!showCorrReject ? (
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowCorrReject(true)}
                      className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm">
                      否認（やり直し）
                    </button>
                    <button type="button" onClick={() => setCorrectionApproved(true)}
                      className="flex-1 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm">
                      承認して深掘り分析へ →
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-red-700">否認の理由を入力してください（必須）</p>
                    <textarea value={corrRejectReason} onChange={e => setCorrRejectReason(e.target.value)}
                      rows={3} placeholder="管理者が3時間以内に修正を提出してください" className={taCls} />
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setShowCorrReject(false)}
                        className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-gray-600 hover:bg-stone-50">
                        キャンセル
                      </button>
                      <button type="button" onClick={handleCorrectionReject}
                        disabled={corrRejecting || !corrRejectReason.trim()}
                        className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-40">
                        {corrRejecting ? '処理中...' : '否認して戻る'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 深掘り分析フォーム（承認後に表示） */}
          {correctionApproved && (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3 mb-5 flex items-center gap-2">
                <span className="text-emerald-700 font-bold text-sm">✅ 改善報告書を承認しました。深掘り分析を入力してください。</span>
              </div>

              {/* ── 真因：ソクラテス対話 ── */}
              <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden border-l-4 border-l-emerald-400">
                <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50">
                  <span className="text-sm font-bold text-gray-700">🤖 真因の深掘り</span>
                </div>
                <div className="p-5 space-y-5">
                  <p className="text-sm text-gray-600 leading-relaxed">
                    この問題の真因を考えてみましょう。個人の問題ではなく、<strong>仕組みや体制の観点</strong>で掘り下げていきます。
                  </p>

                  {/* Q1 */}
                  <div>
                    <p className="text-sm font-bold text-gray-800 mb-2">
                      なぜ今回のようなことが起きたと思いますか？<br />
                      <span className="text-xs font-normal text-gray-500">（個人ではなく、仕組みや体制の観点で）</span>
                    </p>
                    {rootPhase === 'q1' ? (
                      <div className="space-y-2">
                        <textarea value={rootInputs.q1} onChange={e => setRootInput('q1', e.target.value)}
                          rows={2} placeholder="回答を入力してください" className={taCls} />
                        <div className="flex justify-end">
                          <button type="button" onClick={submitRootQ1} disabled={!rootInputs.q1.trim()}
                            className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold disabled:opacity-40 transition-colors">
                            入力 →
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 bg-stone-50 rounded-xl px-4 py-2.5">
                        <p className="text-sm text-gray-700 flex-1">👤 {rootAnswers.q1}</p>
                        <button type="button" onClick={editRootQ1}
                          className="shrink-0 text-xs text-gray-400 hover:text-gray-700 underline transition-colors">修正</button>
                      </div>
                    )}
                  </div>

                  {/* Q2 */}
                  {rootPhase !== 'q1' && rootAnswers.q1 && (
                    <div>
                      <p className="text-sm font-bold text-gray-800 mb-2">
                        会社として何が足りなかったと思いますか？
                      </p>
                      {rootPhase === 'q2' ? (
                        <div className="space-y-2">
                          <textarea value={rootInputs.q2} onChange={e => setRootInput('q2', e.target.value)}
                            rows={2} placeholder="回答を入力してください" className={taCls} />
                          <div className="flex justify-end">
                            <button type="button" onClick={submitRootQ2} disabled={!rootInputs.q2.trim()}
                              className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold disabled:opacity-40 transition-colors">
                              入力 →
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3 bg-stone-50 rounded-xl px-4 py-2.5">
                          <p className="text-sm text-gray-700 flex-1">👤 {rootAnswers.q2}</p>
                          <button type="button" onClick={editRootQ2}
                            className="shrink-0 text-xs text-gray-400 hover:text-gray-700 underline transition-colors">修正</button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 最終確認 */}
                  {['final_check', 'retry', 'complete'].includes(rootPhase) && rootAnswers.q2 && (
                    <div className="space-y-3">
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <p className="text-sm font-bold text-amber-900">本当にそれが根本的な原因だと思いますか？</p>
                      </div>

                      {rootPhase === 'final_check' && (
                        <div className="flex gap-3">
                          <button type="button" onClick={() => { setRootInput('retry', ''); setRootPhase('retry') }}
                            className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-gray-600 hover:bg-stone-50 transition-colors">
                            いいえ、もう少し考えます
                          </button>
                          <button type="button" onClick={handleRootFinalYes}
                            className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-colors">
                            はい、これが真因です
                          </button>
                        </div>
                      )}

                      {/* 追加質問（いいえの場合） */}
                      {(rootPhase === 'retry' || (rootPhase === 'complete' && rootAnswers.retry)) && (
                        <div>
                          <p className="text-sm font-semibold text-gray-700 mb-2">では何が足りないと思いますか？</p>
                          {rootPhase === 'retry' ? (
                            <div className="space-y-2">
                              <textarea value={rootInputs.retry} onChange={e => setRootInput('retry', e.target.value)}
                                rows={2} placeholder="回答を入力してください" className={taCls} />
                              <div className="flex justify-end">
                                <button type="button" onClick={submitRootRetry} disabled={!rootInputs.retry.trim()}
                                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold disabled:opacity-40 transition-colors">
                                  入力 →
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-stone-50 rounded-xl px-4 py-2.5 text-sm text-gray-700">
                              👤 {rootAnswers.retry}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 完了 */}
                      {rootPhase === 'complete' && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                          <p className="text-sm font-bold text-emerald-800">✅ これが真因ですね。</p>
                          <p className="text-sm text-emerald-700 mt-1">対話の内容を真因として自動反映しました。</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm mb-4 p-5 space-y-4">
                {rootPhase === 'complete' && (
                  <div>
                    <label className={labelCls}>
                      真因 <span className="text-xs text-emerald-600 font-semibold ml-1">（深掘り対話から自動入力）</span>
                    </label>
                    <textarea value={rootCause} onChange={e => setRootCause(e.target.value)}
                      rows={3} className={taCls} />
                  </div>
                )}
                <div>
                  <label className={labelCls}>組織改善案 <span className="text-red-500">*</span></label>
                  <p className={guideCls}>会社として何を変えるか？</p>
                  <textarea value={orgImprove} onChange={e => setOrgImprove(e.target.value)}
                    rows={3} placeholder="例：全部署共通の作業前確認を策定し、月次で見直す体制を設ける"
                    className={taCls} />
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm mb-5 p-5 space-y-4">
                <div>
                  <label className={labelCls}>真因カテゴリー <span className="text-red-500">*</span></label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {ROOT_THEMES.map(theme => (
                      <button key={theme} type="button" onClick={() => setRootTheme(theme)}
                        className={cn('px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all',
                          rootTheme === theme
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-white text-gray-600 border-stone-200 hover:border-emerald-300 hover:bg-emerald-50')}>
                        {theme}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>真因詳細 <span className="text-red-500">*</span></label>
                  <textarea value={rootDetail} onChange={e => setRootDetail(e.target.value)}
                    rows={4} placeholder="例：キッチン引き出し清掃について、作業手順書には記載があったが現場での確認が省略されていた"
                    className={taCls} />
                </div>
              </div>

              {/* ■ 横展開 */}
              <div className="bg-white rounded-2xl shadow-sm mb-5 p-5 space-y-4">
                <p className="text-sm font-bold text-gray-800">📢 横展開</p>
                <div>
                  <label className={labelCls}>
                    対象部署 <span className="text-red-500">*</span>
                    <span className="ml-1 text-[11px] text-gray-400 font-normal">（自分の部署以外を選択）</span>
                  </label>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {DEPARTMENTS.map(dept => (
                      <label key={dept} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input type="checkbox" checked={horizDepts.includes(dept)}
                          onChange={e => setHorizDepts(prev => e.target.checked ? [...prev, dept] : prev.filter(d => d !== dept))}
                          className="w-4 h-4 accent-emerald-600" />
                        <span className="text-sm text-gray-700">{dept}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>周知内容 <span className="text-red-500">*</span></label>
                  <textarea value={horizContent} onChange={e => setHorizContent(e.target.value)}
                    rows={3} placeholder="例：今回の事象を全部署に共有し、養生作業前の確認手順を徹底するよう周知する"
                    className={taCls} />
                </div>
              </div>

              {/* ■ 真因対策 */}
              <div className="bg-white rounded-2xl shadow-sm mb-5 p-5 space-y-4">
                <p className="text-sm font-bold text-gray-800">🎯 真因対策</p>
                <div>
                  <label className={labelCls}>担当者 <span className="text-red-500">*</span></label>
                  <input type="text" value={actionAssignee} onChange={e => setActionAssignee(e.target.value)}
                    placeholder="例：山田 太郎"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
                </div>
                <div>
                  <label className={labelCls}>期限 <span className="text-red-500">*</span></label>
                  <input type="date" value={actionDeadline} onChange={e => setActionDeadline(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
                  {actionDeadline && (() => {
                    const today = new Date(); today.setHours(0, 0, 0, 0)
                    const dl = new Date(actionDeadline); dl.setHours(0, 0, 0, 0)
                    const diff = Math.round((dl - today) / 86400000)
                    return diff < 0
                      ? <p className="text-xs text-red-600 font-bold mt-1.5">{Math.abs(diff)}日超過</p>
                      : diff === 0
                        ? <p className="text-xs text-orange-600 font-bold mt-1.5">本日期限</p>
                        : <p className="text-xs text-emerald-700 font-semibold mt-1.5">残り {diff} 日</p>
                  })()}
                </div>
                <div>
                  <label className={labelCls}>進捗状況 <span className="text-red-500">*</span></label>
                  <div className="flex gap-5 mt-1">
                    {['未着手', '進行中', '完了'].map(p => (
                      <label key={p} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input type="radio" name="deep_action_progress" value={p} checked={actionProgress === p}
                          onChange={() => setActionProgress(p)}
                          className="accent-emerald-600" />
                        <span className={cn('text-sm font-semibold',
                          p === '完了' ? 'text-emerald-700' : p === '進行中' ? 'text-blue-700' : 'text-gray-500')}>
                          {p}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pb-8">
                <button type="button" onClick={() => {
                  setRootCause(''); setOrgImprove(''); setRootTheme(''); setRootDetail('')
                  setHorizDepts([]); setHorizContent('')
                  setActionAssignee(''); setActionDeadline(''); setActionProgress('未着手')
                }}
                  className="px-5 h-12 rounded-xl border border-stone-200 text-sm font-semibold text-gray-600 hover:bg-stone-50">
                  クリア
                </button>
                <button type="button" onClick={handleSubmit} disabled={submitting || !canSubmit}
                  className="flex-1 h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold disabled:opacity-40">
                  {submitting ? '送信中...' : '深掘り分析を提出'}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* ── 深掘り提出済み：合同改善報告書プレビュー ── */}
      {complaint.status === '深掘り提出' && existing && !deepEditMode && (
        <>
          {/* プレビュー */}
          <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50 flex items-center gap-2">
              <span className="text-sm font-bold text-gray-700">📄 合同改善報告書プレビュー</span>
              <span className="text-xs text-gray-400">役員に提出される内容</span>
            </div>
            <div className="p-5 space-y-5 text-sm">

              {/* ■ クレーム概要 */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 border-b border-stone-100 pb-1">■ クレーム概要</p>
                <div className="space-y-1.5 text-gray-700">
                  <p>・発生日：{fmtDateTime(complaint.created_at)}</p>
                  <p>・現場：{complaint.site_name || '—'}</p>
                  <p>・クレーム内容：{complaint.content || '—'}</p>
                  <p>・感情レベル：Lv.{complaint.emotion_level || '—'}</p>
                </div>
              </div>

              {/* ■ 対応の顛末 */}
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

              {/* ■ 事業責任者確認 */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 border-b border-stone-100 pb-1">■ 事業責任者確認</p>
                <div className="space-y-1.5 text-gray-700">
                  <p>・結果：承認</p>
                  <p>・コメント：{supervisorCommentLogs.length > 0
                    ? supervisorCommentLogs[0].content
                    : (complaint.supervisor_comment || '—')}</p>
                </div>
              </div>

              {/* ■ 改善報告書（管理者） */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 border-b border-stone-100 pb-1">■ 改善報告書（管理者）</p>
                <div className="space-y-1.5 text-gray-700">
                  <p>・直接原因：{correction?.direct_cause || '—'}</p>
                  <p>・是正処置：{correction?.correction || '—'}</p>
                  <p>・運用改善案：{correction?.improvement || '—'}</p>
                </div>
              </div>

              {/* ■ 深掘り分析（事業責任者） */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 border-b border-stone-100 pb-1">■ 深掘り分析（事業責任者）</p>
                <div className="space-y-1.5 text-gray-700">
                  <p>・真因：{existing.root_cause || '—'}</p>
                  <p>・真因カテゴリー：{existing.root_theme || '—'}</p>
                  <p>・真因詳細：{existing.root_detail || '—'}</p>
                  <p>・組織改善案：{existing.org_improvement || '—'}</p>
                  <p>・横展開対象部署：{Array.isArray(existing.horizontal_departments) && existing.horizontal_departments.length > 0 ? existing.horizontal_departments.join('・') : '—'}</p>
                  <p>・周知内容：{existing.horizontal_content || '—'}</p>
                  <p>・真因対策 担当者：{existing.action_assignee || '—'}</p>
                  <p>・真因対策 期限：{existing.action_deadline || '—'}</p>
                  <p>・真因対策 進捗：{existing.action_progress || '—'}</p>
                </div>
              </div>

            </div>
          </div>

          {/* 確認アクション */}
          <div className="bg-white rounded-2xl shadow-sm mb-8 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-100">
              <span className="text-sm font-bold text-gray-800">役員への報告確認</span>
            </div>
            <div className="p-5 space-y-4">
              {deepSent ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <p className="text-2xl">✅</p>
                  <p className="text-base font-bold text-emerald-700">役員へ提出しました。</p>
                  <button type="button" onClick={() => navigate(`/complaints/${id}`)}
                    className="mt-2 px-6 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-gray-600 hover:bg-stone-50 transition-colors">
                    クレーム詳細に戻る
                  </button>
                </div>
              ) : !showDeepReject ? (
                <>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    この内容を合同改善報告書として役員に報告しますか？
                  </p>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setDeepEditMode(true)}
                      className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors">
                      いいえ（再度修正）
                    </button>
                    <button type="button" onClick={handleDeepApprove} disabled={deepActing}
                      className="flex-1 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm disabled:opacity-40 transition-colors">
                      {deepActing ? '処理中...' : 'はい（送信）'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-red-700">差し戻しの理由を入力してください（必須）</p>
                  <textarea value={deepRejectReason} onChange={e => setDeepRejectReason(e.target.value)}
                    rows={3} placeholder="深掘り分析を再入力するよう指示してください" className={taCls} />
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowDeepReject(false)}
                      className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-gray-600 hover:bg-stone-50 transition-colors">
                      キャンセル
                    </button>
                    <button type="button" onClick={handleDeepReject}
                      disabled={deepActing || !deepRejectReason.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-40 transition-colors">
                      {deepActing ? '処理中...' : '否認して戻る'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── 役員再協議：修正フォーム ── */}
      {isRevision && (
        <>
          {/* 差し戻し通知 */}
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-5">
            <p className="text-sm font-bold text-red-700 mb-1">⚠️ 役員から差し戻しがありました</p>
            <p className="text-sm text-red-600 mb-3">合同改善報告書を修正して再提出してください。再提出後、役員全員に再承認依頼が送信されます。</p>
            {rejectedApprovals.length > 0 && (
              <div className="space-y-2">
                {rejectedApprovals.map(a => (
                  <div key={a.id} className="bg-white rounded-xl border border-red-200 px-4 py-2.5">
                    <p className="text-xs font-semibold text-red-600 mb-0.5">{a.approver_name}（{a.approver_role}）</p>
                    <p className="text-sm text-gray-700">{a.comment || '（コメントなし）'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 修正フォーム（差分ハイライト付き） */}
          <div className="bg-white rounded-2xl shadow-sm mb-4 p-5 space-y-5">
            <p className="text-sm font-bold text-gray-800">🔍 深掘り分析の修正</p>

            {[
              { label: '真因', key: 'root_cause', val: rootCause, set: setRootCause, rows: 3 },
              { label: '組織改善案', key: 'org_improvement', val: orgImprove, set: setOrgImprove, rows: 3 },
              { label: '真因詳細', key: 'root_detail', val: rootDetail, set: setRootDetail, rows: 4 },
            ].map(({ label, key, val, set, rows }) => {
              const prev = existing?.[key] || ''
              const changed = prev !== val
              return (
                <div key={key}>
                  <label className={labelCls}>{label} <span className="text-red-500">*</span></label>
                  {changed && prev && (
                    <div className="text-xs bg-yellow-100 border border-yellow-300 rounded-xl px-3 py-1.5 mb-1.5 text-yellow-800">
                      <span className="font-semibold">変更前：</span>{prev}
                    </div>
                  )}
                  <textarea value={val} onChange={e => set(e.target.value)} rows={rows}
                    className={cn(taCls, changed && prev !== undefined ? 'border-yellow-400 bg-yellow-50' : '')} />
                </div>
              )
            })}

            {/* 真因カテゴリー */}
            {(() => {
              const prev = existing?.root_theme || ''
              const changed = prev !== rootTheme
              return (
                <div>
                  <label className={labelCls}>真因カテゴリー <span className="text-red-500">*</span></label>
                  {changed && prev && (
                    <div className="text-xs bg-yellow-100 border border-yellow-300 rounded-xl px-3 py-1.5 mb-1.5 text-yellow-800">
                      <span className="font-semibold">変更前：</span>{prev}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {ROOT_THEMES.map(theme => (
                      <button key={theme} type="button" onClick={() => setRootTheme(theme)}
                        className={cn('px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all',
                          rootTheme === theme
                            ? (changed ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-emerald-700 text-white border-emerald-700')
                            : 'bg-white text-gray-600 border-stone-200 hover:border-emerald-300 hover:bg-emerald-50')}>
                        {theme}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* 横展開 */}
          <div className="bg-white rounded-2xl shadow-sm mb-4 p-5 space-y-4">
            <p className="text-sm font-bold text-gray-800">📢 横展開</p>
            {(() => {
              const prevDepts = [...(existing?.horizontal_departments || [])].sort().join(',')
              const currDepts = [...horizDepts].sort().join(',')
              const changed = prevDepts !== currDepts
              return (
                <div>
                  <label className={labelCls}>対象部署 <span className="text-red-500">*</span></label>
                  {changed && (
                    <div className="text-xs bg-yellow-100 border border-yellow-300 rounded-xl px-3 py-1.5 mb-1.5 text-yellow-800">
                      <span className="font-semibold">変更前：</span>{existing?.horizontal_departments?.join('・') || '（なし）'}
                    </div>
                  )}
                  <div className={cn('flex flex-wrap gap-3 mt-2 p-3 rounded-xl', changed ? 'bg-yellow-50 border border-yellow-300' : '')}>
                    {DEPARTMENTS.map(dept => (
                      <label key={dept} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input type="checkbox" checked={horizDepts.includes(dept)}
                          onChange={e => setHorizDepts(prev => e.target.checked ? [...prev, dept] : prev.filter(d => d !== dept))}
                          className="w-4 h-4 accent-emerald-600" />
                        <span className="text-sm text-gray-700">{dept}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })()}
            {(() => {
              const prev = existing?.horizontal_content || ''
              const changed = prev !== horizContent
              return (
                <div>
                  <label className={labelCls}>周知内容 <span className="text-red-500">*</span></label>
                  {changed && prev && (
                    <div className="text-xs bg-yellow-100 border border-yellow-300 rounded-xl px-3 py-1.5 mb-1.5 text-yellow-800">
                      <span className="font-semibold">変更前：</span>{prev}
                    </div>
                  )}
                  <textarea value={horizContent} onChange={e => setHorizContent(e.target.value)}
                    rows={3} className={cn(taCls, changed && prev ? 'border-yellow-400 bg-yellow-50' : '')} />
                </div>
              )
            })()}
          </div>

          {/* 真因対策 */}
          <div className="bg-white rounded-2xl shadow-sm mb-5 p-5 space-y-4">
            <p className="text-sm font-bold text-gray-800">🎯 真因対策</p>
            {(() => {
              const prev = existing?.action_assignee || ''
              const changed = prev !== actionAssignee
              return (
                <div>
                  <label className={labelCls}>担当者 <span className="text-red-500">*</span></label>
                  {changed && prev && (
                    <div className="text-xs bg-yellow-100 border border-yellow-300 rounded-xl px-3 py-1.5 mb-1.5 text-yellow-800">
                      <span className="font-semibold">変更前：</span>{prev}
                    </div>
                  )}
                  <input type="text" value={actionAssignee} onChange={e => setActionAssignee(e.target.value)}
                    placeholder="例：山田 太郎"
                    className={cn('w-full px-3 py-2.5 rounded-xl border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition',
                      changed && prev ? 'border-yellow-400 bg-yellow-50' : 'border-stone-200')} />
                </div>
              )
            })()}
            {(() => {
              const prev = existing?.action_deadline || ''
              const changed = prev !== actionDeadline
              return (
                <div>
                  <label className={labelCls}>期限 <span className="text-red-500">*</span></label>
                  {changed && prev && (
                    <div className="text-xs bg-yellow-100 border border-yellow-300 rounded-xl px-3 py-1.5 mb-1.5 text-yellow-800">
                      <span className="font-semibold">変更前：</span>{prev}
                    </div>
                  )}
                  <input type="date" value={actionDeadline} onChange={e => setActionDeadline(e.target.value)}
                    className={cn('w-full px-3 py-2.5 rounded-xl border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition',
                      changed && prev ? 'border-yellow-400 bg-yellow-50' : 'border-stone-200')} />
                </div>
              )
            })()}
            {(() => {
              const prev = existing?.action_progress || ''
              const changed = prev !== actionProgress
              return (
                <div>
                  <label className={labelCls}>進捗状況 <span className="text-red-500">*</span></label>
                  {changed && prev && (
                    <div className="text-xs bg-yellow-100 border border-yellow-300 rounded-xl px-3 py-1.5 mb-1.5 text-yellow-800">
                      <span className="font-semibold">変更前：</span>{prev}
                    </div>
                  )}
                  <div className={cn('flex gap-5 mt-1 p-2 rounded-xl', changed ? 'bg-yellow-50' : '')}>
                    {['未着手', '進行中', '完了'].map(p => (
                      <label key={p} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input type="radio" name="revision_action_progress" value={p} checked={actionProgress === p}
                          onChange={() => setActionProgress(p)} className="accent-emerald-600" />
                        <span className={cn('text-sm font-semibold',
                          p === '完了' ? 'text-emerald-700' : p === '進行中' ? 'text-blue-700' : 'text-gray-500')}>
                          {p}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>

          <div className="pb-8">
            <button type="button" onClick={handleSubmit} disabled={submitting || !canSubmit}
              className="w-full h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold disabled:opacity-40 transition-colors">
              {submitting ? '送信中...' : '修正して再提出 →'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
