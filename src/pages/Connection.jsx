import { useData } from '../contexts/DataContext'
import { Card } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'

export default function Connection() {
  const { dbStatus } = useData()
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-5">接続確認</h1>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>テーブル</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>件数</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(dbStatus).map(([table, info]) => (
              <TableRow key={table}>
                <TableCell className="font-mono">{table}</TableCell>
                <TableCell>
                  {info.loading ? (
                    <span className="text-gray-400 text-xs">確認中...</span>
                  ) : info.error ? (
                    <span className="text-red-500 text-xs">エラー: {info.error}</span>
                  ) : (
                    <span className="text-emerald-600 text-xs font-semibold">OK</span>
                  )}
                </TableCell>
                <TableCell>{info.count != null ? `${info.count}件` : '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <p className="text-gray-400 text-xs mt-2">
        Supabase URL: <code className="text-xs">{supabaseUrl}</code>
      </p>
    </div>
  )
}
