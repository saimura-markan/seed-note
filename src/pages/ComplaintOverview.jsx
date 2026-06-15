import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { cn, getRole } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const STEPS = ['受付', '対応中', '事業責任者確認', '改善報告書', '深掘り', '役員承認', '周知完了']

function statusToStep(status) {
  const map = {
    '受付済': 0,
    '対応中': 1,
    '是正案提出': 2, '是正案差し戻し': 2, '是正案承認': 2,
    '改善報告書提出': 3, 'correction_rejected': 3,
    '深掘り提出': 5,
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
  const [userRole,     setUserRole]     = useState(null)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserRole(getRole(data.session?.user))
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
    }
    if (corr && corr[0]) setCorrection(corr[0])
    if (deep && deep[0]) setDeepAnalysis(deep[0])
    if (appr) setApprovals(appr)
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

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

  const actionButton =
    // admin（管理者）
    userRole === 'admin' && ['受付済', '対応中', '是正案差し戻し'].includes(complaint.status)
      ? { label: '対応入力 →',           path: `/complaints/${id}/detail`,         color: 'bg-emerald-700 hover:bg-emerald-800' } :
    userRole === 'admin' && complaint.status === '是正案承認'
      ? { label: '改善報告書を作成 →',   path: `/complaints/${id}/correction`,     color: 'bg-emerald-700 hover:bg-emerald-800' } :
    userRole === 'admin' && complaint.status === '改善報告書提出'
      ? { label: '改善報告書を確認 →',   path: `/complaints/${id}/correction`,     color: 'bg-emerald-700 hover:bg-emerald-800' } :
    // manager（主任クラス）
    userRole === 'manager' && ['是正案提出', '是正案差し戻し'].includes(complaint.status)
      ? { label: '是正案を確認・承認 →', path: `/complaints/${id}/deep-analysis`,  color: 'bg-blue-700 hover:bg-blue-800' } :
    userRole === 'manager' && ['是正案承認', '改善報告書提出'].includes(complaint.status)
      ? { label: '深掘り分析を入力 →',   path: `/complaints/${id}/deep-analysis`,  color: 'bg-blue-700 hover:bg-blue-800' } :
    // director（事業責任者）: 是正案の承認・却下
    userRole === 'director' && ['是正案提出', '是正案差し戻し'].includes(complaint.status)
      ? { label: '是正案を確認・承認 →', path: `/complaints/${id}/deep-analysis`,  color: 'bg-amber-600 hover:bg-amber-700' } :
    // judgment / executive（役員）: 深掘り結果を承認
    ['judgment', 'executive'].includes(userRole) && complaint.status === '深掘り提出'
      ? { label: '役員承認へ →',         path: `/complaints/${id}/approval`,       color: 'bg-purple-700 hover:bg-purple-800' } :
    null

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
          <span>受付：{fmtDateTime(complaint.received_at)}</span>
          <span>ステータス：<strong className="text-gray-700">{complaint.status}</strong></span>
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
          {contactLogs.length === 0 && (
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

        {/* ③ 是正案 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-l-violet-400">
          <div className="px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold', reportLog ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-500')}>3</div>
              <span className="text-sm font-bold text-gray-800">是正案</span>
            </div>
            <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', reportLog ? 'bg-emerald-100 text-emerald-700' : 'text-stone-400')}>{reportLog ? '提出済' : '提出待ち'}</span>
          </div>
          <div className="mx-5 mb-4 bg-stone-50 rounded-xl px-4 py-3">
            {reportLog ? (
              <p className="text-sm text-gray-700">{reportLog.content}</p>
            ) : (
              <p className="text-sm text-gray-400">是正案の提出待ちです。</p>
            )}
          </div>
        </div>

        {/* ④ 事業責任者確認 */}
        {(() => {
          const hasLogs    = supervisorCommentLogs.length > 0
          // logsがある場合は supervisor_comment を表示しない（重複防止）
          const showLegacy = !hasLogs && !!complaint.supervisor_comment
          const confirmed  = hasLogs || showLegacy
          return (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-l-amber-400">
          <div className="px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold', confirmed ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-500')}>4</div>
              <span className="text-sm font-bold text-gray-800">事業責任者確認</span>
            </div>
            <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', confirmed ? 'bg-emerald-100 text-emerald-700' : 'text-stone-400')}>{confirmed ? '確認済み' : '未記録'}</span>
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
          {userRole === 'director' && ['是正案提出', '是正案差し戻し'].includes(complaint.status) && (
            <div className="mx-5 mb-4">
              <button onClick={() => navigate(`/complaints/${id}/deep-analysis`)}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-colors">
                是正案を確認・承認 →
              </button>
            </div>
          )}
        </div>
          )
        })()}

        {/* ⑤ 改善報告書 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-l-lime-400">
          <div className="px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold', correction ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-500')}>5</div>
              <span className="text-sm font-bold text-gray-800">改善報告書（現象原因の特定）</span>
            </div>
            {complaint.status === 'correction_rejected'
              ? <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700">否認・修正待ち</span>
              : <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', correction ? 'bg-emerald-100 text-emerald-700' : 'text-stone-400')}>{correction ? '提出済' : '未記録'}</span>
            }
          </div>
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
          {complaint.status === 'correction_rejected' && ['admin', 'manager'].includes(userRole) && (
            <div className="mx-5 mb-4">
              <button onClick={() => navigate(`/complaints/${id}/correction`)}
                className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold transition-colors">
                改善報告書を修正する →
              </button>
            </div>
          )}
        </div>

        {/* ⑥ 深掘り分析 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-l-orange-400">
          <div className="px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold', deepAnalysis ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-500')}>6</div>
              <span className="text-sm font-bold text-gray-800">深掘り分析</span>
            </div>
            <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', deepAnalysis ? 'bg-emerald-100 text-emerald-700' : 'text-stone-400')}>{deepAnalysis ? '提出済' : '未記録'}</span>
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
                  const today = new Date(); today.setHours(0, 0, 0, 0)
                  const dl = new Date(deepAnalysis.action_deadline); dl.setHours(0, 0, 0, 0)
                  const diff = Math.round((dl - today) / 86400000)
                  const badge = diff < 0
                    ? <span className="text-red-600 font-bold ml-1">{Math.abs(diff)}日超過</span>
                    : diff === 0
                      ? <span className="text-orange-600 font-bold ml-1">本日期限</span>
                      : <span className="text-emerald-700 font-semibold ml-1">残り{diff}日</span>
                  return <p><span className="font-semibold text-gray-500 text-xs">真因対策 期限：</span>{deepAnalysis.action_deadline}{badge}</p>
                })()}
                {deepAnalysis.action_progress && <p><span className="font-semibold text-gray-500 text-xs">真因対策 進捗：</span>{deepAnalysis.action_progress}</p>}
              </div>
            ) : (
              <p className="text-sm text-gray-400">深掘り分析の提出待ちです。</p>
            )}
          </div>
          {['director', 'executive'].includes(userRole) && correction && !deepAnalysis && (
            <div className="mx-5 mb-4">
              <button onClick={() => navigate(`/complaints/${id}/deep-analysis`)}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors">
                深掘り分析を行う →
              </button>
            </div>
          )}
        </div>

        {/* ⑦ 役員承認 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-l-emerald-400">
          <div className="px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold', approvals.length > 0 && approvedCount === approvals.length ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-500')}>7</div>
              <span className="text-sm font-bold text-gray-800">役員承認記録</span>
            </div>
            <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', approvals.length > 0 && approvedCount === approvals.length ? 'bg-emerald-100 text-emerald-700' : 'text-stone-400')}>
              {approvals.length > 0 && approvedCount === approvals.length ? '承認済' : approvals.length > 0 ? `${approvedCount}/${approvals.length}名承認` : '承認待ち'}
            </span>
          </div>
          {['executive', 'admin'].includes(userRole) && deepAnalysis && !(approvals.length > 0 && approvedCount === approvals.length) && (
            <div className="mx-5 mb-3">
              <button onClick={() => navigate(`/complaints/${id}/approval`)}
                className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-colors">
                合同改善報告書を確認する →
              </button>
            </div>
          )}
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
                    <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', a.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500')}>{a.status === 'approved' ? '承認済' : '承認待ち'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">役員承認の完了後に公開されます。</p>
            )}
          </div>
        </div>

      </div>

    </div>
  )
}
