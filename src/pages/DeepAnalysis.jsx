import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const STEPS = ['受付済', '対応中', '是正案', '改善報告', '深掘り', '承認完了']

function statusToStep(status) {
  const map = {
    '受付済': 0, '対応中': 1,
    '是正案提出': 2, '是正案差し戻し': 2,
    '是正案承認': 3, '改善報告書提出': 3,
    '深掘り提出': 4, '承認完了': 5,
  }
  return map[status] ?? 0
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
                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                  done    ? 'bg-emerald-600 border-emerald-600 text-white' :
                  current ? 'bg-white border-emerald-600 text-emerald-700 ring-2 ring-emerald-200' :
                  'bg-white border-stone-200 text-stone-400')}>
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

export default function DeepAnalysis() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [complaint,   setComplaint]   = useState(null)
  const [correction,  setCorrection]  = useState(null)
  const [contactLogs, setContactLogs] = useState([])
  const [hearingText, setHearingText] = useState('')
  const [reportLog,   setReportLog]   = useState(null)

  const [supervisorComment, setSupervisorComment] = useState('')
  const [approving, setApproving] = useState(false)
  const [loading,   setLoading]   = useState(true)

  const fetchData = useCallback(async () => {
    const [{ data: c }, { data: logs }, { data: corr }] = await Promise.all([
      supabase.from('complaints').select('*').eq('id', id).maybeSingle(),
      supabase.from('complaint_logs').select('*').eq('complaint_id', id).order('created_at'),
      supabase.from('complaint_corrections').select('*').eq('complaint_id', id).order('created_at').limit(1),
    ])
    if (c) { setComplaint(c); setSupervisorComment(c.supervisor_comment || '') }
    if (logs) {
      setContactLogs(logs.filter(l => l.type === 'contact'))
      const h = logs.filter(l => l.type === 'hearing').pop()
      if (h) setHearingText(h.content)
      const r = logs.filter(l => l.type === 'report').pop()
      if (r) setReportLog(r)
    }
    if (corr && corr[0]) setCorrection(corr[0])
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const handleApprove = async () => {
    setApproving(true)
    const now = new Date().toISOString()
    const { data, error } = await supabase.from('complaints').update({
      status: '是正案承認',
      supervisor_approved_at: now,
      supervisor_comment: supervisorComment,
    }).eq('id', id).select()
    console.log('[handleApprove] result:', { data, error })
    if (error) {
      alert(`承認に失敗しました: ${error.message}`)
      setApproving(false)
      return
    }
    setComplaint(c => ({ ...c, status: '是正案承認', supervisor_approved_at: now, supervisor_comment: supervisorComment }))
    setApproving(false)
    await fetchData()
  }

  const handleReject = async () => {
    if (!supervisorComment.trim()) {
      alert('差し戻しコメントを入力してください')
      return
    }
    setApproving(true)
    await supabase.from('complaints').update({
      status: '是正案差し戻し',
      supervisor_comment: supervisorComment,
    }).eq('id', id)
    setComplaint(c => ({ ...c, status: '是正案差し戻し', supervisor_comment: supervisorComment }))
    setApproving(false)
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

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto">
      <button onClick={() => navigate(`/complaints/${id}`)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-5 transition-colors">
        <ArrowLeft size={15} /> 概要に戻る
      </button>

      <ProgressBar status={complaint.status} />

      {/* ヘッダー */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
        <p className="text-lg font-bold text-gray-900 mb-0.5">✅ 是正案の確認・承認</p>
        <p className="text-sm text-gray-500">{complaint.client_name} — {complaint.site_name}</p>
      </div>

      {/* 注意バナー */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5">
        <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-800 leading-relaxed">
          テキストだけでは伝わらない部分があります。<strong>必ず管理者と直接会話・電話で状況を確認してから</strong>判断してください。
        </p>
      </div>

      {/* ① 管理者の是正案（読み取り専用） */}
      <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50">
          <span className="text-sm font-bold text-gray-700">① 管理者の是正案</span>
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

      {/* 管理者からの報告 */}
      {complaint.judgment && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl mb-4 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-amber-200">
            <span className="text-sm font-bold text-amber-900">📋 管理者からの報告</span>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-sm font-semibold text-amber-800">
              {complaint.judgment === '手直し' ? '手直しで対応します' : '事業責任者へ確認'}
            </p>
            {reportLog && (
              <div className="bg-white rounded-xl px-4 py-3 text-sm text-gray-700 border border-amber-100 leading-relaxed">
                {reportLog.content}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ② 承認/否認 */}
      {['是正案提出', '是正案差し戻し'].includes(complaint.status) && (
        <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-100">
            <span className="text-sm font-bold text-gray-800">② 是正案の承認・否認</span>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <label className={labelCls}>コメント（否認の場合は必須）</label>
              <textarea value={supervisorComment} onChange={e => setSupervisorComment(e.target.value)}
                rows={3} placeholder="承認・否認の理由やフィードバックを記入してください"
                className={taCls} />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={handleReject} disabled={approving}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors disabled:opacity-40">
                {approving ? '処理中...' : '否認（差し戻し）'}
              </button>
              <button type="button" onClick={handleApprove} disabled={approving}
                className="flex-1 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm transition-colors disabled:opacity-40">
                {approving ? '処理中...' : '承認'}
              </button>
            </div>
          </div>
        </div>
      )}

      {complaint.status === '是正案承認' && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 mb-4 flex items-center gap-2">
          <span className="text-green-700 font-bold text-sm">✅ 是正案を承認済み</span>
          {complaint.supervisor_comment && (
            <span className="text-xs text-green-600">— {complaint.supervisor_comment}</span>
          )}
        </div>
      )}
    </div>
  )
}
