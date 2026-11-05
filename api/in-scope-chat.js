
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

    const lastMessage = contents[contents.length - 1]
      .parts[0].text.trim();

    // Handle simple greetings and introductions immediately.
    // These responses do not depend on Gemini availability.
    const greetingPattern =
      /^(hi|hello|hey|heya|good morning|good afternoon|good evening|how are you|how are you doing|what's up|whats up|howdy|greetings)[!.?,\s]*$/i;

    const identityPattern =
      /^(who are you|what is your name|what's your name|introduce yourself)[!.?,\s]*$/i;

    const introductionPattern =
      /^(my name is|i am|i'm)\s+([a-z][a-z\s'-]{0,40})[!.?,\s]*$/i;

    if (greetingPattern.test(lastMessage)) {
      return res.status(200).json({
        reply:
          'Hello! 👋 Welcome to AirData GH. I am In Scope AI, your friendly customer support assistant. How can I help you today?'
      });
    }

    if (identityPattern.test(lastMessage)) {
      return res.status(200).json({
        reply:
          'I am In Scope AI 🤖, the official customer support assistant for AirData GH. I can help you with registration, login, MTN data bundles, orders, wallet deposits and payment questions. What would you like to know?'
      });
    }

    const introduction = lastMessage.match(introductionPattern);

    if (introduction) {
      const personName = introduction[2].trim();

      return res.status(200).json({
        reply:
          `Nice to meet you, ${personName}! 😊 I am In Scope AI, your AirData GH assistant. You can ask me about data bundles, registration, orders, payments or anything related to AirData GH. How can I help you?`
      });
    }

    const systemPrompt = `
You are In Scope AI, the friendly customer support assistant
for AirData GH.

YOUR PERSONALITY:
- Be friendly, polite, welcoming and helpful.
- Accept greetings and introductions naturally.
- Respond warmly when customers say hello, good morning,
  good afternoon, good evening or ask how you are.
- If someone introduces themselves, acknowledge their name
  and make them feel welcome.
- You may have brief friendly conversation before guiding
  customers toward AirData GH support.
- Remember names and details mentioned in the current chat.

YOUR MAIN RESPONSIBILITIES:
Help customers with:
- Customer registration and login.
- MTN data bundles and website prices.
- Bundle orders and order difficulties.
- Wallet deposits and payments.
- Website navigation.
- Customer support.

IMPORTANT RULES:
- Keep answers simple, clear and friendly.
- Do not answer unrelated questions beyond brief polite
  conversation.
- Never invent bundle prices. Refer customers to the website.
- Never claim an order or payment succeeded without verified
  transaction records.
- You cannot view private customer accounts or transactions.
- Never request passwords, PINs, OTPs or full card details.
- Never pretend to perform actions on customer accounts.
- If human assistance is needed, provide WhatsApp support:
  0548 206 175.
- If you do not know an answer, say so honestly.

Always make customers feel welcome and respected.
`;

    // Try the primary model and two verified alternatives.
    const models = [
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite'
    ];

    let lastError = null;

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
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
                maxOutputTokens: 350
              }
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          console.error(`Gemini ${model} error:`, data);
          lastError = data;
          continue;
        }

        const reply = data.candidates?.[0]?.content?.parts
          ?.map(part => part.text || '')
          .join('')
          .trim();

        if (reply) {
          return res.status(200).json({
            reply,
            modelUsed: model
          });
        }

        lastError = {
          error: 'The model returned an empty response.'
        };

      } catch (error) {
        console.error(`Gemini ${model} failed:`, error);
        lastError = error;
      }
    }

    console.error('All Gemini models failed:', lastError);

    return res.status(503).json({
      error:
        'Our AI assistant is temporarily busy. Please try again shortly.'
    });

  } catch (error) {
    console.error('In Scope AI error:', error);

    return res.status(500).json({
      error: 'Something went wrong. Please try again.'
    });
  }
}
