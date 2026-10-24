import type { ReactNode } from 'react';
import { NavLink, Link } from 'react-router';
import { ThemeToggle } from '@/components/Header';
import {
  DoodleBook,
  DoodleBubble,
  DoodleBulb,
  DoodleClock,
  DoodleNote,
  DoodlePeople,
} from '@/components/Doodles';

const nav = [
  { to: '/rooms', label: 'Study Rooms', Doodle: DoodlePeople, hint: 'Live clusters' },
  { to: '/wall', label: 'Study Wall', Doodle: DoodleBubble, hint: 'The commons' },
  { to: '/vault', label: 'Library Vault', Doodle: DoodleBook, hint: 'Knowledge vault' },
  { to: '/ai', label: 'AI Deck', Doodle: DoodleBulb, hint: 'Doubt desk' },
  { to: '/path', label: 'Mastery Path', Doodle: DoodleNote, hint: 'The cockpit' },
];

export default function AppShell({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r b-line bg-paper lg:flex">
        <Link to="/" className="flex h-16 items-center gap-3 border-b b-line px-6">
          <span className="font-slab text-xl font-bold t-ink">
            Co<span className="text-[#ea4467]">Study</span>
          </span>
          <span className="eyebrow t-faint">campus</span>
        </Link>

        <nav className="flex flex-col gap-1 p-4" aria-label="App modules">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-4 py-3 transition-colors duration-300 ${
                  isActive
                    ? 'bg-[var(--card)] shadow-[inset_0_0_0_1.5px_var(--line)]'
                    : 'hover:bg-[var(--card)]'
                }`
              }
            >
              <n.Doodle className="h-6 w-6 shrink-0 t-ink opacity-80 transition-transform duration-500 group-hover:-rotate-6" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight t-ink">{n.label}</span>
                <span className="block text-xs t-faint">{n.hint}</span>
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-4 border-t b-line p-4">
          <div className="flex items-center gap-3 rounded-xl bg-[var(--card)] p-3 shadow-[inset_0_0_0_1.5px_var(--line)]">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ea4467] font-slab text-sm font-bold text-white">
              M
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold leading-tight t-ink">Midhun</span>
              <span className="block text-xs t-faint">Scholar · CMA US P1</span>
            </span>
            <ThemeToggle className="!h-8 !w-8" />
          </div>
          <Link
            to="/"
            className="link-underline flex items-center gap-2 px-1 text-xs font-semibold t-muted hover:t-ink"
          >
            ← Back to the site
          </Link>
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* mobile top bar */}
        <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b b-line bg-glass px-4 backdrop-blur-md lg:hidden">
          <Link to="/" className="font-slab text-lg font-bold t-ink">
            Co<span className="text-[#ea4467]">Study</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle className="!h-8 !w-8" />
            <nav className="flex gap-1" aria-label="App modules">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    `rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      isActive ? 'bg-[#ea4467] text-white' : 't-muted'
                    }`
                  }
                >
                  {n.label.split(' ')[0]}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>

        <main className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8 lg:pt-16">
          <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow mb-3 text-[#ea4467]">{eyebrow}</p>
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
