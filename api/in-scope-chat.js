export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed.'
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: 'AI API key is missing.'
    });
  }

  try {
    const messages = Array.isArray(req.body?.messages)
      ? req.body.messages.slice(-8)
      : [];

    const contents = messages
      .filter(item =>
        ['user', 'model'].includes(item.role) &&
        typeof item.text === 'string' &&
        item.text.trim()
      )
      .map(item => ({
        role: item.role,
        parts: [{ text: item.text.slice(0, 1500) }]
      }));

    if (
      !contents.length ||
      contents[contents.length - 1].role !== 'user'
    ) {
      return res.status(400).json({
        error: 'Please enter a message.'
      });
    }

    const systemPrompt = `
You are In Scope AI, the customer support assistant for AirData GH.

Only answer questions about AirData GH, including:
- Customer registration and login.
- MTN data bundles and prices shown on the website.
- Bundle orders.
- Wallet deposits and payments.
- Customer support.

Use simple, friendly English.

Rules:
- Do not answer unrelated questions.
- Never invent prices. Refer customers to the website.
- Never claim a payment or order succeeded without verified records.
- You cannot view private customer accounts or transactions.
- Never request passwords, PINs, OTPs or full card details.
- For human assistance, provide WhatsApp support: 0548 206 175.
- Never pretend to perform actions on customer accounts.
`;

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' +
        encodeURIComponent(apiKey),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents,
          generationConfig: {
            maxOutputTokens: 350
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API error:', data);
      return res.status(502).json({
        error: 'In Scope AI is temporarily unavailable. Please try again.'
      });
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || '')
      .join('')
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: 'No response received. Please try again.'
      });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('In Scope AI error:', error);

    return res.status(500).json({
      error: 'Something went wrong. Please try again.'
    });
  }
}
