import { useState } from 'react'
import { useData } from '../contexts/DataContext'
import { Input } from '../components/ui/input'
import { Card } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'

export default function Sites() {
  const { sites, loaded } = useData()
  const [q, setQ] = useState('')

  if (!loaded) {
    return (
      <div className="flex items-center justify-center pt-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    )
  }

  const filtered = sites.filter(s =>
    !q || (s.name || '').includes(q) || (s.address || '').includes(q)
  )

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-5">現場マスタ</h1>
      <div className="flex gap-3 mb-4">
        <Input
          placeholder="現場名・住所で検索"
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
                <TableHead>現場名</TableHead>
                <TableHead>住所</TableHead>
                <TableHead>郵便番号</TableHead>
                <TableHead>鍵</TableHead>
                <TableHead>駐車場</TableHead>
                <TableHead>メモ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-semibold">{s.name || '-'}</TableCell>
                  <TableCell>{s.address || '-'}</TableCell>
                  <TableCell>{s.zip_code || '-'}</TableCell>
                  <TableCell className="text-xs">{s.key_info || '-'}</TableCell>
                  <TableCell className="text-xs">{s.parking_info || '-'}</TableCell>
                  <TableCell className="text-xs text-gray-400">
                    {s.memo ? s.memo.slice(0, 30) + (s.memo.length > 30 ? '…' : '') : '-'}
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
