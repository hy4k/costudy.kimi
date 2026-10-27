import { useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '@/components/app/AppShell';
import { DoodleBulb } from '@/components/Doodles';
import { useDeckPins, togglePin } from '@/lib/deckStore';
import { supabase } from '@/lib/supabase';

type BankQ = {
  id: string;
  part: string;
  section: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
};

type SectionNote = { note: string; trap: string };

// Teaching notes per real bank section — grounded in what the banked questions test.
const SECTION_NOTES: Record<string, SectionNote> = {
  'External Financial Reporting': {
    note: "US GAAP mechanics the exam loves. Statement of cash flows: under US GAAP both interest paid and interest received are operating activities — IFRS is the one that offers a choice. Contra-assets like Accumulated Depreciation sit against their related asset. Revenue runs on ASC 606's five-step model: identify the contract → identify performance obligations → determine the transaction price → allocate it → recognize as obligations are satisfied. The third step is determining the transaction price.",
    trap: 'Interest paid is operating under US GAAP — never financing. IFRS distractors are the classic wrong answers.',
  },
  'Planning, Budgeting, and Forecasting': {
    note: 'Regression (Y = a + bX) quantifies planning relationships — R-squared measures how much of Y\u2019s variation X explains (0\u20131, closer to 1 = tighter fit). In volatile markets, rolling (continuous) budgets keep a constant 12-month horizon by adding a period as each one closes. Zero-based budgeting makes every manager justify all spending from a zero baseline each cycle — powerful for cutting fat, expensive to run.',
    trap: 'R-squared measures fit strength, not causation — and ZBB re-justifies everything, not just the increment.',
  },
  'Performance Management': {
    note: 'Responsibility centers: cost centers own only costs, revenue centers only revenue, profit centers both, and investment centers also control the assets employed (evaluated on ROI and residual income). The Balanced Scorecard spans Financial, Customer, Internal Process, and Learning & Growth — retention and training-hours metrics live in Learning & Growth. On variances: an unfavorable price variance paired with a favorable quantity variance often signals buying cheaper, lower-quality material.',
    trap: 'Never judge a center manager on corporate overhead they cannot control — controllability is the principle.',
  },
  'Cost Management': {
    note: 'Process costing spreads costs over equivalent units of production (EUP) — under weighted-average, EUP = units completed + (ending WIP \u00d7 % complete), merging prior-period work with current. Activity-Based Costing assigns overhead by activities (cost drivers) instead of one volume base — it typically raises the cost of low-volume, complex products and lowers the cost of high-volume, simple ones.',
    trap: 'Weighted-average merges beginning inventory into current work — FIFO is the method that separates the two.',
  },
  'Internal Controls': {
    note: 'COSO\u2019s five components: Control Environment (tone at the top — the foundation), Risk Assessment, Control Activities, Information & Communication, and Monitoring. Segregation of duties splits custody of assets from record-keeping and authorization, so no single person can both execute and hide a fraud in cash management.',
    trap: 'Control environment is the foundation — exam items love swapping it with control activities.',
  },
  'Corporate Finance': {
    note: 'CAPM prices equity capital: k = rf + \u03b2(rm \u2212 rf). With a 4% risk-free rate, beta of 1.25 and a 12% market return: 4% + 1.25 \u00d7 8% = 14%. Beta scales the market risk premium — a beta of exactly 1 earns the market return. Use it to feed WACC alongside after-tax cost of debt.',
    trap: 'Multiply beta by the premium, not by the market return itself.',
  },
  'Decision Analysis': {
    note: 'Relevant costs are future and incremental. In make-or-buy, exclude sunk costs and allocated fixed overhead that continues either way. Breakeven volume = fixed costs \u00f7 unit contribution margin — $120,000 \u00f7 ($60 \u2212 $36) = 5,000 units; add target profit to the numerator for goal-volume calculations.',
    trap: 'Sunk costs are never relevant — even when the question begs you to include them.',
  },
  'Enterprise Risk Management': {
    note: 'Risk responses map to four strategies: avoid, reduce (mitigate), share (insurance, hedging), or accept (retain). Purchasing business interruption insurance is risk sharing — the insurer carries the severe-weather loss in exchange for premium.',
    trap: 'Insurance is sharing, not reduction — reduction means making the event less likely or less severe.',
  },
  'Financial Statement Analysis': {
    note: 'The liquidity ladder: the current ratio uses all current assets; the quick (acid-test) ratio strips inventory and prepaids to show ability to pay from near-cash assets; the cash ratio is the strictest. Trend and benchmark these against industry peers, not in isolation.',
    trap: 'The quick ratio excludes inventory — including it is the classic distractor.',
  },
  'Investment Decisions': {
    note: 'NPV discounts incremental cash flows at the required rate. NPV = $0 means the project earns exactly the hurdle rate — IRR equals the cost of capital — so it is acceptable if the hurdle reflects your true required return. Positive NPV adds shareholder value; negative destroys it.',
    trap: 'NPV of exactly zero is not a reject — it earns the required return precisely.',
  },
  'Professional Ethics': {
    note: 'The IMA Statement of Ethical Professional Practice lists four standards: Competence, Confidentiality, Integrity, and Credibility. Resolution path: follow your employer\u2019s policy, escalate unresolved conflicts (IMA ethics hotline as a last resort), and never disclose confidential information unless legally required.',
    trap: 'Credibility — fair and complete disclosure — is the fourth standard. \u201cObjectivity\u201d is a distractor.',
  },
};

const SECTION_KEYWORDS: Record<string, string[]> = {
  'External Financial Reporting': [
    'revenue', 'asc 606', 'gaap', 'cash flow', 'interest', 'contra', 'depreciation',
    'accrual', 'deferr', 'asset', 'liabilit', 'financial report', 'statement',
  ],
  'Planning, Budgeting, and Forecasting': [
    'budget', 'forecast', 'regression', 'r-squared', 'r squared', 'coefficient',
    'rolling', 'zero-based', 'zero based', 'variance analysis plan', 'planning',
  ],
  'Performance Management': [
    'balanced scorecard', 'scorecard', 'responsibility center', 'investment center',
    'profit center', 'cost center', 'variance', 'price variance', 'quantity variance',
    'efficiency', 'learning and growth', 'roi', 'residual income',
  ],
  'Cost Management': [
    'process costing', 'eup', 'equivalent unit', 'weighted-average', 'weighted average',
    'abc', 'activity-based', 'activity based', 'overhead', 'cost driver', 'job order',
  ],
  'Internal Controls': [
    'control', 'coso', 'segregation', 'custody', 'authorization', 'fraud', 'audit', 'compliance',
  ],
  'Corporate Finance': [
    'capm', 'beta', 'cost of equity', 'wacc', 'risk-free', 'risk free', 'market return',
    'capital structure', 'leverage', 'dividend',
  ],
  'Decision Analysis': [
    'make-or-buy', 'make or buy', 'relevant cost', 'sunk', 'breakeven', 'break-even',
    'break even', 'contribution margin', 'special order', 'incremental', 'shutdown',
  ],
  'Enterprise Risk Management': [
    'risk', 'erm', 'insurance', 'hedg', 'mitigat', 'avoid', 'retain', 'transfer', 'interrupt',
  ],
  'Financial Statement Analysis': [
    'ratio', 'quick', 'acid-test', 'acid test', 'current ratio', 'liquidity', 'solvency',
    'return on', 'margin', 'turnover', 'eps', 'dilut',
  ],
  'Investment Decisions': [
    'npv', 'irr', 'payback', 'capital budgeting', 'investment', 'hurdle', 'discount rate',
    'present value', 'annuity', 'depreciation tax',
  ],
  'Professional Ethics': [
    'ethic', 'ima', 'integrity', 'confidential', 'competence', 'credibility', 'conflict of interest',
  ],
};

type Msg = { role: 'user' | 'ai'; text: string; drill?: BankQ; closest?: boolean };

function pickDrill(bank: BankQ[], section: string, excludeId?: string): BankQ | undefined {
  const pool = bank.filter((q) => q.section === section && q.id !== excludeId);
  const src = pool.length > 0 ? pool : bank.filter((q) => q.section === section);
  return src[Math.floor(Math.random() * src.length)];
}

function findSection(text: string): string | null {
  const t = text.toLowerCase();
  let best: string | null = null;
  let bestScore = 0;
  for (const [section, keywords] of Object.entries(SECTION_KEYWORDS)) {
    let score = 0;
    for (const k of keywords) {
      if (t.includes(k)) score += k.length > 6 ? 2 : 1;
    }
    if (t.includes(section.toLowerCase())) score += 4;
    if (score > bestScore) {
      bestScore = score;
      best = section;
    }
  }
  return bestScore >= 2 ? best : null;
}

function findClosestQuestion(bank: BankQ[], text: string): BankQ | null {
  const tokens = text.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
  if (tokens.length === 0) return null;
  let best: BankQ | null = null;
  let bestScore = 0;
  for (const q of bank) {
    const hay = (q.question_text + ' ' + q.section).toLowerCase();
    const score = tokens.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = q;
    }
  }
  return bestScore >= 2 ? best : null;
}

