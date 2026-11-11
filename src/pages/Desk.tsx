import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import AppShell from '@/components/app/AppShell';
import {
  DoodleBook,
  DoodleBubble,
  DoodleBulb,
  DoodleClock,
  DoodleNote,
  DoodlePeople,
  DoodleSpark,
} from '@/components/Doodles';
import { useAuth } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';

type RoomRow = {
  id: string;
  name: string;
  members_count: number | null;
  active_count: number | null;
  is_live: boolean | null;
  created_at: string | null;
};

type RawMini = {
  avatar: string | null;
  bio: string | null;
  strategic_milestone: string | null;
  primary_exam: string | null;
  streak_days: number | null;
  total_mocks: number | null;
  total_essays: number | null;
  tier: string | null;
};

const journey = [
  {
    no: '1',
    to: '/wall',
    label: 'Study Wall',
    role: 'Home',
    hint: "Open the note — the campus feed, like coming home.",
    Doodle: DoodleBubble,
    bg: '#2b2926',
    ink: '#fcfbfa',
  },
  {
    no: '2',
    to: '/path',
    label: 'Mastery Path',
    role: 'Start here',
    hint: 'Your plan, progress and exam countdown.',
    Doodle: DoodleNote,
    bg: 'var(--coral)',
    ink: '#ffffff',
  },
  {
    no: '3',
    to: '/contracts',
    label: 'Study Partners',
    role: 'Contract',
    hint: 'Pair with a student on your schedule — for a fixed, safe window.',
    Doodle: DoodleClock,
    bg: '#e9c46a',
    ink: 'var(--ink)',
  },
  {
    no: '4',
    to: '/rooms',
    label: 'Study Rooms',
    role: 'Study',
    hint: 'Do the deep work, together — with your rooms.',
    Doodle: DoodlePeople,
    bg: 'var(--mint)',
    ink: 'var(--ink)',
  },
  {
    no: '5',
    to: '/ai',
    label: 'AI Deck',
    role: 'Practice',
    hint: 'Drill questions and get un-stuck, fast.',
    Doodle: DoodleBulb,
    bg: '#d9e6f3',
    ink: 'var(--ink)',
  },
  {
    no: '6',
    to: '/vault',
    label: 'Library Vault',
    role: 'Go deeper',
    hint: 'Quality-checked notes, decks and papers.',
    Doodle: DoodleBook,
    bg: '#c6b3a2',
    ink: 'var(--ink)',
  },
];

