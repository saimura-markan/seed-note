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
  const c          = post.content   || {}
  const deep       = post.deep      || {}
  const rejections = post.rejections || []
  const negReplies = post.negReplies || []
  const date = post.created_at
    ? new Date(post.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' })
    : '—'
  const contactCount = Array.isArray(c.contact_logs) ? c.contact_logs.length : 0

  // deep analysis フィールドは complaint_deep_analysis を優先、content をフォールバック
  const rootCause   = deep.root_cause   || c.root_cause   || ''
  const rootTheme   = deep.root_theme   || c.root_theme   || ''
  const rootDetail  = deep.root_detail  || c.root_detail  || ''
  const orgImprove  = deep.org_improvement || c.org_improvement || ''
  const horizDepts  = Array.isArray(deep.horizontal_departments) ? deep.horizontal_departments
                    : Array.isArray(c.horizontal_departments)    ? c.horizontal_departments
                    : []
  const horizContent   = deep.horizontal_content  || c.horizontal_content  || ''
  const actionAssignee = deep.action_assignee     || c.action_assignee     || ''
  const actionDeadline = deep.action_deadline     || c.action_deadline     || ''
  const actionProgress = deep.action_progress     || c.action_progress     || ''

  const progressBadge =
    actionProgress === '完了'   ? 'bg-emerald-100 text-emerald-700' :
    actionProgress === '進行中' ? 'bg-blue-100 text-blue-700'       :
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
          <div style={{ borderLeft: '4px solid #60a5fa', backgroundColor: '#eff6ff', borderRadius: '0 12px 12px 0', padding: '12px 16px' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8', marginBottom: '6px' }}>🔧 現象対策（現場で考えた対策案）</p>
            <p className="text-sm text-gray-700 leading-relaxed">{c.improvement}</p>
          </div>
        )}
        {(rootCause || rootTheme || rootDetail) && (
          <div>
            <p className="text-[11px] font-bold text-gray-400 mb-1">■ 真因分析</p>
            {rootTheme && (
              <span className="inline-block mb-1.5 text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full">
                カテゴリー：{rootTheme}
              </span>
            )}
            {rootCause && <p className="text-sm text-gray-700 leading-relaxed">{rootCause}</p>}
            {rootDetail && (
              <p className="text-xs text-gray-500 leading-relaxed mt-1 bg-stone-50 rounded-lg px-3 py-2">{rootDetail}</p>
            )}
          </div>
        )}
        {(horizDepts.length > 0 || horizContent) && (
          <div>
            <p className="text-[11px] font-bold text-gray-400 mb-1">■ 横展開</p>
            {horizDepts.length > 0 && (
              <p className="text-xs text-gray-600 mb-1">
                対象部署：<strong className="text-gray-800">{horizDepts.join('・')}</strong>
              </p>
            )}
            {horizContent && <p className="text-sm text-gray-700 leading-relaxed">{horizContent}</p>}
          </div>
        )}
        {(orgImprove || actionAssignee || actionDeadline) && (
          <div style={{ borderLeft: '4px solid #10b981', backgroundColor: '#ecfdf5', borderRadius: '0 12px 12px 0', padding: '12px 16px' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#065f46', marginBottom: '6px' }}>🏢 組織改善策（再発防止）</p>
            {orgImprove && (
              <p className="text-sm text-gray-700 leading-relaxed mb-2">{orgImprove}</p>
            )}
            <div className="flex items-center gap-3 flex-wrap text-xs">
              {actionAssignee && (
                <span className="text-gray-600">担当：<strong className="text-gray-800">{actionAssignee}</strong></span>
              )}
              {actionDeadline && (
                <span className="text-gray-600">期限：<strong className="text-gray-800">{actionDeadline}</strong></span>
              )}
              {actionProgress && (
                <span className={cn('font-bold px-2.5 py-0.5 rounded-full', progressBadge)}>
                  {actionProgress}
                </span>
              )}
            </div>
          </div>
        )}
        {rejections.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-gray-400 mb-2">■ 役員からの指摘・最終対策</p>
            <div className="space-y-1.5">
              {rejections.map((a, i) => (
                <div key={i} className="border-l-2 border-amber-400 bg-amber-50 rounded-r-lg px-3 py-2 text-sm">
                  <p className="text-[10px] font-bold text-amber-600 mb-0.5">役員指摘（{a.approver_name}）</p>
                  <p className="text-gray-700">{a.comment}</p>
                </div>
              ))}
              {negReplies.map((r, i) => (
                <div key={i} className="border-l-2 border-emerald-500 bg-emerald-50 rounded-r-lg px-3 py-2 text-sm">
                  <p className="text-[10px] font-bold text-emerald-600 mb-0.5">→ 対応（事業責任者）</p>
                  <p className="text-gray-700">{r.content}</p>
                </div>
              ))}
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
    const load = async () => {
      const { data: posts } = await supabase
        .from('bulletin_board')
        .select('*')
        .order('created_at', { ascending: false })
      if (!posts) { setBulletinLoading(false); return }

      const ids = posts.map(p => p.complaint_id).filter(Boolean)

      // deep_analysis を一括取得
      let deepMap = {}
      if (ids.length > 0) {
        const { data: deepRows } = await supabase
          .from('complaint_deep_analysis')
          .select('complaint_id, root_cause, root_theme, root_detail, org_improvement, horizontal_departments, horizontal_content, action_assignee, action_deadline, action_progress')
          .in('complaint_id', ids)
        if (deepRows) deepRows.forEach(d => { deepMap[d.complaint_id] = d })
      }

      // 役員否認コメントを一括取得（comment が残っているもののみ）
      let rejectionsMap = {}
      if (ids.length > 0) {
        const { data: approvalRows } = await supabase
          .from('complaint_approvals')
          .select('complaint_id, approver_name, comment')
          .in('complaint_id', ids)
          .not('comment', 'is', null)
          .neq('comment', '')
        if (approvalRows) {
          approvalRows.forEach(a => {
            if (!rejectionsMap[a.complaint_id]) rejectionsMap[a.complaint_id] = []
            rejectionsMap[a.complaint_id].push(a)
          })
        }
      }

      // 事業責任者の返答ログを一括取得
      let negReplyMap = {}
      if (ids.length > 0) {
        const { data: negRows } = await supabase
          .from('complaint_logs')
          .select('complaint_id, content, created_at')
          .in('complaint_id', ids)
          .eq('type', 'negotiation_reply')
          .order('created_at', { ascending: true })
        if (negRows) {
          negRows.forEach(n => {
            if (!negReplyMap[n.complaint_id]) negReplyMap[n.complaint_id] = []
            negReplyMap[n.complaint_id].push(n)
          })
        }
      }

      setBulletinPosts(posts.map(p => ({
        ...p,
        deep:       deepMap[p.complaint_id]       ?? null,
        rejections: rejectionsMap[p.complaint_id] ?? [],
        negReplies: negReplyMap[p.complaint_id]   ?? [],
      })))
      setBulletinLoading(false)
    }
    load()
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
      const deep = post.deep || {}
      const haystack = [
        c.description, c.site_name, c.direct_cause,
        deep.root_cause || c.root_cause,
        deep.root_detail || c.root_detail,
        deep.org_improvement || c.org_improvement,
        deep.horizontal_content || c.horizontal_content,
      ].filter(Boolean).join(' ').toLowerCase()
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
