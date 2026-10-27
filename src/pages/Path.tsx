import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import AppShell from '@/components/app/AppShell';
import { DoodleNote, DoodleSpark } from '@/components/Doodles';
import { useAuth } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';

type Attempt = { id: string; scaled_score: number | null; started_at: string | null; pass_threshold: number | null };
type BadgeRow = { id: string; earned_at: string | null; badge?: { name?: string; icon?: string; description?: string } | null };

type Section = { part: string; name: string; count: number; share: number };

const seedSections: Section[] = [
  { part: 'Part 1', name: 'External Financial Reporting Decisions', count: 0, share: 74 },
  { part: 'Part 1', name: 'Planning, Budgeting & Forecasting', count: 0, share: 68 },
  { part: 'Part 1', name: 'Performance Management', count: 0, share: 71 },
  { part: 'Part 1', name: 'Cost Management', count: 0, share: 62 },
  { part: 'Part 1', name: 'Internal Controls', count: 0, share: 55 },
];

const seedMocks = [
  { id: 's1', label: 'Mock 5 · Full timed', score: 368, date: '2 days ago' },
  { id: 's2', label: 'Mock 4 · Full timed', score: 355, date: '9 days ago' },
  { id: 's3', label: 'Mock 3 · Section drill', score: 342, date: '16 days ago' },
  { id: 's4', label: 'Mock 2 · Section drill', score: 318, date: '23 days ago' },
];

