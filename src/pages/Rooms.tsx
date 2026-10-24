import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/app/AppShell';
import { DoodleHeadphones } from '@/components/Doodles';

type Room = {
  id: number;
  name: string;
  topic: string;
  part: 1 | 2;
  scholars: number;
  desks: number;
  role: 'SCHOLAR' | 'MODERATOR' | 'FACULTY';
  tone: string;
  ink: string;
};

const rooms: Room[] = [
  { id: 1, name: 'Ethics & Governance — morning grind', topic: 'Part 1 · Ethics', part: 1, scholars: 6, desks: 8, role: 'MODERATOR', tone: '#ea4467', ink: '#ffffff' },
  { id: 2, name: 'Variance Analysis deep dive', topic: 'Part 1 · Performance Mgmt', part: 1, scholars: 7, desks: 8, role: 'SCHOLAR', tone: '#c6b3a2', ink: '#21221f' },
  { id: 3, name: 'Internal Controls flash sprint', topic: 'Part 1 · Controls', part: 1, scholars: 3, desks: 8, role: 'SCHOLAR', tone: '#e7fec7', ink: '#21221f' },
  { id: 4, name: 'Corporate Finance quiet room', topic: 'Part 2 · Corp Finance', part: 2, scholars: 5, desks: 8, role: 'FACULTY', tone: '#d9e6f3', ink: '#21221f' },
  { id: 5, name: 'Decision Analysis whiteboard club', topic: 'Part 2 · Decision Analysis', part: 2, scholars: 4, desks: 8, role: 'SCHOLAR', tone: '#f3f1ee', ink: '#21221f' },
  { id: 6, name: 'Final-review war room (P1+P2)', topic: 'Mixed · Mock season', part: 1, scholars: 7, desks: 10, role: 'MODERATOR', tone: '#2b2926', ink: '#fcfbfa' },
];

const SPRINT_SECONDS = 25 * 60;

