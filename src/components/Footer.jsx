// Footer.jsx: the honesty note shown under every screen.
export default function Footer({ showAiLine }) {
  return (
    <footer className="mt-10 pt-4 border-t border-sky-line text-xs text-ink-soft text-center space-y-1">
      <p>Approximate factors; a habit tool, not a certified carbon report.</p>
      {showAiLine && <p>AI: Gemma 4 (open weights) through Google AI Studio, with Gemini as a backup.</p>}
    </footer>
  );
}