const relTime = (iso: string | null) => {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d < 1) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d} days ago`;
  return `${Math.floor(d / 30)} mo ago`;
};

/** Best-effort parse of exam_window like "Jan-2027" / "January 2027" into an approx date. */
const approxCountdown = (windowText: string): number | null => {
  const m = windowText.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-]+(20\d{2})/i);
  if (!m) return null;
  const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const month = months[m[1].slice(0, 3).toLowerCase()];
  if (month === undefined) return null;
  const target = new Date(parseInt(m[2], 10), month, 1);
  const days = Math.ceil((target.getTime() - Date.now()) / 86400000);
  return days > 0 ? days : null;
};

function Ring({ pct, size = 190 }: { pct: number; size?: number }) {
  const r = 80;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 200 200" style={{ width: size, height: size }} className="-rotate-90" aria-hidden="true">
      <circle cx="100" cy="100" r={r} fill="none" stroke="var(--line)" strokeWidth="14" />
      <circle
        cx="100" cy="100" r={r} fill="none" stroke="#ea4467" strokeWidth="14" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)' }}
      />
    </svg>
  );
}

export default function Path() {
  const { profile } = useAuth();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [examWindow, setExamWindow] = useState<string | null>(null);
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // syllabus blocks — real question-bank coverage per section
      const { data: qrows } = await supabase.from('mcq_questions').select('part, section');
      if (!cancelled && qrows && qrows.length > 0) {
        const tally = new Map<string, { part: string; name: string; count: number }>();
        for (const q of qrows as { part: string; section: string }[]) {
          const key = `${q.part}|${q.section}`;
          const cur = tally.get(key) || { part: q.part, name: q.section, count: 0 };
          cur.count += 1;
          tally.set(key, cur);
        }
        const total = qrows.length;
        setSections(
          [...tally.values()]
            .sort((a, b) => a.part.localeCompare(b.part) || b.count - a.count)
            .map((s) => ({ ...s, share: Math.round((s.count / total) * 100) })),
        );
      }

      if (profile && !cancelled) {
        const [{ data: atts }, { data: target }, { data: bd }] = await Promise.all([
          supabase
            .from('mock_attempts')
            .select('id, scaled_score, started_at, pass_threshold')
            .eq('user_id', profile.id)
            .order('started_at', { ascending: false })
            .limit(6),
          supabase
            .from('user_exam_targets')
            .select('exam_window')
            .eq('user_id', profile.id)
            .maybeSingle(),
          supabase
            .from('user_badges')
            .select('id, earned_at, badge:badges(name, icon, description)')
            .eq('user_id', profile.id)
            .order('earned_at', { ascending: false }),
        ]);
        if (cancelled) return;
        setAttempts(((atts as Attempt[]) || []).filter((a) => a.scaled_score != null));
        setExamWindow((target as { exam_window?: string } | null)?.exam_window || null);
        setBadges((bd as BadgeRow[]) || []);
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const hasLive = attempts.length > 0;
  const latest = attempts[0]?.scaled_score ?? null;
  const prev = attempts[1]?.scaled_score ?? null;
  const best = useMemo(() => attempts.reduce((m, a) => Math.max(m, a.scaled_score ?? 0), 0), [attempts]);
  const avg = useMemo(
    () => (attempts.length ? Math.round(attempts.reduce((s, a) => s + (a.scaled_score ?? 0), 0) / attempts.length) : 0),
    [attempts],
  );
  const ringPct = hasLive && latest != null ? Math.min(100, Math.round((latest / 500) * 100)) : 68;
  const rising = latest != null && prev != null ? latest >= prev : true;
  const countdown = examWindow ? approxCountdown(examWindow) : null;
  const passMark = attempts[0]?.pass_threshold ?? 360;
  const shownSections = sections.length > 0 ? sections : seedSections;
  const shownMocks = hasLive
    ? attempts.map((a) => ({ id: a.id, label: 'Timed mock', score: a.scaled_score ?? 0, date: relTime(a.started_at) }))
    : seedMocks;
  const blocksLabel = sections.length > 0
    ? `Question-bank coverage · ${sections.length} sections · live from mcq_questions`
    : 'Sample trajectory — log in to load your real path';

  return (
    <AppShell eyebrow="The cockpit" title="Mastery Path">
      {!profile && loaded && (
        <p className="mb-6 rounded-xl border-[1.5px] border-dashed b-line px-4 py-3 text-xs font-semibold t-muted">
          Showing a sample trajectory —{' '}
          <Link to="/login" className="font-bold text-[#ea4467]">log in</Link> to load your real
          mocks, exam window and badges from the campus.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* left column */}
        <div className="space-y-6">
          <section className="grid items-center gap-8 rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-7 sm:grid-cols-[auto_1fr] md:p-9">
            <div className="relative mx-auto">
              <Ring pct={ringPct} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="slab-display text-5xl font-bold t-ink">{ringPct}%</span>
                <span className="eyebrow mt-1 t-faint">Part 1 mastery</span>
              </div>
            </div>
            <div>
              <p className="eyebrow text-[#ea4467]">Trajectory</p>
              <h2 className="slab-display mt-2 text-2xl t-ink md:text-3xl">
                {hasLive ? (rising ? 'Trending up — hold the line.' : 'Dipped — the next mock reclaims it.') : 'On pace for exam day.'}
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed t-muted">
                {hasLive
                  ? `Latest scaled score ${latest} against a pass mark of ${passMark}. ${latest != null && latest >= passMark ? 'You are in the green zone.' : 'A few more focused sprints and the green zone is yours.'}`
                  : 'Mastery blends your mock trend, deck retention and room hours. Internal Controls is your weakest block — one focused week closes it.'}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {(hasLive
                  ? [`${attempts.length} ATTEMPTS`, `BEST ${best}`, `AVG ${avg}`]
                  : ['STREAK 12 DAYS', '412 ROOM HOURS', 'DECK 86 CARDS']
                ).map((b) => (
                  <span key={b} className="rounded-full border-[1.5px] b-line px-3.5 py-1.5 text-[0.65rem] font-bold tracking-widest t-muted">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-7 md:p-9">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="slab-display text-xl t-ink">Syllabus blocks</h2>
              <span className="text-right text-xs font-semibold t-faint">{blocksLabel}</span>
            </div>
            <ul className="space-y-5">
              {shownSections.map((s, i) => (
                <li key={`${s.part}-${s.name}`}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-4">
                    <span className="text-sm font-medium t-ink">
                      <span className="mr-2 text-[0.6rem] font-bold tracking-widest t-faint">{s.part.toUpperCase()}</span>
                      {s.name}
                    </span>
                    <span className="font-slab text-sm font-bold t-ink">
                      {s.share}%{s.count > 0 && <span className="ml-1.5 text-[0.65rem] font-semibold t-faint">· {s.count} banked</span>}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--paper)] shadow-[inset_0_0_0_1px_var(--line)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${s.share}%`,
                        backgroundColor: i === shownSections.length - 1 ? '#ea4467' : '#c6b3a2',
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
            <h2 className="slab-display mt-2 text-3xl">
              {examWindow ? `Exam window · ${examWindow}` : 'Part 1 exam'}
            </h2>
            {countdown != null ? (
              <p className="slab-display mt-1 text-5xl text-[#e7fec7]">
                {countdown}<span className="text-2xl"> days</span>
              </p>
            ) : (
              <p className="slab-display mt-1 text-5xl text-[#e7fec7]">42<span className="text-2xl"> days</span></p>
            )}
            <p className="mt-3 text-sm leading-relaxed opacity-70">
              {hasLive && latest != null
                ? `Passing scaled score: ${passMark}. Your last mock: ${latest} — ${latest >= passMark ? 'you are in the green zone. Keep the streak alive.' : 'within striking distance. One focused week.'}`
                : `Passing scaled score: ${passMark}. Take a timed mock to see exactly where you stand.`}
              {countdown != null && ' · window start is approximate'}
            </p>
          </section>

          <section className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-7">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="slab-display text-xl t-ink">Mock test trend</h2>
              <DoodleSpark className="h-5 w-5 text-[#ea4467]" />
            </div>
            <ul className="space-y-4">
              {shownMocks.map((m) => (
                <li key={m.id}>
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
              Scaled score out of 500 · pass mark {passMark} · {hasLive ? 'your real attempts from mock_attempts' : 'sample trend'}
            </p>
          </section>

          <section className="rounded-[1.6rem] bg-[#e7fec7] p-7 text-[#21221f]">
            <div className="flex items-center justify">
              <h2 className="slab-display text-xl">Badges banked</h2>
              <DoodleNote className="h-6 w-6" />
            </div>
            {badges.length === 0 ? (
              <p className="mt-4 text-sm font-medium opacity-75">
                No badges banked yet — they land here as you earn them across mocks, rooms and the wall.
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {badges.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 rounded-xl bg-[#fcfbfa]/60 px-4 py-3">
                    <span className="text-lg">{b.badge?.icon || '🏅'}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{b.badge?.name || 'Badge'}</p>
                      <p className="truncate text-xs opacity-70">{b.badge?.description || ''} · {relTime(b.earned_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
