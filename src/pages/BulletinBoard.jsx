import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const BULLETIN_CATEGORIES = ['標準化不足', '教育不足', 'ルール未整備', 'システム不備', '顧客確認不足', '引継ぎ不足', 'マネジメント不足', '人員配置問題']
const BULLETIN_PERIODS = [
  { id: 'all', label: '全て' },
  { id: '1m',  label: '直近1ヶ月' },
  { id: '3m',  label: '直近3ヶ月' },
  { id: '6m',  label: '直近6ヶ月' },
  { id: '1y',  label: '1年以内' },
]

function BulletinCard({ post }) {
  const c = post.content || {}
  const date = post.created_at
    ? new Date(post.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' })
    : '—'
  const contactCount = Array.isArray(c.contact_logs) ? c.contact_logs.length : 0
  const progressBadge =
    c.action_progress === '完了'   ? 'bg-emerald-100 text-emerald-700' :
    c.action_progress === '進行中' ? 'bg-blue-100 text-blue-700'       :
                                     'bg-stone-100 text-stone-600'

  return (
    <div className="bg-white rounded-2xl shadow-sm border-l-4 border-l-emerald-400 overflow-hidden">
      <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-bold text-emerald-800">🌱 改善報告書</span>
        <span className="text-xs text-gray-400">{date}</span>
        {c.site_name && <span className="text-xs text-gray-600">現場：<strong>{c.site_name}</strong></span>}
        {c.assignee  && <span className="text-xs text-gray-600">担当：<strong>{c.assignee}</strong></span>}
      </div>
      <div className="px-5 py-4 space-y-4">
        {c.description && (
          <div>
            <p className="text-[11px] font-bold text-gray-400 mb-1">■ クレーム内容</p>
            <p className="text-sm text-gray-700 leading-relaxed">{c.description}</p>
          </div>
        )}
        <div>
          <p className="text-[11px] font-bold text-gray-400 mb-1">■ 対応の顛末</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            連絡{contactCount}件
            {c.hearing           && `　聞き取り：${c.hearing}`}
            {c.correction_action && `　現場対応：${c.correction_action}`}
          </p>
        </div>
        {c.direct_cause && (
          <div>
            <p className="text-[11px] font-bold text-gray-400 mb-1">■ 現象原因</p>
            <p className="text-sm text-gray-700 leading-relaxed">{c.direct_cause}</p>
          </div>
        )}
        {c.improvement && (
          <div>
            <p className="text-[11px] font-bold text-gray-400 mb-1">■ 現象対策（現場で考えた対策案）</p>
            <p className="text-sm text-gray-700 leading-relaxed">{c.improvement}</p>
          </div>
        )}
        {(c.root_cause || c.root_theme) && (
          <div>
            <p className="text-[11px] font-bold text-gray-400 mb-1">■ 真因（なぜ起きたか）</p>
            {c.root_cause && <p className="text-sm text-gray-700 leading-relaxed">{c.root_cause}</p>}
            {c.root_theme && (
              <span className="inline-block mt-1 text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full">
                カテゴリー：{c.root_theme}
              </span>
            )}
          </div>
        )}
        {(c.org_improvement || c.action_assignee || c.action_deadline) && (
          <div>
            <p className="text-[11px] font-bold text-gray-400 mb-1">■ 組織対策（再発防止）</p>
            {c.org_improvement && (
              <p className="text-sm text-gray-700 leading-relaxed mb-2">{c.org_improvement}</p>
            )}
            <div className="flex items-center gap-3 flex-wrap text-xs">
              {c.action_assignee && (
                <span className="text-gray-600">担当：<strong className="text-gray-800">{c.action_assignee}</strong></span>
              )}
              {c.action_deadline && (
                <span className="text-gray-600">期限：<strong className="text-gray-800">{c.action_deadline}</strong></span>
              )}
              {c.action_progress && (
                <span className={cn('font-bold px-2.5 py-0.5 rounded-full', progressBadge)}>
                  {c.action_progress}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function BulletinBoard() {
  const navigate = useNavigate()
  const [bulletinPosts, setBulletinPosts] = useState([])
  const [bulletinLoading, setBulletinLoading] = useState(true)
  const [bulletinKeyword, setBulletinKeyword] = useState('')
  const [bulletinCategories, setBulletinCategories] = useState([])
  const [bulletinPeriod, setBulletinPeriod] = useState('all')

  useEffect(() => {
    supabase
      .from('bulletin_board')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setBulletinPosts(data)
        setBulletinLoading(false)
      })
  }, [])

  const filteredBulletinPosts = bulletinPosts.filter(post => {
    const c = post.content || {}
    if (bulletinPeriod !== 'all') {
      const days = { '1m': 30, '3m': 90, '6m': 180, '1y': 365 }[bulletinPeriod]
      if (Date.now() - new Date(post.created_at).getTime() > days * 86400000) return false
    }
    if (bulletinCategories.length > 0 && !bulletinCategories.includes(c.root_theme)) return false
    if (bulletinKeyword.trim()) {
      const kw = bulletinKeyword.trim().toLowerCase()
      const haystack = [c.description, c.site_name, c.direct_cause, c.root_cause, c.org_improvement]
        .filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(kw)) return false
    }
    return true
  })

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-900 transition-colors"
        >
          ← ダッシュボードに戻る
        </button>
      </div>
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-base font-bold text-gray-700">🌱 改善報告書掲示板</h1>
        {!bulletinLoading && (
          <span className="text-xs font-medium bg-stone-100 text-gray-400 px-2.5 py-0.5 rounded-full">
            {filteredBulletinPosts.length}件
            {filteredBulletinPosts.length !== bulletinPosts.length && (
              <span className="text-gray-300 ml-1">/ {bulletinPosts.length}件中</span>
            )}
          </span>
        )}
      </div>

      {!bulletinLoading && bulletinPosts.length > 0 && (
        <div className="bg-emerald-50/70 rounded-2xl p-4 mb-6 space-y-3 border border-emerald-100">
          <input
            type="text"
            placeholder="キーワードで検索（クレーム内容・現場名・真因など）"
            value={bulletinKeyword}
            onChange={e => setBulletinKeyword(e.target.value)}
            className="w-full px-4 py-2.5 text-sm rounded-xl border border-emerald-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder-gray-400"
          />
          <div>
            <p className="text-[11px] font-bold text-gray-400 mb-1.5">真因カテゴリー</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setBulletinCategories([])}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
                  bulletinCategories.length === 0
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white text-gray-600 border-stone-200 hover:border-emerald-300'
                )}
              >全て</button>
              {BULLETIN_CATEGORIES.map(cat => {
                const active = bulletinCategories.includes(cat)
                return (
                  <button
                    key={cat}
                    onClick={() => setBulletinCategories(prev =>
                      active ? prev.filter(x => x !== cat) : [...prev, cat]
                    )}
                    className={cn(
                      'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
                      active
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-gray-600 border-stone-200 hover:border-emerald-300'
                    )}
                  >{cat}</button>
                )
              })}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 mb-1.5">期間</p>
            <div className="flex flex-wrap gap-1.5">
              {BULLETIN_PERIODS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setBulletinPeriod(p.id)}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
                    bulletinPeriod === p.id
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-white text-gray-600 border-stone-200 hover:border-emerald-300'
                  )}
                >{p.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {bulletinLoading ? (
        <p className="text-center py-8 text-gray-400 text-sm">読み込み中...</p>
      ) : bulletinPosts.length === 0 ? (
        <p className="text-center py-10 text-gray-400 text-sm">まだ投稿がありません。承認完了になると自動で掲載されます。</p>
      ) : filteredBulletinPosts.length === 0 ? (
        <p className="text-center py-10 text-gray-400 text-sm">条件に一致する投稿がありません</p>
      ) : (
        <div className="space-y-4">
          {filteredBulletinPosts.map(post => (
            <BulletinCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