function DrillCard({ q, onResult }: { q: BankQ; onResult: (correct: boolean) => void }) {
  const [picked, setPicked] = useState<string | null>(null);

  const opts: [string, string][] = [
    ['A', q.option_a],
    ['B', q.option_b],
    ['C', q.option_c],
    ['D', q.option_d],
  ];

  return (
    <div className="mt-4 rounded-2xl bg-[var(--card)] p-4 t-ink shadow-[inset_0_0_0_1.5px_var(--line)]">
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] t-faint">
        From your live bank · {q.part} · {q.section}
      </p>
      <p className="mt-2 text-sm font-semibold leading-snug">{q.question_text}</p>
      <div className="mt-3 space-y-2">
        {opts.map(([letter, body]) => {
          const isCorrect = letter === q.correct_answer;
          const isPicked = picked === letter;
          let cls = 'border-transparent bg-[var(--paper)] shadow-[inset_0_0_0_1.5px_var(--line)] hover:border-[var(--ink)]';
          if (picked) {
            if (isCorrect) cls = 'border-transparent bg-[#e7fec7] text-[#21221f]';
            else if (isPicked) cls = 'border-transparent bg-[#ea4467]/15 text-[#ea4467] shadow-[inset_0_0_0_1.5px_#ea4467]';
            else cls = 'border-transparent bg-[var(--paper)] opacity-50 shadow-[inset_0_0_0_1.5px_var(--line)]';
          }
          return (
            <button
              key={letter + body}
              disabled={!!picked}
              onClick={() => {
                setPicked(letter);
                onResult(isCorrect);
              }}
              className={`flex w-full items-start gap-2.5 rounded-xl border-[1.5px] px-3 py-2.5 text-left text-xs font-medium leading-snug transition-all ${cls}`}
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[0.6rem] font-bold text-[var(--paper)]">
                {letter}
              </span>
              <span>{body}</span>
            </button>
          );
        })}
      </div>
      {picked && (
        <p className="mt-3 text-[0.7rem] font-bold">
          {picked === q.correct_answer ? (
            <span className="text-[#5a7d1f]">Correct — bank answer is {q.correct_answer}.</span>
          ) : (
            <span className="text-[#ea4467]">
              Not quite — the bank marks {q.correct_answer}: {opts.find(([l]) => l === q.correct_answer)?.[1]}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

export default function AIDeck() {
  const [bank, setBank] = useState<BankQ[]>([]);
  const [bankLive, setBankLive] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: 'ai',
      text: 'Hey — I\u2019m your CMA US mentor. I answer from your live question bank: every explanation is paired with a real banked exam question. Ask about any topic, or tap a drill below.',
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [drillStats, setDrillStats] = useState({ asked: 0, correct: 0 });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pins = useDeckPins();

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('mcq_questions')
      .select('id, part, section, question_text, option_a, option_b, option_c, option_d, correct_answer')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && Array.isArray(data) && data.length > 0) {
          setBank(data as BankQ[]);
          setBankLive(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sections = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of bank) map.set(q.section, (map.get(q.section) ?? 0) + 1);
    return [...map.entries()];
  }, [bank]);

  const chips = useMemo(() => {
    if (sections.length === 0) return ['Walk me through after-tax cost of debt', 'Explain variance analysis', 'Summarize internal controls'];
    const pool = [...sections];
    const out: string[] = [];
    while (out.length < Math.min(3, pool.length)) {
      const i = Math.floor(Math.random() * pool.length);
      out.push(`Drill me: ${pool.splice(i, 1)[0][0]}`);
    }
    return out;
  }, [sections]);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs]);

  const answerFor = (text: string): { full: string; drill?: BankQ; closest?: boolean } => {
    const pinHit = text.toLowerCase().startsWith('summarise my pinned') || text.toLowerCase().startsWith('summarize my pinned');
    if (pinHit) {
      return {
        full: `Here's your pinned stack, priority-ordered for revision: ${pins
          .map((p) => `\u201c${p.title}\u201d (${p.kind.toLowerCase()})`)
          .join(', ')}. Suggested order: hit the formula sheets first while your head is fresh, then the cheatsheets as rapid-fire recall, and close with the study visuals — they're memory anchors, not reading material. Want a drill from the bank to lock one of these in?`,
      };
    }

    const section = findSection(text);
    if (section) {
      const note = SECTION_NOTES[section];
      const drill = bankLive ? pickDrill(bank, section) : undefined;
      return {
        full: `${note.note}\n\n\u26a0\ufe0e Trap: ${note.trap}`,
        drill,
      };
    }

    const closest = bankLive ? findClosestQuestion(bank, text) : null;
    if (closest) {
      return {
        full: `I don't have a full mentor note on that yet, but your live bank has a directly related question — try it and we'll talk through the answer.`,
        drill: closest,
        closest: true,
      };
    }

    const coverage = sections.length
      ? sections.map(([s, n]) => `${s} (${n})`).join(' · ')
      : 'Part 1 and Part 2 syllabus notes';
    return {
      full: `Good question — that's outside what I can ground tightly right now. Here's what I can coach you on from the live material: ${coverage}. Tap a drill above or name one of those topics and I'll teach it with a real bank question.`,
    };
  };

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);
    setMsgs((m) => [...m, { role: 'user', text }]);

    const { full, drill, closest } = answerFor(text);

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
          copy[copy.length - 1] = { role: 'ai', text: full, drill, closest };
          return copy;
        });
        setBusy(false);
      }
    }, 18);
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
              <p className="text-xs t-faint">
                Grounded in your live bank{bankLive ? ` · mcq_questions` : ' · syllabus notes'}
              </p>
            </div>
            <span className="ml-auto rounded-full bg-[#e7fec7] px-3 py-1 text-xs font-bold text-[#21221f]">
              {bankLive ? `${bank.length} questions banked` : 'syllabus notes'}
            </span>
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
                  {m.role === 'ai' && m.drill && !busy && (
                    <DrillCard
                      key={m.drill.id + i}
                      q={m.drill}
                      onResult={(ok) =>
                        setDrillStats((s) => ({ asked: s.asked + 1, correct: s.correct + (ok ? 1 : 0) }))
                      }
                    />
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
                  onClick={() => send(c.replace(/^Drill me: /, 'Teach me '))}
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
            <h2 className="slab-display mt-2 text-2xl">Every answer ships with a real exam question.</h2>
            <p className="mt-3 text-sm leading-relaxed opacity-85">
              The mentor teaches from your live bank — each explanation ends in a banked MCQ you can
              answer on the spot, with the bank's official answer.
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
            <p className="eyebrow t-faint">Live from Supabase</p>
            <ul className="mt-4 space-y-3 text-sm">
              {[
                ['Questions in bank', bankLive ? String(bank.length) : '—'],
                ['Sections covered', bankLive ? String(sections.length) : '—'],
                ['Your drill score', drillStats.asked > 0 ? `${drillStats.correct}/${drillStats.asked}` : '—'],
              ].map(([k, v]) => (
                <li key={k} className="flex items-center justify-between border-b b-line pb-3 last:border-0 last:pb-0">
                  <span className="t-muted">{k}</span>
                  <span className="font-slab text-lg font-bold t-ink">{v}</span>
                </li>
              ))}
            </ul>
            {bankLive && (
              <p className="mt-4 text-[0.65rem] leading-relaxed t-faint">
                Table: mcq_questions · {sections.length} sections across Parts 1 &amp; 2, refreshed on load.
              </p>
            )}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
