import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

// ─── 定数 ───────────────────────────────────────────────────────────────────

const ROOT_THEMES = ['標準化不足', '教育不足', '報告不足', '顧客視点不足', 'その他']

const STEPS = ['受付済', '対応中', '是正案提出', '深掘り提出', '承認完了']

function ProgressBar({ status }) {
  const step = STEPS.indexOf(status)
  return (
    <div className="bg-white rounded-2xl shadow-sm px-6 py-4 mb-5">
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
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

// ─── メイン ──────────────────────────────────────────────────────────────────

export default function DeepAnalysis() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [complaint,   setComplaint]   = useState(null)
  const [correction,  setCorrection]  = useState(null)
  const [contactLogs, setContactLogs] = useState([])
  const [hearingText, setHearingText] = useState('')
  const [existing,    setExisting]    = useState(null)

  const [rootCause,   setRootCause]   = useState('')
  const [horizontal,  setHorizontal]  = useState('')
  const [orgImprove,  setOrgImprove]  = useState('')
  const [rootTheme,   setRootTheme]   = useState('')

  const [submitting, setSubmitting]   = useState(false)
  const [loading,    setLoading]      = useState(true)
  const [, setTick]                   = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const fetchData = useCallback(async () => {
    const [{ data: c }, { data: logs }, { data: corr }, { data: deep }] = await Promise.all([
      supabase.from('complaints').select('*').eq('id', id).maybeSingle(),
      supabase.from('complaint_logs').select('*').eq('complaint_id', id).order('created_at'),
      supabase.from('complaint_corrections').select('*').eq('complaint_id', id).order('created_at').limit(1),
      supabase.from('complaint_deep_analysis').select('*').eq('complaint_id', id).order('created_at').limit(1),
    ])
    if (c) setComplaint(c)
    if (logs) {
      setContactLogs(logs.filter(l => l.type === 'contact'))
      const h = logs.filter(l => l.type === 'hearing').pop()
      if (h) setHearingText(h.content)
    }
    if (corr && corr[0]) setCorrection(corr[0])
    if (deep && deep[0]) {
      setExisting(deep[0])
      setRootCause(deep[0].root_cause || '')
      setHorizontal(deep[0].horizontal_expansion || '')
      setOrgImprove(deep[0].org_improvement || '')
      setRootTheme(deep[0].root_theme || '')
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const canSubmit = rootCause.trim() && horizontal.trim() && orgImprove.trim() && rootTheme

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    const payload = {
      complaint_id:        id,
      root_cause:          rootCause,
      horizontal_expansion: horizontal,
      org_improvement:     orgImprove,
      root_theme:          rootTheme,
    }

    if (existing) {
      await supabase.from('complaint_deep_analysis').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('complaint_deep_analysis').insert(payload)
    }

    // 役員承認レコードを作成（未作成の場合）
    const APPROVERS = [
      { approver_name: '山口 誠',   approver_role: '代表取締役',         sort_order: 0 },
      { approver_name: '佐々木 隆', approver_role: '取締役 工事部長',    sort_order: 1 },
      { approver_name: '川上 直美', approver_role: '取締役 品質管理責任者', sort_order: 2 },
    ]
    const { data: existing_approvals } = await supabase
      .from('complaint_approvals').select('id').eq('complaint_id', id)
    if (!existing_approvals || existing_approvals.length === 0) {
      await supabase.from('complaint_approvals').insert(
        APPROVERS.map(a => ({ complaint_id: id, ...a, status: 'pending' }))
      )
    }

    await supabase.from('complaints').update({ status: '承認完了' }).eq('id', id)
    setSubmitting(false)
    navigate(`/complaints/${id}/approval`)
  }

  const handleClear = () => { setRootCause(''); setHorizontal(''); setOrgImprove(''); setRootTheme('') }

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

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto">
      <button onClick={() => navigate(`/complaints/${id}/correction`)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-5 transition-colors">
        <ArrowLeft size={15} /> 是正案に戻る
      </button>

      <ProgressBar status="深掘り提出" />

      {/* 24時間カウントダウンタイマー */}
      {complaint.supervisor_reported_at && (() => {
        const deadline = new Date(complaint.supervisor_reported_at).getTime() + 24 * 60 * 60 * 1000
        const remaining = Math.floor((deadline - Date.now()) / 1000)
        const pad = n => String(Math.floor(Math.abs(n))).padStart(2, '0')

        if (remaining <= 0) {
          const over = -remaining
          return (
            <div className="flex items-center gap-3 bg-red-50 border border-red-300 rounded-2xl px-5 py-3 mb-5">
              <AlertTriangle size={16} className="text-red-600 shrink-0" />
              <span className="text-xs font-semibold text-red-700">提出期限</span>
              <span className="text-lg font-black tabular-nums text-red-700">
                期限超過 +{pad(over / 3600)}:{pad((over % 3600) / 60)}:{pad(over % 60)}
              </span>
            </div>
          )
        }

        const h = pad(remaining / 3600)
        const m = pad((remaining % 3600) / 60)
        const s = pad(remaining % 60)
        const isRed    = remaining < 6 * 3600
        const isOrange = !isRed && remaining < 12 * 3600

        const bg     = isRed ? 'bg-red-50 border-red-300'       : isOrange ? 'bg-orange-50 border-orange-300'  : 'bg-amber-50 border-amber-200'
        const label  = isRed ? 'text-red-700'                   : isOrange ? 'text-orange-700'                 : 'text-amber-700'
        const value  = isRed ? 'text-red-700'                   : isOrange ? 'text-orange-800'                 : 'text-amber-800'
        const icon   = isRed ? <AlertTriangle size={16} className="text-red-600 shrink-0" /> : null

        return (
          <div className={`flex items-center gap-3 border rounded-2xl px-5 py-3 mb-5 ${bg}`}>
            {icon}
            <span className={`text-xs font-semibold ${label}`}>
              {isRed ? '⚠️ 残り時間わずか' : isOrange ? '注意：残り時間' : '提出期限まで'}
            </span>
            <span className={`text-lg font-black tabular-nums ${value}`}>残り {h}:{m}:{s}</span>
          </div>
        )
      })()}

      {/* ヘッダー */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
        <p className="text-lg font-bold text-gray-900 mb-0.5">🔍 深掘り・学習</p>
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

      {/* ② 深掘り分析（入力） */}
      <div className="bg-white rounded-2xl shadow-sm mb-4 p-5 space-y-4">
        <p className="text-sm font-bold text-gray-800">② 深掘り分析</p>

        <div>
          <label className={labelCls}>真因 <span className="text-red-500">*</span></label>
          <p className={guideCls}>なぜこの問題が起きたのか？組織・仕組みの観点から一言で</p>
          <textarea value={rootCause} onChange={e => setRootCause(e.target.value)}
            rows={3} placeholder="例：現場確認の責任者が明確でなく、個人の判断に委ねられていた"
            className={taCls} />
        </div>

        <div>
          <label className={labelCls}>横展開 <span className="text-red-500">*</span></label>
          <p className={guideCls}>他部署でも同じことが起きるとしたらどこか？</p>
          <textarea value={horizontal} onChange={e => setHorizontal(e.target.value)}
            rows={3} placeholder="例：産廃部門でも搬入前確認のチェックが属人化している可能性がある"
            className={taCls} />
        </div>

        <div>
          <label className={labelCls}>組織改善案 <span className="text-red-500">*</span></label>
          <p className={guideCls}>会社として何を変えるか？</p>
          <textarea value={orgImprove} onChange={e => setOrgImprove(e.target.value)}
            rows={3} placeholder="例：全部署共通の作業前チェックリストを策定し、月次で見直す体制を設ける"
            className={taCls} />
        </div>
      </div>

      {/* ③ 根源テーマ分類 */}
      <div className="bg-white rounded-2xl shadow-sm mb-5 p-5">
        <label className={labelCls}>③ 根源テーマの分類 <span className="text-red-500">*</span></label>
        <div className="flex flex-wrap gap-2 mt-2">
          {ROOT_THEMES.map(theme => (
            <button key={theme} type="button"
              onClick={() => setRootTheme(theme)}
              className={cn(
                'px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all',
                rootTheme === theme
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white text-gray-600 border-stone-200 hover:border-emerald-300 hover:bg-emerald-50'
              )}>
              {theme}
            </button>
          ))}
        </div>
      </div>

      {/* ボタン */}
      <div className="flex gap-3 pb-8">
        <button type="button" onClick={handleClear}
          className="px-5 h-12 rounded-xl border border-stone-200 text-sm font-semibold text-gray-600 hover:bg-stone-50 transition-colors">
          クリア
        </button>
        <button type="button" onClick={handleSubmit} disabled={submitting || !canSubmit}
          className="flex-1 h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
          {submitting ? '送信中...' : '役員承認へ送付'}
        </button>
      </div>
    </div>
  )
}
