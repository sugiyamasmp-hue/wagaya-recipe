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

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY is not set in environment variables');
      return res.status(500).json({ error: 'APIキーが設定されていません' });
    }

    const { imageData, mediaType } = req.body;

    if (!imageData || !mediaType) {
      return res.status(400).json({ error: '画像データがありません' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageData }
            },
            {
              type: 'text',
              text: `この画像からレシピを読み取って、必ずJSON形式のみで返してください。前置きや説明は不要です。
{
  "title": "料理名",
  "description": "一言メモ",
  "servings": 2,
  "ingredients": [
    {"name": "材料名", "amount": 200, "unit": "g"}
  ],
  "steps": [
    {"type": "prep", "content": "手順"},
    {"type": "cook", "content": "手順"},
    {"type": "plate", "content": "手順"}
  ]
}
amountは必ず数値を抽出すること（例：200g→200、大さじ2→2、少々→nullでOK）。読み取れる数字は必ず入れる。
unitは画像から読み取った単位をそのまま使う。リストにない単位（カップ、少々など）もそのまま入れてよい。
typeはprep（仕込み）、cook（調理）、plate（盛り付け）のどれかを判断して入れてください。レシピが読み取れない場合は { "error": "読み取れませんでした" } を返してください。`
            }
          ]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Claude API error status:', response.status);
      console.error('Claude API error body:', JSON.stringify(data));
      return res.status(500).json({ error: 'AI処理に失敗しました', detail: data?.error?.type });
    }

    const text = data.content.map(c => c.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const recipe = JSON.parse(clean);

    return res.status(200).json(recipe);

  } catch (err) {
    console.error('OCR error:', err);
    return res.status(500).json({ error: '読み取りに失敗しました' });
  }
}
