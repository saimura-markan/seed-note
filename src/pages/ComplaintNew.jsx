import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

// ─── 定数 ───────────────────────────────────────────────────────────────────

const CATEGORIES = ['破損', '施工不備', '遅刻', 'マナー', '近隣トラブル', 'その他']

const EMOTION_LEVELS = [
  { level: 1, label: '穏やか',       emoji: '😌', deadline: 60,
    bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', ring: 'ring-emerald-400' },
  { level: 2, label: 'やや気になる', emoji: '😐', deadline: 60,
    bg: 'bg-lime-50',    border: 'border-lime-300',    text: 'text-lime-700',    ring: 'ring-lime-400' },
  { level: 3, label: '注意',         emoji: '😟', deadline: 60,
    bg: 'bg-amber-50',   border: 'border-amber-300',   text: 'text-amber-700',   ring: 'ring-amber-400' },
  { level: 4, label: '緊張',         emoji: '😰', deadline: 30,
    bg: 'bg-orange-50',  border: 'border-orange-300',  text: 'text-orange-700',  ring: 'ring-orange-400' },
  { level: 5, label: '最高緊張',     emoji: '😱', deadline: 15,
    bg: 'bg-red-50',     border: 'border-red-300',     text: 'text-red-700',     ring: 'ring-red-400' },
]

const DEPARTMENTS = {
  '解体': ['中村 太郎', '大林 次郎', '井上 三郎', '山田 四郎'],
  '産廃': ['藤本 五郎', '森 六郎', '田村 七郎', '松本 八郎'],
  '養生': ['佐藤 美咲', '斎藤 花子', '岡田 由紀', '渡辺 幸子'],
  '清掃': ['田中 健太', '鈴木 一郎', '高橋 二郎', '伊藤 三郎'],
}

const INITIAL_FORM = {
  clientName: '', clientContact: '', siteName: '',
  workerName: '', category: '', content: '',
  emotionLevel: 3, department: '', assignee: '', receiverName: '',
}

// ─── タイマー表示 ─────────────────────────────────────────────────────────────

function DeadlineBadge({ level }) {
  const cfg = EMOTION_LEVELS[level - 1]
  return (
    <div className={cn('inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold', cfg.bg, cfg.border, cfg.text)}>
      <span className="text-xl">{cfg.emoji}</span>
      <span>Lv.{level}「{cfg.label}」→ <strong>{cfg.deadline}分以内</strong>に対応が必要です</span>
    </div>
  )
}

// ─── 入力スタイル ─────────────────────────────────────────────────────────────

const input = 'w-full h-10 px-3 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition'
const label = 'block text-xs font-semibold text-gray-600 mb-1.5'

// ─── メイン ──────────────────────────────────────────────────────────────────

export default function ComplaintNew() {
  const navigate = useNavigate()
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const timerRef = useRef(null)

  useEffect(() => {
    timerRef.current = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleClear = () => setForm(INITIAL_FORM)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.content.trim()) return
    setSubmitting(true)
    const deadlineCfg = EMOTION_LEVELS[form.emotionLevel - 1]
    const deadlineMs  = deadlineCfg.deadline * 60 * 1000
    const receivedAt  = new Date()
    const { error } = await supabase.from('complaints').insert({
      received_at:      receivedAt.toISOString(),
      client_name:      form.clientName,
      client_contact:   form.clientContact,
      site_name:        form.siteName,
      worker_name:      form.workerName,
      category:         form.category,
      content:          form.content,
      emotion_level:    form.emotionLevel,
      deadline_minutes: deadlineCfg.deadline,
      response_deadline: new Date(receivedAt.getTime() + deadlineMs).toISOString(),
      department:       form.department,
      assignee:         form.assignee,
      receiver_name:    form.receiverName,
      status:           '受付済',
    })
    setSubmitting(false)
    if (error) { alert('登録に失敗しました: ' + error.message); return }
    navigate('/dashboard')
  }

  const receivedStr = now.toLocaleString('ja-JP', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  const assigneeOptions = DEPARTMENTS[form.department] || []

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-6 transition-colors">
        <ArrowLeft size={15} /> 戻る
      </button>

      <h2 className="text-xl font-bold text-gray-900 mb-1">新規クレーム受付</h2>
      <p className="text-xs text-gray-400 mb-6">クレームは、成長の種。正確に記録してください。</p>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* 受付日時 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className={label}>受付日時</p>
          <p className="text-sm font-mono text-gray-700 bg-stone-50 rounded-xl px-4 py-2.5 border border-stone-200">
            {receivedStr}
          </p>
        </div>

        {/* 基本情報 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <p className="text-sm font-bold text-gray-800">基本情報</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={label}>元請様名</label>
              <input value={form.clientName} onChange={e => set('clientName', e.target.value)}
                className={input} placeholder="山田工務店" />
            </div>
            <div>
              <label className={label}>元請担当者様名</label>
              <input value={form.clientContact} onChange={e => set('clientContact', e.target.value)}
                className={input} placeholder="山田 太郎 様" />
            </div>
            <div>
              <label className={label}>現場名</label>
              <input value={form.siteName} onChange={e => set('siteName', e.target.value)}
                className={input} placeholder="〇〇ビル A棟" />
            </div>
          </div>
          <div>
            <label className={label}>施工担当者名</label>
            <input value={form.workerName} onChange={e => set('workerName', e.target.value)}
              className={input + ' max-w-xs'} placeholder="中村 太郎" />
          </div>
        </div>

        {/* クレーム内容 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <p className="text-sm font-bold text-gray-800">クレーム内容</p>

          {/* カテゴリタグ */}
          <div>
            <label className={label}>カテゴリ</label>
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

          {/* 詳細内容 */}
          <div>
            <label className={label}>詳細内容 <span className="text-red-500">*</span></label>
            <textarea required value={form.content} onChange={e => set('content', e.target.value)}
              rows={4} placeholder="クレームの詳細内容を記入してください"
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-none" />
          </div>
        </div>

        {/* 感情レベル */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <p className="text-sm font-bold text-gray-800">感情レベル</p>
          <div className="grid grid-cols-5 gap-2">
            {EMOTION_LEVELS.map(({ level, label: lbl, emoji, bg, border, text, ring }) => (
              <button key={level} type="button"
                onClick={() => set('emotionLevel', level)}
                className={cn(
                  'flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all',
                  form.emotionLevel === level
                    ? cn(bg, border, `ring-2 ${ring}`)
                    : 'bg-white border-stone-200 hover:border-stone-300'
                )}>
                <span className="text-2xl">{emoji}</span>
                <span className={cn('text-[11px] font-bold', form.emotionLevel === level ? text : 'text-gray-500')}>
                  Lv.{level}
                </span>
                <span className={cn('text-[10px]', form.emotionLevel === level ? text : 'text-gray-400')}>
                  {lbl}
                </span>
              </button>
            ))}
          </div>

          {/* 期限プレビュー */}
          <div>
            <DeadlineBadge level={form.emotionLevel} />
          </div>
        </div>

        {/* 担当 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <p className="text-sm font-bold text-gray-800">担当設定</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>担当部署</label>
              <select value={form.department}
                onChange={e => { set('department', e.target.value); set('assignee', '') }}
                className={input + ' bg-white'}>
                <option value="">選択してください</option>
                {Object.keys(DEPARTMENTS).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>担当者</label>
              <select value={form.assignee} onChange={e => set('assignee', e.target.value)}
                disabled={!form.department}
                className={input + ' bg-white disabled:opacity-40 disabled:cursor-not-allowed'}>
                <option value="">
                  {form.department ? '選択してください' : '部署を選択してください'}
                </option>
                {assigneeOptions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={label}>受付者名</label>
            <input value={form.receiverName} onChange={e => set('receiverName', e.target.value)}
              className={input + ' max-w-xs'} placeholder="品質管理部 鈴木" />
          </div>
        </div>

        {/* ボタン */}
        <div className="flex gap-3 pb-8">
          <button type="button" onClick={handleClear}
            className="flex items-center gap-1.5 px-5 h-12 rounded-xl border border-stone-200 text-sm font-semibold text-gray-600 hover:bg-stone-50 transition-colors">
            <X size={14} /> クリア
          </button>
          <button type="submit" disabled={submitting || !form.content.trim()}
            className="flex-1 h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-sm font-bold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? '登録中...' : 'この内容で受け付ける'}
          </button>
        </div>
      </form>
    </div>
  )
}
