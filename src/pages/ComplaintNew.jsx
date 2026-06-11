import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

// ─── 定数 ────────────────────────────────────────────────────────────────────

const CATEGORIES = ['破損', '施工不備', '遅刻', 'マナー', '近隣トラブル', 'その他']

const EMOTION_LEVELS = [
  { level: 1, label: '穏やか',       deadline: 60 },
  { level: 2, label: 'やや気になる', deadline: 60 },
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

// 部署 → デフォルト担当者（手動変更可）
const DEPARTMENTS = {
  '清掃部 清掃１課':  '井上参事',
  '清掃部 清掃２課':  '備主任',
  '工事部 解体課':    '松木主任',
  '工事部 産廃課':    '新田主任',
  '環境リサイクル部': '岡橋次長',
  '本部':            '榮藤取締役',
}

const INITIAL_FORM = {
  clientName: '', clientContact: '', siteName: '',
  workerName: '', category: '', content: '',
  emotionLevel: 3, department: '', assignee: '', receiverName: '',
}

// ─── スタイル定数 ─────────────────────────────────────────────────────────────

const inputCls = 'w-full h-10 px-3 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition'
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5'

// ─── メイン ──────────────────────────────────────────────────────────────────

export default function ComplaintNew() {
  const navigate = useNavigate()
  const [form, setForm]       = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [receivedAt]          = useState(() => new Date())
  const [now, setNow]         = useState(() => new Date())

  // リアルタイム時計
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // ログイン中ユーザーのfull_nameを受付者名に自動入力
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const userId = data.session?.user?.id
      if (!userId) return
      const { data: profile } = await supabase
        .from('profiles').select('full_name').eq('id', userId).maybeSingle()
      if (profile?.full_name) set('receiverName', profile.full_name)
    })
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const handleClear = () => setForm(INITIAL_FORM)

  // ─── 送信ロジック（変更禁止） ──────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.content.trim()) return
    setSubmitting(true)
    const deadlineCfg = EMOTION_LEVELS[form.emotionLevel - 1]
    const deadlineMs  = deadlineCfg.deadline * 60 * 1000
    const { error } = await supabase.from('complaints').insert({
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
      status:            '受付済',
    })
    setSubmitting(false)
    if (error) { alert('登録に失敗しました: ' + error.message); return }
    navigate('/dashboard')
  }
  // ──────────────────────────────────────────────────────────────────────────

  // 時刻・日付フォーマット
  const timeStr = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = now.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })

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

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: '#F5F0E8' }}>

      {/* ══════════ ヘッダー ══════════ */}
      <div className="bg-white border-b border-stone-200 px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">

          {/* 左：ロゴ＋コピー */}
          <div className="flex items-center gap-3">
            <svg width="32" height="36" viewBox="0 0 32 36" fill="none">
              <line x1="16" y1="34" x2="16" y2="18" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/>
              <ellipse cx="9" cy="14" rx="9" ry="5.5" transform="rotate(-15 9 14)" fill="#4ade80"/>
              <ellipse cx="23" cy="14" rx="9" ry="5.5" transform="rotate(15 23 14)" fill="#22c55e"/>
            </svg>
            <div>
              <p className="text-base font-bold leading-tight text-gray-900">Seed Note</p>
              <p className="text-[11px] text-gray-400">クレームは、成長の種。</p>
            </div>
          </div>

          {/* 右：リアルタイム時刻 */}
          <div className="text-right">
            <p className="text-xl font-mono font-bold tabular-nums text-gray-800">{timeStr}</p>
            <p className="text-xs text-gray-400">{dateStr}</p>
          </div>
        </div>
      </div>

      {/* ══════════ フォーム ══════════ */}
      <div className="max-w-none px-8 pt-6">
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
              <div>
                <label className={labelCls}>元請様名</label>
                <input value={form.clientName} onChange={e => set('clientName', e.target.value)}
                  className={inputCls} placeholder="山田工務店" />
              </div>
              <div>
                <label className={labelCls}>元請担当者様名</label>
                <input value={form.clientContact} onChange={e => set('clientContact', e.target.value)}
                  className={inputCls} placeholder="山田 太郎 様" />
              </div>
              <div>
                <label className={labelCls}>現場名</label>
                <input value={form.siteName} onChange={e => set('siteName', e.target.value)}
                  className={inputCls} placeholder="〇〇ビル A棟" />
              </div>
            </div>
            <div>
              <label className={labelCls}>現場作業者名</label>
              <input value={form.workerName} onChange={e => set('workerName', e.target.value)}
                className={inputCls + ' max-w-xs'} placeholder="中村 太郎" />
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

            {/* レベルカード */}
            <div className="grid grid-cols-5 gap-2">
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
                  : 'bg-red-50 border-red-200'
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs font-bold', isUrgent && !isExpired ? 'text-white' : 'text-red-600')}>
                    ⏱ 対応期限
                  </span>
                  <span className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full',
                    isUrgent && !isExpired
                      ? 'bg-white/20 text-white'
                      : 'bg-red-100 text-red-600'
                  )}>
                    自動表示
                  </span>
                </div>
                <span className={cn(
                  'text-xs font-semibold',
                  isUrgent && !isExpired ? 'text-white' : 'text-red-500'
                )}>
                  Lv.{form.emotionLevel}「{deadlineCfg.label}」→ {deadlineCfg.deadline}分以内
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className={cn(
                  'text-3xl font-black tabular-nums font-mono',
                  isExpired ? 'text-gray-400' : isUrgent ? 'text-white' : 'text-red-600'
                )}>
                  {remMM}:{remSS}
                </span>
                <span className={cn(
                  'text-xs',
                  isExpired ? 'text-gray-400' : isUrgent ? 'text-red-100' : 'text-red-400'
                )}>
                  {isExpired ? '期限超過' : '残り時間'}
                </span>
              </div>
            </div>
          </div>

          {/* 担当 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <p className="text-sm font-bold text-gray-800">担当</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>担当部署</label>
                <select value={form.department}
                  onChange={e => {
                    const dept = e.target.value
                    set('department', dept)
                    set('assignee', DEPARTMENTS[dept] || '')
                  }}
                  className={inputCls + ' bg-white'}>
                  <option value="">選択してください</option>
                  {Object.keys(DEPARTMENTS).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>
                  担当者
                  {form.department && (
                    <span className="ml-1.5 text-[10px] font-normal text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">自動入力・変更可</span>
                  )}
                </label>
                <input value={form.assignee} onChange={e => set('assignee', e.target.value)}
                  className={inputCls} placeholder="部署を選択すると自動入力されます" />
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

    </div>
  )
}
