import React, { useEffect, useRef, useState } from 'react';

export default function InScopeAI() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState([
    {
      role: 'model',
      text: 'Hello! 👋 I am In Scope AI. How can I help you with AirData GH today?'
    }
  ]);

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(event) {
    event.preventDefault();

    const question = message.trim();

    if (!question || loading) return;

    const updatedMessages = [
      ...messages,
      { role: 'user', text: question }
    ];

    setMessages(updatedMessages);
    setMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/in-scope-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: updatedMessages.slice(-8)
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Please try again.');
      }

      setMessages(previous => [
        ...previous,
        { role: 'model', text: result.reply }
      ]);

    } catch (error) {
      setMessages(previous => [
        ...previous,
        {
          role: 'model',
          text: error.message || 'Sorry, something went wrong.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        className="scope-launcher"
        onClick={() => setOpen(!open)}
      >
        {open ? '✕ Close' : '💬 Need Help? Ask In Scope AI'}
      </button>

      {open && (
        <section className="scope-chat">
          <div className="scope-header">
            <div>
              <strong>In Scope AI</strong>
              <small>AirData GH Customer Assistant</small>
            </div>

            <button onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>

          <div className="scope-messages">
            {messages.map((item, index) => (
              <div
                key={index}
                className={
                  item.role === 'user'
                    ? 'scope-message scope-user'
                    : 'scope-message scope-bot'
                }
              >
                {item.text}
              </div>
            ))}

            {loading && (
              <div className="scope-message scope-bot">
                In Scope AI is typing...
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <form className="scope-form" onSubmit={sendMessage}>
            <input
              value={message}
              onChange={event => setMessage(event.target.value)}
              placeholder="Type your question..."
              maxLength={1500}
              disabled={loading}
            />

            <button disabled={loading || !message.trim()}>
              Send
            </button>
          </form>

          <div className="scope-note">
            In Scope AI can help with AirData GH questions.
          </div>
        </section>
      )}
    </>
  );
    }
