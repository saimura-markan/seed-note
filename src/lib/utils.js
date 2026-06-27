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
