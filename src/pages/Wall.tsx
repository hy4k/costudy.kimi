import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import AppShell from '@/components/app/AppShell';
import { DoodleBubble, DoodleSpark } from '@/components/Doodles';
import SupabaseStatus from '@/components/app/SupabaseStatus';
import { useAuth } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';

type PostType = 'QUESTION' | 'RESOURCE' | 'MCQ' | 'AUDIT' | 'BOUNTY' | 'DISCUSS' | 'EVENT' | 'GOAL';

type Post = {
  id: string;
  type: PostType;
  author: string;
  initials: string;
  level: 'LEARNER' | 'SCHOLAR' | 'EXPERT';
  role: 'STUDENT' | 'TEACHER';
  time: string;
  body: string;
  tags: string[];
  likes: number;
  liked?: boolean;
  saved?: boolean;
  comments: number;
  live?: boolean;
  mcq?: { q: string; options: string[]; answer: number; why: string };
};

type WallComment = {
  id: string;
  author: string;
  initials: string;
  body: string;
  time: string;
};

type DbComment = {
  id: string;
  post_id?: string;
  content?: string;
  created_at?: string;
  author?: { name?: string } | null;
};

type DbPost = {
  id: string;
  type?: string;
  content?: string;
  tags?: string[] | null;
  likes?: number | null;
  created_at?: string;
  author_id?: string;
  author?: { name?: string; role?: string; level?: string } | null;
  comments?: { count: number }[];
};

const mapDbComment = (row: DbComment): WallComment => {
  const name = row.author?.name || 'CMA Aspirant';
  return {
    id: row.id,
    author: name,
    initials: initialsOf(name),
    body: row.content || '',
    time: relTime(row.created_at),
  };
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

const initialsOf = (name: string) =>
  name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'A';

const relTime = (iso?: string) => {
  if (!iso) return 'just now';
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const levelMap: Record<string, Post['level']> = {
  STARTER: 'LEARNER', LEARNER: 'LEARNER', SCHOLAR: 'SCHOLAR', EXPERT: 'EXPERT', MENTOR: 'EXPERT',
};

const mapDbPost = (row: DbPost): Post => {
  const type = (Object.keys(typeMeta) as string[]).includes(row.type || '') ? (row.type as PostType) : 'DISCUSS';
  const name = row.author?.name || 'CMA Aspirant';
  return {
    id: row.id,
    type,
    author: name,
    initials: initialsOf(name),
    level: levelMap[(row.author?.level || '').toUpperCase()] || 'LEARNER',
    role: (row.author?.role || '').toUpperCase() === 'TEACHER' ? 'TEACHER' : 'STUDENT',
    time: relTime(row.created_at),
    body: row.content || '',
    tags: row.tags || [],
    likes: row.likes ?? 0,
    comments: row.comments?.[0]?.count ?? 0,
    live: true,
  };
};

/* Starter posts — shown only until real broadcasts hit the wall. */
const seed: Post[] = [
  {
    id: 'seed-1', type: 'MCQ', author: 'Rohan Sharma', initials: 'RS', level: 'LEARNER', role: 'STUDENT',
    time: 'starter',
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
    id: 'seed-2', type: 'DISCUSS', author: 'Dr. Anita Desai', initials: 'AD', level: 'EXPERT', role: 'TEACHER',
    time: 'starter',
    body: 'Colleagues, regarding the recent changes to Part 2 — the new emphasis on data analytics ethics means rote memorisation of the IMA statement is no longer enough. Expect scenario prompts. Discuss how you are adapting your revision.',
    tags: ['#part2', '#ethics', '#faculty'],
    likes: 41, comments: 12,
  },
  {
    id: 'seed-3', type: 'GOAL', author: 'Priya Nair', initials: 'PN', level: 'SCHOLAR', role: 'STUDENT',
    time: 'starter',
    body: 'Goal banked: “Complete Section A MCQs with 80% accuracy.” Landed 84%. The trick was drilling flexible-budget mechanics until the splits felt automatic — not memorising formulas, seeing the logic. Onto Section B.',
    tags: ['#goal', '#streak', '#part1'],
    likes: 33, comments: 8,
  },
];

const RADAR_KEY = 'costudy-wall-radar';

const loadRadar = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(RADAR_KEY) || '[]') as string[]);
  } catch {
    return new Set();
  }
};

