import { useEffect, useRef, useState } from 'react';
import AppShell from '@/components/app/AppShell';
import { DoodleBulb, DoodlePencil } from '@/components/Doodles';
import { useDeckPins, togglePin } from '@/lib/deckStore';

type QA = {
  match: string[];
  answer: string;
  cards?: { title: string; body: string }[];
  visual?: 'variance';
};

const brain: QA[] = [
  {
    match: ['debt', 'after-tax', 'cost of debt', 'kd'],
    answer:
      'After-tax cost of debt is what the company really pays its lenders, once the tax shield is counted. Interest is tax-deductible, so every dollar of interest saves T dollars in tax. Formula: kd × (1 − T). Example: a 9% bond with a 30% tax rate costs only 9% × 0.70 = 6.3% after tax. Exam trap: use the yield to maturity, not the coupon rate — and never apply the tax shield to preferred stock or common equity.',
    cards: [
      { title: 'Formula', body: 'kd(1−T) — use market yield, never the coupon.' },
      { title: 'Trap', body: 'No tax shield on equity or preferred dividends.' },
    ],
  },
  {
    match: ['variance', 'flexible budget'],
    answer:
      'Variance analysis compares what you planned with what happened, in two layers. First, the flexible-budget variance: actual results minus the flexible budget for actual output — that splits into a price/rate variance and an efficiency/quantity variance. Second, the sales-volume variance: flexible budget minus static budget — pure output effect. Rule of thumb for the exam: price variances use actual quantity purchased; efficiency variances use actual quantity used.',
    cards: [
      { title: 'Price variance', body: '(AP − SP) × AQ purchased' },
      { title: 'Efficiency variance', body: '(AQ used − SQ) × SP' },
    ],
    visual: 'variance',
  },
  {
    match: ['internal control', 'coso', 'controls'],
    answer:
      'Internal controls for Part 1 map to the COSO framework — five components worth memorising cold: 1) Control environment — tone at the top. 2) Risk assessment — identify what could go wrong. 3) Control activities — approvals, reconciliations, segregation of duties. 4) Information & communication. 5) Monitoring — ongoing and separate evaluations. Mnemonic: CRIME. Sarbanes-Oxley then makes management attest to these controls.',
    cards: [
      { title: 'Mnemonic', body: 'CRIME — Control env, Risk, Information, Monitoring, Existing activities.' },
      { title: 'SOX', body: 'Management must attest to internal control effectiveness.' },
    ],
  },
];

const chips = [
  'Walk me through after-tax cost of debt',
  'Explain variance analysis',
  'Summarize internal controls',
];

const fallback =
  "Good question — I'd walk that through step by step: define the concept, write the governing formula, then work a short numeric example. For Part 1 depth, try asking me about cost of debt, variance analysis, or internal controls — I keep full notes on those.";

type Msg = { role: 'user' | 'ai'; text: string; cards?: { title: string; body: string }[]; visual?: string };

function VarianceVisual() {
  return (
    <svg viewBox="0 0 220 120" className="mt-3 h-28 w-full" aria-hidden="true">
      <line x1="20" y1="100" x2="205" y2="100" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="45" y="38" width="42" height="62" rx="6" fill="#ea4467" />
      <rect x="120" y="56" width="42" height="44" rx="6" fill="#c6b3a2" />
      <path d="M66 30v74M141 48v56" stroke="currentColor" strokeWidth="2" strokeDasharray="4 5" />
      <text x="66" y="20" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor">ACTUAL</text>
      <text x="141" y="40" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor">BUDGET</text>
      <text x="103" y="115" fontSize="10" fill="currentColor" opacity="0.7">U variance →</text>
    </svg>
  );
}

