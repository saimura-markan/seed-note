import { useState, useEffect } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Sprout, CalendarDays, Clock, BarChart2 } from 'lucide-react'
import { cn, getRole } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_ORDER = ['受付済', '対応中', '是正案提出', '是正案差し戻し', '是正案承認', '改善報告書提出', '深掘り提出', '承認完了']

const STATUS_TO_STEP = {
  '受付済':         0,
  '対応中':         1,
  '是正案提出':     2,
  '是正案差し戻し': 2,
  '是正案承認':     3,
  '改善報告書提出': 3,
  '深掘り提出':     4,
  '承認完了':       5,
}

const STATUS_FLOW_STEPS = [
  { label: '受付',    dotColor: 'bg-orange-500', textColor: 'text-orange-500', borderColor: 'border-l-orange-500' },
  { label: '対応中',  dotColor: 'bg-amber-500',  textColor: 'text-amber-500',  borderColor: 'border-l-amber-500' },
  { label: '対応案',  dotColor: 'bg-blue-500',   textColor: 'text-blue-500',   borderColor: 'border-l-blue-500' },
  { label: '改善報告', dotColor: 'bg-indigo-500', textColor: 'text-indigo-500', borderColor: 'border-l-indigo-500' },
  { label: '深掘り',  dotColor: 'bg-purple-500', textColor: 'text-purple-500', borderColor: 'border-l-purple-500' },
  { label: '承認',    dotColor: 'bg-emerald-500', textColor: 'text-emerald-500', borderColor: 'border-l-emerald-500' },
]

