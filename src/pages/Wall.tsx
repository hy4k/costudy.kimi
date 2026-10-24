import { useMemo, useState } from 'react';
import AppShell from '@/components/app/AppShell';
import { DoodleBubble, DoodleSpark } from '@/components/Doodles';

type PostType = 'QUESTION' | 'RESOURCE' | 'MCQ' | 'AUDIT' | 'BOUNTY' | 'DISCUSS' | 'EVENT' | 'GOAL';

type Post = {
  id: number;
  type: PostType;
  author: string;
  initials: string;
  level: 'LEARNER' | 'SCHOLAR' | 'EXPERT';
  role: 'STUDENT' | 'TEACHER';
  signal: 'ACTIVE_SOLVER' | 'SILENT_LEARNER' | 'REVISION_FOCUSED';
  time: string;
  body: string;
  tags: string[];
  likes: number;
  liked?: boolean;
  saved?: boolean;
  comments: number;
  mcq?: { q: string; options: string[]; answer: number; why: string };
};

const typeMeta: Record<PostType, { label: string; tone: string; ink: string }> = {
  QUESTION: { label: 'QUESTION', tone: '#ea4467', ink: '#ffffff' },
  RESOURCE: { label: 'RESOURCE', tone: '#c6b3a2', ink: '#21221f' },
  MCQ: { label: 'MCQ SHARE', tone: '#d9e6f3', ink: '#21221f' },
  AUDIT: { label: 'PEER AUDIT', tone: '#e7fec7', ink: '#21221f' },
  BOUNTY: { label: 'BOUNTY', tone: '#2b2926', ink: '#fcfbfa' },
  DISCUSS: { label: 'DISCUSSION', tone: '#ea4467', ink: '#ffffff' },
  EVENT: { label: 'EVENT', tone: '#f3f1ee', ink: '#21221f' },
  GOAL: { label: 'GOAL', tone: '#e7fec7', ink: '#21221f' },
};

const seed: Post[] = [
  {
    id: 1, type: 'MCQ', author: 'Rohan Sharma', initials: 'RS', level: 'LEARNER', role: 'STUDENT', signal: 'ACTIVE_SOLVER',
    time: '18 min ago',
    body: 'Trapped on this one from the Performance Management bank — my gut says B, the answer key says otherwise. What am I missing?',
    tags: ['#variance', '#part1', '#mcq'],
    likes: 14, comments: 6,
    mcq: {
      q: 'A company sells a single product. Budget: 10,000 units @ $50. Actual: 12,000 units @ $48. The sales-volume variance is:',
      options: ['$96,000 F', '$100,000 F', '$20,000 F', '$24,000 U'],
      answer: 1,
      why: 'Volume variance = (AQ − BQ) × budgeted CM per unit = 2,000 × $50 = $100,000 F. Price belongs to the flexible-budget variance, not volume.',
    },
  },
  {
    id: 2, type: 'DISCUSS', author: 'Dr. Anita Desai', initials: 'AD', level: 'EXPERT', role: 'TEACHER', signal: 'ACTIVE_SOLVER',
    time: '1 hr ago',
    body: 'Colleagues, regarding the recent changes to Part 2 — the new emphasis on data analytics ethics means rote memorisation of the IMA statement is no longer enough. Expect scenario prompts. Discuss how you are adapting your revision.',
    tags: ['#part2', '#ethics', '#faculty'],
    likes: 41, comments: 12,
  },
  {
    id: 3, type: 'AUDIT', author: 'Candidate #8842', initials: 'C8', level: 'SCHOLAR', role: 'STUDENT', signal: 'ACTIVE_SOLVER',
    time: '2 hrs ago',
    body: 'Requesting a peer audit of my essay argument: “Responsibility centres should always be evaluated on controllable costs alone.” I argue this is incomplete — controllability is a spectrum, and dual-rate allocations exist precisely because some costs are partially controllable. Rip it apart, please.',
    tags: ['#essay-audit', '#responsibility-centres'],
    likes: 9, comments: 4,
  },
  {
    id: 4, type: 'BOUNTY', author: 'Prof. Vikram Sethi', initials: 'VS', level: 'EXPERT', role: 'TEACHER', signal: 'ACTIVE_SOLVER',
    time: '3 hrs ago',
    body: 'Bounty: 50 deck points to the clearest three-sentence explanation of why NPV dominates payback period for capital budgeting. Brevity wins. One entry per scholar.',
    tags: ['#capital-budgeting', '#bounty'],
    likes: 27, comments: 19,
  },
  {
    id: 5, type: 'GOAL', author: 'Priya Nair', initials: 'PN', level: 'SCHOLAR', role: 'STUDENT', signal: 'REVISION_FOCUSED',
    time: '5 hrs ago',
    body: 'Goal banked: “Complete Section A MCQs with 80% accuracy.” Landed 84%. The trick was drilling flexible-budget mechanics until the splits felt automatic — not memorising formulas, seeing the logic. Onto Section B.',
    tags: ['#goal', '#streak', '#part1'],
    likes: 33, comments: 8,
  },
  {
    id: 6, type: 'RESOURCE', author: 'Sarah Jenkins', initials: 'SJ', level: 'EXPERT', role: 'TEACHER', signal: 'ACTIVE_SOLVER',
    time: 'Yesterday',
    body: 'Posted my one-page variance analysis cheatsheet to the vault — every split with a worked mini-example. Grab it before your next mock. Print it, then throw it away: if you still need it on exam day, it did its job.',
    tags: ['#cheatsheet', '#variance', '#vault'],
    likes: 58, comments: 11,
  },
  {
    id: 7, type: 'EVENT', author: 'Midhun', initials: 'M', level: 'SCHOLAR', role: 'STUDENT', signal: 'ACTIVE_SOLVER',
    time: 'Yesterday',
    body: 'Mock marathon this Saturday: full timed Part 1 paper, 09:00 IST, in the “Final-review war room”. Cameras optional, suffering shared. Bring water.',
    tags: ['#mock-test', '#event', '#part1'],
    likes: 22, comments: 15,
  },
  {
    id: 8, type: 'QUESTION', author: 'Arjun Mehta', initials: 'AM', level: 'LEARNER', role: 'STUDENT', signal: 'SILENT_LEARNER',
    time: '2 days ago',
    body: 'When does the exam want dividing vs. multiplying a dollar variance by the exchange rate? I keep flipping translation adjustment direction. A rule of thumb would save my life.',
    tags: ['#fx', '#part2', '#help'],
    likes: 11, comments: 9,
  },
];

