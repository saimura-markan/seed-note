import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const TAGS = ['遅刻', 'その他', '施工不備', '近隣トラブル', '破損', 'マナー']
const DEADLINES = [15, 30, 60, 120]

export default function ComplaintNew() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    company: '',
    site: '',
    tag: '',
    assignee: '',
    worker: '',
    deadlineMinutes: 60,
    priority: 3,
    description: '',
  })

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = (e) => {
    e.preventDefault()
    // TODO: supabase.from('complaints').insert(form)
    navigate('/dashboard')
  }

  const inputCls = 'w-full h-10 px-3 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition'

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft size={15} />
        戻る
      </button>

      <h2 className="text-xl font-bold text-gray-900 mb-6">新規クレーム受付</h2>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">顧客名 *</label>
            <input required value={form.company} onChange={e => set('company', e.target.value)} className={inputCls} placeholder="株式会社〇〇" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">現場名 *</label>
            <input required value={form.site} onChange={e => set('site', e.target.value)} className={inputCls} placeholder="〇〇ビル A棟" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">クレーム種別</label>
            <select value={form.tag} onChange={e => set('tag', e.target.value)} className={inputCls + ' bg-white'}>
              <option value="">選択してください</option>
              {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">優先度</label>
            <select value={form.priority} onChange={e => set('priority', Number(e.target.value))} className={inputCls + ' bg-white'}>
              <option value={5}>5 - 最高</option>
              <option value={4}>4 - 緊強</option>
              <option value={3}>3 - 注意</option>
              <option value={2}>2 - やや</option>
              <option value={1}>1 - 穏やか</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">担当者</label>
            <input value={form.assignee} onChange={e => set('assignee', e.target.value)} className={inputCls} placeholder="田中 健太" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">施工担当</label>
            <input value={form.worker} onChange={e => set('worker', e.target.value)} className={inputCls} placeholder="大林" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">対応期限</label>
          <div className="flex gap-2">
            {DEADLINES.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => set('deadlineMinutes', m)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  form.deadlineMinutes === m
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white text-gray-600 border-stone-200 hover:border-emerald-300'
                }`}
              >
                {m}分
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">クレーム内容</label>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={4}
            className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-none"
            placeholder="クレームの詳細内容を入力してください"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 h-11 rounded-xl border border-stone-200 text-sm font-semibold text-gray-600 hover:bg-stone-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="flex-1 h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition-colors shadow-sm"
          >
            受付登録
          </button>
        </div>
      </form>
    </div>
  )
}
