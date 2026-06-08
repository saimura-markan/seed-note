import { cn } from '@/lib/utils'

const statusStyles = {
  '調整中': 'bg-amber-100 text-amber-700',
  '日程確定': 'bg-indigo-100 text-indigo-700',
  '完了': 'bg-emerald-100 text-emerald-700',
  'キャンセル': 'bg-red-100 text-red-700',
  '日程相談中': 'bg-amber-100 text-amber-700',
  '日程変更相談中': 'bg-amber-100 text-amber-700',
  'キャンセル相談中': 'bg-red-100 text-red-700',
}

export default function StatusBadge({ status }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        statusStyles[status] ?? 'bg-gray-100 text-gray-600'
      )}
    >
      {status || '-'}
    </span>
  )
}
