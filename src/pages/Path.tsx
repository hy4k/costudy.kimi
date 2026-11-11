import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import AppShell from '@/components/app/AppShell';
import { DoodleClock, DoodleSpark } from '@/components/Doodles';
import { useAuth } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';

type Attempt = { id: string; scaled_score: number | null; started_at: string | null; pass_threshold: number | null };

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

function Ring({ pct, size = 170 }: { pct: number; size?: number }) {
  const r = 80;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 200 200" style={{ width: size, height: size }} className="-rotate-90" aria-hidden="true">
      <circle cx="100" cy="100" r={r} fill="none" stroke="var(--line)" strokeWidth="12" />
      <circle
        cx="100" cy="100" r={r} fill="none" stroke="var(--coral)" strokeWidth="12" strokeLinecap="round"
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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (profile && !cancelled) {
        const [{ data: atts }, { data: target }] = await Promise.all([
          supabase
            .from('mock_attempts')
            .select('id, scaled_score, started_at, pass_threshold')
            .eq('user_id', profile.id)
            .order('started_at', { ascending: false })
            .limit(2),
          supabase.from('user_exam_targets').select('exam_window').eq('user_id', profile.id).maybeSingle(),
        ]);
        if (cancelled) return;
        setAttempts(((atts as Attempt[]) || []).filter((a) => a.scaled_score != null));
        setExamWindow((target as { exam_window?: string } | null)?.exam_window || null);
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const latest = attempts[0]?.scaled_score ?? null;
  const passMark = attempts[0]?.pass_threshold ?? 360;
  const pct = latest != null ? Math.min(100, Math.round((latest / 500) * 100)) : null;
  const countdown = examWindow ? approxCountdown(examWindow) : null;
  const inGreen = latest != null && latest >= passMark;

  return (
    <AppShell eyebrow="Your path" title="Mastery, at a glance">
      {!profile && loaded && (
        <p className="mb-8 rounded-xl border-[1.5px] border-dashed b-line px-4 py-3 text-xs font-semibold t-muted">
          Showing the shape of the page —{' '}
          <Link to="/login" className="font-bold text-[var(--coral)]">log in</Link> to load your
          real scores and exam window.
        </p>
      )}

      <div className="mx-auto max-w-3xl space-y-6">
        {/* one ring, one sentence */}
        <section className="flex flex-col items-center gap-8 rounded-[2rem] border-[1.5px] b-line bg-[var(--card)] p-10 text-center sm:p-14">
          {pct != null ? (
            <div className="relative">
              <Ring pct={pct} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="slab-display text-5xl font-bold t-ink">{pct}%</span>
                <span className="eyebrow mt-1 t-faint">of mastery</span>
              </div>
            </div>
          ) : (
            <div className="py-6">
              <span className="slab-display text-5xl font-bold t-ink">—</span>
              <p className="eyebrow mt-2 t-faint">no mock yet</p>
            </div>
          )}
          <div>
            <h2 className="slab-display text-2xl t-ink md:text-3xl">
              {latest == null
                ? 'One mock tells you everything.'
                : inGreen
                  ? 'You are in the green zone.'
                  : 'Within striking distance.'}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed t-muted">
              {latest == null
                ? `Sit a timed mock once — it calibrates this whole page. The pass mark is ${passMark}.`
                : `Latest scaled score ${latest} · pass mark ${passMark}. ${
                    inGreen ? 'Hold the line — consistency wins the exam.' : 'A few focused weeks of sprints closes the gap.'
                  }`}
            </p>
          </div>
        </section>

        {/* countdown */}
        <section className="flex flex-wrap items-center justify-between gap-6 rounded-[2rem] bg-[#2b2926] px-8 py-7 text-[#fcfbfa] md:px-10">
          <div>
            <p className="eyebrow opacity-60">Exam window</p>
            <p className="slab-display mt-1 text-xl md:text-2xl">
              {examWindow || 'Set your target'}
            </p>
          </div>
          <div className="text-right">
            {countdown != null ? (
              <p className="slab-display text-5xl text-[var(--mint)]">
                {countdown}<span className="text-xl"> days</span>
              </p>
            ) : (
              <Link
                to="/profile"
                className="rounded-full bg-[var(--mint)] px-5 py-2.5 text-xs font-bold tracking-wide text-[var(--ink)] transition-opacity hover:opacity-85"
              >
                Add exam date
              </Link>
            )}
          </div>
        </section>

        {/* one next step */}
        <section className="flex flex-wrap items-center justify-between gap-6 rounded-[2rem] border-[1.5px] b-line bg-[var(--card)] px-8 py-7 md:px-10">
          <div className="flex items-center gap-4">
            <DoodleClock className="h-8 w-8 shrink-0 text-[var(--coral)]" />
            <div>
              <p className="eyebrow text-[var(--coral)]">Next best step</p>
              <p className="slab-display mt-1 text-xl t-ink md:text-2xl">
                {latest == null ? 'Sit your first timed mock.' : 'One focused sprint today.'}
              </p>
            </div>
          </div>
          <Link to={latest == null ? '/ai' : '/rooms'} className="pill-btn !px-6 !py-3 text-sm">
            {latest == null ? 'Open the AI Deck' : 'Enter a study room'}
          </Link>
        </section>

        <p className="flex items-center justify-center gap-2 pt-2 text-center text-xs t-faint">
          <DoodleSpark className="h-4 w-4" />
          Everything else — badges, trends, syllabus blocks — lives where you use it: the Wall, Rooms and the Vault.
        </p>
      </div>
    </AppShell>
  );
}
