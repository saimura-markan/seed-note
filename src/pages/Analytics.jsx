import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

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

function buildMonthlyData(complaints) {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const count = complaints.filter(c => {
      const cd = new Date(c.receivedAt)
      return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth()
    }).length
    return { month: `${d.getMonth() + 1}月`, count }
  })
}

function RankingList({ title, items, barClass }) {
  const top = items.slice(0, 5)
  const maxCount = top[0]?.count ?? 1
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-bold text-gray-700 mb-4">{title}</h3>
      {top.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">データなし</p>
      ) : (
        <div className="space-y-3">
          {top.map((item, i) => (
            <div key={item.name}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="font-black text-gray-300 w-4 shrink-0">{i + 1}</span>
                  <span className="text-gray-700 truncate">{item.name}</span>
                </span>
                <span className="font-bold text-gray-700 shrink-0 ml-2">{item.count}件</span>
              </div>
              <div className="h-1.5 rounded-full bg-stone-100">
                <div
                  className={cn('h-full rounded-full', barClass)}
                  style={{ width: `${(item.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MonthlyTrendChart({ complaints }) {
  const data = buildMonthlyData(complaints)
  const maxCount = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-bold text-gray-700 mb-4">③ 月別発生件数推移（過去6ヶ月）</h3>
      <div className="flex items-end gap-2 h-36">
        {data.map(d => (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold text-gray-500">{d.count > 0 ? `${d.count}件` : ''}</span>
            <div
              className="w-full rounded-t-md bg-emerald-500"
              style={{ height: `${(d.count / maxCount) * 96}px`, minHeight: d.count > 0 ? '4px' : '0' }}
            />
            <span className="text-[10px] text-gray-400">{d.month}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Analytics() {
  const navigate = useNavigate()
  const [complaints, setComplaints] = useState([])
  const [deepAnalyses, setDeepAnalyses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: complaintsData }, { data: analysesData }] = await Promise.all([
        supabase.from('complaints').select('received_at, assignee, client_contact, client_name'),
        supabase.from('complaint_deep_analysis').select('root_theme'),
      ])
      if (complaintsData) {
        setComplaints(complaintsData.map(row => ({
          receivedAt:    new Date(row.received_at).getTime(),
          assignee:      row.assignee ?? '',
          clientContact: row.client_contact ?? '',
          company:       row.client_name ?? '',
        })))
      }
      if (analysesData) setDeepAnalyses(analysesData)
      setLoading(false)
    }
    fetchData()
  }, [])

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
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-base font-bold text-gray-700">📊 分析・ランキング</h1>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <RankingList
          title="① 真因カテゴリーランキング"
          items={rankBy(deepAnalyses, d => d.root_theme)}
          barClass="bg-emerald-500"
        />
        <RankingList
          title="② 担当者別クレーム件数ランキング"
          items={rankBy(complaints, c => c.assignee)}
          barClass="bg-blue-400"
        />
      </div>
      <div className="mb-4">
        <MonthlyTrendChart complaints={complaints} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <RankingList
          title="④ 元請様別ランキング"
          items={rankBy(complaints, c => c.company)}
          barClass="bg-orange-400"
        />
        <RankingList
          title="⑤ 元請担当者ランキング"
          items={rankBy(complaints, c => c.clientContact)}
          barClass="bg-violet-400"
        />
      </div>
    </div>
  )
}
