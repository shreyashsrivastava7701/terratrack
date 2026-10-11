// MicButton.jsx: the big mic button with an English / Hindi switch.
// Tap once to start listening, tap again to stop. What you say appears in the text box.
// If the browser has no speech support (e.g. Firefox), the mic is hidden and typing still works.
import { useEffect, useRef, useState } from 'react';
import { createRecognizer, isSpeechSupported } from '../lib/speech.js';

export default function MicButton({ language, onLanguageChange, onText, onError }) {
  const [listening, setListening] = useState(false);
  const micRef = useRef(null); // the mic session that is running right now

  // Stop listening if the user leaves the screen
  useEffect(() => () => micRef.current?.stop(), []);

  if (!isSpeechSupported()) return null;

  function stop() {
    micRef.current?.stop();
    micRef.current = null; // forget it, so its late messages are ignored
    setListening(false); // the button turns green again straight away
  }

  function start() {
    let heardSomething = false;
    const mic = createRecognizer({
      lang: language,
      onText: (text, isFinal) => {
        if (micRef.current !== mic && !isFinal) return;
        heardSomething = true;
        onText(text, isFinal);
      },
      onEnd: () => {
        // Only the current session may change the button. An old one ending late is ignored.
        if (micRef.current === mic) {
          micRef.current = null;
          setListening(false);
        }
      },
      onError: (msg) => {
        // Ignore errors from old sessions, and "didn't hear anything" when we did hear words
        if (micRef.current !== mic || heardSomething) return;
        onError(msg);
      },
    });
    micRef.current = mic;
    try {
      mic.start();
      setListening(true);
    } catch {
      micRef.current = null;
      setListening(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={listening ? stop : start}
        aria-pressed={listening}
        aria-label={listening ? 'Stop listening' : 'Speak your activity'}
        className={`relative grid place-items-center w-20 h-20 rounded-full shrink-0 transition-colors ${
          listening ? 'bg-con-fg text-white' : 'bg-sprout text-white hover:bg-sprout-dark'
        }`}
      >
        {/* A soft pulsing ring while listening */}
        {listening && <span className="absolute inset-0 rounded-full bg-con-fg/40 animate-ping motion-reduce:hidden" />}
        <MicIcon />
      </button>

      <div className="space-y-2">
        <p className="font-medium" aria-live="polite">
          {listening ? 'Listening… tap to stop' : 'Tap and say what you did'}
        </p>
        {/* Language switch */}
        <div className="inline-flex rounded-full bg-sky-card p-1 text-sm" role="group" aria-label="Voice language">
          {[
            ['en-IN', 'English'],
            ['hi-IN', 'हिंदी'],
          ].map(([code, label]) => (
            <button
              key={code}
              type="button"
              onClick={() => onLanguageChange(code)}
              disabled={listening}
              aria-pressed={language === code}
              className={`px-3 py-1 rounded-full font-medium transition-colors ${
                language === code ? 'bg-white text-sprout shadow-sm' : 'text-ink-soft'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="relative">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
