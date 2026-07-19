// 真因カテゴリー（8種）と表示色
// 色が未定義のカテゴリーがあると画面上で見分けがつかなくなるため、8種すべてに色を定義する
export const ROOT_THEMES = ['教育不足', '標準化不足', 'ルール未整備', 'システム不備', '顧客確認不足', '引継ぎ不足', 'マネジメント不足', '人員配置問題']

export const ROOT_THEME_COLORS = {
  '教育不足':         'bg-amber-500',
  '標準化不足':       'bg-blue-500',
  'ルール未整備':     'bg-violet-500',
  'システム不備':     'bg-cyan-500',
  '顧客確認不足':     'bg-red-500',
  '引継ぎ不足':       'bg-orange-500',
  'マネジメント不足': 'bg-emerald-500',
  '人員配置問題':     'bg-slate-500',
}

// 横展開対象部署（6種）
export const DEPARTMENTS = ['工事部解体課', '工事部産廃課', '清掃部清掃１課', '清掃部清掃２課', '環境リサイクル部', '本部']

// なぜなぜ分析の必須回数（原因分析・改善報告書フォーム）
export const WHY_COUNT_MIN = 3
export const WHY_COUNT_MAX = 5
