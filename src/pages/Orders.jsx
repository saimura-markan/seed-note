import { useState } from 'react'
import { useData } from '../contexts/DataContext'
import { Input } from '../components/ui/input'
import { Card } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import StatusBadge from '../components/StatusBadge'

export default function Orders() {
  const { orders, loaded } = useData()
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  if (!loaded) {
    return (
      <div className="flex items-center justify-center pt-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    )
  }

  const statuses = [...new Set(orders.map(o => o.status).filter(Boolean))]
  const filtered = orders.filter(o =>
    (!q || (o.id || '').includes(q) || (o.service || '').includes(q) || (o.site || '').includes(q)) &&
    (!statusFilter || o.status === statusFilter)
  )

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-5">発注一覧</h1>
      <div className="flex gap-3 mb-4">
        <Input
          placeholder="ID・サービス・現場で検索"
          value={q}
          onChange={e => setQ(e.target.value)}
          className="max-w-xs bg-white"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">すべて</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <Card>
        {filtered.length === 0 ? (
          <p className="text-center py-10 text-gray-400 text-sm">データがありません</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>サービス</TableHead>
                <TableHead>現場</TableHead>
                <TableHead>住所</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>作成日</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.id}</TableCell>
                  <TableCell>{o.service || '-'}</TableCell>
                  <TableCell>{o.site || '-'}</TableCell>
                  <TableCell className="text-xs text-gray-500">{o.address || '-'}</TableCell>
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                  <TableCell className="text-gray-400 text-xs">{o.created_at?.slice(0, 10) ?? '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
