import Anthropic from '@anthropic-ai/sdk'

const QUESTION_SYSTEM = `あなたは建設・解体・清掃業の現場で起きたクレームの根本原因を、現場の担当者と一緒に考えるアシスタントです。
ソクラテス式の対話をしてください。

ルール：
- 毎回1つだけ、短い質問をしてください（1文・20〜40文字程度）
- 現場の言葉を使い、難しい言葉・カタカナ・専門用語は絶対に使わない
- 答えを教えない。ヒントも最小限
- 相手の回答を必ず踏まえて、さらに深く掘り下げる質問をする
- 質問だけを返す。説明や前置きは不要`

const SUMMARY_SYSTEM = `建設・解体・清掃業の現場作業者に向けて、対話の内容をもとに運用改善案を箇条書きでまとめてください。

形式：各項目を「・」で始める

ルール：
- 3〜5項目にまとめる
- 動詞で終わる（例：〜する、〜確認する、〜決める）
- カタカナ・専門用語を使わない
- 「明日から何をすればいいか」がわかる具体的な行動を書く
- 「・」で始まる箇条書きのみ。説明文や見出しは不要`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { directCause, history = [], mode = 'question' } = req.body

  if (!directCause) return res.status(400).json({ error: 'directCause is required' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY が設定されていません' })

  const client = new Anthropic({ apiKey })

  try {
    const messages = buildMessages(directCause, history)

    if (mode === 'summarize') {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: SUMMARY_SYSTEM,
        messages,
      })
      return res.json({ summary: response.content[0].text.trim() })
    }

    // mode === 'question'
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      system: QUESTION_SYSTEM,
      messages,
    })
    return res.json({ question: response.content[0].text.trim() })
  } catch (err) {
    console.error('Anthropic API error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}

function buildMessages(directCause, history) {
  const intro = history.length === 0
    ? `直接原因：「${directCause}」\n\nこの原因について、最初の質問をしてください。`
    : `直接原因：「${directCause}」`

  const messages = [{ role: 'user', content: intro }]

  for (const h of history) {
    messages.push({
      role: h.role === 'ai' ? 'assistant' : 'user',
      content: h.content,
    })
  }

  return messages
}
