import { useState } from 'react'
import { useData } from '../contexts/DataContext'
import { Input } from '../components/ui/input'
import { Card } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'

export default function Companies() {
  const { companies, loaded } = useData()
  const [q, setQ] = useState('')

  if (!loaded) {
    return (
      <div className="flex items-center justify-center pt-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    )
  }

  const filtered = companies.filter(c =>
    !q || (c.name || '').includes(q) || (c.company_id || '').includes(q)
  )

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-5">顧客マスタ</h1>
      <div className="flex gap-3 mb-4">
        <Input
          placeholder="会社名・コードで検索"
          value={q}
          onChange={e => setQ(e.target.value)}
          className="max-w-sm bg-white"
        />
      </div>
      <Card>
        {filtered.length === 0 ? (
          <p className="text-center py-10 text-gray-400 text-sm">データがありません</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>企業コード</TableHead>
                <TableHead>会社名</TableHead>
                <TableHead>担当者</TableHead>
                <TableHead>電話</TableHead>
                <TableHead>メール</TableHead>
                <TableHead>有効</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.company_id || c.id?.slice(0, 8)}</TableCell>
                  <TableCell className="font-semibold">{c.name || '-'}</TableCell>
                  <TableCell>{c.contact_name || '-'}</TableCell>
                  <TableCell>{c.phone || '-'}</TableCell>
                  <TableCell>{c.email || '-'}</TableCell>
                  <TableCell>
                    {c.is_active !== false ? (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700">有効</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600">無効</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
