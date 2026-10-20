/** Ícono de regalo propio (SVG), en lugar de depender de emojis. */
export function GiftMark({ className = "h-14 w-14" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="8" y="26" width="48" height="32" rx="6" fill="var(--color-berry-600)" />
      <rect x="4" y="18" width="56" height="12" rx="4" fill="var(--color-berry-500)" />
      <rect x="28" y="18" width="8" height="40" fill="var(--color-gold-500)" />
      <path
        d="M32 18c-4-9-15-12-17-5-2 6 9 6 17 5Zm0 0c4-9 15-12 17-5 2 6-9 6-17 5Z"
        fill="none"
        stroke="var(--color-gold-500)"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="18" r="3.5" fill="var(--color-gold-700)" />
    </svg>
  );
}
