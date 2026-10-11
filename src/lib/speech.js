// speech.js: a small wrapper around the browser's built-in speech recognition.
// It works in Chrome and Edge, on localhost or HTTPS. Audio goes to the browser maker's
// speech service; typing never does.
//
// const mic = createRecognizer({ lang: 'hi-IN', onText, onEnd, onError });
// mic.start();  ...  mic.stop();

// The browser's speech class (Chrome calls it webkitSpeechRecognition)
function getSpeechClass() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isSpeechSupported() {
  return getSpeechClass() !== null;
}

// Friendly messages for the errors people actually hit
const ERROR_TEXT = {
  'not-allowed': 'Microphone is blocked. Click the icon in the address bar and allow the microphone.',
  'service-not-allowed': 'Microphone is blocked. Click the icon in the address bar and allow the microphone.',
  'no-speech': "We didn't hear anything. Tap the mic and try again.",
  'audio-capture': 'No microphone was found on this device.',
  network: 'Voice needs an internet connection. You can still type.',
};

export function createRecognizer({ lang = 'en-IN', onText, onEnd, onError }) {
  const SpeechClass = getSpeechClass();
  if (!SpeechClass) return null;

  const rec = new SpeechClass();
  rec.lang = lang; // 'en-IN' for English, 'hi-IN' for Hindi
  rec.interimResults = true; // show words while the person is still speaking
  rec.continuous = false; // stop after one sentence
  rec.maxAlternatives = 1;

  rec.onresult = (event) => {
    // Join every piece heard so far into one sentence
    let text = '';
    for (let i = 0; i < event.results.length; i++) {
      text += event.results[i][0].transcript;
    }
    const isFinal = event.results[event.results.length - 1].isFinal;
    onText?.(text.trim(), isFinal);
  };

  rec.onerror = (event) => {
    if (event.error === 'aborted') return; // we stopped it ourselves
    onError?.(ERROR_TEXT[event.error] ?? `Voice error: ${event.error}. You can still type.`);
  };

  let running = false;
  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    running = false;
    onEnd?.();
  };
  rec.onend = finish;

  return {
    start: () => {
      rec.start();
      running = true;
      // Safety net: never listen for more than 15 seconds
      setTimeout(() => running && !ended && stopNow(), 15000);
    },
    // Stop right away. stop() keeps what was heard; if the browser is slow to end,
    // abort() forces it after half a second.
    stop: () => stopNow(),
  };

  function stopNow() {
    try {
      rec.stop();
    } catch {
      // already stopped
    }
    setTimeout(() => {
      if (!ended) {
        try {
          rec.abort();
        } catch {
          // already stopped
        }
        finish();
      }
    }, 500);
  }
}
