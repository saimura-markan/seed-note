import { useState, useEffect, useRef } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

// ─── 定数 ────────────────────────────────────────────────────────────────────

const CATEGORIES = ['破損', '施工不備', '遅刻', 'マナー', '近隣トラブル', 'その他']

const EMOTION_LEVELS = [
  { level: 1, label: '穏やか',       deadline: 60 },
  { level: 2, label: '気になる', deadline: 60 },
  { level: 3, label: '注意',         deadline: 60 },
  { level: 4, label: '緊張',         deadline: 30 },
  { level: 5, label: '最高緊張',     deadline: 15 },
]

// 感情レベル別カラー
const LEVEL_COLOR = {
  1: { active: '#16a34a', light: '#f0fdf4', border: '#bbf7d0', label: 'text-green-700' },
  2: { active: '#65a30d', light: '#f7fee7', border: '#d9f99d', label: 'text-lime-700' },
  3: { active: '#ca8a04', light: '#fefce8', border: '#fef08a', label: 'text-yellow-700' },
  4: { active: '#ea580c', light: '#fff7ed', border: '#fed7aa', label: 'text-orange-700' },
  5: { active: '#dc2626', light: '#fef2f2', border: '#fecaca', label: 'text-red-700' },
}

// 部署 → 管理者・事業責任者（手動変更可、将来はアカウント紐付け予定）
const DEPT_STAFF = {
  '工事部 産廃課':    { manager: '新田主任',  director: '小笠原常務' },
  '工事部 解体課':    { manager: '松木主任',  director: '小笠原常務' },
  '清掃部 清掃１課':  { manager: '井上参事',  director: '川畑次長' },
  '清掃部 清掃２課':  { manager: '備主任',    director: '川畑次長' },
  '環境リサイクル部': { manager: '岡橋次長',  director: '小笠原常務' },
  '本部':             { manager: '中田主任',  director: '榮藤取締役' },
}

const INITIAL_FORM = {
  clientName: '', clientContact: '', siteName: '',
  workerName: '', category: '', content: '',
  emotionLevel: 3, department: '', assignee: '', director: '', receiverName: '', workDate: '',
}

// ─── スタイル定数 ─────────────────────────────────────────────────────────────

const inputCls = 'w-full h-10 px-3 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition'
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5'

// ─── メイン ──────────────────────────────────────────────────────────────────

