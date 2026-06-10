import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Lightbulb, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

// ─── AI ヒント（4M分析） ─────────────────────────────────────────────────────

function generateAIHint(directCause, correction) {
  const c = (directCause || '').slice(0, 50)
  const r = (correction || '').slice(0, 50)
  return `**4M分析によるヒント 🌱**

以下の4つの視点で、運用改善案をさらに深めることを検討してみてください。

**👤 Man（人）** — スキル・意識・習慣
「${c}」から、教育・訓練の見直しや、担当者間でのナレッジ共有を強化することで、同じ問題の再発を防ぎやすくなります。

**📋 Method（方法）** — 手順・ルール・チェック
是正処置「${r}」を標準手順としてドキュメント化し、チェックリストに組み込むことをお勧めします。

**🔧 Machine（設備）** — ツール・機器・作業環境
使用機材・作業環境の定期点検サイクルを見直すことで、環境起因の問題を事前に検知できます。

**📦 Material（材料）** — 素材・情報・データ
作業前の情報確認（現場状況・天候・資材状態）を事前確認リストに追加し、インプット品質を上げましょう。

> 💡 これはAIによる参考ヒントです。最終的な判断は現場・組織の状況に合わせて行ってください。`
}

async function fetchAIHint(directCause, correction) {
  try {
    const { data, error } = await supabase.functions.invoke('ai-hint', {
      body: { directCause, correction }
    })
    if (!error && data?.hint) return data.hint
  } catch {}
  // Edge Function が未デプロイの場合はローカル生成にフォールバック
  return generateAIHint(directCause, correction)
}

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

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

// ─── メイン ──────────────────────────────────────────────────────────────────

