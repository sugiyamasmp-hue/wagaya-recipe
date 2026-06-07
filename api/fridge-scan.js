export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'APIキーが設定されていません' });

    const { imageData, mediaType } = req.body;
    if (!imageData || !mediaType) return res.status(400).json({ error: '画像データがありません' });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageData },
            },
            {
              type: 'text',
              text: `この画像に写っている食材・食品をすべてリストアップしてください。
必ずJSON形式のみで返してください。前置きや説明は不要です。

{
  "ingredients": ["食材名1", "食材名2", "食材名3"]
}

- 食材名は一般的な日本語で記載（例：鶏もも肉、玉ねぎ、にんじん、豆腐、卵）
- 調味料・ドレッシングなどの瓶・袋も含める
- 食材が見えない・判断できない場合は { "ingredients": [], "error": "食材を認識できませんでした" } を返す`,
            },
          ],
        }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Claude API error:', response.status, JSON.stringify(data));
      return res.status(500).json({ error: 'AI処理に失敗しました' });
    }

    const text = data.content.map(c => c.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    return res.status(200).json(result);

  } catch (err) {
    console.error('Fridge scan error:', err);
    return res.status(500).json({ error: 'スキャンに失敗しました' });
  }
}
