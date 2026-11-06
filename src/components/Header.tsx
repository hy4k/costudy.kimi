import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/lib/authStore';
import { DoodleMoon, DoodleSun } from '@/components/Doodles';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { dark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Switch back to daylight' : 'Switch to the night desk'}
      className={`group flex items-center gap-2 rounded-full border-[1.5px] b-line px-4 py-2 text-xs font-bold tracking-wide t-ink transition-all duration-500 hover:border-[var(--ink)] ${className}`}
    >
      <span className="transition-transform duration-500 group-hover:-rotate-12">
        {dark ? <DoodleSun className="h-4 w-4" /> : <DoodleMoon className="h-4 w-4" />}
      </span>
      {dark ? 'Back to daylight' : 'Study after dark'}
    </button>
  );
}

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const { ready, profile } = useAuth();
  const signedIn = ready && !!profile;

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
          <span className="ml-2 hidden rounded-full bg-[#ea4467]/10 px-2.5 py-1 align-middle text-[0.55em] font-bold tracking-widest text-[#ea4467] sm:inline-block">
            CMA US
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {signedIn && profile ? (
            <>
              <Link to="/profile" className="link-underline hidden text-sm font-semibold t-muted transition-colors hover:t-ink sm:block">
                Hey, {profile.name.split(' ')[0]}
              </Link>
              <Link to={profile.role === 'TEACHER' ? '/mentor' : '/wall'} className="pill-btn !px-5 !py-2.5 text-sm">
                Open your desk
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="link-underline hidden text-sm font-semibold t-muted transition-colors hover:t-ink sm:block">
                Log in
              </Link>
              <Link to="/login?mode=signup" className="pill-btn !px-5 !py-2.5 text-sm">
                Grab your seat
                <span aria-hidden="true">→</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
