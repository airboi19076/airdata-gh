
import React, { useEffect, useRef, useState } from 'react';

export default function InScopeAI() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'model',
      text: 'Hello! I am In Scope AI. Say Hey In Scope whenever you need me.'
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [armed, setArmed] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('');

  const bottomRef = useRef(null);
  const wakeRef = useRef(null);
  const commandRef = useRef(null);
  const armedRef = useRef(false);
  const wakeTriggeredRef = useRef(false);
  const commandTextRef = useRef('');
  const busyRef = useRef(false);
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages, loading]);

  useEffect(() => {
    return () => {
      armedRef.current = false;
      wakeRef.current?.stop();
      commandRef.current?.stop();

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function getRecognition() {
    return window.SpeechRecognition ||
      window.webkitSpeechRecognition;
  }

  function isWakePhrase(text) {
    const normalized = text
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return (
      normalized.includes('hey in scope') ||
      normalized.includes('hi in scope') ||
      normalized.includes('hello in scope')
    );
  }

  function speakReply(text) {
    if (!('speechSynthesis' in window) || !text) {
      if (armedRef.current) {
        setTimeout(startWakeRecognition, 400);
      }
      return;
    }

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = 'en-GH';
    speech.rate = 1.08;
    speech.pitch = 1;
    speech.volume = 1;

    const voices = window.speechSynthesis.getVoices();

    const preferredVoice =
      voices.find(v => v.lang.toLowerCase() === 'en-gh') ||
      voices.find(v => v.lang.toLowerCase() === 'en-us') ||
      voices.find(v => v.lang.toLowerCase().startsWith('en'));

    if (preferredVoice) {
      speech.voice = preferredVoice;
    }

    speech.onend = () => {
      if (armedRef.current) {
        setVoiceStatus('Say Hey In Scope when you need me.');
        setTimeout(startWakeRecognition, 400);
      }
    };

    speech.onerror = () => {
      if (armedRef.current) {
        setTimeout(startWakeRecognition, 400);
      }
    };

    window.speechSynthesis.speak(speech);
  }

  function startWakeRecognition() {
    const SpeechRecognition = getRecognition();

    if (
      !SpeechRecognition ||
      !armedRef.current ||
      busyRef.current ||
      wakeRef.current ||
      commandRef.current
    ) {
      return;
    }

    try {
      const recognition = new SpeechRecognition();

      recognition.lang = 'en-GH';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setListening(false);
        setVoiceError('');
        setVoiceStatus('Listening for Hey In Scope...');
      };

      recognition.onresult = event => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;

          if (isWakePhrase(transcript)) {
            wakeTriggeredRef.current = true;
            setOpen(true);
            setVoiceStatus('Hello! I am listening to you.');
            recognition.stop();
            break;
          }
        }
      };

      recognition.onerror = event => {
        if (event.error === 'not-allowed') {
          setVoiceError('Please allow microphone access.');
          deactivateHeyInScope();
        } else if (
          event.error !== 'no-speech' &&
          event.error !== 'aborted'
        ) {
          setVoiceError('Wake-word listening stopped. Please activate it again.');
          deactivateHeyInScope();
        }
      };

      recognition.onend = () => {
        wakeRef.current = null;

        if (!armedRef.current) return;

        if (wakeTriggeredRef.current) {
          wakeTriggeredRef.current = false;
          setOpen(true);
          setTimeout(startCommandRecognition, 300);
          return;
        }

        if (!busyRef.current) {
          setTimeout(startWakeRecognition, 400);
        }
      };

      wakeRef.current = recognition;
      recognition.start();
    } catch (error) {
      wakeRef.current = null;
      setVoiceError('Could not start listening. Please try again.');
      deactivateHeyInScope();
    }
  }

  function startCommandRecognition() {
    const SpeechRecognition = getRecognition();

    if (
      !SpeechRecognition ||
      !armedRef.current ||
      busyRef.current ||
      commandRef.current
    ) {
      return;
    }

    try {
      const recognition = new SpeechRecognition();

      recognition.lang = 'en-GH';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      commandTextRef.current = '';

      recognition.onstart = () => {
        setListening(true);
        setVoiceStatus('🎙️ Listening. Ask your question.');
        setVoiceError('');
      };

      recognition.onresult = event => {
        let transcript = '';

        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript + ' ';
        }

        commandTextRef.current = transcript.trim();
        setMessage(commandTextRef.current);
      };

      recognition.onerror = event => {
        setListening(false);

        if (event.error === 'not-allowed') {
          setVoiceError('Please allow microphone access.');
          deactivateHeyInScope();
        } else if (event.error === 'no-speech') {
          setVoiceStatus('I did not hear anything. Say Hey In Scope again.');
        } else if (event.error !== 'aborted') {
          setVoiceError('I could not hear that. Please try again.');
        }
      };

      recognition.onend = () => {
        commandRef.current = null;
        setListening(false);

        const question = commandTextRef.current.trim();

        if (question && armedRef.current) {
          setMessage('');
          submitQuestion(question, true);
        } else if (armedRef.current && !busyRef.current) {
          setVoiceStatus('Say Hey In Scope when you are ready.');
          setTimeout(startWakeRecognition, 400);
        }
      };

      commandRef.current = recognition;
      recognition.start();
    } catch (error) {
      commandRef.current = null;
      setListening(false);
      setVoiceError('Could not start the microphone. Please try again.');
    }
  }

  function activateHeyInScope() {
    const SpeechRecognition = getRecognition();

    if (!SpeechRecognition) {
      setVoiceError('Your browser does not support wake-word recognition.');
      return;
    }

    setVoiceError('');
    armedRef.current = true;
    setArmed(true);
    wakeTriggeredRef.current = false;

    startWakeRecognition();
  }

  function deactivateHeyInScope() {
    armedRef.current = false;
    setArmed(false);
    wakeTriggeredRef.current = false;

    wakeRef.current?.stop();
    commandRef.current?.stop();

    wakeRef.current = null;
    commandRef.current = null;

    setListening(false);
    setVoiceStatus('Hey In Scope is turned off.');

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  async function submitQuestion(question, shouldSpeak) {
    if (!question || busyRef.current) return;

    busyRef.current = true;
    setLoading(true);
    setVoiceError('');

    const updatedMessages = [
      ...messagesRef.current,
      { role: 'user', text: question }
    ];

    const initialMessages = [
      ...updatedMessages,
      { role: 'model', text: '' }
    ];

    messagesRef.current = initialMessages;
    setMessages(initialMessages);

    let reply = '';

    try {
      const response = await fetch('/api/in-scope-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: updatedMessages.slice(-6)
        })
      });

      if (!response.ok) {
        let errorMessage = 'Please try again.';

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (error) {}

        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type') || '';

      // Instant response path for greetings and simple answers.
      if (contentType.includes('application/json')) {
        const result = await response.json();
        reply = result.reply || 'Sorry, I could not generate a response.';
      } else {
        // Stream the AI response as soon as text arrives.
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finished = false;

        while (!finished) {
          const { value, done } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() || '';

          for (const eventText of events) {
            const dataLine = eventText
              .split(/\r?\n/)
              .find(line => line.startsWith('data:'));

            if (!dataLine) continue;

            const rawData = dataLine.slice(5).trim();

            if (rawData === '[DONE]') {
              finished = true;
              break;
            }

            try {
              const data = JSON.parse(rawData);

              if (data.text) {
                reply += data.text;

                const liveMessages = [
                  ...updatedMessages,
                  { role: 'model', text: reply }
                ];

                messagesRef.current = liveMessages;
                setMessages(liveMessages);
              }
            } catch (error) {
              // Ignore incomplete stream fragments.
            }
          }
        }

        buffer += decoder.decode();

        if (buffer.trim()) {
          const dataLine = buffer
            .split(/\r?\n/)
            .find(line => line.startsWith('data:'));

          if (dataLine) {
            try {
              const data = JSON.parse(dataLine.slice(5).trim());

              if (data.text) {
                reply += data.text;
              }
            } catch (error) {}
          }
        }
      }

      if (!reply.trim()) {
        reply = 'Sorry, I could not generate a response. Please try again.';
      }

      const finalMessages = [
        ...updatedMessages,
        { role: 'model', text: reply }
      ];

      messagesRef.current = finalMessages;
      setMessages(finalMessages);

      busyRef.current = false;
      setLoading(false);

      if (shouldSpeak) {
        speakReply(reply);
      } else if (armedRef.current) {
        setTimeout(startWakeRecognition, 400);
      }
    } catch (error) {
      const errorReply = error.message || 'Sorry, something went wrong.';

      const errorMessages = [
        ...updatedMessages,
        { role: 'model', text: errorReply }
      ];

      messagesRef.current = errorMessages;
      setMessages(errorMessages);

      busyRef.current = false;
      setLoading(false);

      if (shouldSpeak) {
        speakReply(errorReply);
      } else if (armedRef.current) {
        setTimeout(startWakeRecognition, 400);
      }
    }
  }

  function sendMessage(event) {
    event.preventDefault();

    const question = message.trim();

    if (!question || busyRef.current) return;

    setMessage('');
    submitQuestion(question, false);
  }

  function closeChat() {
    setOpen(false);

    commandRef.current?.stop();
    setListening(false);

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    if (armedRef.current) {
      setTimeout(startWakeRecognition, 400);
    }
  }

  function manualVoiceInput() {
    if (!armedRef.current) {
      activateHeyInScope();
      return;
    }

    wakeRef.current?.stop();
    wakeRef.current = null;

    setOpen(true);
    setTimeout(startCommandRecognition, 300);
  }

  return (
    <>
      <div className="scope-launcher">
        <button
          type="button"
          onClick={() => setOpen(!open)}
        >
          {open ? '✕ Close' : '💬 Ask In Scope AI'}
        </button>

        <button
          type="button"
          onClick={armed ? deactivateHeyInScope : activateHeyInScope}
          style={{
            marginLeft: '8px',
            background: armed ? '#dc2626' : '#0879e8',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            padding: '10px 14px',
            cursor: 'pointer'
          }}
        >
          {armed ? '🔴 Turn Wake Word Off' : '🎙️ Activate Hey In Scope'}
        </button>
      </div>

      {open && (
        <section className="scope-chat">
          <div className="scope-header">
            <div>
              <strong>In Scope AI</strong>
              <small>AirData GH Voice Assistant</small>
            </div>

            <button type="button" onClick={closeChat}>
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
                {item.text || (
                  <span className="scope-fast-dots">
                    In Scope AI is thinking...
                  </span>
                )}
              </div>
            ))}

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

            <button
              type="button"
              onClick={manualVoiceInput}
              disabled={loading}
              title="Speak your question"
            >
              🎙️
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
              🎙️ Listening to your question...
            </div>
          )}

          {voiceStatus && (
            <div className="scope-note">
              {voiceStatus}
            </div>
          )}

          {voiceError && (
            <div className="scope-note" role="status">
              {voiceError}
            </div>
          )}

          <div className="scope-note">
            Say Hey In Scope, Hi In Scope or Hello In Scope to activate your assistant.
          </div>
        </section>
      )}
    </>
  );
}
