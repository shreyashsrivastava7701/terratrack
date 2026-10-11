// App.jsx: the app shell.
// It shows the header, the current screen, the footer and the navigation bar.
// We keep the current screen in the address bar (#today, #log ...) so a refresh stays on the same page.
import { useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import NavBar from './components/NavBar.jsx';
import Footer from './components/Footer.jsx';
import { SCREENS } from './navigation.js';
import College from './screens/College.jsx';
import { useCampus } from './lib/campus.js';
import ProofSync from './components/ProofSync.jsx';
import { cloudEnabled } from './lib/supabase.js';
import { useAuth, restoreSession } from './lib/cloud.js';
import Login from './screens/Login.jsx';

// Read the screen name from the address bar, e.g. "#log" -> "log"
function screenFromHash() {
  const id = window.location.hash.replace('#', '');
  return SCREENS.some((s) => s.id === id) ? id : 'today';
}

export default function App() {
  const [screen, setScreen] = useState(screenFromHash);

  // When the address bar changes (back button, link), update the screen
  useEffect(() => {
    const onHash = () => setScreen(screenFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function goTo(id) {
    window.location.hash = id;
    window.scrollTo(0, 0);
  }

  const localCampus = useCampus();
  const auth = useAuth();
  useEffect(() => { restoreSession(); }, []);

  // With Supabase: you must sign in, and your account decides Student or College
  if (cloudEnabled && auth.loading) {
    return <div className="min-h-screen grid place-items-center text-ink-soft">Loading TerraTrack…</div>;
  }
  if (cloudEnabled && !auth.user) return <Login />;
  const role = cloudEnabled ? auth.profile?.role ?? 'student' : localCampus.role;
  const Current = role === 'college' ? College : SCREENS.find((s) => s.id === screen).component;

  return (
    <div className="min-h-screen flex flex-col">
      <Header screen={screen} onNavigate={goTo} role={role} />

      {/* pb-28 leaves room for the bottom navigation bar on phones */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-4 pb-28 lg:pb-10">
        {cloudEnabled && auth.error && (
          <p className="mb-4 rounded-2xl bg-con-bg text-con-fg px-4 py-2 text-sm">{auth.error}</p>
        )}
        <Current onNavigate={goTo} />
        <Footer showAiLine={screen === 'log'} />
      </main>

      {role === 'student' && <ProofSync />}
      {role === 'student' && <NavBar screen={screen} onNavigate={goTo} />}
    </div>
  );
}
