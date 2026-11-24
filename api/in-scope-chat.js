
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(503).json({ error: 'AI API key is missing.' });
  }

  try {
    const messages = Array.isArray(req.body?.messages)
      ? req.body.messages.slice(-6)
      : [];

    const contents = messages
      .filter(item =>
        ['user', 'model'].includes(item.role) &&
        typeof item.text === 'string' &&
        item.text.trim()
      )
      .map(item => ({
        role: item.role,
        parts: [{ text: item.text.slice(0, 1200) }]
      }));

    if (
      !contents.length ||
      contents[contents.length - 1].role !== 'user'
    ) {
      return res.status(400).json({
        error: 'Please enter a message.'
      });
    }

    const lastMessage = contents[contents.length - 1]
      .parts[0].text.trim();

    const greetingPattern =
      /^(hi|hello|hey|heya|good morning|good afternoon|good evening|how are you|how are you doing|what's up|whats up|howdy|greetings)[!.?,\s]*$/i;

    const identityPattern =
      /^(who are you|what is your name|what's your name|introduce yourself)[!.?,\s]*$/i;

    const introductionPattern =
      /^(my name is|i am|i'm)\s+([a-z][a-z\s'-]{0,40})[!.?,\s]*$/i;

    if (greetingPattern.test(lastMessage)) {
      return res.status(200).json({
        reply: 'Hello! 👋 Welcome to AirData GH. I am In Scope AI. How can I help you today?'
      });
    }

    if (identityPattern.test(lastMessage)) {
      return res.status(200).json({
        reply: 'I am In Scope AI 🤖, the AirData GH customer support assistant. I can help with registration, data bundles, orders, wallet deposits and payments. What would you like to know?'
      });
    }

    const introduction = lastMessage.match(introductionPattern);

    if (introduction) {
      return res.status(200).json({
        reply: `Nice to meet you, ${introduction[2].trim()}! 😊 I am In Scope AI. How can I help you with AirData GH today?`
      });
    }

    const systemPrompt = `
You are In Scope AI, the customer support assistant for AirData GH.

Be friendly, natural, accurate and very concise.
Answer the customer's actual question directly.
Prefer short answers and simple language.
Avoid unnecessary introductions, repetition and long explanations.
Use short lists only when they make an answer clearer.

You help with:
- Registration and login.
- MTN, AirtelTigo and Telecel data bundles.
- Orders and order difficulties.
- Wallet deposits and payments.
- Website navigation and customer support.

Rules:
- Never invent bundle prices. Ask customers to check the website for current prices.
- Never claim a payment or order succeeded without verified records.
- You cannot access private customer accounts or transactions.
- Never ask for passwords, PINs, OTPs or full card details.
- Never pretend to perform actions on a customer's account.
- For human assistance, provide WhatsApp support: 0548 206 175.
- If you do not know something, say so honestly.
- Keep normal answers brief unless the customer asks for detail.
`;

    const upstream = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:streamGenerateContent?alt=sse',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents,
          generationConfig: {
            maxOutputTokens: 220,
            candidateCount: 1
          }
        })
      }
    );

    if (!upstream.ok) {
      const errorText = await upstream.text();
      console.error('Gemini API error:', errorText);

      return res.status(502).json({
        error: 'In Scope AI is temporarily unavailable. Please try again.'
      });
    }

    if (!upstream.body) {
      return res.status(502).json({
        error: 'The AI connection did not return a response.'
      });
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    function sendText(text) {
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    function processEvent(eventText) {
      const dataLines = eventText
        .split(/\r?\n/)
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trim());

      if (!dataLines.length) return;

      try {
        const data = JSON.parse(dataLines.join('\n'));
        const text = data.candidates?.[0]?.content?.parts
          ?.map(part => part.text || '')
          .join('');

        sendText(text);
      } catch (error) {
        // Ignore incomplete or non-text stream events.
      }
    }

    try {
      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || '';

        for (const eventText of events) {
          processEvent(eventText);
        }
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        processEvent(buffer);
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (streamError) {
      console.error('AI stream error:', streamError);

      if (!res.writableEnded) {
        res.end();
      }
    }
  } catch (error) {
    console.error('In Scope AI error:', error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Something went wrong. Please try again.'
      });
    }

    if (!res.writableEnded) {
      res.end();
    }
  }
}
