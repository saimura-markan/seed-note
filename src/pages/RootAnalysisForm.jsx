import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { ROOT_THEMES, DEPARTMENTS, WHY_COUNT_MIN, WHY_COUNT_MAX } from '@/lib/constants'

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function RootAnalysisForm() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [complaint,   setComplaint]   = useState(null)
  const [contactLogs, setContactLogs] = useState([])
  const [hearingText, setHearingText] = useState('')
  const [existing,    setExisting]    = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [submitting,  setSubmitting]  = useState(false)

  // ① 発生した事象
  const [occurredEventNote, setOccurredEventNote] = useState('')
  // ② 実施した是正措置
  const [correction, setCorrection] = useState('')
  // ③ なぜなぜ分析
  const [whyChain, setWhyChain] = useState([])       // 確定済みの回答（文字列の配列）
  const [whyInput, setWhyInput] = useState('')
  const [whyPhase, setWhyPhase] = useState('input')  // 'input' | 'checkpoint' | 'done'
  // ④ 真因・真因カテゴリー
  const [rootCause, setRootCause] = useState('')
  const [rootTheme, setRootTheme] = useState('')
  // ⑤ 改善策・担当者・期限・進捗
  const [improvement,     setImprovement]     = useState('')
  const [actionAssignee,  setActionAssignee]  = useState('')
  const [actionDeadline,  setActionDeadline]  = useState('')
  const [actionProgress,  setActionProgress]  = useState('未着手')
  // ⑥ 横展開
  const [horizDepts, setHorizDepts] = useState([])

  const fetchData = useCallback(async () => {
    const [
      { data: c, error: cErr },
      { data: logs, error: logsErr },
      { data: ra, error: raErr },
    ] = await Promise.all([
      supabase.from('complaints').select('*').eq('id', id).maybeSingle(),
      supabase.from('complaint_logs').select('*').eq('complaint_id', id).order('created_at'),
      supabase.from('complaint_root_analysis').select('*').eq('complaint_id', id).order('created_at', { ascending: false }).limit(1),
    ])
    if (cErr)    console.error('[RootAnalysisForm] complaints fetch error:', cErr.message)
    if (logsErr) console.error('[RootAnalysisForm] complaint_logs fetch error:', logsErr.message)
    if (raErr)   console.error('[RootAnalysisForm] complaint_root_analysis fetch error:', raErr.message)
    if (c) setComplaint(c)
    if (logs) {
      setContactLogs(logs.filter(l => l.type === 'contact'))
      const h = logs.filter(l => l.type === 'hearing').pop()
      if (h) setHearingText(h.content)
    }
    if (ra && ra[0]) {
      const row = ra[0]
      setExisting(row)
      setOccurredEventNote(row.occurred_event_note || '')
      setCorrection(row.correction || '')
      const chain = Array.isArray(row.why_chain) ? row.why_chain.map(w => w.answer ?? w) : []
      setWhyChain(chain)
      // 既存行が最低回数以上を満たしていれば、再確認は挟まず確定済みとして復元する
      setWhyPhase(chain.length >= WHY_COUNT_MIN ? 'done' : 'input')
      setRootCause(row.root_cause || '')
      setRootTheme(row.root_theme || '')
      setImprovement(row.improvement || '')
      setActionAssignee(row.action_assignee || '')
      setActionDeadline(row.action_deadline || '')
      setActionProgress(row.action_progress || '未着手')
      setHorizDepts(Array.isArray(row.horizontal_departments) ? row.horizontal_departments : [])
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUser(data.session?.user ?? null)
    })
  }, [])

  // ── なぜなぜ分析 ──
  const submitWhy = () => {
    if (!whyInput.trim()) return
    const next = [...whyChain, whyInput.trim()]
    setWhyChain(next)
    setWhyInput('')
    if (next.length >= WHY_COUNT_MAX) setWhyPhase('done')
    else if (next.length >= WHY_COUNT_MIN) setWhyPhase('checkpoint')
    else setWhyPhase('input')
  }

  const editWhy = (index) => {
    setWhyInput(whyChain[index])
    setWhyChain(whyChain.slice(0, index))
    setWhyPhase('input')
  }

  const canSubmit = occurredEventNote.trim() && correction.trim()
    && whyChain.length >= WHY_COUNT_MIN
    && rootCause.trim() && rootTheme
    && improvement.trim() && actionAssignee.trim() && actionDeadline
    && horizDepts.length > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    const payload = {
      complaint_id: id,
      occurred_event_note: occurredEventNote,
      correction,
      why_chain: whyChain.map((answer, i) => ({ level: i + 1, answer })),
      root_cause: rootCause,
      root_theme: rootTheme,
      improvement,
      action_assignee: actionAssignee,
      action_deadline: actionDeadline || null,
      action_progress: actionProgress,
      horizontal_departments: horizDepts,
      author_name: currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name || null,
    }
    const { error: saveError } = existing
      ? await supabase.from('complaint_root_analysis').update(payload).eq('id', existing.id)
      : await supabase.from('complaint_root_analysis').insert(payload)
    if (saveError) {
      console.error('[RootAnalysisForm] complaint_root_analysis save error:', saveError.message)
      setSubmitting(false)
      alert(`保存に失敗しました: ${saveError.message}`)
      return
    }
    const { error: statusError } = await supabase.from('complaints').update({
      status: '原因分析提出', current_turn_started_at: new Date().toISOString(),
    }).eq('id', id)
    if (statusError) console.error('[RootAnalysisForm] complaints status update error:', statusError.message)
    setSubmitting(false)
    navigate(`/complaints/${id}`)
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
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <button onClick={() => navigate(`/complaints/${id}`)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-5 transition-colors">
        <ArrowLeft size={15} /> クレーム詳細に戻る
      </button>

      <h2 className="text-lg font-bold text-gray-900 mb-5">原因分析・改善報告書</h2>

      {/* ① 発生した事象 */}
      <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50">
          <span className="text-sm font-bold text-gray-700">① 発生した事象</span>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">お客様への連絡記録（自動表示）</p>
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
            <p className="text-xs font-semibold text-gray-500 mb-1">作業者からの聞き取り（自動表示）</p>
            <p className="text-sm text-gray-700 bg-stone-50 rounded-lg px-3 py-2.5 min-h-[2.5rem]">
              {hearingText || <span className="text-gray-400 italic">記録なし</span>}
            </p>
          </div>
          <div>
            <label className={labelCls}>補足 <span className="text-red-500">*</span></label>
            <p className={guideCls}>自動表示だけでは伝わらない事象の詳細を補足してください</p>
            <textarea value={occurredEventNote} onChange={e => setOccurredEventNote(e.target.value)}
              rows={3} placeholder="例：養生前の確認手順が省略され、床材の一部が傷ついた状態でお客様に発見された"
              className={taCls} />
          </div>
        </div>
      </div>

      {/* ② 実施した是正措置 */}
      <div className="bg-white rounded-2xl shadow-sm mb-4 p-5">
        <label className={labelCls}>② 実施した是正措置 <span className="text-red-500">*</span></label>
        <p className={guideCls}>お客様に対して実際にどう対応しましたか？</p>
        <textarea value={correction} onChange={e => setCorrection(e.target.value)}
          rows={3} placeholder="例：即日現場に再訪問し、破損箇所の補修と謝罪を実施。お客様に確認いただいた"
          className={taCls} />
      </div>

      {/* ③ なぜなぜ分析 */}
      <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden border-l-4 border-l-emerald-400">
        <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-700">🤖 ③ なぜなぜ分析</span>
          <span className="text-xs text-gray-400">最低{WHY_COUNT_MIN}回・最大{WHY_COUNT_MAX}回</span>
        </div>
        <div className="p-5 space-y-4">
          {whyChain.map((answer, i) => (
            <div key={i}>
              <p className="text-sm font-bold text-gray-800 mb-2">なぜ{i + 1}</p>
              <div className="flex items-start gap-3 bg-stone-50 rounded-xl px-4 py-2.5">
                <p className="text-sm text-gray-700 flex-1">👤 {answer}</p>
                <button type="button" onClick={() => editWhy(i)}
                  className="shrink-0 text-xs text-gray-400 hover:text-gray-700 underline transition-colors">
                  修正
                </button>
              </div>
            </div>
          ))}

          {whyPhase === 'input' && (
            <div>
              <p className="text-sm font-bold text-gray-800 mb-2">
                なぜ{whyChain.length + 1}
                <span className="text-xs font-normal text-gray-500 ml-2">
                  {whyChain.length === 0 ? '（なぜそれが起きたのですか？）' : '（では、なぜそうなったのですか？）'}
                </span>
              </p>
              <div className="space-y-2">
                <textarea value={whyInput} onChange={e => setWhyInput(e.target.value)}
                  rows={2} placeholder="回答を入力してください" className={taCls} />
                <div className="flex justify-end">
                  <button type="button" onClick={submitWhy} disabled={!whyInput.trim()}
                    className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold disabled:opacity-40 transition-colors">
                    入力 →
                  </button>
                </div>
              </div>
            </div>
          )}

          {whyPhase === 'checkpoint' && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-sm font-bold text-amber-900">本当にそれが根本的な原因だと思いますか？</p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setWhyPhase('input')}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-gray-600 hover:bg-stone-50 transition-colors">
                  もう一段掘り下げる
                </button>
                <button type="button" onClick={() => setWhyPhase('done')}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-colors">
                  これで真因分析は完了です
                </button>
              </div>
            </div>
          )}

          {whyPhase === 'done' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <p className="text-sm font-bold text-emerald-800">✅ なぜなぜ分析が完了しました（{whyChain.length}回）</p>
            </div>
          )}
        </div>
      </div>

      {/* ④ 真因・真因カテゴリー */}
      <div className="bg-white rounded-2xl shadow-sm mb-4 p-5 space-y-4">
        <div>
          <label className={labelCls}>④ 特定した真因 <span className="text-red-500">*</span></label>
          <p className={guideCls}>個人ではなく、仕組みや体制の観点で</p>
          <textarea value={rootCause} onChange={e => setRootCause(e.target.value)}
            rows={3} placeholder="例：作業前確認の手順が形骸化しており、現場での実施確認が省略されていた"
            className={taCls} />
        </div>
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
      </div>

      {/* ⑤ 改善策・担当者・期限・進捗 */}
      <div className="bg-white rounded-2xl shadow-sm mb-4 p-5 space-y-4">
        <p className="text-sm font-bold text-gray-800">⑤ 改善策</p>
        <div>
          <label className={labelCls}>改善策 <span className="text-red-500">*</span></label>
          <p className={guideCls}>今後同じことが起きないために何を変えますか？</p>
          <textarea value={improvement} onChange={e => setImprovement(e.target.value)}
            rows={4} placeholder="例：全部署共通の作業前確認を策定し、月次で見直す体制を設ける"
            className={taCls} />
        </div>
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
        </div>
        <div>
          <label className={labelCls}>進捗状況 <span className="text-red-500">*</span></label>
          <div className="flex gap-5 mt-1">
            {['未着手', '進行中', '完了'].map(p => (
              <label key={p} className="flex items-center gap-1.5 cursor-pointer select-none">
                <input type="radio" name="root_analysis_progress" value={p} checked={actionProgress === p}
                  onChange={() => setActionProgress(p)} className="accent-emerald-600" />
                <span className={cn('text-sm font-semibold',
                  p === '完了' ? 'text-emerald-700' : p === '進行中' ? 'text-blue-700' : 'text-gray-500')}>
                  {p}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* ⑥ 横展開 */}
      <div className="bg-white rounded-2xl shadow-sm mb-5 p-5 space-y-4">
        <p className="text-sm font-bold text-gray-800">⑥ 横展開</p>
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
      </div>

      <div className="flex gap-3 pb-8">
        <button type="button" onClick={handleSubmit} disabled={submitting || !canSubmit}
          className="flex-1 h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed">
          {submitting ? '送信中...' : existing ? '修正して再提出 →' : '原因分析・改善報告書を提出 →'}
        </button>
      </div>
    </div>
  )
}
