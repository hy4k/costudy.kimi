import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import AppShell from '@/components/app/AppShell';
import { DoodleBook, DoodleBulb, DoodleNote, DoodlePeople, DoodleSpark } from '@/components/Doodles';
import { useAuth } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';

type Broadcast = {
  id: string;
  content: string;
  type: string;
  likes: number;
  created_at: string;
};

type QueueItem = {
  id: string;
  name: string;
  external_ref: string | null;
  metadata: { description?: string; kind?: string; submitted_by?: string } | null;
  created_at: string;
};

type CbqMine = {
  id: string;
  title: string;
  part: string;
  section: string | null;
  status: string;
  created_at: string;
};

type CbqItemDraft = {
  question_text: string;
  A: string;
  B: string;
  C: string;
  D: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
};

const emptyCbqItem = (): CbqItemDraft => ({
  question_text: '',
  A: '',
  B: '',
  C: '',
  D: '',
  correct_answer: 'A',
  explanation: '',
});

const relTime = (iso: string) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function Mentor() {
  const navigate = useNavigate();
  const { ready, profile, signOut } = useAuth();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<Broadcast[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueLoaded, setQueueLoaded] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  // CBQ intake + review
  const [cbqPart, setCbqPart] = useState<'Part 1' | 'Part 2'>('Part 1');
  const [cbqSection, setCbqSection] = useState('');
  const [cbqTitle, setCbqTitle] = useState('');
  const [cbqText, setCbqText] = useState('');
  const [cbqItems, setCbqItems] = useState<CbqItemDraft[]>([emptyCbqItem(), emptyCbqItem(), emptyCbqItem()]);
  const [cbqBusy, setCbqBusy] = useState(false);
  const [cbqMsg, setCbqMsg] = useState<string | null>(null);
  const [cbqMine, setCbqMine] = useState<CbqMine[]>([]);
  const [cbqPending, setCbqPending] = useState<CbqMine[]>([]);

  const loadCbq = () => {
    if (!profile) return;
    supabase
      .from('cbq_scenarios')
      .select('id, title, part, section, status, submitted_by, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        const all = (data as (CbqMine & { submitted_by: string | null })[]) || [];
        setCbqMine(
          all
            .filter((s) => s.submitted_by === profile.id)
            .map(({ submitted_by: _sb, ...rest }) => rest),
        );
        setCbqPending(
          all
            .filter((s) => s.status === 'pending' && s.submitted_by !== profile.id)
            .map(({ submitted_by: _sb, ...rest }) => rest),
        );
      });
  };

  useEffect(() => {
    if (ready && profile && profile.role !== 'TEACHER') navigate('/wall', { replace: true });
  }, [ready, profile, navigate]);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('posts')
      .select('id, content, type, likes, created_at')
      .eq('author_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setMine((data as Broadcast[]) || []));
    supabase
      .from('content_sources')
      .select('id, name, external_ref, metadata, created_at')
      .eq('source_kind', 'community_upload')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setQueue((data as QueueItem[]) || []);
        setQueueLoaded(true);
      });
    loadCbq();
  }, [profile]);

  if (!ready || !profile) {
    return (
      <AppShell eyebrow="Faculty room" title="Mentor cockpit">
        <section className="max-w-lg rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-8">
          <p className="slab-display text-2xl t-ink">This room needs a mentor key.</p>
          <p className="mt-3 text-sm leading-relaxed t-muted">
            Sign in with a mentor account to broadcast to the faculty wall, or head back to the commons.
          </p>
          <Link to="/login" className="pill-btn mt-6 inline-block !px-6 !py-3 text-sm">
            Log in as mentor
          </Link>
        </section>
      </AppShell>
    );
  }

  const broadcast = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('posts')
      .insert([{ author_id: profile.id, content: text, type: 'RESOURCE', tags: ['#faculty'], likes: 0 }])
      .select('id, content, type, likes, created_at');
    setBusy(false);
    if (err || !data) {
      setError(err?.message || 'Broadcast failed — try again.');
      return;
    }
    setMine((m) => [data[0] as Broadcast, ...m]);
    setDraft('');
  };

  const removeFromQueue = (id: string) => setQueue((q) => q.filter((x) => x.id !== id));

  const approve = async (item: QueueItem) => {
    if (reviewing) return;
    setReviewing(item.id);
    setReviewMsg(null);
    // promote to the verified shelf
    const { error: insErr } = await supabase.from('library_items').insert([{
      title: item.name,
      description: item.metadata?.description || null,
      category: item.metadata?.kind || null,
      file_url: item.external_ref,
      file_type: item.metadata?.kind || null,
      uploaded_by: profile!.id,
    }]);
    if (insErr) {
      setReviewing(null);
      setReviewMsg(`Approve failed: ${insErr.message}`);
      return;
    }
    // clear the pending row
    const { error: delErr } = await supabase.from('content_sources').delete().eq('id', item.id);
    setReviewing(null);
    if (delErr) {
      setReviewMsg(`Published to the vault, but clearing the queue failed: ${delErr.message}`);
      return;
    }
    removeFromQueue(item.id);
    setReviewMsg(`“${item.name}” is now on the verified shelf.`);
  };

  const reject = async (item: QueueItem) => {
    if (reviewing) return;
    setReviewing(item.id);
    setReviewMsg(null);
    const { error } = await supabase.from('content_sources').delete().eq('id', item.id);
    setReviewing(null);
    if (error) {
      setReviewMsg(`Reject failed: ${error.message}`);
      return;
    }
    removeFromQueue(item.id);
    setReviewMsg(`“${item.name}” was rejected and removed from the queue.`);
  };

  // --- CBQ intake + review -------------------------------------------------
  const updateCbqItem = (i: number, patch: Partial<CbqItemDraft>) =>
    setCbqItems((items) => items.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  const submitCbq = async () => {
    if (cbqBusy) return;
    const items = cbqItems.filter((it) => it.question_text.trim() && it.A.trim() && it.B.trim());
    if (!cbqTitle.trim() || !cbqText.trim() || items.length === 0) {
      setCbqMsg('A case needs a title, the scenario passage, and at least one complete item.');
      return;
    }
    setCbqBusy(true);
    setCbqMsg(null);
    const { data: sc, error: scErr } = await supabase
      .from('cbq_scenarios')
      .insert([
        {
          part: cbqPart,
          section: cbqSection.trim() || null,
          title: cbqTitle.trim(),
          scenario_text: cbqText.trim(),
          submitted_by: profile!.id,
        },
      ])
      .select('id');
    if (scErr || !sc || !sc[0]) {
      setCbqBusy(false);
      setCbqMsg(`Submit failed: ${scErr?.message || 'no row returned'}`);
      return;
    }
    const scenarioId = sc[0].id as string;
    const { error: itErr } = await supabase.from('cbq_items').insert(
      items.map((it, i) => ({
        scenario_id: scenarioId,
        question_text: it.question_text.trim(),
        options: { A: it.A.trim(), B: it.B.trim(), C: it.C.trim(), D: it.D.trim() },
        correct_answer: it.correct_answer,
        explanation: it.explanation.trim() || null,
        sort_order: i + 1,
      })),
    );
    setCbqBusy(false);
    if (itErr) {
      setCbqMsg(`Scenario saved, but items failed: ${itErr.message}`);
      return;
    }
    setCbqTitle('');
    setCbqSection('');
    setCbqText('');
    setCbqItems([emptyCbqItem(), emptyCbqItem(), emptyCbqItem()]);
    setCbqMsg(`“${cbqTitle.trim()}” is in the pending queue — a faculty peer approves it before students see it.`);
    loadCbq();
  };

  const reviewCbq = async (s: CbqMine, status: 'approved' | 'rejected') => {
    if (reviewing) return;
    setReviewing(s.id);
    setCbqMsg(null);
    const { error } = await supabase.from('cbq_scenarios').update({ status }).eq('id', s.id);
    setReviewing(null);
    if (error) {
      setCbqMsg(`Review failed: ${error.message}`);
      return;
    }
    setCbqMsg(
      status === 'approved'
        ? `“${s.title}” approved — it's live on the AI Deck CBQ track.`
        : `“${s.title}” rejected and hidden from the track.`,
    );
    loadCbq();
  };

  return (
    <AppShell eyebrow="The faculty room" title={`${profile.name.split(' ')[0]}'s cockpit`}>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {/* broadcast composer */}
          <section className="rounded-[1.6rem] bg-[#2b2926] p-6 text-[#fcfbfa] md:p-8">
            <div className="flex items-center gap-2">
              <DoodleSpark className="h-5 w-5 text-[#e7fec7]" />
              <p className="eyebrow text-[#e7fec7]">Broadcast to the wall</p>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder="Post a note, a bounty, a correction — the whole campus hears it…"
              className="mt-4 w-full resize-none rounded-xl border-[1.5px] border-[#fcfbfa]/25 bg-[#fcfbfa]/10 p-4 text-sm text-[#fcfbfa] placeholder:text-[#fcfbfa]/50 focus:border-[#e7fec7] focus:outline-none"
            />
            {error && <p className="mt-3 rounded-lg bg-[#ea4467]/25 px-3 py-2 text-xs font-semibold">{error}</p>}
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-[#fcfbfa]/60">Broadcasts land on the Study Wall as FACULTY.</p>
              <button
                onClick={broadcast}
                disabled={!draft.trim() || busy}
                className="rounded-full bg-[#e7fec7] px-5 py-2.5 text-sm font-bold text-[#21221f] transition-opacity disabled:opacity-40"
              >
                {busy ? 'Sending…' : 'Broadcast'}
              </button>
            </div>
          </section>

          {/* CBQ case intake */}
          <section className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <DoodleNote className="h-5 w-5 t-muted" />
                <h2 className="slab-display text-2xl t-ink">CBQ case intake</h2>
              </div>
              <span className="rounded-full bg-[#e7fec7] px-3 py-1 text-[0.65rem] font-bold tracking-widest text-[#21221f]">
                {cbqMine.length} MINE · {cbqPending.length} AWAITING REVIEW
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed t-faint">
              Case-based questions land in the AI Deck as scenario + linked items. Submissions stay
              pending until another faculty member approves them — the same verified-shelf rule as the vault.
            </p>
            {cbqMsg && (
              <p className="mt-4 rounded-xl border-[1.5px] border-dashed b-line px-4 py-3 text-xs font-semibold t-muted">{cbqMsg}</p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr]">
              <select
                value={cbqPart}
                onChange={(e) => setCbqPart(e.target.value as 'Part 1' | 'Part 2')}
                className="rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-3 py-2.5 text-sm t-ink focus:border-[var(--ink)] focus:outline-none"
              >
                <option>Part 1</option>
                <option>Part 2</option>
              </select>
              <input
                value={cbqSection}
                onChange={(e) => setCbqSection(e.target.value)}
                placeholder="Syllabus area — e.g. Internal Controls, Decision Analysis"
                className="rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-3 py-2.5 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
              />
            </div>
            <input
              value={cbqTitle}
              onChange={(e) => setCbqTitle(e.target.value)}
              placeholder="Case title — the hook students see"
              className="mt-3 w-full rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-3 py-2.5 text-sm font-semibold t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
            />
            <textarea
              value={cbqText}
              onChange={(e) => setCbqText(e.target.value)}
              rows={4}
              placeholder="The scenario passage — the company, the numbers, the tension. Everything the items refer back to…"
              className="mt-3 w-full resize-y rounded-xl border-[1.5px] b-line bg-[var(--paper)] p-3 text-sm leading-relaxed t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
            />
            <div className="mt-4 space-y-3">
              {cbqItems.map((it, i) => (
                <div key={i} className="rounded-xl bg-[var(--paper)] p-4 shadow-[inset_0_0_0_1.5px_var(--line)]">
                  <div className="flex items-center justify-between">
                    <p className="text-[0.65rem] font-bold tracking-widest t-faint">ITEM {i + 1}</p>
                    {cbqItems.length > 1 && (
                      <button
                        onClick={() => setCbqItems((items) => items.filter((_, j) => j !== i))}
                        className="text-xs font-bold t-faint transition-colors hover:text-[#ea4467]"
                      >
                        remove
                      </button>
                    )}
                  </div>
                  <input
                    value={it.question_text}
                    onChange={(e) => updateCbqItem(i, { question_text: e.target.value })}
                    placeholder="Question stem"
                    className="mt-2 w-full rounded-lg border-[1.5px] b-line bg-[var(--card)] px-3 py-2 text-xs font-medium t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
                  />
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {(['A', 'B', 'C', 'D'] as const).map((l) => (
                      <input
                        key={l}
                        value={it[l]}
                        onChange={(e) => updateCbqItem(i, { [l]: e.target.value })}
                        placeholder={`Option ${l}`}
                        className="rounded-lg border-[1.5px] b-line bg-[var(--card)] px-3 py-2 text-xs t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={it.correct_answer}
                      onChange={(e) => updateCbqItem(i, { correct_answer: e.target.value as CbqItemDraft['correct_answer'] })}
                      className="rounded-lg border-[1.5px] b-line bg-[var(--card)] px-2.5 py-2 text-xs font-bold t-ink focus:border-[var(--ink)] focus:outline-none"
                    >
                      {['A', 'B', 'C', 'D'].map((l) => (
                        <option key={l} value={l}>Answer {l}</option>
                      ))}
                    </select>
                    <input
                      value={it.explanation}
                      onChange={(e) => updateCbqItem(i, { explanation: e.target.value })}
                      placeholder="Worked explanation (unlocks after answering)"
                      className="min-w-0 flex-1 rounded-lg border-[1.5px] b-line bg-[var(--card)] px-3 py-2 text-xs t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={() => setCbqItems((items) => [...items, emptyCbqItem()])}
                className="rounded-full border-[1.5px] border-dashed b-line px-4 py-2 text-xs font-bold t-muted transition-colors hover:t-ink hover:border-[var(--ink)]"
              >
                + Add another item
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs t-faint">Students never see pending cases — approve peers' work to grow the track.</p>
              <button
                onClick={submitCbq}
                disabled={cbqBusy}
                className="rounded-full bg-[#2b2926] px-5 py-2.5 text-sm font-bold text-[#fcfbfa] transition-opacity disabled:opacity-40"
              >
                {cbqBusy ? 'Submitting…' : 'Submit for review'}
              </button>
            </div>
            {cbqMine.length > 0 && (
              <ul className="mt-5 space-y-2 border-t b-line pt-4">
                {cbqMine.slice(0, 5).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="min-w-0 flex-1 truncate font-semibold t-ink">{s.title}</span>
                    <span className="shrink-0 font-bold tracking-widest t-faint">{s.part.toUpperCase()}{s.section ? ` · ${s.section}` : ''}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-bold ${
                        s.status === 'approved'
                          ? 'bg-[#e7fec7] text-[#21221f]'
                          : s.status === 'rejected'
                            ? 'bg-[#ea4467]/15 text-[#ea4467]'
                            : 'b-line t-muted'
                      }`}
                    >
                      {s.status.toUpperCase()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* CBQ review queue */}
          {cbqPending.length > 0 && (
            <section className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-6 md:p-8">
              <div className="flex items-center gap-2">
                <DoodleBook className="h-5 w-5 t-muted" />
                <h2 className="slab-display text-2xl t-ink">CBQ review queue</h2>
              </div>
              <ul className="mt-5 space-y-3">
                {cbqPending.map((s) => (
                  <li key={s.id} className="rounded-xl bg-[var(--paper)] p-4 shadow-[inset_0_0_0_1.5px_var(--line)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold t-ink">{s.title}</p>
                        <p className="mt-1 text-[0.65rem] font-bold tracking-widest t-faint">
                          {s.part.toUpperCase()}{s.section ? ` · ${s.section}` : ''} · {relTime(s.created_at)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => reviewCbq(s, 'approved')}
                          disabled={reviewing === s.id}
                          className="rounded-full bg-[#6f9c3e] px-4 py-2 text-xs font-bold text-white transition-opacity disabled:opacity-40"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => reviewCbq(s, 'rejected')}
                          disabled={reviewing === s.id}
                          className="rounded-full border-[1.5px] border-[#ea4467] px-4 py-2 text-xs font-bold text-[#ea4467] transition-opacity disabled:opacity-40"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* vault review queue */}
          <section className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <DoodleBook className="h-5 w-5 t-muted" />
                <h2 className="slab-display text-2xl t-ink">Vault review queue</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-[0.65rem] font-bold tracking-widest ${queue.length > 0 ? 'bg-[#ea4467] text-white' : 'b-line t-faint'}`}>
                {queue.length} AWAITING
              </span>
            </div>
            {reviewMsg && (
              <p className="mt-4 rounded-xl border-[1.5px] border-dashed b-line px-4 py-3 text-xs font-semibold t-muted">{reviewMsg}</p>
            )}
            {!queueLoaded ? (
              <p className="mt-4 text-sm t-faint">Loading the queue…</p>
            ) : queue.length === 0 ? (
              <p className="mt-4 text-sm t-faint">
                The review queue is clear — community submissions will appear here the moment students share to the vault.
              </p>
            ) : (
              <ul className="mt-5 space-y-3">
                {queue.map((item) => (
                  <li key={item.id} className="rounded-xl bg-[var(--paper)] p-4 shadow-[inset_0_0_0_1.5px_var(--line)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold t-ink">{item.name}</p>
                        <p className="mt-1 text-xs leading-relaxed t-muted">
                          {item.metadata?.description || 'No summary provided.'}
                        </p>
                        <p className="mt-1.5 text-[0.65rem] font-bold tracking-widest t-faint">
                          {item.metadata?.kind?.toUpperCase() || 'NOTES'} · by {item.metadata?.submitted_by || 'Community'} · {relTime(item.created_at)}
                        </p>
                        {item.external_ref && (
                          <a href={item.external_ref} target="_blank" rel="noreferrer" className="link-underline mt-1 inline-block text-xs font-semibold text-[#ea4467]">
                            Open link ↗
                          </a>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => approve(item)}
                          disabled={reviewing === item.id}
                          className="rounded-full bg-[#6f9c3e] px-4 py-2 text-xs font-bold text-white transition-opacity disabled:opacity-40"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => reject(item)}
                          disabled={reviewing === item.id}
                          className="rounded-full border-[1.5px] border-[#ea4467] px-4 py-2 text-xs font-bold text-[#ea4467] transition-opacity disabled:opacity-40"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* recent broadcasts */}
          <section className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-6 md:p-8">
            <h2 className="slab-display text-2xl t-ink">Your recent broadcasts</h2>
            {mine.length === 0 ? (
              <p className="mt-4 text-sm t-faint">
                Silence so far. Your first broadcast appears here and on the Study Wall at once.
              </p>
            ) : (
              <ul className="mt-5 space-y-3">
                {mine.map((b) => (
                  <li key={b.id} className="rounded-xl bg-[var(--paper)] p-4 shadow-[inset_0_0_0_1.5px_var(--line)]">
                    <p className="line-clamp-2 text-sm font-medium t-ink">{b.content}</p>
                    <p className="mt-1.5 text-[0.65rem] font-bold tracking-widest t-faint">
                      {b.type} · ▲ {b.likes} · {relTime(b.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* right rail */}
        <aside className="space-y-4">
          <section className="rounded-[1.6rem] bg-[#e7fec7] p-6 text-[#21221f]">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2b2926] font-slab text-sm font-bold text-[#fcfbfa]">
                {profile.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
              </span>
              <div>
                <p className="slab-display text-xl">{profile.name}</p>
                <p className="text-xs font-bold tracking-widest opacity-70">FACULTY · {profile.level}</p>
              </div>
            </div>
            <ul className="mt-5 space-y-2.5 text-sm font-medium">
              <li className="flex justify-between border-b border-[#21221f]/15 pb-2"><span>Focus</span><span className="font-slab font-bold">{profile.examFocus}</span></li>
              <li className="flex justify-between border-b border-[#21221f]/15 pb-2"><span>Reputation</span><span className="font-slab font-bold">{profile.reputation}</span></li>
              <li className="flex justify-between"><span>Broadcasts</span><span className="font-slab font-bold">{mine.length}</span></li>
            </ul>
            <button
              onClick={() => signOut().then(() => navigate('/'))}
              className="mt-5 w-full rounded-full border-[1.5px] border-[#21221f]/30 py-2 text-xs font-bold tracking-widest transition-colors hover:bg-[#21221f] hover:text-[#e7fec7]"
            >
              Sign out
            </button>
          </section>

          <section className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-6">
            <div className="flex items-center gap-2">
              <DoodleBulb className="h-5 w-5 t-muted" />
              <h2 className="slab-display text-xl t-ink">Mentor moves</h2>
            </div>
            <ul className="mt-4 space-y-3 text-sm t-muted">
              <li className="flex gap-2.5"><DoodleNote className="h-4 w-4 mt-0.5 shrink-0" /> Broadcasts post as FACULTY-tagged posts on the shared wall.</li>
              <li className="flex gap-2.5"><DoodlePeople className="h-4 w-4 mt-0.5 shrink-0" /> Students answering your threads appear on the Study Wall feed.</li>
            </ul>
            <Link to="/wall" className="link-underline mt-5 inline-block text-xs font-bold tracking-widest t-ink">
              VIEW THE WALL →
            </Link>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
