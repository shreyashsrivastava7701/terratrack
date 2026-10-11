// Header.jsx: the app name at the top, plus the navigation links on bigger screens.
import { SCREENS } from '../navigation.js';
import { LeafIcon } from './Icons.jsx';
import { setRole } from '../lib/campus.js';
import { cloudEnabled } from '../lib/supabase.js';
import { useAuth, signOut } from '../lib/cloud.js';

export default function Header({ screen, onNavigate, role }) {
  const auth = useAuth();
  return (
    <header className="sticky top-0 z-10 bg-sky-page/90 backdrop-blur border-b border-sky-line">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        <button
          onClick={() => onNavigate('today')}
          className="flex items-center gap-2 text-sprout"
        >
          <span className="grid place-items-center w-9 h-9 rounded-full bg-sprout-light">
            <LeafIcon width={20} height={20} />
          </span>
          <span className="font-display font-bold text-2xl leading-none pt-1">TerraTrack</span>
        </button>

        <div className="flex items-center gap-2">
        {/* On laptops the links sit here; on phones they move to the bottom bar */}
        {role === 'student' && <nav className="hidden lg:flex gap-1">
          {SCREENS.map((s) => (
            <button
              key={s.id}
              onClick={() => onNavigate(s.id)}
              className={`px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                screen === s.id
                  ? 'bg-sprout text-white'
                  : 'text-ink-soft hover:bg-sky-card hover:text-ink'
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>}

        {/* Logged in: your name and Sign out. On-device mode: a Student / College switch. */}
        {cloudEnabled ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="hidden sm:inline text-ink-soft max-w-32 truncate">{auth.profile?.name}</span>
            <button onClick={signOut} className="px-3 py-1.5 rounded-full bg-sky-card font-semibold">Sign out</button>
          </div>
        ) : (
        <div className="flex rounded-full bg-sky-card p-1 text-xs font-semibold" role="group" aria-label="Dashboard">
          {[['student', 'Student'], ['college', 'College']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => { setRole(id); window.scrollTo(0, 0); }}
              aria-pressed={role === id}
              className={`px-3 py-1.5 rounded-full ${role === id ? 'bg-white text-sprout shadow-sm' : 'text-ink-soft'}`}
            >
              {label}
            </button>
          ))}
        </div>
        )}
        </div>
      </div>
    </header>
  );
}
