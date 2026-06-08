import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, XCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

// ─── 定数 ───────────────────────────────────────────────────────────────────

const STEPS = ['受付済', '対応中', '是正案提出', '深掘り提出', '承認完了']

const ROOT_THEME_COLORS = {
  '標準化不足': 'bg-blue-500',
  '教育不足':   'bg-amber-500',
  '報告不足':   'bg-orange-500',
  '顧客視点不足': 'bg-red-500',
  'その他':     'bg-stone-400',
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
  const [approvals,  setApprovals]  = useState([])
  const [themeStats, setThemeStats] = useState({})
  const [, setTick] = useState(0)

  const [comments,  setComments]  = useState({})
  const [saving,    setSaving]    = useState({})
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const fetchData = useCallback(async () => {
    const [{ data: c }, { data: deep }, { data: appr }, { data: stats }] = await Promise.all([
      supabase.from('complaints').select('*').eq('id', id).maybeSingle(),
      supabase.from('complaint_deep_analysis').select('*').eq('complaint_id', id).order('created_at').limit(1),
      supabase.from('complaint_approvals').select('*').eq('complaint_id', id).order('sort_order'),
      supabase.from('complaint_deep_analysis').select('root_theme'),
    ])
    if (c) setComplaint(c)
    if (deep && deep[0]) setAnalysis(deep[0])
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
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const handleApproval = async (approvalId, status) => {
    setSaving(s => ({ ...s, [approvalId]: true }))
    await supabase.from('complaint_approvals').update({
      status,
      comment:     comments[approvalId] || '',
      approved_at: new Date().toISOString(),
    }).eq('id', approvalId)

    setApprovals(prev => prev.map(a =>
      a.id === approvalId ? { ...a, status, comment: comments[approvalId] || '', approved_at: new Date().toISOString() } : a
    ))

    // 全員承認済みなら complaint を完了に
    const updated = approvals.map(a =>
      a.id === approvalId ? { ...a, status } : a
    )
    if (updated.every(a => a.status === 'approved')) {
      await supabase.from('complaints').update({ status: '承認完了' }).eq('id', id)
      setComplaint(c => ({ ...c, status: '承認完了' }))
    }

    setSaving(s => ({ ...s, [approvalId]: false }))
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
  const countdown = calcCountdown(analysis?.created_at)
  const allApproved = approvals.length > 0 && approvals.every(a => a.status === 'approved')
  const totalTheme = Object.values(themeStats).reduce((s, v) => s + v, 0) || 1

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto">
      <button onClick={() => navigate(`/complaints/${id}/analysis`)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-5 transition-colors">
        <ArrowLeft size={15} /> 深掘り分析に戻る
      </button>

      <ProgressBar status={complaint.status} />

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

      {/* ① 事業責任者の深掘り結果（読み取り専用） */}
      {analysis && (
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

      {/* ② 役員承認（3名） */}
      <div className="space-y-4 mb-5">
        {approvals.map((appr, i) => {
          const done     = appr.status === 'approved'
          const rejected = appr.status === 'rejected'
          const pending  = appr.status === 'pending'
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
                    <p className="text-xs text-gray-400">{appr.approver_role}</p>
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

                {/* 未承認の場合は入力フォーム */}
                {pending && (
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
                        onClick={() => handleApproval(appr.id, 'rejected')}
                        disabled={saving[appr.id]}
                        className="flex-1 h-10 rounded-xl border-2 border-red-200 text-red-700 bg-red-50 hover:bg-red-100 text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                        <XCircle size={14} />
                        差し戻す
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ③ 今月の根源テーマ集計 */}
      <div className="bg-white rounded-2xl shadow-sm mb-8 p-5">
        <p className="text-sm font-bold text-gray-800 mb-4">📊 今月の根源テーマ集計</p>
        <div className="space-y-3">
          {['標準化不足', '教育不足', '報告不足', '顧客視点不足', 'その他'].map(theme => {
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
    </div>
  )
}
