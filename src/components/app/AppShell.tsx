import type { ReactNode } from 'react';
import { NavLink, Link } from 'react-router';
import { useAuth } from '@/lib/authStore';
import { useTheme } from '@/hooks/useTheme';
import {
  DoodleBook,
  DoodleBubble,
  DoodleBulb,
  DoodleClock,
  DoodleCoffee,
  DoodleMoon,
  DoodleNote,
  DoodlePeople,
  DoodleSpark,
  DoodleSun,
} from '@/components/Doodles';

type NavItem = {
  to: string;
  label: string;
  short: string;
  step: string;
  Doodle: typeof DoodleBubble;
  hint: string;
};

const studentNav: NavItem[] = [
  { to: '/wall', label: 'Study Wall', short: 'Wall', step: '1', Doodle: DoodleBubble, hint: 'Home · the note' },
  { to: '/path', label: 'Mastery Path', short: 'Path', step: '2', Doodle: DoodleNote, hint: 'Start · your plan' },
  { to: '/contracts', label: 'Study Partners', short: 'Partners', step: '3', Doodle: DoodleClock, hint: 'Contract · find your pair' },
  { to: '/rooms', label: 'Study Rooms', short: 'Rooms', step: '4', Doodle: DoodlePeople, hint: 'Study · focus together' },
  { to: '/ai', label: 'AI Deck', short: 'AI', step: '5', Doodle: DoodleBulb, hint: 'Practice · un-stuck fast' },
  { to: '/vault', label: 'Library Vault', short: 'Vault', step: '6', Doodle: DoodleBook, hint: 'Go deeper · materials' },
  { to: '/mentors', label: 'Mentors', short: 'Mentors', step: '7', Doodle: DoodleCoffee, hint: 'Hire · learn from faculty' },
];

const mentorNav: NavItem[] = [
  { to: '/mentor', label: 'Command Center', short: 'Cockpit', step: '★', Doodle: DoodleSpark, hint: 'Requests · bounties · revenue' },
  { to: '/wall', label: 'Faculty Lounge', short: 'Lounge', step: '1', Doodle: DoodleBubble, hint: 'Discuss · the faculty wall' },
  { to: '/ai', label: 'Teaching Deck', short: 'Deck', step: '2', Doodle: DoodleBulb, hint: 'Drills · CBQ review' },
  { to: '/mentors', label: 'Mentor Desk', short: 'Desk', step: '3', Doodle: DoodleCoffee, hint: 'Your card · the marketplace' },
  { to: '/vault', label: 'Library Vault', short: 'Vault', step: '4', Doodle: DoodleBook, hint: 'Review · student uploads' },
];

const Pill = ({ n, isActive }: { n: NavItem; isActive: boolean }) => (
  <>
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
        isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-[#f3ede3]/70 group-hover:text-white'
      }`}
    >
      <n.Doodle className="h-4 w-4" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-2">
        <span className="block truncate text-sm font-bold leading-tight">{n.label}</span>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[0.55rem] font-black tracking-wider ${
            isActive ? 'bg-white/25 text-white' : 'bg-white/10 text-[#f3ede3]/50'
          }`}
        >
          {n.step}
        </span>
      </span>
      <span className="block truncate text-[0.68rem] text-[#f3ede3]/45">{n.hint}</span>
    </span>
  </>
);

export default function AppShell({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  const { profile } = useAuth();
  const { dark, toggle } = useTheme();
  const isTeacher = profile?.role === 'TEACHER';
  const items = isTeacher ? mentorNav : studentNav;
  const initials = profile
    ? profile.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div className="app-skin min-h-screen bg-paper">
      {/* ---- workspace rail ---- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-[#1a1510] text-[#f3ede3] dark:bg-[#0a0e17] lg:flex">
        <Link to={isTeacher ? '/mentor' : '/wall'} className="flex h-16 items-center gap-3 border-b border-white/10 px-6">
          <span className="font-slab text-xl font-bold tracking-tight">
            Co<span className="text-[#ff4d4d]">Study</span>
          </span>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[0.55rem] font-black tracking-[0.18em] text-[#f3ede3]/70">
            {isTeacher ? 'FACULTY' : 'CAMPUS'}
          </span>
        </Link>

        <nav className="flex flex-col gap-1.5 p-4" aria-label="App modules">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-full px-3.5 py-2.5 transition-all duration-300 ${
                  isActive
                    ? 'bg-[#e01e1e] text-white shadow-lg shadow-red-950/40'
                    : 'hover:bg-white/10'
                }`
              }
            >
              {({ isActive }) => <Pill n={n} isActive={isActive} />}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-3 border-t border-white/10 p-4">
          {profile ? (
            <Link
              to="/profile"
              className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 transition-colors hover:bg-white/10"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e01e1e] font-slab text-sm font-bold text-white">
                {initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold leading-tight">{profile.name}</span>
                <span className="block text-xs text-[#f3ede3]/50">
                  {isTeacher ? 'Faculty' : profile.level} · {profile.examFocus}
                </span>
              </span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="flex items-center justify-center gap-2 rounded-full bg-[#e01e1e] px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Log in
            </Link>
          )}
          <button
            onClick={toggle}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-xs font-bold text-[#f3ede3]/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            {dark ? <DoodleSun className="h-4 w-4" /> : <DoodleMoon className="h-4 w-4" />}
            {dark ? 'Study in daylight' : 'Study after dark'}
          </button>
          <Link
            to="/"
            className="flex items-center gap-2 px-2 text-xs font-semibold text-[#f3ede3]/50 transition-colors hover:text-white"
          >
            ← Back to the site
          </Link>
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* mobile top bar */}
        <div className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 overflow-x-auto border-b b-line bg-glass px-4 backdrop-blur-md lg:hidden">
          <Link to={isTeacher ? '/mentor' : '/wall'} className="shrink-0 font-slab text-lg font-bold t-ink">
            Co<span className="text-[#e01e1e]">Study</span>
          </Link>
          <nav className="flex gap-1.5" aria-label="App modules">
            {items.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                    isActive ? 'bg-[#e01e1e] text-white' : 't-muted'
                  }`
                }
              >
                {n.short}
              </NavLink>
            ))}
          </nav>
        </div>

        <main className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8 lg:pt-16">
          <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow mb-3 text-[#e01e1e]">{eyebrow}</p>
              <h1 className="slab-display text-4xl t-ink md:text-5xl">{title}</h1>
            </div>
            <div className="hidden items-center gap-2 rounded-full border-[1.5px] b-line px-4 py-2 text-xs font-semibold t-muted md:flex">
              <DoodleClock className="h-4 w-4" />
              CMA US · Part 1 & Part 2
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
