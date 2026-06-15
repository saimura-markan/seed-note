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
 */
export function getRole(user) {
  const meta = user?.app_metadata ?? {}
  return meta.seed_note_role || meta.role || 'user'
}
