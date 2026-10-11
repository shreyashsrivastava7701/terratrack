// NavBar.jsx: the bottom navigation bar on phones (hidden on laptops).
import { SCREENS } from '../navigation.js';
import { SCREEN_ICONS } from './Icons.jsx';

export default function NavBar({ screen, onNavigate }) {
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-10 bg-white border-t border-sky-line"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-6">
        {SCREENS.map((s) => {
          const Icon = SCREEN_ICONS[s.id];
          const active = screen === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onNavigate(s.id)}
              className={`flex flex-col items-center gap-1 py-3 text-[11px] font-medium ${
                active ? 'text-sprout' : 'text-ink-soft'
              }`}
            >
              <span className={`px-3 py-1 rounded-full ${active ? 'bg-sprout-light' : ''}`}>
                <Icon width={22} height={22} />
              </span>
              {s.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
