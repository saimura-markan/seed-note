import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { cn, getRole, calcDeadlineMinutes, fmtCountdown } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const STEPS = ['受付', '対応中', '事業責任者確認', '改善報告書', '深掘り', '役員承認', '周知完了']

function statusToStep(status) {
  const map = {
    '受付済': 0,
    '対応中': 1,
    '是正案提出': 2, '是正案差し戻し': 2, '是正案再提出': 2, '是正案承認': 2,
    '改善報告書提出': 3, 'correction_rejected': 3, 'report_rejected': 3, 'supervisor_check': 3,
    '深掘り提出': 5, '役員再協議': 5,
    '承認完了': 6,
  }
  return map[status] ?? 0
}

const PRIORITY = {
  5: { label: '最高緊張', bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-l-red-400' },
  4: { label: '緊張',     bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-l-orange-400' },
  3: { label: '注意',     bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-l-amber-400' },
  2: { label: 'やや',     bg: 'bg-lime-100',   text: 'text-lime-700',   border: 'border-l-lime-400' },
  1: { label: '穏やか',   bg: 'bg-emerald-100',text: 'text-emerald-700',border: 'border-l-emerald-400' },
}

const pad = n => String(Math.floor(Math.abs(n))).padStart(2, '0')

function calcElapsed(receivedAt, firstContactAt) {
  if (!receivedAt || !firstContactAt) return null
  const elapsed = (new Date(firstContactAt) - new Date(receivedAt)) / 1000
  return `${pad(elapsed / 60)}:${pad(elapsed % 60)}`
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDateTimeWithElapsed(iso, baseIso) {
  if (!iso || !baseIso) return fmtDateTime(iso)
  const elapsedMin = Math.floor((new Date(iso) - new Date(baseIso)) / 60000)
  return `${fmtDateTime(iso)} (+${elapsedMin}分)`
}

function ProgressBar({ status }) {
  const step = statusToStep(status)
  return (
    <div className="bg-white rounded-2xl shadow-sm px-6 py-4 mb-5">
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const done = i < step; const current = i === step
          return (
            <div key={s} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center shrink-0">
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                  done    ? 'bg-emerald-600 border-emerald-600 text-white' :
                  current ? 'bg-white border-emerald-600 text-emerald-700 ring-2 ring-emerald-200' :
                  'bg-white border-stone-200 text-stone-400'
                )}>
                  {done ? '✓' : i + 1}
                </div>
                <span className={cn('text-[10px] mt-1 text-center leading-tight whitespace-nowrap',
                  current ? 'text-emerald-700 font-bold' : done ? 'text-emerald-500' : 'text-stone-400')}>
                  {s}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn('flex-1 h-0.5 mx-1 mt-[-14px]', done ? 'bg-emerald-500' : 'bg-stone-200')} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LockedStep({ num, title }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-l-stone-200 opacity-50">
      <div className="px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-stone-200 text-stone-400">{num}</div>
          <span className="text-sm font-bold text-stone-400">{title}</span>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-stone-100 text-stone-400">🔒</span>
      </div>
      <div className="mx-5 mb-3 px-4 py-2">
        <p className="text-sm text-stone-400">前のステップが完了すると表示されます</p>
      </div>
    </div>
  )
}

function StatusRow({ label, value, done }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-stone-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={cn(
        'text-xs font-bold px-2.5 py-1 rounded-full',
        done ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'
      )}>
        {done ? '✓ ' : ''}{value}
      </span>
    </div>
  )
}

export default function ComplaintOverview() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [complaint,    setComplaint]    = useState(null)
  const [contactLogs,  setContactLogs]  = useState([])
  const [hearingLogs,  setHearingLogs]  = useState([])
  const [contactCount, setContactCount] = useState(0)
  const [hasHearing,   setHasHearing]   = useState(false)
  const [correction,          setCorrection]          = useState(null)
  const [reportLog,           setReportLog]           = useState(null)
  const [supervisorCommentLogs, setSupervisorCommentLogs] = useState([])
  const [deepAnalysis,        setDeepAnalysis]        = useState(null)
  const [approvals,    setApprovals]    = useState([])
  const [latestCorrectionReply, setLatestCorrectionReply] = useState(null)
  const [replyText,    setReplyText]    = useState('')
  const [replySending, setReplySending] = useState(false)
  const [resubmitActing,        setResubmitActing]        = useState(false)
  const [showResubmitReject,    setShowResubmitReject]    = useState(false)
  const [resubmitRejectComment, setResubmitRejectComment] = useState('')
  const [negotiationComment,    setNegotiationComment]    = useState('')
  const [negotiationSending,    setNegotiationSending]    = useState(false)
  const [negotiationReplies,    setNegotiationReplies]    = useState([])
  const [correctionRejectedLog, setCorrectionRejectedLog] = useState(null)
  const [userRole,     setUserRole]     = useState(null)
  const [currentUser,  setCurrentUser]  = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [tick,         setTick]         = useState(0)

  // 毎分 tick を更新 → 残り時間表示を自動再計算
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      const role = getRole(u)
      console.log('[ComplaintOverview] userRole:', role, '| raw meta:', u?.app_metadata)
      setUserRole(role)
      setCurrentUser(u)
    })
  }, [])

  const fetchData = useCallback(async () => {
    const [{ data: c }, { data: logs }, { data: corr }, { data: deep }, { data: appr }] = await Promise.all([
      supabase.from('complaints').select('*').eq('id', id).maybeSingle(),
      supabase.from('complaint_logs').select('*').eq('complaint_id', id).order('created_at'),
      supabase.from('complaint_corrections').select('*').eq('complaint_id', id).order('created_at').limit(1),
      supabase.from('complaint_deep_analysis').select('*').eq('complaint_id', id).order('created_at').limit(1),
      supabase.from('complaint_approvals').select('status, approver_name, approver_role, comment, approved_at').eq('complaint_id', id).order('sort_order'),
    ])
    if (c) setComplaint(c)
    if (logs) {
      const cLogs = logs.filter(l => l.type === 'contact')
      const hLogs = logs.filter(l => l.type === 'hearing')
      const rLog  = logs.filter(l => l.type === 'report').pop()
      setContactLogs(cLogs)
      setHearingLogs(hLogs)
      setContactCount(cLogs.length)
      setHasHearing(hLogs.length > 0)
      if (rLog) setReportLog(rLog)
      setSupervisorCommentLogs(logs.filter(l => l.type === 'supervisor_comment'))
      const replyLog = logs.filter(l => l.type === 'correction_reply').pop()
      if (replyLog) setLatestCorrectionReply(replyLog)
      setNegotiationReplies(logs.filter(l => l.type === 'negotiation_reply'))
      const rejLog = logs.filter(l => l.type === 'correction_rejected').pop()
      if (rejLog) setCorrectionRejectedLog(rejLog)
    }
    if (corr && corr[0]) setCorrection(corr[0])
    if (deep && deep[0]) setDeepAnalysis(deep[0])
    if (appr) setApprovals(appr)
    console.log('[ComplaintOverview] fetchData:', {
      status: c?.status,
      correction: corr?.[0] ? '存在' : 'なし',
      deepAnalysis: deep?.[0] ? '存在' : 'なし',
    })
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const handleResubmitApprove = async () => {
    setResubmitActing(true)
    const now = new Date().toISOString()
    await supabase.from('complaints').update({
      status: '是正案承認', supervisor_approved_at: now, current_turn_started_at: now,
    }).eq('id', id)
    await supabase.from('complaint_logs').insert({
      complaint_id: id, type: 'supervisor_comment', content: '承認（再提出）'
    })
    setResubmitActing(false)
    fetchData()
  }

  const handleResubmitReject = async () => {
    if (!resubmitRejectComment.trim()) return
    setResubmitActing(true)
    await supabase.from('complaints').update({
      status: '是正案差し戻し', supervisor_comment: resubmitRejectComment.trim(),
      current_turn_started_at: new Date().toISOString(),
    }).eq('id', id)
    await supabase.from('complaint_logs').insert({
      complaint_id: id, type: 'supervisor_comment', content: `差し戻し: ${resubmitRejectComment.trim()}`
    })
    setResubmitActing(false)
    setShowResubmitReject(false)
    setResubmitRejectComment('')
    fetchData()
  }

  const handleSendReply = async () => {
    if (!replyText.trim()) return
    setReplySending(true)
    await supabase.from('complaint_logs').insert({
      complaint_id: id, type: 'correction_reply', content: replyText.trim()
    })
    await supabase.from('complaints').update({
      status: '是正案再提出', current_turn_started_at: new Date().toISOString()
    }).eq('id', id)
    setReplySending(false)
    setReplyText('')
    fetchData()
  }

  const handleSupervisorCheckApprove = async () => {
    await supabase.from('complaint_approvals')
      .update({ status: 'pending', approved_at: null })
      .eq('complaint_id', id)
      .eq('status', 'rejected')
    await supabase.from('complaints').update({
      status: '深掘り提出', current_turn_started_at: new Date().toISOString(),
    }).eq('id', id)
    fetchData()
  }

  const handleNegotiationReply = async () => {
    if (!negotiationComment.trim()) return
    setNegotiationSending(true)
    await supabase.from('complaint_logs').insert({
      complaint_id: id, type: 'negotiation_reply', content: negotiationComment.trim(),
    })
    await supabase.from('complaint_approvals')
      .update({ status: 'pending', approved_at: null })
      .eq('complaint_id', id)
      .eq('status', 'rejected')
    await supabase.from('complaints').update({
      status: '深掘り提出', current_turn_started_at: new Date().toISOString(),
    }).eq('id', id)
    setNegotiationSending(false)
    setNegotiationComment('')
    fetchData()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-gray-400">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mr-3" />読み込み中...
    </div>
  )
  if (!complaint) return (
    <div className="px-6 py-12 text-center text-gray-400"><p className="text-4xl mb-3">🌱</p><p>データが見つかりません</p></div>
  )

  const pc = PRIORITY[complaint.emotion_level] ?? PRIORITY[3]
  const approvedCount = approvals.filter(a => a.status === 'approved').length
  const supervisorConfirmed = supervisorCommentLogs.length > 0 || !!complaint.supervisor_comment

  const PAST_STEP4 = ['是正案提出', '是正案差し戻し', '是正案再提出', '是正案承認', '改善報告書提出', 'correction_rejected', 'report_rejected', 'supervisor_check', '深掘り提出', '承認完了']
  const PAST_STEP5 = ['是正案承認', '改善報告書提出', 'correction_rejected', 'report_rejected', 'supervisor_check', '深掘り提出', '承認完了']
  const PAST_STEP6 = ['改善報告書提出', '深掘り提出', '役員再協議', '承認完了']
  const step2Locked = contactLogs.length === 0
  const step3Locked = !hasHearing
  const step4Locked = !PAST_STEP4.includes(complaint.status)
  const step5Locked = !PAST_STEP5.includes(complaint.status)
  const step6Locked = !PAST_STEP6.includes(complaint.status)
  const step7Locked = !deepAnalysis

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <button onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-5 transition-colors">
        <ArrowLeft size={15} /> ダッシュボードに戻る
      </button>

      <h2 className="text-lg font-bold text-gray-900 mb-1">クレーム詳細</h2>

      <ProgressBar status={complaint.status} />

      {/* 基本情報 */}
      <div className={cn('bg-white rounded-2xl shadow-sm mb-5 p-5 border-l-4', pc.border)}>
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-mono text-gray-400">{complaint.id?.slice(0, 8).toUpperCase()}</span>
              <span className={cn('text-xs font-bold px-2.5 py-0.5 rounded-full', pc.bg, pc.text)}>
                Lv.{complaint.emotion_level} {pc.label}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold border border-red-200">
                🚨 クレーム
              </span>
            </div>
            <p className="font-bold text-gray-900 text-[17px] leading-snug">{complaint.client_name || '—'}</p>
            <p className="text-sm text-gray-500 mt-0.5">{complaint.site_name}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs text-gray-500">
          <span>担当：<strong className="text-gray-700">{complaint.assignee || '—'}</strong></span>
          <span>現場作業者：<strong className="text-gray-700">{complaint.worker_name || '—'}</strong></span>
          <span>作業日：<strong className="text-gray-700">{complaint.work_date || '—'}</strong></span>
          {complaint.call_completed_at ? (() => {
            const diffSec = Math.floor((new Date(complaint.call_completed_at) - new Date(complaint.received_at)) / 1000)
            const elapsed = diffSec < 60 ? `${diffSec}秒後` : `${Math.floor(diffSec / 60)}分後`
            return (
              <span className="col-span-2">
                受付 {fmtDateTime(complaint.received_at)}
                <span className="mx-1 text-gray-400">→</span>
                主任引継 <strong className="text-gray-700">{fmtDateTime(complaint.call_completed_at)}</strong>
                <span className="ml-1 text-emerald-600 font-semibold">（{elapsed}）</span>
              </span>
            )
          })() : (
            <span>受付：{fmtDateTime(complaint.received_at)}</span>
          )}
          <span>ステータス：<strong className="text-gray-700">{complaint.status.replace('是正案', '対応案')}</strong></span>
        </div>
        {complaint.content && (
          <div className="mt-3 pt-3 border-t border-stone-100">
            <p className="text-xs text-gray-400 mb-1">クレーム内容</p>
            <p className="text-sm text-gray-700 leading-relaxed">{complaint.content}</p>
          </div>
        )}
      </div>

      {/* セクション状態一覧 */}
      <div className="space-y-3 mb-5">

        {/* ① お客様への連絡 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-l-teal-400">
          <div className="px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold', contactCount > 0 ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-500')}>1</div>
              <span className="text-sm font-bold text-gray-800">お客様への連絡記録</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', contactCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'text-stone-400')}>{contactCount > 0 ? `${contactCount}件記録済` : '未記録'}</span>
              {contactLogs.length > 0 && (() => {
                const elapsed = calcElapsed(complaint.received_at, contactLogs[0].created_at)
                return elapsed ? (
                  <div className="shrink-0 text-right text-emerald-700">
                    <div className="text-[26px] font-black tabular-nums leading-none">{elapsed}</div>
                    <div className="text-[11px] mt-0.5">初回連絡まで（記録済）</div>
                  </div>
                ) : null
              })()}
            </div>
          </div>
          <div className="mx-5 mb-4 bg-stone-50 rounded-xl px-4 py-3">
            {contactLogs.length > 0 ? (
              <div className="space-y-2">
                {contactLogs.map(log => (
                  <div key={log.id} className={cn(
                    'flex items-start gap-3 px-3 py-2 rounded-lg text-sm border',
                    log.content === '繋がらず' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  )}>
                    <span className="font-bold shrink-0">{log.content === '繋がらず' ? '🔴' : '✅'}</span>
                    <span className="flex-1">{log.content}</span>
                    <span className="text-[11px] text-gray-400 shrink-0">{fmtDateTimeWithElapsed(log.created_at, complaint.received_at)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">まだ連絡が記録されていません。</p>
            )}
          </div>
          {contactLogs.length === 0 && userRole !== 'staff' && (
            <div className="mx-5 mb-4">
              <button onClick={() => navigate(`/complaints/${id}/detail`)}
                className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2">
                対応入力 →
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* ② 聞き取り */}
        {step2Locked ? <LockedStep num="2" title="作業者からの聞き取り" /> : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-l-blue-400">
          <div className="px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold', hasHearing ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-500')}>2</div>
              <span className="text-sm font-bold text-gray-800">作業者からの聞き取り</span>
            </div>
            <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', hasHearing ? 'bg-emerald-100 text-emerald-700' : 'text-stone-400')}>{hasHearing ? '記録済' : '未記録'}</span>
          </div>
          <div className="mx-5 mb-4 bg-stone-50 rounded-xl px-4 py-3">
            {hearingLogs.length > 0 ? (
              <div className="space-y-2">
                {hearingLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 px-3 py-2 rounded-lg text-sm border bg-emerald-50 border-emerald-200 text-emerald-800">
                    <span className="font-bold shrink-0">✅</span>
                    <span className="flex-1">{log.content}</span>
                    <span className="text-[11px] text-gray-400 shrink-0">{fmtDateTime(log.created_at)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">まだ記録されていません。</p>
            )}
          </div>
        </div>
        )}

        {/* ③ 対応案 */}
        {step3Locked ? <LockedStep num="3" title="対応案" /> : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-l-violet-400">
          <div className="px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold', reportLog ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-500')}>3</div>
              <span className="text-sm font-bold text-gray-800">対応案</span>
            </div>
            <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', reportLog ? 'bg-emerald-100 text-emerald-700' : 'text-stone-400')}>{reportLog ? '提出済' : '提出待ち'}</span>
          </div>
          <div className="mx-5 mb-4 bg-stone-50 rounded-xl px-4 py-3">
            {reportLog ? (
              <p className="text-sm text-gray-700">{reportLog.content}</p>
            ) : (
              <p className="text-sm text-gray-400">対応案の提出待ちです。</p>
            )}
          </div>
          {!reportLog && !correction && ['manager', 'admin'].includes(userRole) && ['受付済', '対応中'].includes(complaint.status) && (
            <div className="mx-5 mb-4">
              <button onClick={() => navigate(`/complaints/${id}/correction`)}
                className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition-colors">
                対応案を作成・提出 →
              </button>
            </div>
          )}
        </div>
        )}

        {/* ④ 事業責任者確認 */}
        {step4Locked ? <LockedStep num="4" title="事業責任者確認" /> : (() => {
          const hasLogs    = supervisorCommentLogs.length > 0
          // logsがある場合は supervisor_comment を表示しない（重複防止）
          const showLegacy = !hasLogs && !!complaint.supervisor_comment
          const confirmed  = hasLogs || showLegacy
          // 承認時刻：complaints.supervisor_approved_at → 最新のsupervisor_commentログ順にフォールバック
          const approvedAt = complaint.supervisor_approved_at
            || supervisorCommentLogs.filter(l => !l.content?.startsWith('差し戻し')).pop()?.created_at
            || null
          return (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-l-amber-400">
          <div className="px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold', confirmed ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-500')}>4</div>
              <span className="text-sm font-bold text-gray-800">事業責任者確認</span>
            </div>
            {confirmed ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                ✅ 承認済み{approvedAt ? `：${fmtDateTime(approvedAt)}` : ''}
              </span>
            ) : (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full text-stone-400">未記録</span>
            )}
          </div>
          <div className="mx-5 mb-4 bg-stone-50 rounded-xl px-4 py-3">
            {hasLogs ? (
              <div className="space-y-2">
                {supervisorCommentLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 px-3 py-2 rounded-lg text-sm border bg-amber-50 border-amber-200 text-amber-900">
                    <span className="font-bold shrink-0">💬</span>
                    <span className="flex-1">{log.content}</span>
                    <span className="text-[11px] text-gray-400 shrink-0">{fmtDateTime(log.created_at)}</span>
                  </div>
                ))}
              </div>
            ) : showLegacy ? (
              <div className="flex items-start gap-3 px-3 py-2 rounded-lg text-sm border bg-amber-50 border-amber-200 text-amber-900">
                <span className="font-bold shrink-0">💬</span>
                <span className="flex-1">{complaint.supervisor_comment}</span>
                <span className="text-[11px] text-gray-400 shrink-0">{fmtDateTime(complaint.supervisor_approved_at)}</span>
              </div>
            ) : (
              <p className="text-sm text-gray-400">事業責任者の確認待ちです。</p>
            )}
          </div>
          {['director', 'admin'].includes(userRole) && complaint.status === '是正案提出' && (
            <div className="mx-5 mb-4">
              <button onClick={() => navigate(`/complaints/${id}/deep-analysis`)}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-colors">
                対応案を確認・承認 →
              </button>
            </div>
          )}
        </div>
          )
        })()}

        {/* ④A 対応案の修正・返答 - 是正案差し戻し時のみ（⑤が解放されたら非表示） */}
        {complaint.status === '是正案差し戻し' && step5Locked && ['manager', 'admin'].includes(userRole) && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-l-red-400">
            <div className="px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-red-400 text-white">↩</div>
                <span className="text-sm font-bold text-gray-800">④A 対応案の修正・返答</span>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full text-stone-400">返答待ち</span>
            </div>
            <div className="mx-5 mb-3 bg-red-50 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-red-600 mb-1">事業責任者からの差し戻しコメント</p>
              <p className="text-sm text-gray-700">{complaint.supervisor_comment || '（コメントなし）'}</p>
            </div>
            <div className="mx-5 mb-4">
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                rows={4}
                placeholder="修正内容・返答を入力してください"
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 transition resize-none mb-2"
              />
              <button
                onClick={handleSendReply}
                disabled={replySending || !replyText.trim()}
                className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {replySending ? '送信中...' : '返答・再提出 →'}
              </button>
            </div>
          </div>
        )}

        {/* ④B 再確認・承認 */}
        {complaint.status === '是正案再提出' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-l-blue-400">
            <div className="px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold', userRole === 'director' ? 'bg-blue-500 text-white' : 'bg-stone-200 text-stone-500')}>🔄</div>
                <span className="text-sm font-bold text-gray-800">④B 再確認・承認</span>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">返答済み・確認待ち</span>
            </div>
            <div className="mx-5 mb-4 bg-stone-50 rounded-xl px-4 py-3">
              {latestCorrectionReply ? (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">管理者からの返答</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{latestCorrectionReply.content}</p>
                  <p className="text-xs text-gray-400 mt-1.5">{fmtDateTime(latestCorrectionReply.created_at)}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">返答内容を読み込み中...</p>
              )}
            </div>
            {['director', 'admin'].includes(userRole) && (
              <div className="mx-5 mb-4">
                {!showResubmitReject ? (
                  <div className="flex gap-3">
                    <button onClick={() => setShowResubmitReject(true)} disabled={resubmitActing}
                      className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-40">
                      差し戻し
                    </button>
                    <button onClick={handleResubmitApprove} disabled={resubmitActing}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-colors disabled:opacity-40">
                      {resubmitActing ? '処理中...' : '承認'}
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-red-700 mb-2">差し戻しコメントを入力してください（必須）</p>
                    <textarea
                      value={resubmitRejectComment}
                      onChange={e => setResubmitRejectComment(e.target.value)}
                      rows={3}
                      placeholder="差し戻し理由を入力してください"
                      className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400 transition resize-none mb-2"
                    />
                    <div className="flex gap-3">
                      <button onClick={() => { setShowResubmitReject(false); setResubmitRejectComment('') }}
                        className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-gray-600 hover:bg-stone-50">
                        キャンセル
                      </button>
                      <button onClick={handleResubmitReject}
                        disabled={resubmitActing || !resubmitRejectComment.trim()}
                        className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-40">
                        {resubmitActing ? '処理中...' : '差し戻して戻る'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ⑤ 改善報告書 */}
        {step5Locked ? <LockedStep num="5" title="改善報告書" /> : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-l-lime-400">
          <div className="px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold', correction ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-500')}>5</div>
              <span className="text-sm font-bold text-gray-800">改善報告書（現象原因の特定）</span>
            </div>
            {['correction_rejected', 'report_rejected'].includes(complaint.status)
              ? <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700">否認・修正待ち</span>
              : complaint.status === 'supervisor_check'
              ? <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">事業責任者確認待ち</span>
              : <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', correction ? 'bg-emerald-100 text-emerald-700' : 'text-stone-400')}>{correction ? '提出済' : '未記録'}</span>
            }
          </div>
          {['director', 'admin'].includes(userRole) && complaint.status === '改善報告書提出' && correctionRejectedLog && (
            <div className="mx-5 mt-1 mb-3 flex items-start gap-3 bg-blue-50 border border-blue-300 rounded-xl px-4 py-3">
              <span className="text-lg leading-none">📋</span>
              <p className="text-sm font-semibold text-blue-800 leading-relaxed">
                管理者より改善報告書の修正提出がありました。ご確認をお願いします。
              </p>
            </div>
          )}
          <div className="mx-5 mb-4 bg-stone-50 rounded-xl px-4 py-3">
            {correction ? (
              <div className="space-y-2 text-sm text-gray-700">
                {correction.direct_cause && <p><span className="font-semibold text-gray-500 text-xs">直接原因：</span>{correction.direct_cause}</p>}
                {correction.correction   && <p><span className="font-semibold text-gray-500 text-xs">是正処置：</span>{correction.correction}</p>}
                {correction.improvement  && <p><span className="font-semibold text-gray-500 text-xs">運用改善案：</span>{correction.improvement}</p>}
              </div>
            ) : (
              <p className="text-sm text-gray-400">改善報告書の提出待ちです。</p>
            )}
          </div>
          {supervisorConfirmed && !correction && ['admin', 'manager'].includes(userRole) && (
            <div className="mx-5 mb-4">
              <button onClick={() => navigate(`/complaints/${id}/correction`)}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors">
                改善報告書を作成する →
              </button>
            </div>
          )}
          {complaint.status === 'correction_rejected' && correctionRejectedLog && (
            <div className="mx-5 mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-red-700 mb-1">⚠️ 事業責任者からの差し戻しコメント</p>
              <p className="text-sm text-gray-700 leading-relaxed">{correctionRejectedLog.content}</p>
            </div>
          )}
          {complaint.status === 'correction_rejected' && ['admin', 'manager'].includes(userRole) && (
            <div className="mx-5 mb-4">
              <button onClick={() => navigate(`/complaints/${id}/correction`)}
                className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold transition-colors">
                改善報告書を修正する →
              </button>
            </div>
          )}
          {complaint.status === 'report_rejected' && (() => {
            const rejectedApproval = approvals.find(a => a.status === 'rejected')
            return (
              <div className="mx-5 mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-red-700 mb-2">
                  ⚠️ {rejectedApproval ? `${rejectedApproval.approver_name}より差し戻しがありました` : '役員から改善報告書の差し戻しがありました'}
                </p>
                {rejectedApproval?.comment && (
                  <p className="text-sm text-gray-700 bg-white rounded-lg px-3 py-2 mb-2 border border-red-100">
                    コメント：「{rejectedApproval.comment}」
                  </p>
                )}
                <p className="text-sm text-gray-500">内容を修正して再提出してください。</p>
              </div>
            )
          })()}
          {complaint.status === 'report_rejected' && ['admin', 'manager'].includes(userRole) && (
            <div className="mx-5 mb-4">
              <button onClick={() => navigate(`/complaints/${id}/correction`)}
                className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold transition-colors">
                改善報告書を修正する →
              </button>
            </div>
          )}
          {complaint.status === 'supervisor_check' && ['director', 'admin'].includes(userRole) && (
            <div className="mx-5 mt-1 mb-3 flex items-start gap-3 bg-blue-50 border border-blue-300 rounded-xl px-4 py-3">
              <span className="text-lg leading-none">📋</span>
              <p className="text-sm font-semibold text-blue-800 leading-relaxed">
                役員差し戻し後の改善報告書が修正・再提出されました。ご確認をお願いします。
              </p>
            </div>
          )}
          {complaint.status === 'supervisor_check' && ['director', 'admin'].includes(userRole) && (
            <div className="mx-5 mb-4">
              <button onClick={handleSupervisorCheckApprove}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors">
                役員承認に回す →
              </button>
            </div>
          )}
        </div>
        )}

        {/* ⑥ 深掘り分析 */}
        {(step6Locked && userRole !== 'admin') ? <LockedStep num="6" title="深掘り分析" /> : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-l-orange-400">
          <div className="px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold', deepAnalysis ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-500')}>6</div>
              <span className="text-sm font-bold text-gray-800">深掘り分析</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', deepAnalysis ? 'bg-emerald-100 text-emerald-700' : 'text-stone-400')}>{deepAnalysis ? '提出済' : '未記録'}</span>
              {deepAnalysis && correction?.created_at && deepAnalysis.updated_at && (() => {
                const elapsed = (new Date(deepAnalysis.updated_at) - new Date(correction.created_at)) / 1000
                const h = Math.floor(elapsed / 3600)
                const m = Math.floor((elapsed % 3600) / 60)
                const s = Math.floor(elapsed % 60)
                const label = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
                return (
                  <div className="shrink-0 text-right text-emerald-700">
                    <div className="text-[26px] font-black tabular-nums leading-none">{label}</div>
                    <div className="text-[11px] mt-0.5">分析所要時間（提出済）</div>
                  </div>
                )
              })()}
            </div>
          </div>
          <div className="mx-5 mb-4 bg-stone-50 rounded-xl px-4 py-3">
            {deepAnalysis ? (
              <div className="space-y-2 text-sm text-gray-700">
                {deepAnalysis.root_cause  && <p><span className="font-semibold text-gray-500 text-xs">真因：</span>{deepAnalysis.root_cause}</p>}
                {deepAnalysis.root_theme  && <p><span className="font-semibold text-gray-500 text-xs">真因カテゴリー：</span>{deepAnalysis.root_theme}</p>}
                {deepAnalysis.root_detail && <p><span className="font-semibold text-gray-500 text-xs">真因詳細：</span>{deepAnalysis.root_detail}</p>}
                {deepAnalysis.org_improvement && <p><span className="font-semibold text-gray-500 text-xs">組織改善案：</span>{deepAnalysis.org_improvement}</p>}
                {Array.isArray(deepAnalysis.horizontal_departments) && deepAnalysis.horizontal_departments.length > 0 && (
                  <p><span className="font-semibold text-gray-500 text-xs">横展開 対象部署：</span>{deepAnalysis.horizontal_departments.join('・')}</p>
                )}
                {deepAnalysis.horizontal_content && <p><span className="font-semibold text-gray-500 text-xs">横展開 周知内容：</span>{deepAnalysis.horizontal_content}</p>}
                {deepAnalysis.action_assignee && <p><span className="font-semibold text-gray-500 text-xs">真因対策 担当者：</span>{deepAnalysis.action_assignee}</p>}
                {deepAnalysis.action_deadline && (() => {
                  void tick
                  const mins = calcDeadlineMinutes(deepAnalysis.action_deadline, deepAnalysis.action_progress)
                  const badge = mins === null ? null
                    : mins < 0
                      ? <span className="text-red-600 font-bold ml-1">⚠️ {fmtCountdown(mins)}超過</span>
                      : mins === 0
                        ? <span className="text-orange-600 font-bold ml-1">本日期限</span>
                        : <span className={cn('font-semibold ml-1', mins < 4320 ? 'text-orange-500' : 'text-emerald-700')}>残り{fmtCountdown(mins)}</span>
                  return <p><span className="font-semibold text-gray-500 text-xs">真因対策 期限：</span>{deepAnalysis.action_deadline}{badge}</p>
                })()}
                {deepAnalysis.action_progress && <p><span className="font-semibold text-gray-500 text-xs">真因対策 進捗：</span>{deepAnalysis.action_progress}</p>}
              </div>
            ) : (
              <p className="text-sm text-gray-400">深掘り分析の提出待ちです。</p>
            )}
          </div>
          {['director', 'executive', 'admin'].includes(userRole) && !deepAnalysis && (complaint.status === '改善報告書提出' || (complaint.status === '是正案承認' && correction) || complaint.status === '深掘り提出') && (
            <div className="mx-5 mb-4">
              <button onClick={() => navigate(`/complaints/${id}/deep-analysis`)}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors">
                深掘り分析を行う →
              </button>
            </div>
          )}
        </div>
        )}

        {/* ⑦ 役員承認 */}
        {(step7Locked && userRole !== 'admin') ? <LockedStep num="7" title="役員承認" /> : (
        <div className={cn('bg-white rounded-2xl shadow-sm overflow-hidden border-l-4', complaint.status === '役員再協議' ? 'border-l-orange-400' : 'border-l-emerald-400')}>
          <div className="px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold', approvals.length > 0 && approvedCount === approvals.length ? 'bg-emerald-500 text-white' : complaint.status === '役員再協議' ? 'bg-orange-400 text-white' : 'bg-stone-200 text-stone-500')}>7</div>
              <span className="text-sm font-bold text-gray-800">役員承認記録</span>
            </div>
            <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', approvals.length > 0 && approvedCount === approvals.length ? 'bg-emerald-100 text-emerald-700' : complaint.status === '役員再協議' ? 'bg-orange-100 text-orange-700' : 'text-stone-400')}>
              {complaint.status === '役員再協議' ? '再協議中' : approvals.length > 0 && approvedCount === approvals.length ? '承認済' : approvals.length > 0 ? `${approvedCount}/${approvals.length}名承認` : '承認待ち'}
            </span>
          </div>
          {complaint.status === '役員再協議' && (
            <div className="mx-5 mb-3 bg-orange-50 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-orange-700 mb-2">⚠️ 役員から否認がありました。返答・修正コメントを送信してください。</p>
              {approvals.filter(a => a.status === 'rejected').map((a, i) => (
                <div key={i} className="bg-white rounded-xl border border-orange-200 px-3 py-2 mb-2 last:mb-0">
                  <p className="text-xs font-semibold text-red-600 mb-0.5">
                    {a.approver_name}（{a.approver_role}）さんが否認しました
                  </p>
                  <p className="text-sm text-gray-700">否認理由：{a.comment || '（コメントなし）'}</p>
                </div>
              ))}
              {negotiationReplies.length > 0 && (
                <div className="mt-2 pt-2 border-t border-orange-100">
                  <p className="text-xs text-orange-600 font-semibold mb-1">過去の返答：</p>
                  {negotiationReplies.map((r, i) => (
                    <p key={i} className="text-xs text-gray-600 bg-white rounded-lg px-2 py-1 mb-1">{r.content}</p>
                  ))}
                </div>
              )}
            </div>
          )}
          {complaint.status === '役員再協議' && ['director', 'admin'].includes(userRole) && (
            <div className="mx-5 mb-3 space-y-2">
              <textarea
                value={negotiationComment}
                onChange={e => setNegotiationComment(e.target.value)}
                rows={3}
                placeholder="返答・修正コメントを入力してください（否認した役員に届きます）"
                className="w-full px-3 py-2.5 rounded-xl border border-orange-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 transition resize-none"
              />
              <button
                onClick={handleNegotiationReply}
                disabled={negotiationSending || !negotiationComment.trim()}
                className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold transition-colors disabled:opacity-40">
                {negotiationSending ? '送信中...' : '返答して再提出 →'}
              </button>
            </div>
          )}
          {['executive', 'admin'].includes(userRole) && deepAnalysis && complaint.status === '深掘り提出' && !(approvals.length > 0 && approvedCount === approvals.length) && (() => {
            const displayName = currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name || currentUser?.email || ''
            const alreadyApproved = approvals.some(a => displayName.includes(a.approver_name) && a.status === 'approved')
            return (
              <div className="mx-5 mb-3">
                <button
                  onClick={() => navigate(`/complaints/${id}/approval`)}
                  disabled={alreadyApproved}
                  className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {alreadyApproved ? '承認済みです' : '役員承認を行う →'}
                </button>
              </div>
            )
          })()}
          <div className="mx-5 mb-4 bg-stone-50 rounded-xl px-4 py-3">
            {approvals.length > 0 ? (
              <div className="space-y-2">
                {approvals.map((a, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-stone-200 text-stone-600 flex items-center justify-center text-xs font-bold">{a.approver_name?.charAt(0)}</div>
                      <div>
                        <span className="text-sm text-gray-700">{a.approver_name}</span>
                        {a.approver_role && <p className="text-xs text-gray-400">{a.approver_role}</p>}
                      </div>
                    </div>
                    <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', a.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500')}>
                      {a.status === 'approved' ? `承認済 ${fmtDateTime(a.approved_at)}` : '承認待ち'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">役員承認の完了後に公開されます。</p>
            )}
          </div>
        </div>
        )}

      </div>

    </div>
  )
}
