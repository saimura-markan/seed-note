import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sprout, CalendarDays, Clock, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_STEPS = ['受付済', '対応中', '改善策作成中', '承認待ち', '完了']

const PRIORITY = {
  5: { label: '最高', bg: 'bg-red-100',    text: 'text-red-600',    border: 'border-l-red-400' },
  4: { label: '緊強', bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-l-orange-400' },
  3: { label: '注意', bg: 'bg-amber-100',  text: 'text-amber-600',  border: 'border-l-amber-400' },
  2: { label: 'やや', bg: 'bg-lime-100',   text: 'text-lime-600',   border: 'border-l-lime-400' },
  1: { label: '穏やか', bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-l-emerald-400' },
}

const STATUS_BADGE = {
  '受付済':      'bg-stone-100 text-stone-600 border border-stone-200',
  '対応中':      'bg-stone-100 text-stone-600 border border-stone-200',
  '改善策作成中': 'bg-amber-100 text-amber-700 border border-amber-200',
  '承認待ち':    'bg-teal-100 text-teal-700 border border-teal-200',
  '完了':        'bg-emerald-100 text-emerald-700 border border-emerald-200',
}

const TAG_COLOR = {
  '遅刻':       'bg-blue-50 text-blue-700',
  'その他':     'bg-stone-100 text-stone-600',
  '施工不備':   'bg-red-50 text-red-700',
  '近隣トラブル': 'bg-amber-50 text-amber-700',
  '破損':       'bg-red-50 text-red-700',
  'マナー':     'bg-violet-50 text-violet-700',
}

const STATUS_FILTERS = ['未対応', '受付済', '対応中', '改善策作成中', '承認待ち', '完了']

// ─── Mock data ────────────────────────────────────────────────────────────────

function buildMock(now) {
  const ago = (min, sec = 0) => now - (min * 60 + sec) * 1000
  return [
    { id:'1', priority:3, company:'山田工務店',     site:'桜台レジデンス',      tag:'遅刻',       assignee:'佐藤 美咲', worker:'中村', deadlineMinutes:60, receivedAt:ago(72,13), status:'受付済',      isMine:false },
    { id:'2', priority:4, company:'グリーンホーム',  site:'緑ヶ丘小学校',        tag:'その他',     assignee:'高橋 由紀', worker:'藤本', deadlineMinutes:30, receivedAt:ago(28,14), status:'対応中',      isMine:false },
    { id:'3', priority:5, company:'株式会社みどり建設', site:'本社ビル B棟',     tag:'施工不備',   assignee:'田中 健太', worker:'大林', deadlineMinutes:15, receivedAt:ago(12,14), status:'対応中',      isMine:true  },
    { id:'4', priority:5, company:'株式会社大成',    site:'駅前再開発 C街区',    tag:'施工不備',   assignee:'田中 健太', worker:'井上', deadlineMinutes:15, receivedAt:ago(6,14),  status:'改善策作成中', isMine:true  },
    { id:'5', priority:4, company:'サンライズ開発',  site:'中央公園 整備工事',   tag:'近隣トラブル', assignee:'田中 健太', worker:'斎藤', deadlineMinutes:30, receivedAt:ago(11,14), status:'改善策作成中', isMine:true  },
    { id:'6', priority:2, company:'北日本建設',      site:'グランドール東',      tag:'破損',       assignee:'鈴木 一郎', worker:'森',   deadlineMinutes:60, receivedAt:ago(24,18), status:'承認待ち',    isMine:false },
    { id:'7', priority:1, company:'みなと開発',      site:'港南倉庫 A棟',        tag:'マナー',     assignee:'田中 健太', worker:'岡田', deadlineMinutes:60, receivedAt:ago(6,18),  status:'受付済',      isMine:true  },
    { id:'8', priority:3, company:'東京建設',        site:'渋谷オフィスビル',    tag:'その他',     assignee:'佐藤 美咲', worker:'田村', deadlineMinutes:60, receivedAt:ago(80),    status:'完了',        isMine:false },
  ]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pad = n => String(Math.floor(Math.abs(n))).padStart(2, '0')

function calcTimer(receivedAt, deadlineMinutes) {
  const remaining = (deadlineMinutes * 60 * 1000 - (Date.now() - receivedAt)) / 1000
  if (remaining < 0) {
    const over = -remaining
    return { overdue: true, main: '超過', sub: `+${pad(over / 60)}:${pad(over % 60)} 経過` }
  }
  const color = remaining < 30 * 60 ? 'text-orange-500' : 'text-gray-700'
  return { overdue: false, main: `${pad(remaining / 60)}:${pad(remaining % 60)}`, sub: '残り対応時間', color }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, iconBg, iconColor, valueColor }) {
  return (
    <div className="bg-white rounded-2xl p-5 flex items-start gap-3 shadow-sm">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', iconBg)}>
        <Icon size={19} className={iconColor} />
      </div>
      <div>
        <p className={cn('text-[28px] font-black leading-none mb-1', valueColor ?? 'text-gray-900')}>{value}</p>
        <p className="text-xs font-semibold text-gray-700 mb-0.5">{label}</p>
        <p className="text-[11px] text-gray-400">{sub}</p>
      </div>
    </div>
  )
}

function ProgressDots({ status }) {
  const step = STATUS_STEPS.indexOf(status)
  return (
    <div className="flex gap-1 mt-3">
      {STATUS_STEPS.map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 flex-1 rounded-full',
            i < step  ? 'bg-emerald-500' :
            i === step ? 'bg-emerald-400' :
            'bg-stone-200'
          )}
        />
      ))}
    </div>
  )
}

