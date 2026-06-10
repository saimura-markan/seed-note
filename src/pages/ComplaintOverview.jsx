import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'
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

const PRIORITY = {
  5: { label: '最高緊張', bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-l-red-400' },
  4: { label: '緊張',     bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-l-orange-400' },
  3: { label: '注意',     bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-l-amber-400' },
  2: { label: 'やや',     bg: 'bg-lime-100',   text: 'text-lime-700',   border: 'border-l-lime-400' },
  1: { label: '穏やか',   bg: 'bg-emerald-100',text: 'text-emerald-700',border: 'border-l-emerald-400' },
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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
  const [contactCount, setContactCount] = useState(0)
  const [hasHearing,   setHasHearing]   = useState(false)
  const [hasCorrection,setHasCorrection]= useState(false)
  const [hasDeep,      setHasDeep]      = useState(false)
  const [approvals,    setApprovals]    = useState([])
  const [userRole,     setUserRole]     = useState(null)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserRole(data.session?.user?.app_metadata?.role || 'user')
    })
  }, [])

  const fetchData = useCallback(async () => {
    const [{ data: c }, { data: logs }, { data: corr }, { data: deep }, { data: appr }] = await Promise.all([
      supabase.from('complaints').select('*').eq('id', id).maybeSingle(),
      supabase.from('complaint_logs').select('type').eq('complaint_id', id),
      supabase.from('complaint_corrections').select('id').eq('complaint_id', id).limit(1),
      supabase.from('complaint_deep_analysis').select('id').eq('complaint_id', id).limit(1),
      supabase.from('complaint_approvals').select('status, approver_name').eq('complaint_id', id).order('sort_order'),
    ])
    if (c) setComplaint(c)
    if (logs) {
      setContactCount(logs.filter(l => l.type === 'contact').length)
      setHasHearing(logs.some(l => l.type === 'hearing'))
    }
    if (corr) setHasCorrection(corr.length > 0)
    if (deep) setHasDeep(deep.length > 0)
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

  const actionButton =
    userRole === 'admin' && ['受付済', '対応中', '是正案差し戻し'].includes(complaint.status)
      ? { label: '対応入力 →',       path: `/complaints/${id}/detail`,      color: 'bg-emerald-700 hover:bg-emerald-800' } :
    userRole === 'admin' && complaint.status === '是正案承認'
      ? { label: '改善報告書を作成 →', path: `/complaints/${id}/correction`,  color: 'bg-emerald-700 hover:bg-emerald-800' } :
    userRole === 'manager' && complaint.status === '是正案提出'
      ? { label: '是正案を確認・承認 →', path: `/complaints/${id}/analysis`,  color: 'bg-blue-700 hover:bg-blue-800' } :
    userRole === 'manager' && ['是正案承認', '改善報告書提出'].includes(complaint.status)
      ? { label: '深掘り分析を入力 →', path: `/complaints/${id}/deep-analysis`, color: 'bg-blue-700 hover:bg-blue-800' } :
    null

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto">
      <button onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-5 transition-colors">
        <ArrowLeft size={15} /> ダッシュボードに戻る
      </button>

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
        <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs text-gray-500">
          <span>担当：<strong className="text-gray-700">{complaint.assignee || '—'}</strong></span>
          <span>受付：{fmtDateTime(complaint.received_at)}</span>
          <span>ステータス：<strong className="text-gray-700">{complaint.status}</strong></span>
          {complaint.judgment && (
            <span>対応判断：<strong className="text-gray-700">{complaint.judgment}</strong></span>
          )}
        </div>
      </div>

      {/* セクション状態一覧 */}
      <div className="bg-white rounded-2xl shadow-sm mb-5 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-stone-100">
          <span className="text-sm font-bold text-gray-800">対応状況</span>
        </div>
        <div className="px-5">
          <StatusRow label="① お客様への連絡" value={contactCount > 0 ? `${contactCount}件` : '未記録'} done={contactCount > 0} />
          <StatusRow label="② 聞き取り" value={hasHearing ? '記録済' : '未記録'} done={hasHearing} />
          <StatusRow label="③ 是正案" value={hasCorrection ? '提出済' : '未提出'} done={hasCorrection} />
          <StatusRow label="④ 深掘り分析" value={hasDeep ? '提出済' : '未提出'} done={hasDeep} />
          <StatusRow
            label="⑤ 役員承認"
            value={approvals.length > 0 ? `${approvedCount}/${approvals.length}名` : '未開始'}
            done={approvals.length > 0 && approvedCount === approvals.length}
          />
        </div>
      </div>

      {/* ロール別アクションボタン */}
      {actionButton && (
        <button onClick={() => navigate(actionButton.path)}
          className={cn(
            'w-full py-4 rounded-2xl text-white font-bold text-sm transition-colors shadow-sm flex items-center justify-center gap-2',
            actionButton.color
          )}>
          {actionButton.label}
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  )
}