const PRIORITY = {
  5: { label: '最高', bg: 'bg-red-100',    text: 'text-red-600',    border: 'border-l-red-400' },
  4: { label: '緊強', bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-l-orange-400' },
  3: { label: '注意', bg: 'bg-amber-100',  text: 'text-amber-600',  border: 'border-l-amber-400' },
  2: { label: 'やや', bg: 'bg-lime-100',   text: 'text-lime-600',   border: 'border-l-lime-400' },
  1: { label: '穏やか', bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-l-emerald-400' },
}

const STATUS_BADGE = {
  '受付済':         'bg-stone-100 text-stone-600 border border-stone-200',
  '対応中':         'bg-stone-100 text-stone-600 border border-stone-200',
  '是正案提出':     'bg-amber-100 text-amber-700 border border-amber-200',
  '是正案差し戻し': 'bg-red-100 text-red-700 border border-red-200',
  '是正案承認':     'bg-green-100 text-green-700 border border-green-200',
  '改善報告書提出': 'bg-blue-100 text-blue-700 border border-blue-200',
  '深掘り提出':     'bg-indigo-100 text-indigo-700 border border-indigo-200',
  '承認完了':       'bg-emerald-100 text-emerald-700 border border-emerald-200',
}

const TAG_COLOR = {
  '遅刻':         'bg-blue-50 text-blue-700',
  'その他':       'bg-stone-100 text-stone-600',
  '施工不備':     'bg-red-50 text-red-700',
  '近隣トラブル': 'bg-amber-50 text-amber-700',
  '破損':         'bg-red-50 text-red-700',
  'マナー':       'bg-violet-50 text-violet-700',
}

const STATUS_FILTER_GROUPS = {
  '全て':     null,
  '未対応':   ['受付済', '対応中'],
  '対応中':   ['是正案提出', '是正案差し戻し', '是正案承認', '改善報告書提出', '深掘り提出'],
  '承認待ち': [],
  '完了':     ['承認完了'],
}
const STATUS_FILTERS = Object.keys(STATUS_FILTER_GROUPS)

// 自分のターン判定（role → 担当ステータスのSet）
const MY_TURN_STATUSES = {
  manager:   new Set(['受付済', '対応中', '是正案差し戻し', '是正案承認']),
  staff:     new Set(['受付済', '対応中', '是正案差し戻し', '是正案承認']),
  director:  new Set(['是正案提出', '改善報告書提出']),
  executive: new Set(['深掘り提出']),
  admin:     new Set(['深掘り提出']),
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ステータスごとの期限起点と制限時間を返す
function deadlineInfo(status, receivedAt, currentTurnStartedAt, deadlineMinutes) {
  if (['受付済', '対応中', '是正案差し戻し'].includes(status)) {
    return { startMs: receivedAt, limitMs: deadlineMinutes * 60 * 1000 }
  }
  return { startMs: currentTurnStartedAt ?? receivedAt, limitMs: 24 * 60 * 60 * 1000 }
}

function calcTurnStyle(status, receivedAt, currentTurnStartedAt, deadlineMinutes) {
  const { startMs, limitMs } = deadlineInfo(status, receivedAt, currentTurnStartedAt, deadlineMinutes)
  const ratio = (Date.now() - startMs) / limitMs
  if (ratio < 0.5)  return { border: 'border-l-green-400',  bg: 'bg-white' }
  if (ratio < 0.83) return { border: 'border-l-yellow-400', bg: 'bg-yellow-50' }
  if (ratio <= 1.0) return { border: 'border-l-orange-400', bg: 'bg-orange-50' }
  return { border: 'border-l-red-500', bg: 'bg-red-50' }
}

function calcStepTimer(status, receivedAt, currentTurnStartedAt, deadlineMinutes) {
  const { startMs, limitMs } = deadlineInfo(status, receivedAt, currentTurnStartedAt, deadlineMinutes)
  const remaining = (limitMs - (Date.now() - startMs)) / 1000
  if (remaining < 0) {
    const over = -remaining
    return { overdue: true, main: '超過', sub: `+${pad(over / 60)}:${pad(over % 60)} 経過` }
  }
  const h = Math.floor(remaining / 3600)
  const label = h > 0
    ? `${pad(remaining / 3600)}:${pad((remaining % 3600) / 60)}:${pad(remaining % 60)}`
    : `${pad(remaining / 60)}:${pad(remaining % 60)}`
  const color = remaining < 30 * 60 ? 'text-orange-500' : 'text-gray-700'
  return { overdue: false, main: label, sub: '残り対応時間', color }
}

function mapRow(row) {
  return {
    id:                   row.id,
    priority:             row.emotion_level ?? 3,
    company:              row.client_name   ?? '',
    site:                 row.site_name     ?? '',
    tag:                  row.category      ?? '',
    assignee:             row.assignee      ?? '',
    worker:               row.worker_name   ?? '',
    deadlineMinutes:      row.deadline_minutes ?? 60,
    receivedAt:           new Date(row.received_at).getTime(),
    status:               row.status        ?? '受付済',
    department:           row.department     ?? '',
    clientContact:        row.client_contact ?? '',
    currentTurnStartedAt: row.current_turn_started_at ? new Date(row.current_turn_started_at).getTime() : null,
    isMine:               false,
  }
}

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

function StepProgressBar({ status }) {
  const stepIndex = STATUS_TO_STEP[status] ?? 0
  return (
    <div className="mt-3">
      <div className="flex items-center">
        {STATUS_FLOW_STEPS.map((step, i) => {
          const completed = i < stepIndex
          const current   = i === stepIndex
          const isLast    = i === STATUS_FLOW_STEPS.length - 1
          const dotCls    = completed ? 'bg-[#1D9E75]' : current ? step.dotColor : 'bg-stone-200'
          return (
            <div key={i} className={cn('flex items-center', isLast ? '' : 'flex-1')}>
              <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', dotCls)} />
              {!isLast && (
                <div className={cn('h-0.5 flex-1', i < stepIndex ? 'bg-[#1D9E75]' : 'bg-stone-200')} />
              )}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-1">
        {STATUS_FLOW_STEPS.map((step, i) => {
          const completed = i < stepIndex
          const current   = i === stepIndex
          return (
            <span key={i} className={cn(
              'text-[9px] font-medium',
              completed ? 'text-[#1D9E75]' : current ? step.textColor : 'text-stone-300'
            )}>
              {step.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function ComplaintCard({ c, onClick, firstContactMin, role }) {
  const pc         = PRIORITY[c.priority] ?? PRIORITY[1]
  const myTurnSet  = MY_TURN_STATUSES[role] ?? MY_TURN_STATUSES.manager
  const isMyTurn   = myTurnSet.has(c.status)
  const { border, bg } = isMyTurn
    ? calcTurnStyle(c.status, c.receivedAt, c.currentTurnStartedAt, c.deadlineMinutes)
    : { border: 'border-l-stone-200', bg: 'bg-white' }
  const timer = c.status === '承認完了'
    ? null
    : isMyTurn ? calcStepTimer(c.status, c.receivedAt, c.currentTurnStartedAt, c.deadlineMinutes) : null

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl shadow-sm cursor-pointer hover:shadow-md transition-all border-l-[5px] p-4 pl-5',
        bg, border
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
          <StepProgressBar status={c.status} />
        </div>

        {/* Timer + Status */}
        <div className="shrink-0 text-right flex flex-col items-end gap-2 min-w-[110px]">
          {c.status === '承認完了' ? (
            <div className="text-[22px] font-black text-emerald-600 leading-none">完了</div>
          ) : timer ? (
            timer.overdue ? (
              <div>
                <div className="text-[22px] font-black text-red-600 leading-none">{timer.main}</div>
                <div className="text-sm text-red-500 font-semibold mt-0.5">{timer.sub}</div>
              </div>
            ) : (
              <div>
                <div className={cn('text-[26px] font-black tabular-nums leading-none', timer.color)}>{timer.main}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{timer.sub}</div>
              </div>
            )
          ) : (
            <div className="h-9" />
          )}
          <span className={cn('text-xs font-semibold px-3 py-1 rounded-full', STATUS_BADGE[c.status] ?? 'bg-stone-100 text-stone-600')}>
            {c.status.replace('是正案', '対応案')}
          </span>
          {firstContactMin != null && (
            <span className="text-xs text-gray-500">初回連絡: {firstContactMin}分</span>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusComplaintCard({ c, onClick, role }) {
  const stepIndex  = STATUS_TO_STEP[c.status] ?? 0
  const step       = STATUS_FLOW_STEPS[stepIndex]
  const initials   = c.assignee ? c.assignee.charAt(0) : '?'
  const myTurnSet  = MY_TURN_STATUSES[role] ?? MY_TURN_STATUSES.manager
  const isMyTurn   = myTurnSet.has(c.status)
  const { border, bg } = isMyTurn
    ? calcTurnStyle(c.status, c.receivedAt, c.currentTurnStartedAt, c.deadlineMinutes)
    : { border: 'border-l-stone-200', bg: 'bg-white' }
  const turnTimer = c.status === '承認完了'
    ? null
    : isMyTurn ? calcStepTimer(c.status, c.receivedAt, c.currentTurnStartedAt, c.deadlineMinutes) : null

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl shadow-sm cursor-pointer hover:shadow-md transition-all border-l-[3px] p-4 pl-5',
        bg, border
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-bold text-gray-900 text-[15px]">{c.company}</span>
            <span className="text-sm text-gray-500">{c.site}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
            <span className={cn('px-2 py-0.5 rounded-full font-medium text-[11px]', TAG_COLOR[c.tag] ?? 'bg-stone-100 text-stone-600')}>
              {c.tag}
            </span>
            <span>施工：{c.worker}</span>
          </div>
        </div>
        <span className={cn('text-xs font-semibold px-3 py-1 rounded-full shrink-0', STATUS_BADGE[c.status] ?? 'bg-stone-100 text-stone-600 border border-stone-200')}>
          {c.status.replace('是正案', '対応案')}
        </span>
      </div>

      <StepProgressBar status={c.status} />

      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-stone-100">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
            {initials}
          </div>
          <span className="text-xs text-gray-500 truncate">
            今ここで止まっています：<span className="font-semibold text-gray-700">{c.assignee || '未割り当て'}</span> さん（担当）
          </span>
        </div>
        {turnTimer && (
          <span className={cn('text-xs font-bold shrink-0 tabular-nums', turnTimer.overdue ? 'text-red-500' : 'text-gray-500')}>
            {turnTimer.overdue ? turnTimer.sub : turnTimer.main}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useOutletContext()
  const role = getRole(user)
  const [complaints, setComplaints] = useState([])
  const [firstContactMap, setFirstContactMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [, setTick] = useState(0)
  const [tab, setTab] = useState('all')
  const [statusFilter, setStatusFilter] = useState('全て')
  const [userDepartment, setUserDepartment] = useState('')

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .order('received_at', { ascending: false })
      if (error) {
        console.error('[Dashboard] complaints fetch error:', error)
      } else {
        const rows = data ?? []
        setComplaints(rows.map(mapRow))
        const ids = rows.map(c => c.id)
        if (ids.length > 0) {
          const { data: logs } = await supabase
            .from('complaint_logs')
            .select('complaint_id, created_at')
            .in('complaint_id', ids)
            .eq('type', 'contact')
            .order('created_at', { ascending: true })
          if (logs) {
            const map = {}
            logs.forEach(log => {
              if (map[log.complaint_id] !== undefined) return
              const complaint = rows.find(c => c.id === log.complaint_id)
              if (complaint) {
                map[log.complaint_id] = Math.floor((new Date(log.created_at) - new Date(complaint.received_at)) / 60000)
              }
            })
            setFirstContactMap(map)
          }
        }
      }
      setLoading(false)
    }
    fetch()
  }, [])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!user?.id) return
    supabase.from('profiles').select('department').eq('id', user.id).single()
      .then(({ data }) => { if (data?.department) setUserDepartment(data.department) })
  }, [user?.id])

  const today = new Date().toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })

  const overdue = complaints.filter(c => calcTimer(c.receivedAt, c.deadlineMinutes).overdue)

  const todayStr    = new Date().toDateString()
  const now         = new Date()
  const thisMonth   = now.getMonth()
  const thisYear    = now.getFullYear()
  const lastMonth   = thisMonth === 0 ? 11 : thisMonth - 1
  const lastYear    = thisMonth === 0 ? thisYear - 1 : thisYear

  const todayCount     = complaints.filter(c => new Date(c.receivedAt).toDateString() === todayStr).length
  const thisMonthCount = complaints.filter(c => { const d = new Date(c.receivedAt); return d.getFullYear() === thisYear && d.getMonth() === thisMonth }).length
  const lastMonthCount = complaints.filter(c => { const d = new Date(c.receivedAt); return d.getFullYear() === lastYear && d.getMonth() === lastMonth }).length
  const monthDiff      = thisMonthCount - lastMonthCount

  const stats = [
    { label: '未対応クレーム',    value: complaints.filter(c => c.status !== '承認完了').length, sub: '承認完了を除く全件',                                                                              icon: Sprout,      iconBg: 'bg-emerald-100', iconColor: 'text-emerald-700' },
    { label: '本日の受付件数',    value: todayCount,                                              sub: `${today}時点`,                                                                                   icon: CalendarDays, iconBg: 'bg-blue-100',    iconColor: 'text-blue-600' },
    { label: '期限超過',          value: overdue.length,                                          sub: '即時フォローが必要',                                                                             icon: Clock,        iconBg: 'bg-red-100',     iconColor: 'text-red-600', valueColor: 'text-red-600' },
    { label: '今月のクレーム件数', value: thisMonthCount,                                         sub: monthDiff === 0 ? '先月比 ±0件' : `先月比 ${monthDiff > 0 ? '+' : ''}${monthDiff}件`,            icon: BarChart2,    iconBg: 'bg-orange-100',  iconColor: 'text-orange-600' },
    { label: '先月のクレーム件数', value: lastMonthCount,                                         sub: '比較対象',                                                                                       icon: BarChart2,    iconBg: 'bg-stone-100',   iconColor: 'text-stone-500' },
  ]

  const tabFiltered =
    tab === 'dept' ? complaints.filter(c => userDepartment && c.department === userDepartment) :
    complaints

  const getCount = (f) => {
    if (f === '全て') return tabFiltered.length
    const statuses = STATUS_FILTER_GROUPS[f] ?? []
    return tabFiltered.filter(c => statuses.includes(c.status)).length
  }

  const displayed = statusFilter === '全て'
    ? tabFiltered
    : tabFiltered.filter(c => (STATUS_FILTER_GROUPS[statusFilter] ?? []).includes(c.status))

  const tabs = [
    { id: 'all',  label: '全件',      count: complaints.length },
    { id: 'dept', label: '自分の部署', count: userDepartment ? complaints.filter(c => c.department === userDepartment).length : 0 },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    )
  }

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-base font-bold text-gray-700">クレーム管理ダッシュボード</h1>
        <button
          onClick={() => navigate('/complaints/new')}
          className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm transition-colors"
        >
          <span className="text-base leading-none">＋</span>
          新規依頼
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Nav buttons */}
      <div className="grid grid-cols-2 gap-3 mb-7">
        <button
          onClick={() => navigate('/analytics')}
          className="flex items-center justify-center gap-2 bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-800 font-semibold text-sm px-4 py-3 rounded-xl shadow-sm transition-colors"
        >
          📊 分析・ランキング
        </button>
        <button
          onClick={() => navigate('/bulletin-board')}
          className="flex items-center justify-center gap-2 bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-800 font-semibold text-sm px-4 py-3 rounded-xl shadow-sm transition-colors"
        >
          🌱 改善報告書掲示板
        </button>
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
              firstContactMin={firstContactMap[c.id] ?? null}
              role={role}
            />
          ))
        )}
      </div>
    </div>
  )
}
