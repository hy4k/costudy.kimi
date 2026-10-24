import AppShell from '@/components/app/AppShell';
import { DoodleNote, DoodleSpark } from '@/components/Doodles';

const sections = [
  { name: 'External Financial Reporting Decisions', pct: 74 },
  { name: 'Planning, Budgeting & Forecasting', pct: 68 },
  { name: 'Performance Management', pct: 71 },
  { name: 'Cost Management', pct: 62 },
  { name: 'Internal Controls', pct: 55 },
];

const mocks = [
  { label: 'Mock 5 · Full timed', score: 368, date: '2 days ago' },
  { label: 'Mock 4 · Full timed', score: 355, date: '9 days ago' },
  { label: 'Mock 3 · Section drill', score: 342, date: '16 days ago' },
  { label: 'Mock 2 · Section drill', score: 318, date: '23 days ago' },
];

function Ring({ pct, size = 190 }: { pct: number; size?: number }) {
  const r = 80;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 200 200" style={{ width: size, height: size }} className="-rotate-90" aria-hidden="true">
      <circle cx="100" cy="100" r={r} fill="none" stroke="var(--line)" strokeWidth="14" />
      <circle
        cx="100"
        cy="100"
        r={r}
        fill="none"
        stroke="#ea4467"
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)' }}
      />
    </svg>
  );
}

export default function Path() {
  return (
    <AppShell eyebrow="The cockpit" title="Mastery Path">
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* left column */}
        <div className="space-y-6">
          <section className="grid items-center gap-8 rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-7 sm:grid-cols-[auto_1fr] md:p-9">
            <div className="relative mx-auto">
              <Ring pct={68} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="slab-display text-5xl font-bold t-ink">68%</span>
                <span className="eyebrow mt-1 t-faint">Part 1 mastery</span>
              </div>
            </div>
            <div>
              <p className="eyebrow text-[#ea4467]">Trajectory</p>
              <h2 className="slab-display mt-2 text-2xl t-ink md:text-3xl">On pace for exam day.</h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed t-muted">
                Mastery blends your mock trend, deck retention and room hours.
                Internal Controls is your weakest block — one focused week
                closes it.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {['STREAK 12 DAYS', '412 ROOM HOURS', 'DECK 86 CARDS'].map((b) => (
                  <span key={b} className="rounded-full border-[1.5px] b-line px-3.5 py-1.5 text-[0.65rem] font-bold tracking-widest t-muted">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-7 md:p-9">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="slab-display text-xl t-ink">Syllabus blocks</h2>
              <span className="text-xs font-semibold t-faint">Part 1 · 5 of 6 unlocked</span>
            </div>
            <ul className="space-y-5">
              {sections.map((s, i) => (
                <li key={s.name}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-4">
                    <span className="text-sm font-medium t-ink">{s.name}</span>
                    <span className="font-slab text-sm font-bold t-ink">{s.pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--paper)] shadow-[inset_0_0_0_1px_var(--line)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${s.pct}%`,
                        backgroundColor: i === sections.length - 1 ? '#ea4467' : '#c6b3a2',
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* right column */}
        <div className="space-y-6">
          <section className="rounded-[1.6rem] bg-[#2b2926] p-7 text-[#fcfbfa]">
            <p className="eyebrow opacity-60">Next milestone</p>
            <h2 className="slab-display mt-2 text-3xl">Part 1 exam</h2>
            <p className="slab-display mt-1 text-5xl text-[#e7fec7]">42<span className="text-2xl"> days</span></p>
            <p className="mt-3 text-sm leading-relaxed opacity-70">
              Passing scaled score: 360. Your last mock: 368 — you are in the
              green zone. Keep the streak alive.
            </p>
          </section>

          <section className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-7">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="slab-display text-xl t-ink">Mock test trend</h2>
              <DoodleSpark className="h-5 w-5 text-[#ea4467]" />
            </div>
            <ul className="space-y-4">
              {mocks.map((m) => (
                <li key={m.label}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="font-medium t-ink">{m.label}</span>
                    <span className="t-faint text-xs">{m.date}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--paper)] shadow-[inset_0_0_0_1px_var(--line)]">
                      <div
                        className="h-full rounded-full bg-[#ea4467]"
                        style={{ width: `${(m.score / 500) * 100}%` }}
                      />
                    </div>
                    <span className="font-slab text-sm font-bold t-ink">{m.score}</span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t b-line pt-4 text-xs t-faint">
              Scaled score out of 500 · pass mark 360
            </p>
          </section>

          <section className="rounded-[1.6rem] bg-[#e7fec7] p-7 text-[#21221f]">
            <div className="flex items-center justify-between">
              <h2 className="slab-display text-xl">This week at the desk</h2>
              <DoodleNote className="h-6 w-6" />
            </div>
            <div className="mt-4 flex justify-between">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <span key={i} className="flex flex-col items-center gap-1.5">
                  <span
                    className={`h-8 w-8 rounded-full border-[1.5px] border-[#21221f] ${
                      i < 5 ? 'bg-[#21221f] text-[#e7fec7]' : ''
                    } flex items-center justify-center text-xs font-bold`}
                  >
                    {i < 5 ? '✓' : ''}
                  </span>
                  <span className="text-[0.6rem] font-bold opacity-60">{d}</span>
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm font-medium opacity-75">
              5 of 7 days banked — weekend sprints count double.
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
