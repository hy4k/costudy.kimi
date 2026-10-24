import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import AppShell from '@/components/app/AppShell';
import { DoodleBook, DoodleBulb } from '@/components/Doodles';
import { useDeckPins, togglePin, isPinned } from '@/lib/deckStore';

type Kind = 'CHEATSHEET' | 'FORMULA' | 'NOTES' | 'PAST PAPER' | 'MOCK' | 'VISUAL';

type Resource = {
  id: string;
  title: string;
  kind: Kind;
  author: string;
  part: 1 | 2;
  downloads: number;
  verified: boolean;
  tags: string[];
  summary: string;
};

const kindMeta: Record<Kind, { label: string; tone: string; ink: string }> = {
  CHEATSHEET: { label: 'CHEATSHEET', tone: '#e7fec7', ink: '#21221f' },
  FORMULA: { label: 'FORMULA SHEET', tone: '#d9e6f3', ink: '#21221f' },
  NOTES: { label: 'SUMMARY NOTES', tone: '#c6b3a2', ink: '#21221f' },
  'PAST PAPER': { label: 'PAST PAPER', tone: '#f3f1ee', ink: '#21221f' },
  MOCK: { label: 'MOCK TEST', tone: '#ea4467', ink: '#ffffff' },
  VISUAL: { label: 'STUDY VISUAL', tone: '#2b2926', ink: '#fcfbfa' },
};

const resources: Resource[] = [
  {
    id: 'variance-cheatsheet', title: 'Variance Analysis — one-pager', kind: 'CHEATSHEET', author: 'Sarah Jenkins', part: 1,
    downloads: 1240, verified: true, tags: ['#variance', '#performance-mgmt'],
    summary: 'Every split with a worked mini-example. Print it, then throw it away.',
  },
  {
    id: 'cost-of-capital-formulas', title: 'Cost of Capital — formula sheet', kind: 'FORMULA', author: 'Prof. Vikram Sethi', part: 2,
    downloads: 986, verified: true, tags: ['#wacc', '#capital-budgeting'],
    summary: 'WACC builds, kd(1−T), CAPM and the examiner\'s favourite traps.',
  },
  {
    id: 'internal-controls-notes', title: 'Internal Controls — summary notes', kind: 'NOTES', author: 'Dr. Anita Desai', part: 1,
    downloads: 874, verified: true, tags: ['#coso', '#crime', '#controls'],
    summary: 'The five COSO components with SOX attestations, in six pages.',
  },
  {
    id: 'p2-nov-paper', title: 'Part 2 — past paper walkthrough', kind: 'PAST PAPER', author: 'Faculty Lounge', part: 2,
    downloads: 2130, verified: true, tags: ['#part2', '#past-paper'],
    summary: 'Last sitting, fully worked with time-per-question annotations.',
  },
  {
    id: 'p1-mock-5', title: 'Part 1 Mock 5 — full timed set', kind: 'MOCK', author: 'CoStudy Mock Engine', part: 1,
    downloads: 3412, verified: true, tags: ['#mock', '#part1', '#timed'],
    summary: 'Closest match to the real exam difficulty this season. 4 hrs.',
  },
  {
    id: 'fx-translation-visual', title: 'FX translation — study visual', kind: 'VISUAL', author: 'Candidate #8842', part: 2,
    downloads: 655, verified: true, tags: ['#fx', '#translation'],
    summary: 'One diagram for when to divide vs multiply. Ends the confusion.',
  },
  {
    id: 'responsibility-centres-notes', title: 'Responsibility Centres — notes', kind: 'NOTES', author: 'Rohan Sharma', part: 1,
    downloads: 231, verified: false, tags: ['#centres', '#needs-review'],
    summary: 'Draft summary — pending faculty quality check. Read critically.',
  },
  {
    id: 'npv-vs-payback-visual', title: 'NPV vs payback — visual explainer', kind: 'VISUAL', author: 'Midhun', part: 2,
    downloads: 189, verified: false, tags: ['#capital-budgeting', '#fresh'],
    summary: 'Three panels: time value, reinvestment, risk. Community upload.',
  },
  {
    id: 'ethics-cheatsheet', title: 'Professional Ethics — cheatsheet', kind: 'CHEATSHEET', author: 'Dr. Anita Desai', part: 2,
    downloads: 1577, verified: true, tags: ['#ethics', '#ima-statement'],
    summary: 'The IMA statement as decision trees, not paragraphs.',
  },
  {
    id: 'budgeting-formulas', title: 'Budgeting — formula sheet', kind: 'FORMULA', author: 'Priya Nair', part: 1,
    downloads: 542, verified: true, tags: ['#budgeting', '#planning'],
    summary: 'Static vs flexible mechanics plus the master budget sequence.',
  },
];

const kinds: (Kind | 'ALL')[] = ['ALL', 'CHEATSHEET', 'FORMULA', 'NOTES', 'PAST PAPER', 'MOCK', 'VISUAL'];

