import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * ユーザーのロールを返す。
 * raw_app_meta_data の seed_note_role を優先し、未設定なら role にフォールバック。
 *
 * seed_note_role の値:
 *   admin     → 管理者（全権限）
 *   director  → 事業責任者
 *   executive → 役員
 *   manager   → 主任クラス
 *   staff     → スタッフ（受付入力・閲覧のみ。対応入力・対応案・報告書・承認は不可）
 */
export function getRole(user) {
  const meta = user?.app_metadata ?? {}
  return meta.seed_note_role || meta.role || 'user'
}

/**
 * action_deadline（YYYY-MM-DD）から現在までの残り分数を返す。
 * 期限は当日の 23:59:59 とみなす。
 * 正値 = 残り、負値 = 超過、null = 計算不要（期限なし or 完了）
 */
export function calcDeadlineMinutes(deadlineStr, progressStr) {
  if (!deadlineStr || progressStr === '完了') return null
  const dl = new Date(deadlineStr + 'T23:59:59')
  return Math.round((dl - new Date()) / 60000)
}

/**
 * 分数（正値 or 負値）を "X日 X時間 X分" 形式に変換。
 * diffMin が null の場合は null を返す。
 */
export function fmtCountdown(diffMin) {
  if (diffMin === null) return null
  const abs = Math.abs(diffMin)
  const d = Math.floor(abs / 1440)
  const h = Math.floor((abs % 1440) / 60)
  const m = abs % 60
  const parts = []
  if (d > 0) parts.push(`${d}日`)
  if (h > 0) parts.push(`${h}時間`)
  if (m > 0 || parts.length === 0) parts.push(`${m}分`)
  return parts.join(' ')
}

/**
 * ローカルタイムでの今日の日付文字列（YYYY-MM-DD）。
 * 期限アラートの useMemo キーに使う（日付が変わった時だけ再計算させるため）。
 */
export function getTodayDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// dueDate（YYYY-MM-DD）までのカレンダー日数の差。正値=残り、0=本日、負値=超過日数。
// calcDeadlineMinutes と同じく「当日23:59:59を期限とする」考え方に揃える。
function daysUntil(dueDate, todayStr = getTodayDateStr()) {
  const [ty, tm, td] = todayStr.split('-').map(Number)
  const [dy, dm, dd] = dueDate.split('-').map(Number)
  return Math.round((Date.UTC(dy, dm - 1, dd) - Date.UTC(ty, tm - 1, td)) / 86400000)
}

/**
 * 真因対策（組織改善策）の期限状態を4段階で返す純粋関数。
 * 掲示板・ダッシュボードで共有する。
 *
 * dueDate: action_deadline（YYYY-MM-DD）
 * isDone : action_progress === '完了' など、完了を表すboolean
 * 戻り値 : 'normal'（残り4日以上） | 'soon'（残り3日以内） | 'today'（本日期限） |
 *          'overdue'（超過） | null（期限なし or 完了）
 */
export function getDeadlineStatus(dueDate, isDone) {
  if (!dueDate || isDone) return null
  const diff = daysUntil(dueDate)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff <= 3) return 'soon'
  return 'normal'
}

/** 超過日数（overdueの時だけ意味を持つ。常に0以上） */
export function getDaysOverdue(dueDate) {
  if (!dueDate) return 0
  return Math.max(0, -daysUntil(dueDate))
}

/** 残り日数（normal/soonの時に使う） */
export function getDaysRemaining(dueDate) {
  if (!dueDate) return null
  return Math.max(0, daysUntil(dueDate))
}

/** 期限状態ごとの色定義。掲示板・ダッシュボードで共有する。 */
export const DEADLINE_STATUS_STYLES = {
  normal:  { border: 'border-l-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700', label: '通常' },
  soon:    { border: 'border-l-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700',   label: 'まもなく' },
  today:   { border: 'border-l-orange-400',  bg: 'bg-orange-50',  text: 'text-orange-700',  label: '本日期限' },
  overdue: { border: 'border-l-red-400',     bg: 'bg-red-50',     text: 'text-red-700',     label: '超過' },
}