export default function CorrectionSubmit() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [complaint, setComplaint]       = useState(null)
  const [contactLogs, setContactLogs]   = useState([])
  const [hearingContent, setHearingContent] = useState('')
  const [existing, setExisting]         = useState(null)

  const [directCause, setDirectCause]   = useState('')
  const [correction, setCorrection]     = useState('')
  const [improvement, setImprovement]   = useState('')
  const [aiHint, setAiHint]             = useState('')
  const [aiLoading, setAiLoading]       = useState(false)

  const [submitting, setSubmitting]     = useState(false)
  const [loading, setLoading]           = useState(true)
  const [, setTick]                     = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const fetchData = useCallback(async () => {
    const [{ data: c }, { data: logs }, { data: corr }] = await Promise.all([
      supabase.from('complaints').select('*').eq('id', id).maybeSingle(),
      supabase.from('complaint_logs').select('*').eq('complaint_id', id).order('created_at'),
      supabase.from('complaint_corrections').select('*').eq('complaint_id', id).order('created_at').limit(1),
    ])
    if (c) setComplaint(c)
    if (logs) {
      setContactLogs(logs.filter(l => l.type === 'contact'))
      const h = logs.filter(l => l.type === 'hearing').pop()
      if (h) setHearingContent(h.content)
    }
    if (corr && corr[0]) {
      setExisting(corr[0])
      setDirectCause(corr[0].direct_cause || '')
      setCorrection(corr[0].correction || '')
      setImprovement(corr[0].improvement || '')
      setAiHint(corr[0].ai_hint || '')
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const handleGetAIHint = async () => {
    if (!directCause.trim() || !correction.trim()) {
      alert('「直接原因」と「是正処置」を入力してからAIヒントを取得してください')
      return
    }
    setAiLoading(true)
    const hint = await fetchAIHint(directCause, correction)
    setAiHint(hint)
    setAiLoading(false)
  }

  const canSubmit = directCause.trim() && correction.trim() && improvement.trim()

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    const payload = { complaint_id: id, direct_cause: directCause, correction, improvement, ai_hint: aiHint }
    if (existing) {
      await supabase.from('complaint_corrections').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('complaint_corrections').insert(payload)
    }
    await supabase.from('complaints').update({ status: '是正案提出' }).eq('id', id)
    setSubmitting(false)
    navigate(`/complaints/${id}/analysis`)
  }

  const handleClear = () => {
    setDirectCause(''); setCorrection(''); setImprovement(''); setAiHint('')
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

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto">
      <button onClick={() => navigate(`/complaints/${id}`)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-5 transition-colors">
        <ArrowLeft size={15} /> 概要に戻る
      </button>

      <ProgressBar status={complaint.status === '深掘り提出' ? '深掘り提出' : '是正案提出'} />

      {/* 経過時間タイマー */}
      {complaint.supervisor_reported_at && (() => {
        const elapsed = Math.floor((Date.now() - new Date(complaint.supervisor_reported_at).getTime()) / 1000)
        const pad = n => String(Math.floor(Math.abs(n))).padStart(2, '0')
        const h = pad(elapsed / 3600)
        const m = pad((elapsed % 3600) / 60)
        const s = pad(elapsed % 60)
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 mb-5 flex items-center gap-3">
            <span className="text-xs font-semibold text-amber-700">上司報告からの経過時間</span>
            <span className="text-lg font-black tabular-nums text-amber-800">{h}:{m}:{s}</span>
          </div>
        )
      })()}

      {/* ヘッダー */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-xs font-mono text-gray-400">{complaint.id?.slice(0, 8).toUpperCase()}</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-700 font-bold border border-teal-200">
            ✅ 対応完了済み
          </span>
        </div>
        <p className="font-bold text-gray-900">{complaint.client_name} — {complaint.site_name}</p>
      </div>

      {/* 説明文 */}
      <div className="bg-emerald-50 rounded-2xl p-4 mb-5 border border-emerald-200">
        <p className="text-sm text-emerald-800 leading-relaxed">
          🌱 対応が完了したら、何が起きてなぜそうなったかを整理して提出してください。<br />
          AIがヒントをくれます。焦らず丁寧に。
        </p>
      </div>

      {/* ① 発生事実（読み取り専用） */}
      <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50">
          <span className="text-sm font-bold text-gray-700">① 発生事実（自動表示）</span>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">お客様への連絡記録</p>
            {contactLogs.length === 0
              ? <p className="text-sm text-gray-400 italic">記録なし</p>
              : (
                <div className="space-y-1.5">
                  {contactLogs.map(log => (
                    <div key={log.id} className={cn('flex items-center gap-2 text-sm px-3 py-2 rounded-lg',
                      log.content === '繋がらず' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800')}>
                      <span>{log.content === '繋がらず' ? '🔴' : '✅'}</span>
                      <span className="flex-1">{log.content}</span>
                      <span className="text-xs text-gray-400">{fmtDateTime(log.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">作業者からの聞き取り</p>
            <p className="text-sm text-gray-700 bg-stone-50 rounded-lg px-3 py-2.5 min-h-[2.5rem]">
              {hearingContent || <span className="text-gray-400 italic">記録なし</span>}
            </p>
          </div>
        </div>
      </div>

      {/* ② 直接原因 */}
      <div className="bg-white rounded-2xl shadow-sm mb-4 p-5">
        <label className={labelCls}>② 直接原因 <span className="text-red-500">*</span></label>
        <p className={guideCls}>人のせいではなく、自分たちの行動・手順から考えてください</p>
        <textarea value={directCause} onChange={e => setDirectCause(e.target.value)}
          rows={3} placeholder="例：施工前の養生確認チェックリストが形骸化しており、確認が省略されていた"
          className={taCls} />
      </div>

      {/* ③ 是正処置 */}
      <div className="bg-white rounded-2xl shadow-sm mb-4 p-5">
        <label className={labelCls}>③ 是正処置 <span className="text-red-500">*</span></label>
        <p className={guideCls}>実際にどう対応しましたか？</p>
        <textarea value={correction} onChange={e => setCorrection(e.target.value)}
          rows={3} placeholder="例：即日現場に再訪問し、破損箇所の補修と謝罪を実施。お客様に確認いただいた"
          className={taCls} />
      </div>

      {/* ④ 運用改善案 */}
      <div className="bg-white rounded-2xl shadow-sm mb-5 p-5">
        <label className={labelCls}>④ 運用改善案 <span className="text-red-500">*</span></label>
        <p className={guideCls}>今後同じことが起きないために何を変えますか？</p>
        <textarea value={improvement} onChange={e => setImprovement(e.target.value)}
          rows={3} placeholder="例：養生確認チェックリストを刷新し、作業前の確認を管理者と2名で行う体制を整備する"
          className={taCls + ' mb-3'} />

        {/* AIヒントボタン */}
        <button type="button" onClick={handleGetAIHint} disabled={aiLoading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-sm font-semibold hover:bg-emerald-100 transition-colors disabled:opacity-50">
          {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Lightbulb size={14} />}
          {aiLoading ? '分析中...' : 'AIに改善案のヒントをもらう'}
        </button>

        {/* AIヒント表示 */}
        {aiHint && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1">
              <Lightbulb size={12} /> AI分析ヒント
            </p>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{aiHint}</div>
          </div>
        )}
      </div>

      {/* ボタン */}
      <div className="flex gap-3 pb-8">
        <button type="button" onClick={handleClear}
          className="px-5 h-12 rounded-xl border border-stone-200 text-sm font-semibold text-gray-600 hover:bg-stone-50 transition-colors">
          クリア
        </button>
        <button type="button" onClick={handleSubmit} disabled={submitting || !canSubmit}
          className="flex-1 h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
          {submitting ? '送信中...' : '事業責任者へ提出'}
        </button>
      </div>
    </div>
  )
}
