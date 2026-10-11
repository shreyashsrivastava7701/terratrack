// StatusDot.jsx: a small dot showing the Gemma connection.
// Green after the last call worked; grey before the first call or after a failure.
import { useEffect, useState } from 'react';
import { getStatus, onStatusChange } from '../lib/ai.js';

export function useAiStatus() {
  const [status, setStatus] = useState(getStatus);
  useEffect(() => onStatusChange(setStatus), []);
  return status;
}

export default function StatusDot({ showText = true }) {
  const status = useAiStatus();
  const ok = status.state === 'ok';
  const backup = ok && /gemini/i.test(status.message);
  const label = ok
    ? backup ? 'Gemini backup connected' : 'Gemma connected'
    : status.state === 'failed' ? 'AI offline, keyword parser on' : 'AI not tried yet';
  return (
    <span className="inline-flex items-center gap-2 text-sm" title={status.message}>
      <span className={`w-2.5 h-2.5 rounded-full ${ok ? 'bg-ring-green' : 'bg-ink-soft/40'}`} aria-hidden="true" />
      {showText && <span className="text-ink-soft">{label}</span>}
    </span>
  );
}
