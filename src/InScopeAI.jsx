
import React, { useEffect, useRef, useState } from 'react';

export default function InScopeAI() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');

  const [messages, setMessages] = useState([
    {
      role: 'model',
      text: 'Hello! 👋 I am In Scope AI. How can I help you with AirData GH today?'
    }
  ]);

  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);
  const voiceBaseRef = useRef('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function startVoiceRecognition() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError(
        'Voice recognition is not supported in this browser. Try another supported browser.'
      );
      return;
    }

    setVoiceError('');

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-GH';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    voiceBaseRef.current = message.trim();

    recognition.onstart = () => {
      setListening(true);
      setVoiceError('');
    };

    recognition.onresult = (event) => {
      let transcript = '';

      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript + ' ';
      }

      setMessage(
        `${voiceBaseRef.current} ${transcript}`.trim().slice(0, 1500)
      );
    };

    recognition.onerror = (event) => {
      setListening(false);

      if (event.error === 'not-allowed') {
        setVoiceError('Please allow microphone access to use voice input.');
      } else if (event.error === 'no-speech') {
        setVoiceError('No speech detected. Tap the microphone and try again.');
      } else {
        setVoiceError('Voice recognition stopped. Please try again.');
      }
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      setListening(false);
      recognitionRef.current = null;
      setVoiceError('Could not start the microphone. Please try again.');
    }
  }

  function stopVoiceRecognition() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  async function sendMessage(event) {
    event.preventDefault();

    const question = message.trim();
    if (!question || loading) return;

    stopVoiceRecognition();
    setVoiceError('');

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
        type="button"
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

            <button
              type="button"
              onClick={() => {
                stopVoiceRecognition();
                setOpen(false);
              }}
            >
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
              placeholder="Type or speak your question..."
              maxLength={1500}
              disabled={loading}
            />

            <button
              type="button"
              onClick={listening ? stopVoiceRecognition : startVoiceRecognition}
              disabled={loading}
              aria-label={listening ? 'Stop voice input' : 'Start voice input'}
              title={listening ? 'Stop listening' : 'Speak your question'}
              style={{
                background: listening ? '#dc2626' : '#0879e8',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '0 13px',
                cursor: 'pointer',
                fontSize: '19px',
                minWidth: '44px'
              }}
            >
              {listening ? '⏹' : '🎙️'}
            </button>

            <button
              type="submit"
              disabled={loading || !message.trim()}
            >
              Send
            </button>
          </form>

          {listening && (
            <div className="scope-note">
              🎙️ Listening... Speak now, then tap Send.
            </div>
          )}

          {voiceError && (
            <div className="scope-note" role="status">
              {voiceError}
            </div>
          )}

          <div className="scope-note">
            In Scope AI can help with AirData GH questions.
          </div>
        </section>
      )}
    </>
  );
}