export default function Wall() {
  const { profile } = useAuth();
  const [live, setLive] = useState<Post[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftType, setDraftType] = useState<PostType>('QUESTION');
  const [mcqPicked, setMcqPicked] = useState<Record<string, number>>({});
  const [radarIds, setRadarIds] = useState<Set<string>>(loadRadar);
  const [publishing, setPublishing] = useState(false);
  const [pubError, setPubError] = useState<string | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [threads, setThreads] = useState<Record<string, { items: WallComment[]; loaded: boolean }>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentBusy, setCommentBusy] = useState<string | null>(null);

  // initial load from the live `posts` table
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('posts')
      .select('*, author:user_profiles(name, role, level), comments(count)')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (cancelled) return;
        setLive(((data as DbPost[]) || []).map(mapDbPost));
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // realtime — new broadcasts and thread replies appear instantly
  useEffect(() => {
    const channel = supabase
      .channel('wall-posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
        const row = payload.new as DbPost;
        supabase
          .from('posts')
          .select('*, author:user_profiles(name, role, level), comments(count)')
          .eq('id', row.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) setLive((l) => (l.some((p) => p.id === (data as DbPost).id) ? l : [mapDbPost(data as DbPost), ...l]));
          });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, (payload) => {
        const row = payload.new as DbComment;
        if (!row.post_id) return;
        setLive((l) => l.map((p) => (p.id === row.post_id ? { ...p, comments: p.comments + 1 } : p)));
        if (openThread === row.post_id) {
          supabase
            .from('comments')
            .select('*, author:user_profiles(name)')
            .eq('id', row.id)
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                const c = mapDbComment(data as DbComment);
                setThreads((t) => {
                  const cur = t[row.post_id!];
                  if (!cur || cur.items.some((x) => x.id === c.id)) return t;
                  return { ...t, [row.post_id!]: { items: [...cur.items, c], loaded: true } };
                });
              }
            });
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [openThread]);

  const toggleRadar = (p: Post) => {
    setRadarIds((prev) => {
      const next = new Set(prev);
      if (next.has(p.id)) next.delete(p.id);
      else next.add(p.id);
      localStorage.setItem(RADAR_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const posts = (live.length > 0 ? live : seed).map((p) => ({ ...p, saved: radarIds.has(p.id) }));
  const usingSeeds = live.length === 0;
  const radar = posts.filter((p) => p.saved);

  const mutate = (id: string, fn: (p: Post) => Post) =>
    setLive((ps) => ps.map((p) => (p.id === id ? fn(p) : p)));

  const toggleLike = (p: Post) => {
    if (p.live) {
      const next = p.liked ? p.likes - 1 : p.likes + 1;
      mutate(p.id, (x) => ({ ...x, liked: !x.liked, likes: next }));
      supabase.from('posts').update({ likes: next }).eq('id', p.id).then(() => {});
    } else {
      mutate(p.id, (x) => ({ ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) }));
    }
  };

  const publish = async () => {
    const text = draft.trim();
    if (!text || publishing || !profile) return;
    setPublishing(true);
    setPubError(null);
    const { data, error } = await supabase
      .from('posts')
      .insert([{ author_id: profile.id, content: text, type: draftType, tags: ['#fresh'], likes: 0 }])
      .select('*, author:user_profiles(name, role, level)');
    setPublishing(false);
    if (error || !data) {
      setPubError(error?.message || 'Broadcast failed — try again.');
      return;
    }
    setLive((l) => [mapDbPost(data[0] as DbPost), ...l]);
    setDraft('');
  };

  const toggleThread = (postId: string) => {
    setOpenThread((cur) => (cur === postId ? null : postId));
    const cached = threads[postId];
    if (!cached?.loaded) {
      supabase
        .from('comments')
        .select('*, author:user_profiles(name)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
        .limit(100)
        .then(({ data }) => {
          setThreads((t) => ({ ...t, [postId]: { items: ((data as DbComment[]) || []).map(mapDbComment), loaded: true } }));
        });
    }
  };

  const publishComment = async (postId: string) => {
    const text = (commentDrafts[postId] || '').trim();
    if (!text || commentBusy || !profile) return;
    setCommentBusy(postId);
    const { data, error } = await supabase
      .from('comments')
      .insert([{ post_id: postId, author_id: profile.id, content: text }])
      .select('*, author:user_profiles(name)');
    setCommentBusy(null);
    if (error || !data) return;
    const c = mapDbComment(data[0] as DbComment);
    setThreads((t) => {
      const cur = t[postId] || { items: [], loaded: true };
      return { ...t, [postId]: { items: [...cur.items, c], loaded: true } };
    });
    setLive((l) => l.map((p) => (p.id === postId ? { ...p, comments: p.comments + 1 } : p)));
    setCommentDrafts((d) => ({ ...d, [postId]: '' }));
  };

  return (
    <AppShell eyebrow="The commons, out loud" title="Study Wall">
      {/* composer — deliberately set apart from the three columns */}
      {profile ? (
        <section className="relative mb-8 overflow-hidden rounded-[1.6rem] bg-[#2b2926] p-6 text-[#fcfbfa] md:p-8">
          <DoodleSpark className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 text-[#e7fec7]/15" />
          <div className="flex items-center gap-2">
            <DoodleSpark className="h-5 w-5 text-[#e7fec7]" />
            <p className="eyebrow text-[#e7fec7]">Broadcast to the wall</p>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder={profile.role === 'TEACHER' ? 'Drop a note, bounty or correction for the whole campus…' : 'What strategic insight have you learned today?'}
            className="mt-4 w-full resize-none rounded-xl border-[1.5px] border-[#fcfbfa]/25 bg-[#fcfbfa]/10 p-4 text-sm text-[#fcfbfa] placeholder:text-[#fcfbfa]/50 focus:border-[#e7fec7] focus:outline-none"
          />
          {pubError && <p className="mt-3 rounded-lg bg-[#ea4467]/25 px-3 py-2 text-xs font-semibold">{pubError}</p>}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
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
            <button
              onClick={publish}
              disabled={!draft.trim() || publishing}
              className="rounded-full bg-[#e7fec7] px-5 py-2.5 text-sm font-bold text-[#21221f] transition-opacity disabled:opacity-40"
            >
              {publishing ? 'Broadcasting…' : 'Broadcast'}
            </button>
          </div>
        </section>
      ) : (
        <section className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-6">
          <div>
            <p className="slab-display text-xl t-ink">The wall is live — log in to broadcast.</p>
            <p className="mt-1 text-sm t-muted">Real posts from the campus flow here the moment they land.</p>
          </div>
          <Link to="/login" className="pill-btn !px-6 !py-3 text-sm">Log in to post</Link>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
        {/* feed column — the centre of gravity */}
        <div>
          {usingSeeds && loaded && (
            <p className="mb-4 rounded-xl border-[1.5px] border-dashed b-line px-4 py-3 text-xs font-semibold t-muted">
              Showing starter posts to set the tone — log in and broadcast the first real one.
            </p>
          )}
          <div className="space-y-4">
            {posts.map((p) => {
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
                            onClick={() => toggleLike(p)}
                            className={`flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-xs font-bold transition-all duration-300 ${
                              p.liked ? 'border-[#ea4467] bg-[#ea4467] text-white' : 'b-line t-muted hover:t-ink'
                            }`}
                            aria-pressed={p.liked}
                          >
                            ▲ {p.likes}
                          </button>
                          <button
                            onClick={() => toggleRadar(p)}
                            className={`flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-xs font-bold transition-all duration-300 ${
                              p.saved ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]' : 'b-line t-muted hover:t-ink'
                            }`}
                            aria-pressed={p.saved}
                          >
                            Radar {p.saved ? '✓' : '+'}
                          </button>
                          {p.live ? (
                            <button
                              onClick={() => toggleThread(p.id)}
                              aria-expanded={openThread === p.id}
                              className={`ml-1 rounded-full border-[1.5px] px-3 py-1.5 text-xs font-bold transition-all duration-300 ${
                                openThread === p.id ? 'b-line t-ink' : 'border-transparent t-faint hover:t-ink'
                              }`}
                            >
                              {p.comments} {p.comments === 1 ? 'reply' : 'replies'} {openThread === p.id ? '▴' : '▾'}
                            </button>
                          ) : (
                            p.comments > 0 && <span className="ml-1 text-xs t-faint">{p.comments} replies</span>
                          )}
                        </span>
                      </div>

                      {/* thread */}
                      {p.live && openThread === p.id && (
                        <div className="mt-4 rounded-xl bg-[var(--paper)] p-4 shadow-[inset_0_0_0_1.5px_var(--line)]">
                          {(threads[p.id]?.items.length ?? 0) === 0 ? (
                            <p className="text-xs t-faint">
                              {threads[p.id]?.loaded ? 'No replies yet — open the thread.' : 'Loading thread…'}
                            </p>
                          ) : (
                            <ul className="space-y-3">
                              {threads[p.id].items.map((c) => (
                                <li key={c.id} className="flex items-start gap-2.5">
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c6b3a2] font-slab text-[0.65rem] font-bold text-[#21221f]">
                                    {c.initials}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-xs t-ink">
                                      <strong>{c.author}</strong> <span className="t-faint">· {c.time}</span>
                                    </p>
                                    <p className="mt-0.5 text-sm leading-relaxed t-ink">{c.body}</p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}

                          {profile ? (
                            <div className="mt-4 flex gap-2 border-t b-line pt-4">
                              <input
                                value={commentDrafts[p.id] || ''}
                                onChange={(e) => setCommentDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    publishComment(p.id);
                                  }
                                }}
                                placeholder="Add to the thread…"
                                className="min-w-0 flex-1 rounded-full border-[1.5px] b-line bg-[var(--card)] px-4 py-2 text-xs t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
                              />
                              <button
                                onClick={() => publishComment(p.id)}
                                disabled={!(commentDrafts[p.id] || '').trim() || commentBusy === p.id}
                                className="rounded-full bg-[#ea4467] px-4 py-2 text-xs font-bold text-white transition-opacity disabled:opacity-40"
                              >
                                {commentBusy === p.id ? '…' : 'Reply'}
                              </button>
                            </div>
                          ) : (
                            <p className="mt-4 border-t b-line pt-4 text-xs t-faint">
                              <Link to="/login" className="font-bold text-[#ea4467]">Log in</Link> to join the thread.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
            {posts.length === 0 && (
              <p className="py-10 text-center text-sm t-faint">Nothing here yet — be the first broadcast.</p>
            )}
          </div>
        </div>

        {/* right rail — Radar+ only */}
        <aside className="space-y-4">
          <section className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DoodleBubble className="h-5 w-5 t-muted" />
                <h2 className="slab-display text-xl t-ink">Radar+</h2>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold tracking-widest ${radar.length > 0 ? 'bg-[#e7fec7] text-[#21221f]' : 'b-line t-faint'}`}>
                {radar.length} tracked
              </span>
            </div>
            {radar.length === 0 ? (
              <p className="text-sm leading-relaxed t-faint">
                Your silent track is empty. Bookmark any post with <strong className="t-muted">Radar +</strong> — it waits here without buzzing you.
              </p>
            ) : (
              <ul className="space-y-3">
                {radar.map((p) => (
                  <li key={p.id} className="rounded-xl bg-[var(--paper)] p-3 shadow-[inset_0_0_0_1.5px_var(--line)]">
                    <p className="line-clamp-2 text-xs font-medium leading-snug t-ink">{p.body}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <p className="text-[0.65rem] font-bold tracking-widest t-faint">{typeMeta[p.type].label} · {p.author}</p>
                      <button onClick={() => toggleRadar(p)} className="text-[0.65rem] font-bold tracking-widest t-faint hover:text-[#ea4467]">
                        RELEASE
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <SupabaseStatus />
        </aside>
      </div>
    </AppShell>
  );
}
