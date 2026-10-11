// ComingSoon.jsx: a friendly placeholder card for parts we build in later steps.
export default function ComingSoon({ title, step, children }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-sky-line p-5 text-ink-soft">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display font-semibold text-lg text-ink">{title}</h3>
        <span className="shrink-0 text-xs font-medium px-3 py-1 rounded-full bg-sun text-sun-dark">
          Step {step}
        </span>
      </div>
      <p className="mt-1 text-sm">{children}</p>
    </div>
  );
}
