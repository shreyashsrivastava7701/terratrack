// Badge.jsx: the Pro / Neutral / Con label.
// It always shows the word, so colour is never the only signal.
const STYLES = {
  pro: 'bg-pro-bg text-pro-fg',
  neutral: 'bg-neutral-bg text-neutral-fg',
  con: 'bg-con-bg text-con-fg',
};
const WORDS = { pro: 'Pro', neutral: 'Neutral', con: 'Con' };

// percent is optional, e.g. <Badge label="con" percent={220} /> shows "Con 220%"
export default function Badge({ label, percent }) {
  return (
    <span className={`inline-block whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-semibold ${STYLES[label]}`}>
      {WORDS[label]}{percent != null && ` ${percent}%`}
    </span>
  );
}
