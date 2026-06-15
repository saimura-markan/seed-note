import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function CorrectionSubmit() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [complaint,      setComplaint]      = useState(null)
  const [contactLogs,    setContactLogs]    = useState([])
  const [hearingContent, setHearingContent] = useState('')
  const [existing,       setExisting]       = useState(null)

  const [directCause, setDirectCause] = useState('')
  const [correction,  setCorrection]  = useState('')
  const [improvement, setImprovement] = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [loading,     setLoading]     = useState(true)

  // ── ソクラテス対話（固定質問） ──
  // phase: idle | q1 | q2 | final_check | retry | complete
  const [socrPhase, setSocrPhase] = useState('idle')
  const [answers,   setAnswers]   = useState({ q1: '', q2: '', retry: '' })
  const [inputs,    setInputs]    = useState({ q1: '', q2: '', retry: '' })
  // DB からの初期ロード時はソクラテス対話を自動起動しない
  const loadingFromDb = useRef(false)

  const setInput = (key, val) => setInputs(prev => ({ ...prev, [key]: val }))

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
      loadingFromDb.current = true
      setExisting(corr[0])
      setDirectCause(corr[0].direct_cause || '')
      setCorrection(corr[0].correction || '')
      setImprovement(corr[0].improvement || '')
      // ソクラテス式対話の回答履歴を復元
      const sa = corr[0].socratic_answers
      if (sa && sa.q1) {
        setAnswers({ q1: sa.q1 || '', q2: sa.q2 || '', retry: sa.retry || '' })
        setInputs({ q1: sa.q1 || '', q2: sa.q2 || '', retry: sa.retry || '' })
        setSocrPhase('complete')
      }
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  // 直接原因が入力されたらQ1を自動表示、消したらリセット
  // DB からの初期ロード時はスキップ（再提出時に既存データをそのまま表示するため）
  useEffect(() => {
    if (loadingFromDb.current) {
      loadingFromDb.current = false
      return
    }
    if (directCause.trim() && socrPhase === 'idle') {
      setSocrPhase('q1')
    } else if (!directCause.trim()) {
      setSocrPhase('idle')
      setAnswers({ q1: '', q2: '', retry: '' })
      setInputs({ q1: '', q2: '', retry: '' })
    }
  }, [directCause]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 確定・修正ハンドラ ──
  const submitQ1 = () => {
    if (!inputs.q1.trim()) return
    setAnswers(prev => ({ ...prev, q1: inputs.q1.trim() }))
    setSocrPhase('q2')
  }

  const editQ1 = () => {
    setInputs(prev => ({ ...prev, q1: answers.q1 }))
    setAnswers({ q1: '', q2: '', retry: '' })
    setInputs(prev => ({ ...prev, q1: answers.q1, q2: '', retry: '' }))
    setSocrPhase('q1')
  }

  const submitQ2 = () => {
    if (!inputs.q2.trim()) return
    setAnswers(prev => ({ ...prev, q2: inputs.q2.trim() }))
    setSocrPhase('final_check')
  }

  const editQ2 = () => {
    setInputs(prev => ({ ...prev, q2: answers.q2, retry: '' }))
    setAnswers(prev => ({ ...prev, q2: '', retry: '' }))
    setSocrPhase('q2')
  }

  const handleFinalYes = () => {
    const parts = []
    if (answers.q2)    parts.push(`・${answers.q2}`)
    if (answers.retry) parts.push(`・${answers.retry}`)
    setImprovement(parts.join('\n'))
    setSocrPhase('complete')
  }

  const submitRetry = () => {
    if (!inputs.retry.trim()) return
    setAnswers(prev => ({ ...prev, retry: inputs.retry.trim() }))
    setSocrPhase('final_check')
  }

  const canSubmit = directCause.trim() && correction.trim() && improvement.trim()

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    const payload = {
      complaint_id: id,
      direct_cause: directCause,
      correction,
      improvement,
      socratic_answers: { q1: answers.q1, q2: answers.q2, retry: answers.retry },
    }
    if (existing) {
      await supabase.from('complaint_corrections').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('complaint_corrections').insert(payload)
    }
    const nextStatus = ['是正案承認', 'correction_rejected'].includes(complaint?.status) ? '改善報告書提出' : '是正案提出'
    await supabase.from('complaints').update({ status: nextStatus }).eq('id', id)
    setSubmitting(false)
    navigate(`/complaints/${id}`)
  }

  const handleClear = () => {
    setDirectCause(''); setCorrection(''); setImprovement('')
    setSocrPhase('idle')
    setAnswers({ q1: '', q2: '', retry: '' })
    setInputs({ q1: '', q2: '', retry: '' })
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

  // 表示判定
  const showQ2    = socrPhase !== 'idle' && socrPhase !== 'q1' && answers.q1
  const showFinal = ['final_check', 'retry', 'complete'].includes(socrPhase) && answers.q2
  const showRetry = socrPhase === 'retry' || (socrPhase === 'complete' && answers.retry)

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <button onClick={() => navigate(`/complaints/${id}`)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-5 transition-colors">
        <ArrowLeft size={15} /> クレーム詳細に戻る
      </button>

      <h2 className="text-lg font-bold text-gray-900 mb-5">改善報告書（現象原因の特定）</h2>

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
          🌱 対応が完了したら、何が起きてなぜそうなったかを整理して提出してください。
        </p>
      </div>

      {/* ① 発生事実 */}
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

      {/* ── ソクラテス対話 ── */}
      {socrPhase !== 'idle' && (
        <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden border-l-4 border-l-emerald-400">
          <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50">
            <span className="text-sm font-bold text-gray-700">🤖 原因の深掘り</span>
          </div>
          <div className="p-5 space-y-5">

            {/* Q1 */}
            <div>
              <p className="text-sm font-bold text-gray-800 mb-2">その原因はなぜ起きたのでしょうか？</p>
              {socrPhase === 'q1' ? (
                <div className="space-y-2">
                  <textarea
                    value={inputs.q1}
                    onChange={e => setInput('q1', e.target.value)}
                    rows={2}
                    placeholder="回答を入力してください"
                    className={taCls}
                  />
                  <div className="flex justify-end">
                    <button type="button" onClick={submitQ1} disabled={!inputs.q1.trim()}
                      className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold disabled:opacity-40 transition-colors">
                      入力 →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 bg-stone-50 rounded-xl px-4 py-2.5">
                  <p className="text-sm text-gray-700 flex-1">👤 {answers.q1}</p>
                  <button type="button" onClick={editQ1}
                    className="shrink-0 text-xs text-gray-400 hover:text-gray-700 underline transition-colors">
                    修正
                  </button>
                </div>
              )}
            </div>

            {/* Q2 */}
            {showQ2 && (
              <div>
                <p className="text-sm font-bold text-gray-800 mb-2">では2度と起きないようにするには何が必要だと思いますか？</p>
                {socrPhase === 'q2' ? (
                  <div className="space-y-2">
                    <textarea
                      value={inputs.q2}
                      onChange={e => setInput('q2', e.target.value)}
                      rows={2}
                      placeholder="回答を入力してください"
                      className={taCls}
                    />
                    <div className="flex justify-end">
                      <button type="button" onClick={submitQ2} disabled={!inputs.q2.trim()}
                        className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold disabled:opacity-40 transition-colors">
                        入力 →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 bg-stone-50 rounded-xl px-4 py-2.5">
                    <p className="text-sm text-gray-700 flex-1">👤 {answers.q2}</p>
                    <button type="button" onClick={editQ2}
                      className="shrink-0 text-xs text-gray-400 hover:text-gray-700 underline transition-colors">
                      修正
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 最終確認 */}
            {showFinal && (
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <p className="text-sm font-bold text-amber-900">本当にそれで2度と起きませんか？</p>
                </div>

                {socrPhase === 'final_check' && (
                  <div className="flex gap-3">
                    <button type="button" onClick={() => { setInput('retry', ''); setSocrPhase('retry') }}
                      className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-gray-600 hover:bg-stone-50 transition-colors">
                      いいえ、もう少し考えます
                    </button>
                    <button type="button" onClick={handleFinalYes}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-colors">
                      はい、大丈夫です
                    </button>
                  </div>
                )}

                {/* 追加質問（いいえの場合） */}
                {showRetry && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">では何が足りないと思いますか？</p>
                    {socrPhase === 'retry' ? (
                      <div className="space-y-2">
                        <textarea
                          value={inputs.retry}
                          onChange={e => setInput('retry', e.target.value)}
                          rows={2}
                          placeholder="回答を入力してください"
                          className={taCls}
                        />
                        <div className="flex justify-end">
                          <button type="button" onClick={submitRetry} disabled={!inputs.retry.trim()}
                            className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold disabled:opacity-40 transition-colors">
                            入力 →
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-stone-50 rounded-xl px-4 py-2.5 text-sm text-gray-700">
                        👤 {answers.retry}
                      </div>
                    )}
                  </div>
                )}

                {/* 完了 */}
                {socrPhase === 'complete' && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                    <p className="text-sm font-bold text-emerald-800">✅ これがあなたの考える原因と対策ですね。</p>
                    <p className="text-sm text-emerald-700 mt-1">問題なければ上司に報告を上げましょう。④ 運用改善案に自動で反映しました。</p>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

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
        <label className={labelCls}>
          ④ 運用改善案 <span className="text-red-500">*</span>
          {socrPhase === 'complete' && (
            <span className="ml-2 text-emerald-600 font-semibold text-[11px]">（深掘り対話から自動入力）</span>
          )}
        </label>
        <p className={guideCls}>今後同じことが起きないために何を変えますか？</p>
        <textarea value={improvement} onChange={e => setImprovement(e.target.value)}
          rows={5} placeholder="例：養生確認チェックリストを刷新し、作業前の確認を管理者と2名で行う体制を整備する"
          className={taCls} />
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