export default function Rooms() {
  const [query, setQuery] = useState('');
  const [part, setPart] = useState<0 | 1 | 2>(0);
  const [joined, setJoined] = useState<Set<number>>(new Set([2]));
  const [seconds, setSeconds] = useState(SPRINT_SECONDS);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>(['Sprint room joined — cameras optional.']);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setRunning(false);
          setLog((l) => [`Sprint complete — 25 min banked.`, ...l].slice(0, 4));
          return SPRINT_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  const filtered = useMemo(
    () =>
      rooms.filter(
        (r) =>
          (part === 0 || r.part === part) &&
          (r.name + r.topic).toLowerCase().includes(query.toLowerCase()),
      ),
    [query, part],
  );

  const toggleJoin = (id: number) => {
    setJoined((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setLog((l) => [`Left “${rooms.find((r) => r.id === id)?.name}”.`, ...l].slice(0, 4));
      } else {
        next.add(id);
        setLog((l) => [`Joined “${rooms.find((r) => r.id === id)?.name}” — desk ${next.size + 1}.`, ...l].slice(0, 4));
      }
      return next;
    });
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const progress = 1 - seconds / SPRINT_SECONDS;

  return (
    <AppShell eyebrow="Live clusters" title="Study Rooms">
      {/* my desk */}
      <section className="mb-10 grid gap-6 rounded-[1.8rem] bg-[#e7fec7] p-7 text-[#21221f] md:grid-cols-[1.2fr_1fr] md:p-10" aria-label="Your desk">
        <div>
          <p className="eyebrow opacity-70">Your desk</p>
          <h2 className="slab-display mt-2 text-2xl md:text-3xl">Deep Work · Variance Analysis</h2>
          <div className="mt-5 flex items-center gap-3">
            {['AK', 'JM', 'RS', 'TP', 'MV', 'LW'].map((n, i) => (
              <span
                key={n}
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#e7fec7] font-slab text-xs font-bold ${
                  i === 0 ? 'bg-[#ea4467] text-white' : 'bg-[#21221f] text-[#e7fec7]'
                }`}
                style={{ marginLeft: i ? -12 : 0 }}
                title={n}
              >
                {n}
              </span>
            ))}
            <span className="ml-2 text-sm font-semibold opacity-70">6 of 8 desks occupied</span>
          </div>
          <p className="mt-6 max-w-md text-sm leading-relaxed opacity-75">
            Shared timer keeps the whole room in the same sprint. When it rings,
            everyone surfaces together — stretch, breathe, compare notes.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => setRunning((r) => !r)} className="pill-btn">
              {running ? 'Pause sprint' : 'Start sprint'}
            </button>
            <span className="pill-btn pill-btn--ghost !border-[#21221f] !text-[#21221f] hover:!bg-[#21221f] hover:!text-[#e7fec7]">
              <DoodleHeadphones className="h-4 w-4" />
              Room muted · presence only
            </span>
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-2xl bg-[#21221f] p-6 text-[#e7fec7]">
          <div className="flex items-baseline justify-between">
            <span className="eyebrow opacity-60">Shared timer</span>
            <span className="text-xs font-semibold opacity-60">{Math.round(progress * 100)}%</span>
          </div>
          <p className="slab-display my-4 text-center text-6xl tabular-nums md:text-7xl">
            {mm}:{ss}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-[#e7fec7]/20">
            <div
              className="h-full rounded-full bg-[#e7fec7] transition-[width] duration-1000 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <ul className="mt-5 space-y-1.5 text-xs opacity-70">
            {log.map((l, i) => (
              <li key={i}>· {l}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search active study clusters or topics…"
          className="w-full max-w-sm rounded-full border-[1.5px] b-line bg-[var(--card)] px-5 py-2.5 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
        />
        <div className="flex gap-2">
          {([0, 1, 2] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPart(p)}
              className={`rounded-full border-[1.5px] px-4 py-2 text-xs font-bold tracking-wide transition-colors ${
                part === p
                  ? 'border-[#ea4467] bg-[#ea4467] text-white'
                  : 'b-line t-muted hover:t-ink'
              }`}
            >
              {p === 0 ? 'ALL' : `PART ${p}`}
            </button>
          ))}
        </div>
      </div>

      {/* cluster grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((r) => {
          const isIn = joined.has(r.id);
          const count = r.scholars + (isIn ? 1 : 0);
          return (
            <article
              key={r.id}
              className="flex min-h-[220px] flex-col justify-between rounded-[1.4rem] p-6 transition-transform duration-500 ease-out-soft hover:-translate-y-1"
              style={{ backgroundColor: r.tone, color: r.ink }}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="eyebrow opacity-70">{r.topic}</p>
                  <span className="rounded-full border border-current px-2.5 py-1 text-[0.6rem] font-bold tracking-widest opacity-80">
                    {r.role}
                  </span>
                </div>
                <h3 className="slab-display mt-3 text-xl leading-snug">{r.name}</h3>
              </div>
              <div className="mt-6">
                <div className="mb-2 flex justify-between text-xs font-semibold opacity-75">
                  <span>{count} / {r.desks} desks</span>
                  <span>{count >= r.desks ? 'FULL' : 'LIVE'}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-current opacity-20">
                  <div
                    className="h-full rounded-full bg-current transition-[width] duration-700"
                    style={{ width: `${Math.min(100, (count / r.desks) * 100)}%` }}
                  />
                </div>
                <button
                  onClick={() => toggleJoin(r.id)}
                  disabled={!isIn && count >= r.desks}
                  className={`mt-4 w-full rounded-full py-2.5 text-sm font-bold transition-all duration-300 ${
                    isIn
                      ? ''
                      : count >= r.desks
                        ? 'opacity-30'
                        : 'hover:opacity-80'
                  }`}
                  style={
                    isIn
                      ? { backgroundColor: r.ink, color: r.tone }
                      : { boxShadow: `inset 0 0 0 1.5px currentColor` }
                  }
                >
                  {isIn ? 'Leave room' : count >= r.desks ? 'Room full' : 'Take a desk'}
                </button>
              </div>
            </article>
          );
        })}
        {filtered.length === 0 && (
          <p className="t-faint col-span-full py-10 text-center text-sm">
            No clusters match “{query}” — try another topic.
          </p>
        )}
      </div>
    </AppShell>
  );
}
