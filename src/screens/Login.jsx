// Login.jsx: sign in or create an account (email + password, through Supabase).
// Students can join their college with a code now or later; a college account creates its college.
import { useState } from 'react';
import { signIn, signUp } from '../lib/cloud.js';
import { LeafIcon } from '../components/Icons.jsx';

export default function Login() {
  const [mode, setMode] = useState('signin'); // "signin" or "signup"
  const [role, setRole] = useState('student');
  const [form, setForm] = useState({ email: '', password: '', name: '', collegeName: '', code: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const change = (k) => (ev) => setForm({ ...form, [k]: k === 'code' ? ev.target.value.toUpperCase() : ev.target.value });

  async function submit(ev) {
    ev.preventDefault();
    setError(null);
    if (mode === 'signup' && form.password.length < 6) return setError('Use at least 6 characters for the password.');
    setBusy(true);
    try {
      if (mode === 'signin') await signIn(form);
      else await signUp({ ...form, role });
    } catch (err) {
      setError(friendly(err.message));
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <span className="inline-grid place-items-center w-14 h-14 rounded-full bg-sprout-light text-sprout">
            <LeafIcon width={30} height={30} />
          </span>
          <h1 className="font-display font-bold text-4xl text-sprout">TerraTrack</h1>
          <p className="text-ink-soft">Your carbon bank account.</p>
        </div>

        <div className="grid grid-cols-2 rounded-full bg-sky-card p-1 text-sm font-semibold">
          {[['signin', 'Sign in'], ['signup', 'Create account']].map(([id, label]) => (
            <button key={id} onClick={() => { setMode(id); setError(null); }} className={`py-2 rounded-full ${mode === id ? 'bg-white text-sprout shadow-sm' : 'text-ink-soft'}`}>
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="rounded-3xl bg-white border border-sky-line p-5 space-y-3">
          {mode === 'signup' && (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm font-semibold">
                {[['student', "I'm a student"], ['college', "I'm a college"]].map(([id, label]) => (
                  <button type="button" key={id} onClick={() => setRole(id)} className={`py-2.5 rounded-2xl border-2 ${role === id ? 'border-sprout bg-sprout-light text-sprout-dark' : 'border-sky-line'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <input value={form.name} onChange={change('name')} required maxLength={40} placeholder={role === 'college' ? 'Your name (admin)' : 'Your name'} className="field w-full" />
              {role === 'college' ? (
                <input value={form.collegeName} onChange={change('collegeName')} required minLength={2} placeholder="College name" className="field w-full" />
              ) : (
                <input value={form.code} onChange={change('code')} maxLength={6} placeholder="College code (optional, 6 letters)" className="field w-full tracking-widest" />
              )}
            </>
          )}
          <input type="email" value={form.email} onChange={change('email')} required autoComplete="email" placeholder="Email" className="field w-full" />
          <input type="password" value={form.password} onChange={change('password')} required autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="Password" className="field w-full" />
          {error && <p className="text-sm text-con-fg">{error}</p>}
          <button disabled={busy} className="w-full py-3 rounded-full bg-sprout text-white font-semibold hover:bg-sprout-dark disabled:opacity-50">
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <p className="text-xs text-ink-soft text-center">Your entries are private. Your college only sees daily totals for the leaderboard.</p>
      </div>
    </div>
  );
}

function friendly(message) {
  if (/invalid login/i.test(message)) return 'Wrong email or password.';
  if (/already registered/i.test(message)) return 'That email already has an account. Sign in instead.';
  if (/fetch/i.test(message)) return "Can't reach the database. Check the internet and the Supabase lines in .env.";
  return message;
}
