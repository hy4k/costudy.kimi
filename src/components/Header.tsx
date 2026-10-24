import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useTheme } from '@/hooks/useTheme';
import { DoodleMoon, DoodleSun } from '@/components/Doodles';

const links = [
  { label: 'Rooms', to: '/rooms' },
  { label: 'Wall', to: '/wall' },
  { label: 'AI Deck', to: '/ai' },
];

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { dark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Switch to day mode' : 'Switch to night desk'}
      title={dark ? 'Day mode' : 'Night desk'}
      className={`relative flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] b-line text-[var(--ink)] transition-all duration-500 hover:-rotate-12 hover:border-[var(--ink)] ${className}`}
    >
      <span
        className="absolute inset-0 flex items-center justify-center transition-all duration-500"
        style={{
          opacity: dark ? 0 : 1,
          transform: dark ? 'rotate(90deg) scale(0.4)' : 'none',
        }}
      >
        <DoodleSun className="h-5 w-5" />
      </span>
      <span
        className="absolute inset-0 flex items-center justify-center transition-all duration-500"
        style={{
          opacity: dark ? 1 : 0,
          transform: dark ? 'none' : 'rotate(-90deg) scale(0.4)',
        }}
      >
        <DoodleMoon className="h-5 w-5" />
      </span>
    </button>
  );
}

export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-glass backdrop-blur-md border-b b-line'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="font-slab text-xl font-bold tracking-tight t-ink">
          Co<span className="text-[#ea4467]">Study</span>
          <span className="ml-0.5 align-super text-[0.6em] font-medium t-muted">.in</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {links.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              className="link-underline text-sm font-medium t-muted transition-colors hover:t-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link to="/rooms" className="pill-btn !px-5 !py-2.5 text-sm">
            Claim your desk
          </Link>
        </div>
      </div>
    </header>
  );
}