const greeting = () => {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function Desk() {
  const { profile, ready } = useAuth();
  const [raw, setRaw] = useState<RawMini | null>(null);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [roomCount, setRoomCount] = useState(0);
  const [partnerCount, setPartnerCount] = useState(0);
  const [lastMock, setLastMock] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !profile) return;
    supabase
      .from('user_profiles')
      .select('avatar, bio, strategic_milestone, primary_exam, streak_days, total_mocks, total_essays, tier')
      .eq('id', profile.id)
      .maybeSingle()
      .then(({ data }) => data && setRaw(data as RawMini));

    supabase
      .from('study_rooms')
      .select('id, name, members_count, active_count, is_live, created_at', { count: 'exact' })
      .eq('creator_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(4)
      .then(({ data, count }) => {
        setRooms((data as RoomRow[]) || []);
        setRoomCount(count ?? 0);
      });

    supabase
      .from('alignments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('status', 'ACTIVE')
      .then(({ count }) => setPartnerCount(count ?? 0));

    supabase
      .from('mock_attempts')
      .select('completed_at')
      .eq('user_id', profile.id)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setLastMock((data as { completed_at: string } | null)?.completed_at ?? null));
  }, [ready, profile]);

  if (!ready || !profile) {
    return (
      <AppShell title="Your desk" eyebrow="Start here">
        <p className="t-muted">Setting up your desk…</p>
      </AppShell>
    );
  }

  const first = profile.name.split(' ')[0];
  const checks = [
    { label: 'Photo', done: !!raw?.avatar },
    { label: 'Bio', done: !!raw?.bio },
    { label: 'Study goal', done: !!raw?.strategic_milestone },
    { label: 'Exam focus', done: !!raw?.primary_exam },
  ];
  const doneCount = checks.filter((c) => c.done).length;
  const completeness = Math.round((doneCount / checks.length) * 100);

  return (
    <AppShell title={`${greeting()}, ${first}.`} eyebrow="Your desk · start here">
      {/* where you stand */}
      <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="relative overflow-hidden rounded-[1.8rem] border-[1.5px] b-line bg-[var(--card)] p-8 md:p-10">
          <DoodleSpark className="pointer-events-none absolute -right-4 -top-4 w-28 rotate-12 text-[var(--coral)]/10" />
          <p className="eyebrow t-faint">Where you stand</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[var(--coral)]/10 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--coral)]">
              {raw?.primary_exam || profile.examFocus}
            </span>
            {raw?.tier && (
              <span className="rounded-full bg-[var(--mint)] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--ink)]">
                {raw.tier} tier
              </span>
            )}
            <span className="rounded-full border-[1.5px] b-line px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] t-muted">
              {raw?.streak_days ?? 0}-day streak
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Mocks taken', value: raw?.total_mocks ?? 0 },
              { label: 'Essays written', value: raw?.total_essays ?? 0 },
              { label: 'Rooms created', value: roomCount },
              { label: 'Study partners', value: partnerCount },
            ].map((s) => (
              <div key={s.label} className="rounded-[1.2rem] bg-[var(--line)]/40 p-4 text-center">
                <p className="slab-display text-3xl t-ink">{s.value}</p>
                <p className="eyebrow mt-1 t-faint">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold t-muted">
              <span>Profile setup</span>
              <span>{completeness}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
              <div
                className="h-full rounded-full bg-[var(--coral)] transition-all duration-700"
                style={{ width: `${completeness}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {checks.map((c) => (
                <Link
                  key={c.label}
                  to="/profile"
                  className={`rounded-full px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-widest ${
                    c.done ? 'bg-[var(--mint)] text-[#4a7a2e]' : 'bg-[var(--line)]/60 t-muted hover:text-[var(--coral)]'
                  }`}
                >
                  {c.done ? '✓ ' : '+ '}
                  {c.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* your rooms */}
        <div className="rounded-[1.8rem] border-[1.5px] b-line bg-[var(--card)] p-8 md:p-10">
          <div className="flex items-center justify-between">
            <p className="eyebrow t-faint">Your rooms</p>
            <Link to="/rooms" className="link-underline text-xs font-bold uppercase tracking-widest t-muted hover:t-ink">
              All rooms →
            </Link>
          </div>
          <p className="slab-display mt-3 text-5xl t-ink">
            {roomCount}
            <span className="ml-2 text-lg t-muted">{roomCount === 1 ? 'room created' : 'rooms created'}</span>
          </p>
          <ul className="mt-5 space-y-2.5">
            {rooms.length === 0 && (
              <li className="rounded-[1.2rem] bg-[var(--line)]/40 p-4 text-sm t-muted">
                No rooms yet — create one and invite your study circle.
              </li>
            )}
            {rooms.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-[1.2rem] border-[1.5px] b-line px-4 py-3">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${r.is_live ? 'bg-[#6f9c3e]' : 'bg-[var(--line)]'}`} />
                  <span className="truncate text-sm font-bold t-ink">{r.name}</span>
                </span>
                <span className="shrink-0 text-xs t-faint">
                  {r.active_count ?? 0}/{r.members_count ?? 0} in
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* the journey */}
      <section className="mt-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-2 text-[var(--coral)]">The CoStudy loop</p>
            <h2 className="slab-display text-3xl t-ink md:text-4xl">One page at a time.</h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed t-muted">
            Start at the top, work down, wrap up on the Wall. When you come back,
            this same order is waiting for you.
          </p>
        </div>

        <ol className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {journey.map((j) => (
            <li key={j.no}>
              <Link
                to={j.to}
                className="group flex h-full flex-col justify-between rounded-[1.6rem] p-6 transition-transform duration-500 ease-out-soft hover:-translate-y-1.5"
                style={{ backgroundColor: j.bg, color: j.ink }}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="slab-display text-4xl opacity-30">{j.no}</span>
                    <j.Doodle className="h-8 w-8 opacity-80 transition-transform duration-500 group-hover:-rotate-6" />
                  </div>
                  <p className="eyebrow mt-5 opacity-70">{j.role}</p>
                  <h3 className="slab-display mt-1 text-2xl">{j.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed opacity-75">{j.hint}</p>
                </div>
                <span className="mt-6 text-lg opacity-60 transition-transform duration-500 group-hover:translate-x-1.5">→</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* gentle nudge */}
      <section className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-[1.8rem] border-[1.5px] b-line bg-[var(--card)] p-7 md:p-9">
        <div>
          <p className="eyebrow text-[var(--coral)]">Next best step</p>
          <p className="slab-display mt-2 text-2xl t-ink md:text-3xl">
            {lastMock
              ? `Last mock ${new Date(lastMock).toLocaleDateString()} — time for the next one?`
              : 'Sit your first mock — it calibrates everything else.'}
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/path" className="pill-btn !px-6 !py-3 text-sm">
            Open Mastery Path
          </Link>
          <Link to="/rooms" className="rounded-full border-[1.5px] b-line px-6 py-3 text-sm font-bold t-muted transition-colors hover:t-ink">
            Study now
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