export default function AIDeck() {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: 'ai',
      text: 'Hey — I\'m your CMA US mentor. Ask me anything from Part 1 or Part 2, or tap a prompt below to warm up.',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pins = useDeckPins();

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs]);

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);
    setMsgs((m) => [...m, { role: 'user', text }]);

    const hit = brain.find((q) => q.match.some((k) => text.toLowerCase().includes(k)));
    const pinHit = text.toLowerCase().startsWith('summarise my pinned');
    const full = pinHit
      ? `Here's your pinned stack, priority-ordered for revision: ${pins
          .map((p) => `“${p.title}” (${p.kind.toLowerCase()})`)
          .join(', ')}. Suggested order: hit the formula sheets first while your head is fresh, then the cheatsheets as rapid-fire recall, and close with the study visuals — they're memory anchors, not reading material. Want me to turn any of these into a 10-question drill?`
      : hit
        ? hit.answer
        : fallback;
    const cards = hit?.cards;
    const visual = hit?.visual;

    // typewriter reveal
    let i = 0;
    setMsgs((m) => [...m, { role: 'ai', text: '' }]);
    timer.current = setInterval(() => {
      i += 3 + Math.floor(Math.random() * 4);
      const slice = full.slice(0, i);
      setMsgs((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: 'ai', text: slice };
        return copy;
      });
      if (i >= full.length) {
        if (timer.current) clearInterval(timer.current);
        setMsgs((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: 'ai', text: full, cards, visual };
          return copy;
        });
        setBusy(false);
      }
    }, 24);
  };

  return (
    <AppShell eyebrow="Doubt desk · always awake" title="AI Deck">
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* chat */}
        <section className="flex flex-col overflow-hidden rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)]">
          <div className="flex items-center gap-3 border-b b-line px-6 py-4">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#e7fec7] text-[#21221f]">
              <DoodleBulb className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#ea4467]" />
            </span>
            <div>
              <p className="text-sm font-bold leading-tight t-ink">CoStudy AI Mentor</p>
              <p className="text-xs t-faint">Gemini deep-reasoning · grounded in your syllabus</p>
            </div>
            <span className="ml-auto rounded-full bg-[#e7fec7] px-3 py-1 text-xs font-bold text-[#21221f]">~4s answers</span>
          </div>

          <div ref={scrollRef} className="h-[52vh] space-y-4 overflow-y-auto p-6" data-lenis-prevent>
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'rounded-br-md bg-[#ea4467] text-white'
                      : 'rounded-bl-md bg-[var(--paper)] t-ink shadow-[inset_0_0_0_1.5px_var(--line)]'
                  }`}
                >
                  {m.text}
                  {m.role === 'ai' && m.text && !busy && m.cards && (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {m.cards.map((c) => (
                        <div key={c.title} className="rounded-xl bg-[#e7fec7] p-3 text-[#21221f]">
                          <p className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-widest opacity-70">
                            <DoodlePencil className="h-3.5 w-3.5" /> {c.title}
                          </p>
                          <p className="mt-1 text-xs font-medium leading-snug">{c.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {m.role === 'ai' && m.visual === 'variance' && !busy && (
                    <div className="mt-3 rounded-xl bg-[var(--card)] p-3 t-ink shadow-[inset_0_0_0_1.5px_var(--line)]">
                      <p className="text-[0.65rem] font-bold uppercase tracking-widest t-faint">Study visual</p>
                      <VarianceVisual />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && <p className="text-xs t-faint">Mentor is thinking…</p>}
          </div>

          <div className="border-t b-line p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {chips.map((c) => (
                <button
                  key={c}
                  onClick={() => send(c)}
                  disabled={busy}
                  className="rounded-full border-[1.5px] b-line px-3.5 py-1.5 text-xs font-semibold t-muted transition-colors hover:t-ink hover:border-[var(--ink)] disabled:opacity-40"
                >
                  {c}
                </button>
              ))}
              {pins.length > 0 && (
                <button
                  onClick={() => send('Summarise my pinned resources')}
                  disabled={busy}
                  className="rounded-full border-[1.5px] border-[#ea4467] bg-[#ea4467]/10 px-3.5 py-1.5 text-xs font-semibold text-[#ea4467] transition-colors hover:bg-[#ea4467] hover:text-white disabled:opacity-40"
                >
                  ✦ Summarise my {pins.length} pinned
                </button>
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask your CMA US mentor anything…"
                className="flex-1 rounded-full border-[1.5px] b-line bg-[var(--paper)] px-5 py-3 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
              />
              <button type="submit" disabled={busy} className="pill-btn !px-6 disabled:opacity-40">
                Ask
              </button>
            </form>
          </div>
        </section>

        {/* deck rail */}
        <aside className="space-y-4">
          <div className="rounded-[1.6rem] bg-[#ea4467] p-6 text-white">
            <p className="eyebrow opacity-70">Deck building</p>
            <h2 className="slab-display mt-2 text-2xl">Formula cards, generated as you ask.</h2>
            <p className="mt-3 text-sm leading-relaxed opacity-85">
              Every answer can be pinned to your revision deck — formulas, traps
              and mnemonics, one tap each.
            </p>
          </div>
          {pins.length > 0 && (
            <div className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-6">
              <div className="mb-4 flex items-center justify-between">
                <p className="eyebrow t-faint">Pinned from the vault</p>
                <span className="rounded-full bg-[#e7fec7] px-2.5 py-0.5 text-[0.65rem] font-bold text-[#21221f]">
                  {pins.length}
                </span>
              </div>
              <ul className="space-y-2.5">
                {pins.map((p) => (
                  <li key={p.id} className="flex items-center gap-2.5 rounded-xl bg-[var(--paper)] p-2.5 shadow-[inset_0_0_0_1.5px_var(--line)]">
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[0.55rem] font-bold tracking-widest"
                      style={{ backgroundColor: p.tone, color: '#21221f' }}
                    >
                      {p.kind.split(' ')[0]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold t-ink">{p.title}</span>
                    <button
                      onClick={() => togglePin(p)}
                      className="text-xs font-bold t-faint transition-colors hover:text-[#ea4467]"
                      aria-label={`Unpin ${p.title}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-6">
            <p className="eyebrow t-faint">This week</p>
            <ul className="mt-4 space-y-3 text-sm">
              {[
                ['Formula cards pinned', '14'],
                ['Doubts resolved', '23'],
                ['Study visuals generated', '5'],
              ].map(([k, v]) => (
                <li key={k} className="flex items-center justify-between border-b b-line pb-3 last:border-0 last:pb-0">
                  <span className="t-muted">{k}</span>
                  <span className="font-slab text-lg font-bold t-ink">{v}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
