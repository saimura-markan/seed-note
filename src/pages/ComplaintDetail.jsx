import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, PhoneOff, ClipboardList, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

// ─── 定数 ───────────────────────────────────────────────────────────────────

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

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function calcTimer(receivedAt, deadlineMinutes) {
  if (!receivedAt) return null
  const remaining = (deadlineMinutes * 60 * 1000 - (Date.now() - new Date(receivedAt).getTime())) / 1000
  const pad = n => String(Math.floor(Math.abs(n))).padStart(2, '0')
  if (remaining < 0) {
    const over = -remaining
    return { overdue: true, label: `+${pad(over / 60)}:${pad(over % 60)} 超過` }
  }
  return { overdue: false, label: `${pad(remaining / 60)}:${pad(remaining % 60)}` }
}

// ─── 進捗バー ─────────────────────────────────────────────────────────────────

function ProgressBar({ status }) {
  const step = statusToStep(status)
  return (
    <div className="bg-white rounded-2xl shadow-sm px-6 py-4 mb-5">
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const done    = i < step
          const current = i === step
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

// ─── ヘッダーカード ───────────────────────────────────────────────────────────

function ComplaintHeader({ c, timer }) {
  const pc = PRIORITY[c.emotion_level] ?? PRIORITY[3]
  return (
    <div className={cn('bg-white rounded-2xl shadow-sm mb-5 p-5 border-l-4', pc.border)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-mono text-gray-400">{c.id?.slice(0, 8).toUpperCase()}</span>
            <span className={cn('text-xs font-bold px-2.5 py-0.5 rounded-full', pc.bg, pc.text)}>
              Lv.{c.emotion_level} {pc.label}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold border border-red-200">
              🚨 クレーム
            </span>
          </div>
          <p className="font-bold text-gray-900 text-[17px] leading-snug">{c.client_name || '—'}</p>
          <p className="text-sm text-gray-500 mt-0.5">{c.site_name}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
            <span>社内担当：<strong className="text-gray-700">{c.assignee || '—'}</strong></span>
            <span>受付日時：{fmtDateTime(c.received_at)}</span>
          </div>
        </div>
        {timer && (
          <div className={cn('shrink-0 text-right', timer.overdue ? 'text-red-600' : 'text-gray-700')}>
            <div className="text-[26px] font-black tabular-nums leading-none">{timer.label}</div>
            <div className="text-[11px] mt-0.5">{timer.overdue ? '期限超過' : '残り対応時間'}</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── セクションカード ─────────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-stone-100">
        <Icon size={15} className="text-emerald-600" />
        <span className="text-sm font-bold text-gray-800">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ─── メイン ──────────────────────────────────────────────────────────────────

export default function ComplaintDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [complaint, setComplaint]         = useState(null)
  const [contactLogs, setContactLogs]     = useState([])
  const [hearingLog, setHearingLog]       = useState(null)
  const [contactInput, setContactInput]   = useState('')
  const [hearingInput, setHearingInput]   = useState('')
  const [judgment, setJudgment]           = useState(null)
  const [saving, setSaving]               = useState(false)
  const [loading, setLoading]             = useState(true)
  const [, setTick]                       = useState(0)
  const [toast, setToast]                 = useState('')
  const [plannedAt, setPlannedAt]         = useState('')
  const [supervisorNote, setSupervisorNote] = useState('')
  const [improvementReport, setImprovementReport] = useState('')

  // 1秒ごとにタイマー更新
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const fetchData = useCallback(async () => {
    const [{ data: c }, { data: logs }] = await Promise.all([
      supabase.from('complaints').select('*').eq('id', id).maybeSingle(),
      supabase.from('complaint_logs').select('*').eq('complaint_id', id).order('created_at'),
    ])
    if (c) { setComplaint(c); setJudgment(c.judgment || null); setImprovementReport(c.improvement_report || '') }
    if (logs) {
      setContactLogs(logs.filter(l => l.type === 'contact'))
      const h = logs.filter(l => l.type === 'hearing').pop()
      if (h) { setHearingLog(h); setHearingInput(h.content) }
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  // ステータスを '対応中' に更新（最初のログ記録時）
  const ensureActive = async () => {
    if (!complaint || complaint.status !== '受付済') return
    await supabase.from('complaints').update({ status: '対応中' }).eq('id', id)
    setComplaint(c => ({ ...c, status: '対応中' }))
  }

  // 繋がらず記録
  const handleNotReached = async () => {
    setSaving(true)
    await ensureActive()
    const { data } = await supabase.from('complaint_logs').insert({
      complaint_id: id, type: 'contact', content: '繋がらず',
    }).select().single()
    if (data) setContactLogs(prev => [...prev, data])
    setSaving(false)
  }

  // 連絡ログ記録
  const handleContactLog = async () => {
    if (!contactInput.trim()) return
    setSaving(true)
    await ensureActive()
    const { data } = await supabase.from('complaint_logs').insert({
      complaint_id: id, type: 'contact', content: contactInput.trim(),
    }).select().single()
    if (data) { setContactLogs(prev => [...prev, data]); setContactInput('') }
    setSaving(false)
  }

  // 聞き取り記録（upsert）
  const handleHearingLog = async () => {
    if (!hearingInput.trim()) return
    setSaving(true)
    await ensureActive()
    if (hearingLog) {
      const { data } = await supabase.from('complaint_logs')
        .update({ content: hearingInput.trim() }).eq('id', hearingLog.id).select().single()
      if (data) setHearingLog(data)
    } else {
      const { data } = await supabase.from('complaint_logs').insert({
        complaint_id: id, type: 'hearing', content: hearingInput.trim(),
      }).select().single()
      if (data) setHearingLog(data)
    }
    setSaving(false)
  }

  // 対応判断
  const handleJudgment = async (j) => {
    setJudgment(j)
    setPlannedAt('')
    setSupervisorNote('')
    await supabase.from('complaints').update({
      judgment: j,
      status: '是正案提出',
    }).eq('id', id)
    setComplaint(c => ({ ...c, judgment: j, status: '是正案提出' }))
  }

  // 上司に報告
  const handleReportToSupervisor = async () => {
    setSaving(true)
    const content = judgment === '手直し'
      ? `手直し対応予定：${fmtDateTime(plannedAt)}`
      : `上司へ報告（自分の考え）：${supervisorNote}`
    console.log('[handleReportToSupervisor] insert:', { complaint_id: id, type: 'report', content })
    const { error } = await supabase.from('complaint_logs').insert({
      complaint_id: id, type: 'report', content,
    })
    if (error) {
      console.error('[handleReportToSupervisor] Supabase error:', error)
      setSaving(false)
      return
    }
    const reportedAt = new Date().toISOString()
    await supabase.from('complaints').update({ status: '是正案提出', supervisor_reported_at: reportedAt }).eq('id', id)
    setComplaint(c => ({ ...c, status: '是正案提出', supervisor_reported_at: reportedAt }))
    setSaving(false)
    setToast('上司に報告しました ✅')
    setTimeout(() => {
      setToast('')
      navigate(`/complaints/${id}`)
    }, 2500)
  }

  // 改善報告書提出
  const handleSubmitImprovementReport = async () => {
    if (!improvementReport.trim()) return
    setSaving(true)
    await supabase.from('complaints').update({
      improvement_report: improvementReport,
      improvement_reported_at: new Date().toISOString(),
      status: '改善報告書提出',
    }).eq('id', id)
    setComplaint(c => ({ ...c, improvement_report: improvementReport, status: '改善報告書提出' }))
    setSaving(false)
    setToast('改善報告書を提出しました ✅')
    setTimeout(() => setToast(''), 2500)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-gray-400">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mr-3" />
      読み込み中...
    </div>
  )
  if (!complaint) return (
    <div className="px-6 py-12 text-center text-gray-400">
      <p className="text-4xl mb-3">🌱</p><p>クレームが見つかりませんでした</p>
    </div>
  )

  const timer = calcTimer(complaint.received_at, complaint.deadline_minutes)

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg text-sm font-bold">
          {toast}
        </div>
      )}
      <button onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-5 transition-colors">
        <ArrowLeft size={15} /> ダッシュボードに戻る
      </button>

      <ProgressBar status={complaint.status} />
      <ComplaintHeader c={complaint} timer={timer} />

      {/* ① お客様への連絡 */}
      <SectionCard title="① お客様への連絡" icon={Phone}>
        {/* ログ一覧 */}
        {contactLogs.length > 0 && (
          <div className="mb-4 space-y-2">
            {contactLogs.map(log => (
              <div key={log.id} className={cn(
                'flex items-start gap-3 px-4 py-2.5 rounded-xl text-sm border',
                log.content === '繋がらず'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              )}>
                <span className="font-bold shrink-0">{log.content === '繋がらず' ? '🔴' : '✅'}</span>
                <span className="flex-1">{log.content}</span>
                <span className="text-[11px] text-gray-400 shrink-0 mt-0.5">{fmtDateTime(log.created_at)}</span>
              </div>
            ))}
          </div>
        )}

        {/* 繋がらずボタン */}
        <button type="button" onClick={handleNotReached} disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 text-sm font-bold hover:bg-red-100 transition-colors mb-3 disabled:opacity-50">
          <PhoneOff size={14} /> 繋がらず
        </button>

        {/* 記録入力 */}
        <div className="flex gap-2">
          <textarea value={contactInput} onChange={e => setContactInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && e.shiftKey && handleContactLog()}
            className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition resize-none"
            rows={3}
            placeholder="連絡内容を入力（例：折り返しの了承をいただいた）&#10;Shift+Enterで送信" />
          <button type="button" onClick={handleContactLog} disabled={saving || !contactInput.trim()}
            className="px-4 h-10 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-colors disabled:opacity-40">
            記録する
          </button>
        </div>
      </SectionCard>

      {/* ② 作業者からの聞き取り */}
      <SectionCard title="② 作業者からの聞き取り" icon={ClipboardList}>
        <textarea value={hearingInput} onChange={e => setHearingInput(e.target.value)}
          rows={4} placeholder="作業者からの聞き取り内容を記録してください"
          className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition resize-none mb-3" />
        <div className="flex items-center justify-between">
          {hearingLog && (
            <span className="text-xs text-gray-400">最終更新：{fmtDateTime(hearingLog.created_at)}</span>
          )}
          <button type="button" onClick={handleHearingLog} disabled={saving || !hearingInput.trim()}
            className="ml-auto px-4 h-10 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-colors disabled:opacity-40">
            記録する
          </button>
        </div>
      </SectionCard>

      {/* ③ 対応判断 */}
      <div className="bg-white rounded-2xl shadow-sm mb-8 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-stone-100">
          <span className="text-sm font-bold text-gray-800">③ 対応判断</span>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          {[
            {
              key: '手直し',
              icon: '🔧',
              title: '手直しで対応',
              desc: '現場で是正する',
              color: judgment === '手直し' ? 'ring-2 ring-emerald-400 border-emerald-300 bg-emerald-50' : 'border-stone-200 hover:border-emerald-300 hover:bg-emerald-50/50',
            },
            {
              key: '事業責任者',
              icon: '👤',
              title: '事業責任者へ確認',
              desc: '上司の指示を仰ぐ',
              color: judgment === '事業責任者' ? 'ring-2 ring-amber-400 border-amber-300 bg-amber-50' : 'border-stone-200 hover:border-amber-300 hover:bg-amber-50/50',
            },
          ].map(j => (
            <button key={j.key} type="button"
              onClick={() => handleJudgment(j.key)}
              className={cn(
                'flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all cursor-pointer',
                j.color
              )}>
              <span className="text-3xl">{j.icon}</span>
              <span className="font-bold text-gray-900 text-sm">{j.title}</span>
              <span className="text-xs text-gray-500">{j.desc}</span>
              {judgment === j.key && (
                <span className={cn(
                  'flex items-center gap-1 text-xs font-bold mt-1',
                  j.key === '手直し' ? 'text-emerald-700' : 'text-amber-700'
                )}>
                  <ChevronRight size={12} /> 選択中
                </span>
              )}
            </button>
          ))}
        </div>
        {judgment === '手直し' && (
          <div className="px-5 pb-5 space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">手直し予定日時</label>
              <input type="datetime-local" value={plannedAt} onChange={e => setPlannedAt(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
            </div>
            {plannedAt && (
              <button type="button" onClick={handleReportToSupervisor} disabled={saving}
                className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm transition-colors disabled:opacity-40">
                上司に報告する
              </button>
            )}
          </div>
        )}
        {judgment === '事業責任者' && (
          <div className="px-5 pb-5 space-y-3">
            <textarea
              value={supervisorNote}
              onChange={e => setSupervisorNote(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && e.shiftKey && supervisorNote.trim() && handleReportToSupervisor()}
              rows={4}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition resize-none"
              placeholder={`お客様のご意見と作業者への聞き取りを踏まえ、あなたはどうすべきだと思いますか？\nShift+Enterで送信`}
            />
            {supervisorNote.trim() && (
              <button type="button" onClick={handleReportToSupervisor} disabled={saving}
                className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm transition-colors disabled:opacity-40">
                上司に報告する
              </button>
            )}
          </div>
        )}
      </div>

      {/* ④ 差し戻しセクション */}
      {complaint.status === '是正案差し戻し' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-4">
          <p className="text-sm font-bold text-red-700 mb-3">⚠️ 是正案が差し戻されました</p>
          {complaint.supervisor_comment && (
            <div className="bg-white rounded-xl px-4 py-3 text-sm text-gray-700 mb-4 border border-red-100">
              <p className="text-xs font-semibold text-red-600 mb-1">事業責任者のコメント</p>
              <p className="leading-relaxed">{complaint.supervisor_comment}</p>
            </div>
          )}
          <button onClick={() => navigate(`/complaints/${id}/correction`)}
            className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors">
            是正案を修正して再提出
          </button>
        </div>
      )}

      {/* ④ 改善報告書セクション */}
      {complaint.status === '是正案承認' && (
        <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-100 bg-green-50">
            <span className="text-sm font-bold text-green-800">✅ 是正案が承認されました</span>
          </div>
          <div className="p-5">
            <p className="text-sm text-gray-600 mb-3">最終改善報告書を作成してください。</p>
            <textarea
              value={improvementReport}
              onChange={e => setImprovementReport(e.target.value)}
              rows={5}
              placeholder="今回のクレーム対応を通じて、何を学び、今後どう活かすかを記述してください"
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition resize-none mb-3"
            />
            <button onClick={handleSubmitImprovementReport} disabled={saving || !improvementReport.trim()}
              className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm transition-colors disabled:opacity-40">
              改善報告書を提出する
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
