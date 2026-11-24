
import React, { useEffect, useRef, useState } from 'react';

export default function InScopeAI() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'model',
      text: 'Hello! I am In Scope AI. How can I help you today?'
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('');

  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);
  const voiceQuestionRef = useRef('');
  const voiceSessionRef = useRef(false);
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
      voiceSessionRef.current = false;
      recognitionRef.current?.abort();

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function getRecognition() {
    return window.SpeechRecognition ||
      window.webkitSpeechRecognition;
  }

  function speakReply(text) {
    if (!('speechSynthesis' in window) || !text) return;

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = 'en-GH';
    speech.rate = 1.05;
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

    window.speechSynthesis.speak(speech);
  }

  function startVoiceInput() {
    const SpeechRecognition = getRecognition();

    if (!SpeechRecognition) {
      setVoiceError(
        'Voice input is not supported by this browser. Please use Safari or Chrome with microphone access enabled.'
      );
      return;
    }

    if (busyRef.current || recognitionRef.current) return;

    setVoiceError('');
    setVoiceStatus('Starting microphone...');
    voiceQuestionRef.current = '';
    voiceSessionRef.current = true;

    try {
      const recognition = new SpeechRecognition();

      recognition.lang = 'en-GH';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setListening(true);
        setVoiceStatus('Listening. Speak your question now.');
      };

      recognition.onresult = event => {
        let transcript = '';

        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript + ' ';
        }

        voiceQuestionRef.current = transcript.trim();
        setMessage(voiceQuestionRef.current);
      };

      recognition.onerror = event => {
        if (event.error === 'not-allowed' ||
            event.error === 'service-not-allowed') {
          setVoiceError('Microphone permission was denied. Allow microphone access in your browser settings.');
        } else if (event.error === 'no-speech') {
          setVoiceStatus('I did not hear anything. Tap the microphone and try again.');
        } else if (event.error !== 'aborted') {
          setVoiceError('Voice recognition stopped. Please try again.');
        }
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        setListening(false);

        const question = voiceQuestionRef.current.trim();
        const shouldSend = voiceSessionRef.current;

        voiceSessionRef.current = false;

        if (question && shouldSend) {
          voiceQuestionRef.current = '';
          setMessage('');
          setVoiceStatus('Processing your voice question...');
          submitQuestion(question, true);
        } else if (shouldSend) {
          setVoiceStatus('No question detected. Tap the microphone to try again.');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      recognitionRef.current = null;
      voiceSessionRef.current = false;
      setListening(false);
      setVoiceError('Could not start the microphone. Please try again.');
    }
  }

  function stopVoiceInput() {
    if (!recognitionRef.current) return;

    setVoiceStatus('Finishing your voice question...');
    recognitionRef.current.stop();
  }

  async function submitQuestion(question, shouldSpeak) {
    if (!question || busyRef.current) return;

    busyRef.current = true;
    setLoading(true);
    setVoiceError('');
    setVoiceStatus(shouldSpeak ? 'Preparing your spoken answer...' : '');

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

      if (contentType.includes('application/json')) {
        const result = await response.json();
        reply = result.reply || 'Sorry, I could not generate a response.';
      } else {
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
            } catch (error) {}
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
              if (data.text) reply += data.text;
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
      setVoiceStatus('');

      if (shouldSpeak) {
        speakReply(reply);
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
      setVoiceStatus('');

      if (shouldSpeak) {
        speakReply(errorReply);
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

    voiceSessionRef.current = false;
    recognitionRef.current?.abort();
    recognitionRef.current = null;

    setListening(false);
    setVoiceStatus('');

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  function handleMicrophone() {
    if (listening) {
      stopVoiceInput();
    } else {
      startVoiceInput();
    }
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
      </div>

      {open && (
        <section className="scope-chat">
          <div className="scope-header">
            <div>
              <strong>In Scope AI</strong>
              <small>AirData GH Customer Assistant</small>
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
              disabled={loading || listening}
            />

            <button
              type="button"
              onClick={handleMicrophone}
              disabled={loading}
              title={listening ? 'Stop recording' : 'Speak your question'}
            >
              {listening ? '⏹️' : '🎙️'}
            </button>

            <button
              type="submit"
              disabled={loading || listening || !message.trim()}
            >
              Send
            </button>
          </form>

          {listening && (
            <div className="scope-note">
              🎙️ Listening to your question. Tap stop when you finish.
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
        </section>
      )}
    </>
  );
}