export default function ComplaintNew() {
  const navigate = useNavigate()
  const { user, profileName } = useOutletContext()
  const [form, setForm]         = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [receivedAt]            = useState(() => new Date())
  const [now, setNow]           = useState(() => new Date())
  const [phase, setPhase]       = useState('form')   // 'form' | 'calling'
  const [complaintId, setComplaintId] = useState(null)
  const [callStartTime, setCallStartTime] = useState(0)
  const [elapsed, setElapsed]   = useState(0)

  // 元請様名サジェスト
  const [suggestions,     setSuggestions]     = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestRef = useRef(null)

  // リアルタイム時計
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // ログイン中ユーザーの名前を受付者名に自動入力（profilesテーブル優先）
  useEffect(() => {
    const name = profileName || user?.user_metadata?.full_name
    if (name) set('receiverName', name)
  }, [profileName, user])

  // calling フェーズの経過時間カウントアップ
  useEffect(() => {
    if (phase !== 'calling') return
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - callStartTime) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [phase, callStartTime])

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handler = e => {
      if (suggestRef.current && !suggestRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ひらがな→カタカナ変換（「なさ」→「ナサ」で中間一致させるため）
  const toKatakana = (str) =>
    str.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60))

  const handleClientNameChange = async (value) => {
    set('clientName', value)
    if (!value.trim()) { setSuggestions([]); setShowSuggestions(false); return }
    const kata = toKatakana(value)
    const filter = kata !== value
      ? `name.ilike.%${value}%,name.ilike.%${kata}%`
      : `name.ilike.%${value}%`
    const { data } = await supabase
      .from('client_companies')
      .select('id, name')
      .or(filter)
      .order('name')
      .limit(10)
    setSuggestions(data ?? [])
    setShowSuggestions(true)
  }

  const handleSuggestSelect = (name) => {
    set('clientName', name)
    setShowSuggestions(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const handleClear = () => setForm(INITIAL_FORM)

  // ─── 送信ロジック ─────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.content.trim()) return
    setSubmitting(true)
    const deadlineCfg = EMOTION_LEVELS[form.emotionLevel - 1]
    const deadlineMs  = deadlineCfg.deadline * 60 * 1000
    const { data, error } = await supabase.from('complaints').insert({
      received_at:       receivedAt.toISOString(),
      client_name:       form.clientName,
      client_contact:    form.clientContact,
      site_name:         form.siteName,
      worker_name:       form.workerName,
      category:          form.category,
      content:           form.content,
      emotion_level:     form.emotionLevel,
      deadline_minutes:  deadlineCfg.deadline,
      response_deadline: new Date(receivedAt.getTime() + deadlineMs).toISOString(),
      department:        form.department,
      assignee:          form.assignee,
      receiver_name:     form.receiverName,
      status:            'calling',
    }).select('id').single()
    setSubmitting(false)
    if (error) { alert('登録に失敗しました: ' + error.message); return }
    setComplaintId(data.id)
    setCallStartTime(Date.now())
    setElapsed(0)
    setPhase('calling')
  }

  const handleCallComplete = async () => {
    const secs = elapsed
    const mins = Math.floor(secs / 60)
    const sec  = secs % 60
    const callCompletedAt = new Date().toISOString()
    await Promise.all([
      supabase.from('complaints').update({
        call_duration_seconds: secs,
        call_completed_at:     callCompletedAt,
        status: 'pending',
      }).eq('id', complaintId),
      supabase.from('complaint_logs').insert({
        complaint_id: complaintId,
        action:       'call_completed',
        detail:       `受付〜連絡完了：${mins}分${sec}秒`,
      }),
    ])
    navigate('/dashboard')
  }
  // ──────────────────────────────────────────────────────────────────────────

  // 時刻・日付フォーマット
  const currentTime = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const currentDate = now.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })

  // カウントダウン計算
  const deadlineCfg   = EMOTION_LEVELS[form.emotionLevel - 1]
  const deadlineTime  = new Date(receivedAt.getTime() + deadlineCfg.deadline * 60 * 1000)
  const remainingMs   = Math.max(0, deadlineTime - now)
  const remSec        = Math.floor(remainingMs / 1000)
  const remMM         = String(Math.floor(remSec / 60)).padStart(2, '0')
  const remSS         = String(remSec % 60).padStart(2, '0')
  const isUrgent      = remainingMs < 5 * 60 * 1000
  const isExpired     = remainingMs === 0

  const lc = LEVEL_COLOR[form.emotionLevel]

  const deadlineBg = {
    1: 'bg-emerald-50 border-emerald-200',
    2: 'bg-lime-50 border-lime-200',
    3: 'bg-amber-50 border-amber-200',
    4: 'bg-orange-50 border-orange-200',
    5: 'bg-red-50 border-red-200',
  }

  const deadlineText = {
    1: 'text-emerald-600',
    2: 'text-lime-600',
    3: 'text-amber-600',
    4: 'text-orange-600',
    5: 'text-red-600',
  }

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: '#F5F0E8' }}>


      {/* ══════════ フォーム ══════════ */}
      <div className="max-w-none px-8 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
        >
          ← 戻る
        </button>
        <h2 className="text-lg font-bold text-gray-900 mb-1">新規クレーム受付</h2>
        <p className="text-xs text-gray-400 mb-5">正確・迅速に記録してください。</p>

        <form id="complaint-form" onSubmit={handleSubmit} className="space-y-4">

          {/* 受付日時 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <p className={labelCls + ' mb-0'}>受付日時</p>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                自動入力
              </span>
            </div>
            <div className="inline-flex items-center gap-3 bg-white border border-stone-200 rounded-xl px-6 py-3 w-fit">
              <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
                <line x1="10" y1="22" x2="10" y2="12" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round"/>
                <ellipse cx="5.5" cy="9.5" rx="5.5" ry="3.5" transform="rotate(-15 5.5 9.5)" fill="#4ade80"/>
                <ellipse cx="14.5" cy="9.5" rx="5.5" ry="3.5" transform="rotate(15 14.5 9.5)" fill="#22c55e"/>
              </svg>
              <p className="text-xl font-medium text-gray-800 tabular-nums">
                {receivedAt.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
                {'　'}
                {receivedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
          </div>

          {/* 基本情報 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <p className="text-sm font-bold text-gray-800">基本情報</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="relative" ref={suggestRef}>
                <label className={labelCls}>元請様名</label>
                <input
                  value={form.clientName}
                  onChange={e => handleClientNameChange(e.target.value)}
                  onFocus={() => form.clientName && setShowSuggestions(suggestions.length > 0)}
                  className={inputCls}
                  placeholder="山田工務店"
                  autoComplete="off"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden">
                    {suggestions.map(c => (
                      <li key={c.id}
                        onMouseDown={() => handleSuggestSelect(c.name)}
                        className="px-3 py-2.5 text-sm text-gray-800 hover:bg-emerald-50 cursor-pointer">
                        {c.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <label className={labelCls}>元請担当者名（フルネーム）</label>
                <input value={form.clientContact} onChange={e => set('clientContact', e.target.value)}
                  className={inputCls} placeholder="山田 太郎 様" />
              </div>
              <div>
                <label className={labelCls}>現場名（ProOneの案件名）</label>
                <input value={form.siteName} onChange={e => set('siteName', e.target.value)}
                  className={inputCls} placeholder="〇〇ビル A棟" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">現場作業者名（Nisite）</label>
                <input
                  type="text"
                  placeholder="中村 太郎"
                  value={form.workerName}
                  onChange={e => set('workerName', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">作業に入った日</label>
                <input
                  type="date"
                  value={form.workDate}
                  onChange={e => set('workDate', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 min-w-0"
                />
              </div>
            </div>
          </div>

          {/* クレーム内容 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <p className="text-sm font-bold text-gray-800">クレーム内容</p>
            <div>
              <label className={labelCls}>カテゴリ</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button key={cat} type="button"
                    onClick={() => set('category', form.category === cat ? '' : cat)}
                    className={cn(
                      'px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all',
                      form.category === cat
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-gray-600 border-stone-200 hover:border-emerald-300 hover:bg-emerald-50'
                    )}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>詳細内容 <span className="text-red-500">*</span></label>
              <textarea required value={form.content} onChange={e => set('content', e.target.value)}
                rows={4} placeholder="クレームの詳細内容を記入してください"
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-none" />
            </div>
          </div>

          {/* 感情レベル */}
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <p className="text-sm font-bold text-gray-800">感情レベル</p>
            <p className="text-xs text-gray-400 mb-3">お客様の感情を数値で表現してください</p>

            {/* レベルカード */}
            <div className="grid grid-cols-5 gap-2 items-stretch">
              {EMOTION_LEVELS.map(({ level, label }) => {
                const c = LEVEL_COLOR[level]
                const selected = form.emotionLevel === level
                return (
                  <button key={level} type="button"
                    onClick={() => set('emotionLevel', level)}
                    className="flex flex-col items-center justify-center py-3 rounded-xl border-2 transition-all"
                    style={selected
                      ? { backgroundColor: c.active, borderColor: c.active, color: 'white' }
                      : { backgroundColor: c.light, borderColor: c.border, color: c.active }
                    }>
                    <span className="text-2xl font-black leading-none mb-1">{level}</span>
                    <span className="text-[10px] font-semibold leading-tight text-center">{label}</span>
                  </button>
                )
              })}
            </div>

            {/* 対応期限カード */}
            <div className={cn(
              'rounded-xl px-4 py-3 border',
              isExpired
                ? 'bg-gray-100 border-gray-200'
                : isUrgent
                  ? 'bg-red-600 border-red-600'
                  : deadlineBg[form.emotionLevel]
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs font-bold', isUrgent && !isExpired ? 'text-white' : deadlineText[form.emotionLevel])}>
                    ⏱ 対応期限
                  </span>
                  <span className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full',
                    isUrgent && !isExpired
                      ? 'bg-white/20 text-white'
                      : cn('bg-white/60', deadlineText[form.emotionLevel])
                  )}>
                    自動表示
                  </span>
                </div>
                <span className={cn(
                  'text-xs font-semibold',
                  isUrgent && !isExpired ? 'text-white' : deadlineText[form.emotionLevel]
                )}>
                  Lv.{form.emotionLevel}「{deadlineCfg.label}」→ {deadlineCfg.deadline}分以内
                </span>
              </div>
              {form.emotionLevel >= 3 && (
                <div className="mt-2 flex flex-col items-start leading-none">
                  <span className={cn('text-3xl font-black tabular-nums', deadlineText[form.emotionLevel])}>
                    {deadlineCfg.deadline}
                  </span>
                  <span className={cn('text-[10px] font-semibold mt-0.5', deadlineText[form.emotionLevel])}>
                    分以内
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 担当 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <p className="text-sm font-bold text-gray-800">担当</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>担当部署</label>
                <select value={form.department}
                  onChange={e => {
                    const dept = e.target.value
                    const staff = DEPT_STAFF[dept] ?? {}
                    setForm(f => ({ ...f, department: dept, assignee: staff.manager || '', director: staff.director || '' }))
                  }}
                  className={inputCls + ' bg-white'}>
                  <option value="">選択してください</option>
                  {Object.keys(DEPT_STAFF).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>
                  管理者（担当者）
                  {form.department && (
                    <span className="ml-1.5 text-[10px] font-normal text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">自動入力・変更可</span>
                  )}
                </label>
                <input value={form.assignee} onChange={e => set('assignee', e.target.value)}
                  className={cn(inputCls, form.department && form.assignee ? 'border-emerald-200 bg-emerald-50' : '')}
                  placeholder="部署を選択すると自動入力" />
              </div>
              <div>
                <label className={labelCls}>
                  事業責任者
                  {form.department && (
                    <span className="ml-1.5 text-[10px] font-normal text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">自動入力・変更可</span>
                  )}
                </label>
                <input value={form.director} onChange={e => set('director', e.target.value)}
                  className={cn(inputCls, form.department && form.director ? 'border-emerald-200 bg-emerald-50' : '')}
                  placeholder="部署を選択すると自動入力" />
              </div>
            </div>
            <div>
              <label className={labelCls}>
                受付者名
                <span className="ml-1.5 text-[10px] font-normal text-gray-400 bg-stone-100 px-1.5 py-0.5 rounded-full">自動入力</span>
              </label>
              <input value={form.receiverName} readOnly
                className={inputCls + ' max-w-xs bg-stone-50 text-gray-500 cursor-default'} />
            </div>
          </div>

        </form>
      </div>

      {/* ══════════ 固定フッターボタン ══════════ */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-6 py-4 z-20">
        <div className="max-w-none px-2 flex gap-3">
          <button type="button" onClick={handleClear}
            className="flex items-center gap-1.5 px-5 h-12 rounded-xl border border-stone-200 text-sm font-semibold text-gray-600 hover:bg-stone-50 transition-colors">
            <X size={14} /> クリア
          </button>
          <button type="submit" form="complaint-form" disabled={submitting || !form.content.trim()}
            className="flex-1 h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-sm font-bold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? '登録中...' : 'この内容で受け付ける'}
          </button>
        </div>
      </div>

      {/* ══════════ 電話連絡中パネル（calling フェーズ） ══════════ */}
      {phase === 'calling' && (() => {
        const elMM = String(Math.floor(elapsed / 60)).padStart(2, '0')
        const elSS = String(elapsed % 60).padStart(2, '0')
        return (
          <div className="fixed right-4 bottom-24 z-30 w-[280px] bg-white rounded-2xl shadow-2xl border border-stone-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl animate-pulse">📞</span>
              <span className="text-sm font-bold text-gray-800">主任へ電話連絡中...</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              {form.assignee || '担当者'} に連絡してください
            </p>
            <div className="text-4xl font-black tabular-nums font-mono text-emerald-700 text-center mb-4 tracking-wider">
              {elMM}:{elSS}
            </div>
            <button
              onClick={handleCallComplete}
              className="w-full h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-sm font-bold transition-colors shadow-sm">
              ✓ 連絡完了
            </button>
          </div>
        )
      })()}

    </div>
  )
}