export default function Vault() {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<(typeof kinds)[number]>('ALL');
  const pins = useDeckPins();
  const [, force] = useState(0);

  const visible = useMemo(() => {
    const q = query.toLowerCase();
    return resources.filter(
      (r) =>
        (kind === 'ALL' || r.kind === kind) &&
        (!q || (r.title + r.author + r.tags.join(' ') + r.summary).toLowerCase().includes(q)),
    );
  }, [query, kind]);

  return (
    <AppShell eyebrow="The knowledge vault" title="Library Vault">
      {/* stats strip */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        {[
          ['312', 'resources shared'],
          ['98%', 'quality-checked'],
          ['12', 'pending review'],
        ].map(([n, l]) => (
          <div key={l} className="rounded-2xl border-[1.5px] b-line bg-[var(--card)] px-5 py-4">
            <p className="slab-display text-2xl t-ink md:text-3xl">{n}</p>
            <p className="mt-0.5 text-xs t-faint">{l}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div>
          {/* search + filters */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your knowledge vault…"
              className="w-full max-w-sm rounded-full border-[1.5px] b-line bg-[var(--card)] px-5 py-2.5 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              {kinds.map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`rounded-full border-[1.5px] px-3.5 py-2 text-[0.65rem] font-bold tracking-widest transition-all duration-300 ${
                    kind === k
                      ? 'border-[#ea4467] bg-[#ea4467] text-white'
                      : 'b-line t-muted hover:t-ink hover:border-[var(--ink)]'
                  }`}
                >
                  {k === 'ALL' ? 'ALL' : kindMeta[k].label}
                </button>
              ))}
            </div>
          </div>

          {/* resource grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {visible.map((r) => {
              const meta = kindMeta[r.kind];
              const pinned = isPinned(r.id);
              return (
                <article
                  key={r.id}
                  className="flex min-h-[210px] flex-col justify-between rounded-[1.4rem] border-[1.5px] b-line bg-[var(--card)] p-6 transition-transform duration-500 ease-out-soft hover:-translate-y-1"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded-full px-2.5 py-1 text-[0.6rem] font-bold tracking-widest"
                        style={{ backgroundColor: meta.tone, color: meta.ink }}
                      >
                        {meta.label}
                      </span>
                      <span className="text-xs font-semibold t-faint">PART {r.part}</span>
                      {r.verified ? (
                        <span className="ml-auto flex items-center gap-1 text-[0.6rem] font-bold tracking-widest text-[#6f9c3e]">
                          ✓ VERIFIED
                        </span>
                      ) : (
                        <span className="ml-auto text-[0.6rem] font-bold tracking-widest t-faint">
                          PENDING CHECK
                        </span>
                      )}
                    </div>
                    <h3 className="slab-display mt-3 text-lg leading-snug t-ink">{r.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed t-muted">{r.summary}</p>
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold t-faint">
                        {r.author} · {r.downloads.toLocaleString()} pulls
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {r.tags.map((t) => (
                          <span key={t} className="text-[0.65rem] font-semibold text-[#ea4467]">{t}</span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        togglePin({ id: r.id, title: r.title, kind: meta.label, tone: meta.tone });
                        force((v) => v + 1);
                      }}
                      className={`shrink-0 rounded-full border-[1.5px] px-3.5 py-2 text-xs font-bold transition-all duration-300 ${
                        pinned
                          ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]'
                          : 'b-line t-muted hover:t-ink hover:border-[var(--ink)]'
                      }`}
                      aria-pressed={pinned}
                    >
                      {pinned ? 'Pinned ✓' : 'Pin to Deck'}
                    </button>
                  </div>
                </article>
              );
            })}
            {visible.length === 0 && (
              <p className="col-span-full py-10 text-center text-sm t-faint">
                Nothing in the vault matches “{query}”.
              </p>
            )}
          </div>
        </div>

        {/* pinned rail */}
        <aside className="space-y-4">
          <section className="rounded-[1.6rem] bg-[#ea4467] p-6 text-white">
            <div className="flex items-center gap-2">
              <DoodleBulb className="h-5 w-5" />
              <p className="eyebrow opacity-80">Pinned to AI Deck</p>
            </div>
            <p className="slab-display mt-3 text-3xl">
              {pins.length} {pins.length === 1 ? 'resource' : 'resources'}
            </p>
            <p className="mt-2 text-sm leading-relaxed opacity-85">
              Pinned vault items ride along to the AI Deck — ask the mentor to
              summarise, quiz you, or turn them into flashcards.
            </p>
            <Link
              to="/ai"
              className="pill-btn mt-5 !bg-[#2b2926] !text-[#fcfbfa] hover:!bg-[#171310]"
            >
              Open AI Deck →
            </Link>
          </section>

          <section className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-6">
            <h2 className="slab-display text-xl t-ink">Your pins</h2>
            {pins.length === 0 ? (
              <p className="mt-3 text-sm t-faint">
                Pin any resource with <strong className="t-muted">Pin to Deck</strong> and it
                queues here for your next mentor session.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {pins.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl bg-[var(--paper)] p-3 shadow-[inset_0_0_0_1.5px_var(--line)]"
                  >
                    <span
                      className="shrink-0 rounded-full px-2 py-1 text-[0.55rem] font-bold tracking-widest"
                      style={{ backgroundColor: p.tone, color: '#21221f' }}
                    >
                      {p.kind.split(' ')[0]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold t-ink">{p.title}</span>
                    <button
                      onClick={() => {
                        togglePin(p);
                        force((v) => v + 1);
                      }}
                      className="text-xs font-bold t-faint transition-colors hover:text-[#ea4467]"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[1.6rem] bg-[#e7fec7] p-6 text-[#21221f]">
            <div className="flex items-center gap-2">
              <DoodleBook className="h-5 w-5" />
              <h2 className="slab-display text-xl">Share to the vault</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed opacity-80">
              Uploads enter <strong>pending review</strong> until two scholars
              or one faculty member quality-checks them. Verified resources
              earn their author karma.
            </p>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
