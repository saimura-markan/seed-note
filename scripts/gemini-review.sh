#!/bin/bash
# Gemini CLIによる日次コードレビュースクリプト
# AI-REVIEW-SECURITY-RULES.md 準拠

set -euo pipefail

# ===== 設定 =====
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${npm_config_local_prefix:-$(cd "$SCRIPT_DIR/.." && pwd)}"
RULES_FILE="$PROJECT_ROOT/docs/AI-REVIEW-SECURITY-RULES.md"
REPORTS_DIR="$PROJECT_ROOT/docs/reports"
TODAY="$(date +%Y-%m-%d)"
REPORT_FILE="$REPORTS_DIR/${TODAY}-review.md"
MAX_ROUNDS=3

# ===== 関数定義 =====

log() { echo "[$(date +%H:%M:%S)] $*"; }
abort() { echo "❌ 中止: $*" >&2; exit 1; }

# APIキーをロード（値は表示しない）
load_api_key() {
  if [[ -n "${GEMINI_API_KEY:-}" ]]; then
    log "APIキー: 環境変数から読み込み済み"
    return
  fi
  local env_file="$PROJECT_ROOT/.env.local"
  if [[ -f "$env_file" ]]; then
    local key
    key=$(grep -E "^GEMINI_API_KEY=" "$env_file" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    if [[ -n "$key" ]]; then
      export GEMINI_API_KEY="$key"
      log "APIキー: .env.local から読み込み済み"
    else
      abort ".env.local に GEMINI_API_KEY が見つかりません"
    fi
  else
    abort ".env.local が見つかりません。APIキーを設定してください"
  fi
}

# シークレット検査（送信前チェック）
# 代入コンテキスト（KEYWORD = "長い値"）のみ検出し、変数名・関数名・プロパティキー単体は除外する
check_secrets() {
  local content="$1"

  # KEYWORD = "20文字以上の値" 形式のみ検出（アルファベット・数字のみで構成された長い文字列が実際の値に相当）
  local value_patterns=(
    "[A-Za-z_]*API_KEY[A-Za-z_]*[[:space:]]*[=:][[:space:]]*[\"']?[A-Za-z0-9+/=_-]{20,}"
    "[A-Za-z_]*SECRET[A-Za-z_]*[[:space:]]*[=:][[:space:]]*[\"']?[A-Za-z0-9+/=_-]{20,}"
    "[A-Za-z_]*TOKEN[A-Za-z_]*[[:space:]]*[=:][[:space:]]*[\"']?[A-Za-z0-9+/=_-]{20,}"
    "[A-Za-z_]*PASSWORD[A-Za-z_]*[[:space:]]*[=:][[:space:]]*[\"']?[A-Za-z0-9+/=_@!#-]{8,}"
    "SUPABASE_SERVICE_ROLE_KEY[[:space:]]*[=:][[:space:]]*[\"']?[A-Za-z0-9+/=_.-]{20,}"
    "JWT[[:space:]]*[=:][[:space:]]*[\"']?[A-Za-z0-9+/=_.-]{20,}"
  )

  # 形式が固有なため短くても高信頼度のパターン
  local specific_patterns=(
    "ghp_[A-Za-z0-9]{36}"   # GitHub PAT
    "eyJ[A-Za-z0-9+/]{30,}" # JWT（base64ヘッダ eyJ = {"）
  )

  for pattern in "${value_patterns[@]}"; do
    if echo "$content" | grep -qE "$pattern"; then
      abort "シークレット検出: '$pattern' パターンに一致。送信を中止します"
    fi
  done

  for pattern in "${specific_patterns[@]}"; do
    if echo "$content" | grep -qE "$pattern"; then
      abort "シークレット検出: '$pattern' パターンに一致。送信を中止します"
    fi
  done

  log "シークレット検査: 問題なし ✅"
}

# 個人情報チェック（簡易）
check_personal_info() {
  local content="$1"
  # 電話番号パターン（日本）
  if echo "$content" | grep -qE "0[0-9]{1,4}-[0-9]{2,4}-[0-9]{4}"; then
    abort "電話番号の可能性があるデータを検出。送信を中止します"
  fi
  # メールアドレスパターン
  if echo "$content" | grep -qE "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"; then
    abort "メールアドレスの可能性があるデータを検出。送信を中止します"
  fi
  log "個人情報チェック: 問題なし ✅"
}

# diff から追加行(+)のみを抽出する（ファイルヘッダ +++ は除外）
# 削除行(-)には「消したはずの過去データ」が写り込むため、新規混入だけを
# 検査したい PII チェックはこの出力を対象にする。
added_lines() {
  local content="$1"
  echo "$content" | grep -E '^\+' | grep -vE '^\+\+\+' || true
}

# 外部送信前に個人情報（メール・電話番号）をマスクする。
# 追加行の新規 PII は check_personal_info で既に中止済み。ここでは削除行・
# 文脈行に残る過去 PII を Gemini へ送らないためにマスクする。
redact_pii() {
  local content="$1"
  echo "$content" \
    | sed -E 's/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/[REDACTED_EMAIL]/g' \
    | sed -E 's/0[0-9]{1,4}-[0-9]{2,4}-[0-9]{4}/[REDACTED_PHONE]/g'
}

# レビュー対象のコードを収集（Git差分のみ）
collect_review_target() {
  cd "$PROJECT_ROOT"

  # ステージング済み + 未ステージの差分
  local diff_content
  diff_content=$(git diff HEAD 2>/dev/null || true)

  # 差分がない場合は直近1コミットの変更を対象
  if [[ -z "$diff_content" ]]; then
    log "作業中の差分なし → 直近1コミットの変更をレビュー対象にします"
    diff_content=$(git diff HEAD~1 HEAD 2>/dev/null || true)
  fi

  if [[ -z "$diff_content" ]]; then
    abort "レビュー対象のコード差分が見つかりません"
  fi

  echo "$diff_content"
}

# Geminiへ送信してレビュー取得
run_gemini_review() {
  local code="$1"
  local round="$2"

  local prompt="あなたはReact + Supabaseのコードレビュアーです。
以下のGit差分をレビューしてください。

【レビュー観点】
1. バグ・ロジックエラー
2. セキュリティリスク（SQLインジェクション・XSS・認証不備など）
3. パフォーマンス問題
4. React/JSのベストプラクティス違反
5. Supabase利用の適切性

【出力形式】
## 重大な問題（要修正）
## 軽微な問題（推奨修正）
## 良い点
## 総合評価（A/B/C/D）

---
${code}"

  log "Geminiレビュー実行中... (第${round}回)"
  gemini -p "$prompt" 2>/dev/null
}

# レポートを保存
save_report() {
  local review_result="$1"
  local round="$2"
  local diff_summary="$3"

  mkdir -p "$REPORTS_DIR"

  if [[ "$round" -eq 1 ]]; then
    # 新規作成
    cat > "$REPORT_FILE" << EOF
# Geminiレビューレポート ${TODAY}

> 生成日時: $(date "+%Y-%m-%d %H:%M:%S")
> AI-REVIEW-SECURITY-RULES.md 準拠

---

## レビュー対象サマリー

\`\`\`
${diff_summary}
\`\`\`

---

EOF
  fi

  cat >> "$REPORT_FILE" << EOF
## レビュー結果（第${round}回）

${review_result}

---

EOF

  log "レポート保存: $REPORT_FILE"
}

# ===== メイン処理 =====

main() {
  log "===== Geminiレビュー開始 ====="

  # セキュリティルールファイル確認
  if [[ ! -f "$RULES_FILE" ]]; then
    abort "AI-REVIEW-SECURITY-RULES.md が見つかりません: $RULES_FILE"
  fi
  log "セキュリティルール: 確認済み ✅"

  # APIキー読み込み
  load_api_key

  # レビュー対象収集
  log "レビュー対象コードを収集中..."
  local code
  code=$(collect_review_target)

  # 送信前チェック
  # PII（メール・電話番号）は「追加行」のみを検査する。git diff には削除行(-)
  # として過去のデータが写り込むため、削除行まで検査すると「消したはずのメール」で
  # 誤中止する。新規に混入した PII だけを止めたい。
  log "送信前セキュリティチェック実行中..."
  local added_only
  added_only=$(added_lines "$code")
  check_secrets "$code"              # シークレットは重大度が高いため差分全体を対象に据え置き
  check_personal_info "$added_only"

  # Gemini へ送るコードは、削除行・文脈行に残る PII をマスクしてから送信する
  # （追加行の新規 PII は上の check_personal_info で既に中止済み）
  code=$(redact_pii "$code")

  # 差分サマリー（ファイル名のみ）
  local diff_summary
  diff_summary=$(cd "$PROJECT_ROOT" && git diff HEAD --name-only 2>/dev/null || git diff HEAD~1 HEAD --name-only)

  # レビューループ（最大3回）
  local round=1
  while [[ $round -le $MAX_ROUNDS ]]; do
    local result
    result=$(run_gemini_review "$code" "$round")

    save_report "$result" "$round" "$diff_summary"

    echo ""
    echo "===== 第${round}回レビュー結果 ====="
    echo "$result"
    echo "=================================="
    echo ""

    # 重大問題がなければ終了
    if ! echo "$result" | grep -qE "^## 重大な問題" || echo "$result" | grep -qE "重大な問題.*(なし|ありません|該当なし)"; then
      log "重大な問題なし → レビュー完了"
      break
    fi

    if [[ $round -lt $MAX_ROUNDS ]]; then
      echo "重大な問題が検出されました。修正後に続行しますか？ [y/N]"
      read -r answer
      if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
        log "ユーザーによりレビュー中断"
        break
      fi
      log "次のレビューラウンドへ..."
    else
      log "⚠️ ${MAX_ROUNDS}回のレビューで解決せず → 人間確認が必要です"
      echo "" >> "$REPORT_FILE"
      echo "## ⚠️ 未解決：人間確認が必要" >> "$REPORT_FILE"
    fi

    ((round++))
  done

  log "===== レビュー完了 ====="
  log "レポート: $REPORT_FILE"
}

main "$@"
