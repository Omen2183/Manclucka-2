export function HenMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path
        d="M7 22c1.2-4.4 4.2-8 9.4-8.2 1.6-3.4 4.8-5 7.6-4.1.4 1.6-.2 3.1-1.5 4.2 2.2 1.4 3.5 3.6 3.5 6.1 0 3.6-3.2 6-7.4 6H12c-2.8 0-5-1.8-5-4z"
        fill="currentColor"
      />
      <path d="M22.2 8.2c.6-1.4 1.6-2.2 2.6-2.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="20.2" cy="13.2" r="0.9" fill="#F7F1E6" />
      <path d="M6.2 22.5c2.2.8 4.4.6 6.2-.4" stroke="#F7F1E6" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}