function ComplaintCard({ c, onClick }) {
  const pc = PRIORITY[c.priority] ?? PRIORITY[1]
  const timer = calcTimer(c.receivedAt, c.deadlineMinutes)

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-2xl shadow-sm cursor-pointer hover:shadow-md transition-all border-l-[5px] p-4 pl-5',
        timer.overdue ? 'border-l-red-500' : pc.border
      )}
    >
      <div className="flex items-start gap-4">
        {/* Priority */}
        <div className={cn('w-[52px] shrink-0 rounded-xl flex flex-col items-center justify-center py-2.5 gap-0.5', pc.bg)}>
          <span className={cn('text-[22px] font-black leading-none', pc.text)}>{c.priority}</span>
          <span className={cn('text-[10px] font-semibold', pc.text)}>{pc.label}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="font-bold text-gray-900 text-[15px]">{c.company}</span>
            <span className="text-sm text-gray-500">{c.site}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
            <span className={cn('px-2 py-0.5 rounded-full font-medium text-[11px]', TAG_COLOR[c.tag] ?? 'bg-stone-100 text-stone-600')}>
              {c.tag}
            </span>
            <span>担当：{c.assignee}</span>
            <span>施工：{c.worker}</span>
            <span className="text-gray-400">・期限 {c.deadlineMinutes}分</span>
          </div>
          <ProgressDots status={c.status} />
        </div>

        {/* Timer + Status */}
        <div className="shrink-0 text-right flex flex-col items-end gap-2 min-w-[110px]">
          {timer.overdue ? (
            <div>
              <div className="text-[22px] font-black text-red-600 leading-none">{timer.main}</div>
              <div className="text-sm text-red-500 font-semibold mt-0.5">{timer.sub}</div>
            </div>
          ) : (
            <div>
              <div className={cn('text-[26px] font-black tabular-nums leading-none', timer.color)}>{timer.main}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{timer.sub}</div>
            </div>
          )}
          <span className={cn('text-xs font-semibold px-3 py-1 rounded-full', STATUS_BADGE[c.status] ?? 'bg-stone-100 text-stone-600')}>
            {c.status}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const baseTime = useRef(Date.now())
  const complaints = useMemo(() => buildMock(baseTime.current), [])
  const [, setTick] = useState(0)
  const [tab, setTab] = useState('all')
  const [statusFilter, setStatusFilter] = useState('未対応')

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const today = new Date().toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })

  const overdue = complaints.filter(c => calcTimer(c.receivedAt, c.deadlineMinutes).overdue)

  const stats = [
    { label: '未対応クレーム',    value: complaints.filter(c => c.status !== '完了').length, sub: '完了を除く全件',       icon: Sprout,      iconBg: 'bg-emerald-100', iconColor: 'text-emerald-700' },
    { label: '本日の受付件数',    value: 8,                                                    sub: `${today}時点`,       icon: CalendarDays, iconBg: 'bg-blue-100',    iconColor: 'text-blue-600' },
    { label: '期限超過',          value: overdue.length,                                       sub: '即時フォローが必要', icon: Clock,        iconBg: 'bg-red-100',     iconColor: 'text-red-600', valueColor: 'text-red-600' },
    { label: '今月のクレーム件数', value: 34,                                                   sub: '先月比 -7件',        icon: BarChart2,    iconBg: 'bg-orange-100',  iconColor: 'text-orange-600' },
    { label: '先月のクレーム件数', value: 41,                                                   sub: '比較対象',           icon: BarChart2,    iconBg: 'bg-stone-100',   iconColor: 'text-stone-500' },
  ]

  const tabFiltered =
    tab === 'mine'  ? complaints.filter(c => c.isMine) :
    tab === 'staff' ? complaints :
    complaints

  const getCount = (f) =>
    f === '未対応' ? tabFiltered.filter(c => c.status !== '完了').length
                   : tabFiltered.filter(c => c.status === f).length

  const displayed = statusFilter === '未対応'
    ? tabFiltered.filter(c => c.status !== '完了')
    : tabFiltered.filter(c => c.status === statusFilter)

  const tabs = [
    { id: 'all',   label: '全件',           count: complaints.length },
    { id: 'mine',  label: '自分の担当',      count: complaints.filter(c => c.isMine).length },
    { id: 'staff', label: '全スタッフのクレーム一覧', count: null },
  ]

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-7">
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-stone-200 mb-5">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              tab === t.id
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            )}
          >
            {t.label}
            {t.count != null && (
              <span className={cn(
                'text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.2rem] text-center',
                tab === t.id ? 'bg-emerald-700 text-white' : 'bg-stone-200 text-stone-500'
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span className="text-xs text-gray-400 mr-1">表示：</span>
        {STATUS_FILTERS.map(f => {
          const count = getCount(f)
          const active = statusFilter === f
          return (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors border',
                active
                  ? 'bg-emerald-800 text-white border-emerald-800'
                  : 'bg-white text-gray-600 border-stone-200 hover:border-stone-300 hover:bg-stone-50'
              )}
            >
              {f}
              <span className={cn('text-xs font-bold', active ? 'text-emerald-200' : 'text-gray-400')}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* List */}
      <div className="space-y-3">
        {displayed.length === 0 ? (
          <p className="text-center py-12 text-gray-400 text-sm">該当するクレームがありません</p>
        ) : (
          displayed.map(c => (
            <ComplaintCard
              key={c.id}
              c={c}
              onClick={() => navigate(`/complaints/${c.id}`)}
            />
          ))
        )}
      </div>
    </div>
  )
}