const categories = [
  { label: 'All Feed', match: null as PostType[] | null },
  { label: 'Audit Desk', match: ['AUDIT'] as PostType[] },
  { label: 'Bounty Board', match: ['BOUNTY'] as PostType[] },
  { label: 'Strategic Notes', match: ['RESOURCE', 'MCQ', 'GOAL'] as PostType[] },
  { label: 'Expert Q&A', match: ['QUESTION', 'DISCUSS'] as PostType[] },
];

const signalOptions = ['ACTIVE_SOLVER', 'SILENT_LEARNER', 'REVISION_FOCUSED', 'EXAM_WEEK'] as const;

const signalCopy: Record<string, string> = {
  ACTIVE_SOLVER: 'Open to protocols, bounties and DMs.',
  SILENT_LEARNER: 'Not accepting protocols. Watching quietly.',
  REVISION_FOCUSED: 'Deep revision mode — mentions muted.',
  EXAM_WEEK: 'Exam week. Signal intercepted for everything.',
};

export default function Wall() {
  const [posts, setPosts] = useState<Post[]>(seed);
  const [cat, setCat] = useState(0);
  const [draft, setDraft] = useState('');
  const [draftType, setDraftType] = useState<PostType>('QUESTION');
  const [signal, setSignal] = useState<(typeof signalOptions)[number]>('ACTIVE_SOLVER');
  const [mcqPicked, setMcqPicked] = useState<Record<number, number>>({});

  const visible = useMemo(() => {
    const m = categories[cat].match;
    return m ? posts.filter((p) => m.includes(p.type)) : posts;
  }, [cat, posts]);

  const mutate = (id: number, fn: (p: Post) => Post) =>
    setPosts((ps) => ps.map((p) => (p.id === id ? fn(p) : p)));

  const publish = () => {
    const text = draft.trim();
    if (!text) return;
    setPosts((ps) => [
      {
        id: Date.now(),
        type: draftType,
        author: 'Midhun',
        initials: 'M',
        level: 'SCHOLAR',
        role: 'STUDENT',
        signal: 'ACTIVE_SOLVER',
        time: 'just now',
        body: text,
        tags: ['#fresh'],
        likes: 0,
        comments: 0,
      },
      ...ps,
    ]);
    setDraft('');
    setCat(0);
  };

  const radar = posts.filter((p) => p.saved);

  return (
    <AppShell eyebrow="The commons, out loud" title="Study Wall">
      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        {/* feed column */}
        <div>
          {/* composer */}
          <section className="mb-6 rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-5 md:p-6">
            <label htmlFor="wall-draft" className="eyebrow t-faint">
              What strategic insight have you learned today?
            </label>
            <textarea
              id="wall-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="Share a thought…"
              className="mt-3 w-full resize-none rounded-xl border-[1.5px] b-line bg-[var(--paper)] p-4 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(typeMeta) as PostType[])
                  .filter((t) => ['QUESTION', 'RESOURCE', 'MCQ', 'AUDIT'].includes(t))
                  .map((t) => (
                    <button
                      key={t}
                      onClick={() => setDraftType(t)}
                      className={`rounded-full px-3.5 py-1.5 text-[0.65rem] font-bold tracking-widest transition-all duration-300 ${
                        draftType === t ? '' : 'opacity-45 hover:opacity-80'
                      }`}
                      style={{ backgroundColor: typeMeta[t].tone, color: typeMeta[t].ink }}
                    >
                      {typeMeta[t].label}
                    </button>
                  ))}
              </div>
              <button onClick={publish} disabled={!draft.trim()} className="pill-btn !px-5 !py-2.5 text-sm disabled:opacity-40">
                Broadcast
              </button>
            </div>
          </section>

          {/* categories */}
          <div className="mb-6 flex flex-wrap gap-2">
            {categories.map((c, i) => (
              <button
                key={c.label}
                onClick={() => setCat(i)}
                className={`rounded-full border-[1.5px] px-4 py-2 text-xs font-bold transition-all duration-300 ${
                  cat === i
                    ? 'border-[#ea4467] bg-[#ea4467] text-white'
                    : 'b-line t-muted hover:t-ink hover:border-[var(--ink)]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* posts */}
          <div className="space-y-4">
            {visible.map((p) => {
              const meta = typeMeta[p.type];
              const picked = mcqPicked[p.id];
              return (
                <article key={p.id} className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-6">
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-slab text-sm font-bold text-white"
                      style={{ backgroundColor: p.role === 'TEACHER' ? '#2b2926' : '#ea4467' }}
                    >
                      {p.initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-bold t-ink">{p.author}</span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[0.6rem] font-bold tracking-widest"
                          style={{ backgroundColor: meta.tone, color: meta.ink }}
                        >
                          {meta.label}
                        </span>
                        {p.role === 'TEACHER' && (
                          <span className="rounded-full bg-[#2b2926] px-2 py-0.5 text-[0.6rem] font-bold tracking-widest text-[#fcfbfa]">
                            FACULTY
                          </span>
                        )}
                        <span className="text-xs t-faint">
                          · {p.level} · {p.time}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed t-ink">{p.body}</p>

                      {/* MCQ block */}
                      {p.mcq && (
                        <div className="mt-4 rounded-xl bg-[var(--paper)] p-4 shadow-[inset_0_0_0_1.5px_var(--line)]">
                          <p className="text-sm font-semibold t-ink">{p.mcq.q}</p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {p.mcq.options.map((o, i) => {
                              const revealed = picked !== undefined;
                              const isRight = i === p.mcq!.answer;
                              const isPick = i === picked;
                              return (
                                <button
                                  key={i}
                                  onClick={() => setMcqPicked((m) => (m[p.id] !== undefined ? m : { ...m, [p.id]: i }))}
                                  disabled={revealed}
                                  className={`rounded-lg border-[1.5px] px-3 py-2 text-left text-xs font-semibold transition-all duration-300 ${
                                    revealed
                                      ? isRight
                                        ? 'border-[#6f9c3e] bg-[#e7fec7] text-[#21221f]'
                                        : isPick
                                          ? 'border-[#ea4467] bg-[#ea4467]/10 t-ink'
                                          : 'b-line t-faint'
                                      : 'b-line t-ink hover:border-[var(--ink)]'
                                  }`}
                                >
                                  {String.fromCharCode(65 + i)}. {o}
                                </button>
                              );
                            })}
                          </div>
                          {picked !== undefined && (
                            <p className="mt-3 border-t b-line pt-3 text-xs leading-relaxed t-muted">
                              <strong className="t-ink">{picked === p.mcq.answer ? 'Correct.' : `Answer key: ${String.fromCharCode(65 + p.mcq.answer)}.`}</strong>{' '}
                              {p.mcq.why}
                            </p>
                          )}
                        </div>
                      )}

                      {/* tags + actions */}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {p.tags.map((t) => (
                          <span key={t} className="text-xs font-semibold text-[#ea4467]">
                            {t}
                          </span>
                        ))}
                        <span className="ml-auto flex items-center gap-1">
                          <button
                            onClick={() =>
                              mutate(p.id, (x) => ({ ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) }))
                            }
                            className={`flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-xs font-bold transition-all duration-300 ${
                              p.liked ? 'border-[#ea4467] bg-[#ea4467] text-white' : 'b-line t-muted hover:t-ink'
                            }`}
                            aria-pressed={p.liked}
                          >
                            ▲ {p.likes}
                          </button>
                          <button
                            onClick={() => mutate(p.id, (x) => ({ ...x, saved: !x.saved }))}
                            className={`flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-xs font-bold transition-all duration-300 ${
                              p.saved ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]' : 'b-line t-muted hover:t-ink'
                            }`}
                            aria-pressed={p.saved}
                          >
                            Radar {p.saved ? '✓' : '+'}
                          </button>
                          <span className="ml-1 text-xs t-faint">{p.comments} replies</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
            {visible.length === 0 && (
              <p className="py-10 text-center text-sm t-faint">Nothing here yet — be the first broadcast.</p>
            )}
          </div>
        </div>

        {/* right rail */}
        <aside className="space-y-4">
          <section className="rounded-[1.6rem] bg-[#2b2926] p-6 text-[#fcfbfa]">
            <p className="eyebrow opacity-60">Your signal</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {signalOptions.map((s) => (
                <button
                  key={s}
                  onClick={() => setSignal(s)}
                  className={`rounded-full border px-3 py-1.5 text-[0.6rem] font-bold tracking-widest transition-all duration-300 ${
                    signal === s ? 'border-[#e7fec7] bg-[#e7fec7] text-[#21221f]' : 'border-[#fcfbfa]/30 text-[#fcfbfa]/70 hover:border-[#fcfbfa]'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
            <p className="mt-4 text-sm leading-relaxed opacity-75">{signalCopy[signal]}</p>
          </section>

          <section className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="slab-display text-xl t-ink">Academic Radar</h2>
              <DoodleBubble className="h-5 w-5 t-muted" />
            </div>
            {radar.length === 0 ? (
              <p className="text-sm t-faint">
                Your silent track is empty. Bookmark any post with <strong className="t-muted">Radar +</strong> — it waits here without buzzing you.
              </p>
            ) : (
              <ul className="space-y-3">
                {radar.map((p) => (
                  <li key={p.id} className="rounded-xl bg-[var(--paper)] p-3 shadow-[inset_0_0_0_1.5px_var(--line)]">
                    <p className="line-clamp-2 text-xs font-medium leading-snug t-ink">{p.body}</p>
                    <p className="mt-1.5 text-[0.65rem] font-bold tracking-widest t-faint">{typeMeta[p.type].label} · {p.author}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[1.6rem] bg-[#e7fec7] p-6 text-[#21221f]">
            <div className="flex items-center gap-2">
              <DoodleSpark className="h-5 w-5" />
              <h2 className="slab-display text-xl">Wall karma this week</h2>
            </div>
            <ul className="mt-4 space-y-2.5 text-sm font-medium">
              <li className="flex justify-between border-b border-[#21221f]/15 pb-2"><span>Audits given</span><span className="font-slab font-bold">3</span></li>
              <li className="flex justify-between border-b border-[#21221f]/15 pb-2"><span>Bounties won</span><span className="font-slab font-bold">1</span></li>
              <li className="flex justify-between"><span>Insights shared</span><span className="font-slab font-bold">7</span></li>
            </ul>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
