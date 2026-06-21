import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rankBy(arr, keyFn) {
  const counts = {}
  arr.forEach(item => {
    const key = keyFn(item)
    if (!key) return
    counts[key] = (counts[key] ?? 0) + 1
  })
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => ({ name, count }))
}

function toYearMonth(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getLast12Months() {
  const result = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({
      key:        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label:      `${d.getFullYear()}年${d.getMonth() + 1}月`,
      shortLabel: `${d.getMonth() + 1}月`,
    })
  }
  return result
}

// ─── グラフコンポーネント ──────────────────────────────────────────────────────

function HorizontalBarChart({ title, items, color, maxItems = 10 }) {
  const data = items.slice(0, maxItems)
  const barHeight = 44
  const chartHeight = Math.max(data.length * barHeight + 20, 80)
  const yAxisWidth = Math.min(Math.max(...data.map(d => d.name.length), 4) * 11, 180)

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-bold text-gray-700 mb-4">{title}</h3>
      {data.length === 0 ? (
        <p className="text-xs text-gray-400 py-6 text-center">データなし</p>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 0, right: 48, top: 4, bottom: 4 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={yAxisWidth}
              tick={{ fontSize: 12, fill: '#374151' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={v => [`${v}件`]}
              contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid #e7e5e4' }}
            />
            <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} maxBarSize={28}>
              <LabelList
                dataKey="count"
                position="right"
                formatter={v => `${v}件`}
                style={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function TrendLineChart({ data, title, color = '#10b981', highlightKey = null }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-bold text-gray-700 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="shortLabel"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            formatter={v => [`${v}件`]}
            contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid #e7e5e4' }}
            labelFormatter={label => `${label}`}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke={color}
            strokeWidth={2.5}
            dot={(props) => {
              const isHighlight = props.payload?.key === highlightKey
              return (
                <circle
                  key={props.key}
                  cx={props.cx}
                  cy={props.cy}
                  r={isHighlight ? 6 : 4}
                  fill={isHighlight ? color : '#fff'}
                  stroke={color}
                  strokeWidth={2}
                />
              )
            }}
            activeDot={{ r: 6, fill: color }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// 元請別タブ用の月別内訳リスト（変更なし）
function MonthlyBreakdownList({ data }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const filtered = data.filter(m => m.count > 0).slice().reverse()
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-bold text-gray-700 mb-4">月別内訳</h3>
      {filtered.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">データなし</p>
      ) : (
        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {filtered.map(m => (
            <div key={m.key} className="flex items-center justify-between text-xs">
              <span className="text-gray-600">{m.label}</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 rounded-full bg-stone-100">
                  <div
                    className="h-full rounded-full bg-orange-300"
                    style={{ width: `${(m.count / max) * 100}%` }}
                  />
                </div>
                <span className="font-bold text-gray-800 w-8 text-right">{m.count}件</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 色定数 ──────────────────────────────────────────────────────────────────

const COLORS = {
  rootTheme:  '#ef4444',  // 赤
  department: '#3b82f6',  // 青
  company:    '#f97316',  // オレンジ
  category:   '#8b5cf6',  // 紫
}

// ─── Main ────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overall', label: '全体' },
  { id: 'monthly', label: '月別' },
  { id: 'company', label: '元請別' },
]

export default function Analytics() {
  const navigate = useNavigate()
  const months   = useMemo(() => getLast12Months(), [])

  const [tab,             setTab]             = useState('overall')
  const [complaints,      setComplaints]      = useState([])
  const [deepAnalyses,    setDeepAnalyses]    = useState([])
  const [loading,         setLoading]         = useState(true)
  const [selectedMonth,   setSelectedMonth]   = useState(months[months.length - 1].key)
  const [selectedCompany, setSelectedCompany] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: cData }, { data: dData }] = await Promise.all([
        supabase.from('complaints').select('id, received_at, client_name, client_contact, department, category'),
        supabase.from('complaint_deep_analysis').select('complaint_id, root_theme'),
      ])
      if (cData) {
        setComplaints(cData.map(row => ({
          id:            row.id,
          yearMonth:     toYearMonth(row.received_at),
          company:       row.client_name    ?? '',
          clientContact: row.client_contact ?? '',
          department:    row.department     ?? '',
          category:      row.category       ?? '',
        })))
      }
      if (dData) setDeepAnalyses(dData)
      setLoading(false)
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (complaints.length > 0 && !selectedCompany) {
      const ranked = rankBy(complaints, c => c.company)
      if (ranked[0]) setSelectedCompany(ranked[0].name)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complaints])

  // ── 全体 data ────────────────────────────────────────────────────────────────

  const overallRankings = useMemo(() => ({
    rootTheme:  rankBy(deepAnalyses, d => d.root_theme),
    department: rankBy(complaints,   c => c.department),
    company:    rankBy(complaints,   c => c.company),
    category:   rankBy(complaints,   c => c.category),
  }), [complaints, deepAnalyses])

  // ── 月別 data ────────────────────────────────────────────────────────────────

  const monthlyChartData = useMemo(() =>
    months.map(m => ({
      ...m,
      count: complaints.filter(c => c.yearMonth === m.key).length,
    }))
  , [complaints, months])

  const monthlyRankings = useMemo(() => {
    const mc  = complaints.filter(c => c.yearMonth === selectedMonth)
    const ids = new Set(mc.map(c => c.id))
    const mda = deepAnalyses.filter(d => ids.has(d.complaint_id))
    return {
      count:      mc.length,
      rootTheme:  rankBy(mda, d => d.root_theme),
      department: rankBy(mc,  c => c.department),
      company:    rankBy(mc,  c => c.company),
      category:   rankBy(mc,  c => c.category),
    }
  }, [complaints, deepAnalyses, selectedMonth])

  // ── 元請別 data ───────────────────────────────────────────────────────────────

  const companyOptions = useMemo(() =>
    rankBy(complaints, c => c.company).map(r => r.name)
  , [complaints])

  const companyData = useMemo(() => {
    if (!selectedCompany) return null
    const cc       = complaints.filter(c => c.company === selectedCompany)
    const ids      = new Set(cc.map(c => c.id))
    const cda      = deepAnalyses.filter(d => ids.has(d.complaint_id))
    const allRanked = rankBy(complaints, c => c.company)
    const rank     = allRanked.findIndex(r => r.name === selectedCompany) + 1
    return {
      count:          cc.length,
      rank,
      totalCompanies: allRanked.length,
      monthlyData:    months.map(m => ({
        ...m,
        count: cc.filter(c => c.yearMonth === m.key).length,
      })),
      clientContact:  rankBy(cc,  c => c.clientContact),
      rootTheme:      rankBy(cda, d => d.root_theme),
      category:       rankBy(cc,  c => c.category),
    }
  }, [complaints, deepAnalyses, selectedCompany, months])

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    )
  }

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

      <div className="flex items-center justify-between mb-5">
        <h1 className="text-base font-bold text-gray-700">📊 分析・ランキング</h1>
        <span className="text-xs text-gray-400 bg-white px-2.5 py-1 rounded-full shadow-sm">
          累計 {complaints.length}件
        </span>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-stone-200 mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              tab === t.id
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════ 全体タブ ════════════════ */}
      {tab === 'overall' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <HorizontalBarChart
              title="① 真因カテゴリーランキング"
              items={overallRankings.rootTheme}
              color={COLORS.rootTheme}
            />
            <HorizontalBarChart
              title="② 担当部署ランキング"
              items={overallRankings.department}
              color={COLORS.department}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <HorizontalBarChart
              title="③ 元請別ランキング"
              items={overallRankings.company}
              color={COLORS.company}
            />
            <HorizontalBarChart
              title="④ クレーム項目ランキング"
              items={overallRankings.category}
              color={COLORS.category}
            />
          </div>
        </div>
      )}

      {/* ════════════════ 月別タブ ════════════════ */}
      {tab === 'monthly' && (
        <div className="space-y-4">
          {/* Month selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-gray-600 shrink-0">対象月：</label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="px-4 py-2 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              {months.map(m => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Summary card */}
          <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center gap-5">
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-black text-emerald-700 leading-none">{monthlyRankings.count}</span>
              <span className="text-lg text-gray-500 font-semibold">件</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">
                {months.find(m => m.key === selectedMonth)?.label} のクレーム件数
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                全期間累計 {complaints.length}件中
              </p>
            </div>
          </div>

          {/* 月別推移 折れ線グラフ */}
          <TrendLineChart
            data={monthlyChartData}
            title="月別発生件数推移"
            color="#10b981"
            highlightKey={selectedMonth}
          />

          {/* Rankings for selected month */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <HorizontalBarChart
              title="真因カテゴリーランキング"
              items={monthlyRankings.rootTheme}
              color={COLORS.rootTheme}
            />
            <HorizontalBarChart
              title="担当部署ランキング"
              items={monthlyRankings.department}
              color={COLORS.department}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <HorizontalBarChart
              title="元請別ランキング"
              items={monthlyRankings.company}
              color={COLORS.company}
            />
            <HorizontalBarChart
              title="クレーム項目ランキング"
              items={monthlyRankings.category}
              color={COLORS.category}
            />
          </div>
        </div>
      )}

      {/* ════════════════ 元請別タブ ════════════════ */}
      {tab === 'company' && (
        <div className="space-y-4">
          {companyOptions.length === 0 ? (
            <p className="text-center py-12 text-gray-400 text-sm">データなし</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <label className="text-sm font-semibold text-gray-600 shrink-0">元請：</label>
                <select
                  value={selectedCompany}
                  onChange={e => setSelectedCompany(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  {companyOptions.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {companyData && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-2xl p-5 shadow-sm">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black text-gray-900 leading-none">{companyData.count}</span>
                        <span className="text-sm text-gray-500 font-semibold">件</span>
                      </div>
                      <p className="text-xs font-semibold text-gray-600 mt-1.5">クレーム総件数</p>
                    </div>
                    <div className="bg-white rounded-2xl p-5 shadow-sm">
                      <div className="flex items-baseline gap-0.5">
                        <span className={cn(
                          'text-4xl font-black leading-none',
                          companyData.rank === 1 ? 'text-red-600' :
                          companyData.rank === 2 ? 'text-orange-500' :
                          companyData.rank <= 5  ? 'text-amber-600' : 'text-gray-700'
                        )}>
                          {companyData.rank}
                        </span>
                        <span className="text-lg font-bold text-gray-500">位</span>
                      </div>
                      <p className="text-xs font-semibold text-gray-600 mt-1.5">
                        元請別ランキング
                        <span className="text-gray-400 font-normal ml-1">/ {companyData.totalCompanies}社中</span>
                      </p>
                    </div>
                  </div>

                  {/* 月別推移 折れ線グラフ */}
                  <TrendLineChart
                    data={companyData.monthlyData}
                    title={`${selectedCompany} — 月別件数推移`}
                    color={COLORS.company}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <HorizontalBarChart
                      title="元請担当者ランキング"
                      items={companyData.clientContact}
                      color={COLORS.company}
                    />
                    <HorizontalBarChart
                      title="真因カテゴリーランキング"
                      items={companyData.rootTheme}
                      color={COLORS.rootTheme}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <HorizontalBarChart
                      title="クレーム項目ランキング"
                      items={companyData.category}
                      color={COLORS.category}
                    />
                    <MonthlyBreakdownList data={companyData.monthlyData} />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
