/**
 * Hand-drawn study doodles — single-weight ink strokes with round caps,
 * deliberately imperfect paths so they feel sketched, not icon-set.
 */
type DoodleProps = {
  className?: string;
  accent?: string;
};

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function DoodleBook({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} {...base} aria-hidden="true">
      <path d="M50 22c-9-6-22-7-33-4v55c11-3 24-2 33 4 9-6 22-7 33-4V18c-11-3-24-2-33 4z" />
      <path d="M50 22v55" />
      <path d="M25 32c7-1.6 15-1 21 2M25 44c7-1.6 15-1 21 2M25 56c7-1.6 15-1 21 2" strokeWidth="2.4" />
      <path d="M54 34c6-3 14-3.6 21-2M54 46c6-3 14-3.6 21-2M54 58c6-3 14-3.6 21-2" strokeWidth="2.4" />
    </svg>
  );
}

export function DoodleHeadphones({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} {...base} aria-hidden="true">
      <path d="M18 62c-2-27 12-44 32-44s34 17 32 44" />
      <rect x="14" y="58" width="14" height="24" rx="7" />
      <rect x="72" y="58" width="14" height="24" rx="7" />
    </svg>
  );
}

export function DoodleBubble({ className, accent = 'currentColor' }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} {...base} aria-hidden="true">
      <path d="M18 20h64c4.4 0 8 3.4 8 7.6v29.8c0 4.2-3.6 7.6-8 7.6H48l-16 14v-14h-14c-4.4 0-8-3.4-8-7.6V27.6c0-4.2 3.6-7.6 8-7.6z" />
      <path d="M30 38h40M30 50h26" stroke={accent} strokeWidth="3" />
    </svg>
  );
}

export function DoodleBulb({ className, accent = 'currentColor' }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} {...base} aria-hidden="true">
      <path d="M50 14c-16 0-27 12-27 26 0 10 5 17 11 22 3.4 2.8 5 6 5 10h22c0-4 1.6-7.2 5-10 6-5 11-12 11-22 0-14-11-26-27-26z" />
      <path d="M41 80h18M44 88h12" strokeWidth="3" />
      <path d="M42 40c1-5 5-8 9-8" stroke={accent} />
    </svg>
  );
}

export function DoodlePencil({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} {...base} aria-hidden="true">
      <path d="M64 14l22 22-44 44-24 6 6-24z" />
      <path d="M56 22l22 22" />
      <path d="M24 78l8 8" strokeWidth="2.6" />
    </svg>
  );
}

export function DoodleCoffee({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} {...base} aria-hidden="true">
      <path d="M22 38h48v18c0 13-10 22-24 22s-24-9-24-22z" />
      <path d="M70 42h6c5 0 9 4 9 9s-4 9-9 9h-7" />
      <path d="M36 26c-2-3 2-5 0-8M50 26c-2-3 2-5 0-8" strokeWidth="2.8" />
    </svg>
  );
}

export function DoodleNote({ className, accent = 'currentColor' }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} {...base} aria-hidden="true">
      <path d="M22 18h50l10 12v50c0 2.2-1.8 4-4 4H26c-2.2 0-4-1.8-4-4V22c0-2.2 1.8-4 4-4z" />
      <path d="M72 18v12h12" />
      <path d="M36 46l10 10 18-18" stroke={accent} strokeWidth="3.6" />
    </svg>
  );
}

export function DoodleClock({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} {...base} aria-hidden="true">
      <circle cx="50" cy="54" r="34" />
      <path d="M50 32v22l15 9" />
      <path d="M40 12h20" />
    </svg>
  );
}

export function DoodlePeople({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} {...base} aria-hidden="true">
      <circle cx="35" cy="34" r="12" />
      <path d="M14 84c1-17 9-26 21-26s20 9 21 26" />
      <circle cx="70" cy="40" r="9" />
      <path d="M62 60c10-3 22 3 24 22" />
    </svg>
  );
}

export function DoodleSpark({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} {...base} aria-hidden="true">
      <path d="M50 12c3 20 12 30 36 38-24 8-33 18-36 38-3-20-12-30-36-38 24-8 33-18 36-38z" />
    </svg>
  );
}

export function DoodlePaperPlane({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} {...base} aria-hidden="true">
      <path d="M12 50L88 18 62 84 48 58z" />
      <path d="M48 58L88 18" />
    </svg>
  );
}

export function DoodleSun({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} {...base} aria-hidden="true">
      <circle cx="50" cy="50" r="18" />
      <path d="M50 14v10M50 76v10M14 50h10M76 50h10M25 25l7 7M68 68l7 7M75 25l-7 7M32 68l-7 7" />
    </svg>
  );
}

export function DoodleMoon({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 100 100" className={className} {...base} aria-hidden="true">
      <path d="M70 16a38 38 0 1 0 14 46 30 30 0 0 1-14-46z" />
      <path d="M74 30l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" strokeWidth="2.6" />
    </svg>
  );
}
