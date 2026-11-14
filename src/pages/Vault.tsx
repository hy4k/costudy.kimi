import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import AppShell from '@/components/app/AppShell';
import { DoodleBook, DoodleBulb } from '@/components/Doodles';
import { useDeckPins, togglePin, isPinned } from '@/lib/deckStore';
import { useAuth } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';
import {
  loadEngagements, setVouch, recordView, useEngagementLive,
  vouchTier, type EngageCounts,
} from '@/lib/engagements';

type Kind = 'CHEATSHEET' | 'FORMULA' | 'NOTES' | 'PAST PAPER' | 'MOCK' | 'VISUAL';

type Resource = {
  id: string;
  title: string;
  kind: Kind;
  author: string;
  downloads: number;
  verified: boolean;
  tags: string[];
  summary: string;
  url?: string | null;
  live?: boolean;
  /* community trust layer */
  vouches: number;
  views: number;
  vouched?: boolean;
  comments: number;
};

const kindMeta: Record<Kind, { label: string; tone: string; ink: string }> = {
  CHEATSHEET: { label: 'CHEATSHEET', tone: 'var(--mint)', ink: 'var(--ink)' },
  FORMULA: { label: 'FORMULA SHEET', tone: '#d9e6f3', ink: 'var(--ink)' },
  NOTES: { label: 'SUMMARY NOTES', tone: '#c6b3a2', ink: 'var(--ink)' },
  'PAST PAPER': { label: 'PAST PAPER', tone: '#f3f1ee', ink: 'var(--ink)' },
  MOCK: { label: 'MOCK TEST', tone: 'var(--coral)', ink: '#ffffff' },
  VISUAL: { label: 'STUDY VISUAL', tone: '#2b2926', ink: '#fcfbfa' },
};

const KIND_ALIASES: Record<string, Kind> = {
  pdf: 'NOTES', notes: 'NOTES', cheatsheet: 'CHEATSHEET', formula: 'FORMULA', formulas: 'FORMULA',
  'past paper': 'PAST PAPER', past_paper: 'PAST PAPER', mock: 'MOCK', 'mock test': 'MOCK',
  visual: 'VISUAL', link: 'NOTES', doc: 'NOTES', sheet: 'CHEATSHEET',
};

const toKind = (raw?: string | null): Kind => {
  if (!raw) return 'NOTES';
  const alias = KIND_ALIASES[raw.toLowerCase()];
  if (alias) return alias;
  const up = raw.toUpperCase();
  return (Object.keys(kindMeta) as string[]).includes(up) ? (up as Kind) : 'NOTES';
};

/* Curated starter shelf — shown only until live rows exist. */
const seed: Resource[] = [
  { id: 'variance-cheatsheet', title: 'Variance Analysis — one-pager', kind: 'CHEATSHEET', author: 'Sarah Jenkins', downloads: 1240, verified: true, tags: ['#variance', '#performance-mgmt'], summary: 'Every split with a worked mini-example. Print it, then throw it away.', vouches: 12, views: 0, comments: 0 },
  { id: 'cost-of-capital-formulas', title: 'Cost of Capital — formula sheet', kind: 'FORMULA', author: 'Prof. Vikram Sethi', downloads: 986, verified: true, tags: ['#wacc', '#capital-budgeting'], summary: "WACC builds, kd(1−T), CAPM and the examiner's favourite traps.", vouches: 9, views: 0, comments: 0 },
  { id: 'internal-controls-notes', title: 'Internal Controls — summary notes', kind: 'NOTES', author: 'Dr. Anita Desai', downloads: 874, verified: true, tags: ['#coso', '#crime', '#controls'], summary: 'The five COSO components with SOX attestations, in six pages.', vouches: 7, views: 0, comments: 0 },
  { id: 'p2-nov-paper', title: 'Part 2 — past paper walkthrough', kind: 'PAST PAPER', author: 'Faculty Lounge', downloads: 2130, verified: true, tags: ['#part2', '#past-paper'], summary: 'Last sitting, fully worked with time-per-question annotations.', vouches: 15, views: 0, comments: 0 },
  { id: 'p1-mock-5', title: 'Part 1 Mock 5 — full timed set', kind: 'MOCK', author: 'CoStudy Mock Engine', downloads: 3412, verified: true, tags: ['#mock', '#part1', '#timed'], summary: 'Closest match to the real exam difficulty this season. 4 hrs.', vouches: 21, views: 0, comments: 0 },
  { id: 'fx-translation-visual', title: 'FX translation — study visual', kind: 'VISUAL', author: 'Candidate #8842', downloads: 655, verified: true, tags: ['#fx', '#translation'], summary: 'One diagram for when to divide vs multiply. Ends the confusion.', vouches: 6, views: 0, comments: 0 },
  { id: 'responsibility-centres-notes', title: 'Responsibility Centres — notes', kind: 'NOTES', author: 'Rohan Sharma', downloads: 231, verified: false, tags: ['#centres', '#needs-review'], summary: 'Draft summary — pending faculty quality check. Read critically.', vouches: 0, views: 0, comments: 0 },
  { id: 'npv-vs-payback-visual', title: 'NPV vs payback — visual explainer', kind: 'VISUAL', author: 'Midhun', downloads: 189, verified: false, tags: ['#capital-budgeting', '#fresh'], summary: 'Three panels: time value, reinvestment, risk. Community upload.', vouches: 2, views: 0, comments: 0 },
];

const kinds: (Kind | 'ALL')[] = ['ALL', 'CHEATSHEET', 'FORMULA', 'NOTES', 'PAST PAPER', 'MOCK', 'VISUAL'];

type DbLibraryItem = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  file_url: string | null;
  file_type: string | null;
  created_at: string;
  uploader?: { name?: string } | null;
};

type DbContentSource = {
  id: string;
  name: string;
  external_ref: string | null;
  metadata: { description?: string; kind?: string; submitted_by?: string } | null;
  created_at: string;
};

type ResComment = {
  id: string;
  author: string;
  initials: string;
  body: string;
  time: string;
};

type DbResComment = {
  id: string;
  resource_id?: string;
  content?: string;
  created_at?: string;
  author?: { name?: string } | null;
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

const mapDbComment = (row: DbResComment): ResComment => {
  const name = row.author?.name || 'CMA Aspirant';
  return {
    id: row.id,
    author: name,
    initials: initialsOf(name),
    body: row.content || '',
    time: relTime(row.created_at),
  };
};

export default function Vault() {
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<(typeof kinds)[number]>('ALL');
  const [live, setLive] = useState<Resource[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', kind: 'NOTES' as Kind, description: '', url: '' });
  const [eng, setEng] = useState<EngageCounts>({ vouches: {}, views: {}, mine: new Set() });
  const [seedVouch, setSeedVouch] = useState<Record<string, boolean>>({});
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [threads, setThreads] = useState<Record<string, { items: ResComment[]; loaded: boolean }>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentBusy, setCommentBusy] = useState<string | null>(null);
  const pins = useDeckPins();
  const [, force] = useState(0);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const base = (partial: Partial<Resource>): Resource =>
    ({
      downloads: 0,
      vouches: 0,
      views: 0,
      comments: 0,
      ...partial,
    }) as Resource;

  // live shelves: verified = library_items, pending = community uploads in content_sources
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase
        .from('library_items')
        .select('id, title, description, category, file_url, file_type, created_at, uploader:user_profiles(name)')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('content_sources')
        .select('id, name, external_ref, metadata, created_at')
        .eq('source_kind', 'community_upload')
        .order('created_at', { ascending: false })
        .limit(50),
    ]).then(([lib, src]) => {
      if (cancelled) return;
      const verified = ((lib.data as DbLibraryItem[]) || []).map((r) => base({
        id: `lib-${r.id}`,
        title: r.title,
        kind: toKind(r.file_type || r.category),
        author: r.uploader?.name || 'CoStudy Faculty',
        verified: true,
        tags: r.category ? [r.category.toLowerCase().replace(/\s+/g, '-').replace(/^/, '#')] : [],
        summary: r.description || '',
        url: r.file_url,
        live: true,
      }));
      const pending = ((src.data as DbContentSource[]) || []).map((r) => base({
        id: `src-${r.id}`,
        title: r.name,
        kind: toKind(r.metadata?.kind),
        author: r.metadata?.submitted_by || 'Community upload',
        verified: false,
        tags: ['#community'],
        summary: r.metadata?.description || 'Awaiting faculty quality check.',
        url: r.external_ref,
        live: true,
      }));
      setLive([...verified, ...pending]);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // community layer — vouches, views, comment counts (re-runs once the profile resolves)
  const liveIds = useMemo(() => live.map((r) => r.id), [live]);
  useEffect(() => {
    if (liveIds.length === 0) return;
    let cancelled = false;
    loadEngagements('vault', liveIds, profile?.id).then((counts) => {
      if (!cancelled) setEng(counts);
    });
    supabase
      .from('resource_comments')
      .select('resource_id')
      .eq('resource_type', 'vault')
      .in('resource_id', liveIds)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const counts: Record<string, number> = {};
        (data as { resource_id: string }[]).forEach((r) => {
          counts[r.resource_id] = (counts[r.resource_id] || 0) + 1;
        });
        setLive((l) => l.map((r) => (counts[r.id] !== undefined ? { ...r, comments: counts[r.id] } : r)));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveIds.join(','), profile?.id]);

  // realtime — vouches and views tick live across the campus
  useEngagementLive('vault', ({ event, resource_id, user_id, kind }) => {
    if (user_id && user_id === profileRef.current?.id) return; // own clicks already applied
    setEng((e) => {
      const vouches = { ...e.vouches };
      const views = { ...e.views };
      const delta = event === 'INSERT' ? 1 : -1;
      if (kind === 'vouch') vouches[resource_id] = Math.max(0, (vouches[resource_id] || 0) + delta);
      if (kind === 'view') views[resource_id] = Math.max(0, (views[resource_id] || 0) + delta);
      return { ...e, vouches, views };
    });
  });

  // realtime — new discussion notes land instantly
  useEffect(() => {
    const channel = supabase
      .channel('vault-resource-comments')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'resource_comments' }, (payload) => {
        const row = payload.new as DbResComment;
        if (!row.resource_id) return;
        setLive((l) => l.map((r) => (r.id === row.resource_id ? { ...r, comments: r.comments + 1 } : r)));
        if (openThread === row.resource_id) {
          supabase
            .from('resource_comments')
            .select('*, author:user_profiles(name)')
            .eq('id', row.id)
            .maybeSingle()
            .then(({ data }) => {
              if (!data) return;
              const c = mapDbComment(data as DbResComment);
              setThreads((t) => {
                const cur = t[row.resource_id!];
                if (!cur || cur.items.some((x) => x.id === c.id)) return t;
                return { ...t, [row.resource_id!]: { items: [...cur.items, c], loaded: true } };
              });
            });
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [openThread]);

  const resources = live.length > 0 ? live : seed;
  const usingSeeds = live.length === 0;

  const decorate = (r: Resource): Resource =>
    r.live
      ? { ...r, vouches: eng.vouches[r.id] || 0, views: eng.views[r.id] || 0, vouched: eng.mine.has(r.id) }
      : { ...r, vouched: !!seedVouch[r.id], vouches: r.vouches + (seedVouch[r.id] ? 1 : 0) };

  const visible = useMemo(() => {
    const q = query.toLowerCase();
    return resources
      .map(decorate)
      .filter(
        (r) =>
          (kind === 'ALL' || r.kind === kind) &&
          (!q || (r.title + r.author + r.tags.join(' ') + r.summary).toLowerCase().includes(q)),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, kind, resources, eng, seedVouch]);

  const shelf = visible.filter((r) => r.verified);
  const review = visible.filter((r) => !r.verified);

  const toggleVouch = (r: Resource) => {
    if (r.live && profile) {
      const now = eng.mine.has(r.id);
      setEng((e) => {
        const mine = new Set(e.mine);
        const vouches = { ...e.vouches };
        if (now) {
          mine.delete(r.id);
          vouches[r.id] = Math.max(0, (vouches[r.id] || 0) - 1);
        } else {
          mine.add(r.id);
          vouches[r.id] = (vouches[r.id] || 0) + 1;
        }
        return { ...e, mine, vouches };
      });
      setVouch('vault', r.id, profile.id, !now);
    } else if (!r.live) {
      setSeedVouch((s) => ({ ...s, [r.id]: !s[r.id] }));
    }
  };

  const toggleThread = (r: Resource) => {
    if (r.live && profile) recordView('vault', r.id, profile.id);
    setOpenThread((cur) => (cur === r.id ? null : r.id));
    const cached = threads[r.id];
    if (r.live && !cached?.loaded) {
      supabase
        .from('resource_comments')
        .select('*, author:user_profiles(name)')
        .eq('resource_type', 'vault')
        .eq('resource_id', r.id)
        .order('created_at', { ascending: true })
        .limit(100)
        .then(({ data }) => {
          setThreads((t) => ({ ...t, [r.id]: { items: ((data as DbResComment[]) || []).map(mapDbComment), loaded: true } }));
        });
    }
  };

  const publishComment = async (r: Resource) => {
    const text = (commentDrafts[r.id] || '').trim();
    if (!text || commentBusy || !profile || !r.live) return;
    setCommentBusy(r.id);
    const { data, error } = await supabase
      .from('resource_comments')
      .insert([{ resource_type: 'vault', resource_id: r.id, author_id: profile.id, content: text }])
      .select('*, author:user_profiles(name)');
    setCommentBusy(null);
    if (error || !data) return;
    const c = mapDbComment(data[0] as DbResComment);
    setThreads((t) => {
      const cur = t[r.id] || { items: [], loaded: true };
      return { ...t, [r.id]: { items: [...cur.items, c], loaded: true } };
    });
    setLive((l) => l.map((x) => (x.id === r.id ? { ...x, comments: x.comments + 1 } : x)));
    setCommentDrafts((d) => ({ ...d, [r.id]: '' }));
  };

  const submit = async () => {
    if (!form.title.trim() || submitBusy) return;
    setSubmitBusy(true);
    setSubmitMsg(null);
    const { data, error } = await supabase
      .from('content_sources')
      .insert([{
        source_kind: 'community_upload',
        name: form.title.trim(),
        external_ref: form.url.trim() || null,
        metadata: {
          description: form.description.trim(),
          kind: form.kind,
          submitted_by: profile?.name || 'Student',
        },
      }])
      .select('id, name, external_ref, metadata, created_at');
    setSubmitBusy(false);
    if (error || !data) {
      setSubmitMsg(error?.message || 'Submission failed — try again.');
      return;
    }
    const row = data[0] as DbContentSource;
    setLive((l) => [
      ...l,
      base({
        id: `src-${row.id}`,
        title: row.name,
        kind: toKind(row.metadata?.kind),
        author: row.metadata?.submitted_by || 'Community upload',
        verified: false,
        tags: ['#community'],
        summary: row.metadata?.description || 'Awaiting faculty quality check.',
        url: row.external_ref,
        live: true,
      }),
    ]);
    setSubmitMsg('Submitted — it now sits in pending review. Thank you.');
    setForm({ title: '', kind: 'NOTES', description: '', url: '' });
  };

  const renderCard = (r: Resource, inReview: boolean) => {
    const meta = kindMeta[r.kind];
    const pinned = isPinned(r.id);
    const tier = vouchTier(r.vouches);
    const title = (
      <h3 className="slab-display mt-3 text-lg leading-snug t-ink">{r.title}</h3>
    );
    return (
      <article
        key={r.id}
        className={`flex min-h-[190px] flex-col justify-between gap-5 rounded-[1.4rem] border-[1.5px] p-6 transition-transform duration-500 ease-out-soft hover:-translate-y-1 ${
          inReview ? 'border-dashed b-line bg-[var(--card)]' : 'b-line bg-[var(--card)]'
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[0.6rem] font-bold tracking-widest"
              style={{ backgroundColor: meta.tone, color: meta.ink }}
            >
              {meta.label}
            </span>
            {r.verified ? (
              <span className="ml-auto flex items-center gap-1 text-[0.6rem] font-bold tracking-widest text-[#6f9c3e]">
                ✓ VERIFIED
              </span>
            ) : (
              <span className="ml-auto text-[0.6rem] font-bold tracking-widest t-faint">
                PENDING REVIEW
              </span>
            )}
          </div>
          {r.url ? (
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                if (r.live && profile) recordView('vault', r.id, profile.id);
              }}
              className="block"
            >
              {title}
            </a>
          ) : (
            title
          )}
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed t-muted">{r.summary}</p>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.65rem] font-bold tracking-widest t-faint">
            <span className="truncate">{r.author}</span>
            {r.downloads > 0 && <span>· {r.downloads.toLocaleString()} pulls</span>}
            <span>· 👁 {r.views} {r.views === 1 ? 'watch' : 'watches'}</span>
            {tier && (
              <span className="rounded-full bg-[var(--mint)] px-2 py-0.5 text-[0.6rem] font-bold tracking-widest text-[var(--ink)]">
                {tier.toUpperCase()}
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t b-line pt-4">
            {profile ? (
              <button
                onClick={() => toggleVouch(r)}
                aria-pressed={r.vouched}
                className={`flex items-center gap-1.5 rounded-full border-[1.5px] px-3.5 py-1.5 text-xs font-bold transition-all duration-300 ${
                  r.vouched
                    ? 'border-[var(--mint)] bg-[var(--mint)] text-[var(--ink)]'
                    : 'b-line t-muted hover:t-ink hover:border-[var(--ink)]'
                }`}
              >
                ✓ Vouch ({r.vouches})
              </button>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 rounded-full border-[1.5px] b-line px-3.5 py-1.5 text-xs font-bold t-muted hover:t-ink"
              >
                ✓ Vouch ({r.vouches})
              </Link>
            )}
            {r.live && (
              <button
                onClick={() => toggleThread(r)}
                aria-expanded={openThread === r.id}
                className={`flex items-center gap-1.5 rounded-full border-[1.5px] px-3.5 py-1.5 text-xs font-bold transition-all duration-300 ${
                  openThread === r.id ? 'b-line t-ink' : 'b-line t-muted hover:t-ink'
                }`}
              >
                💬 Discussion ({r.comments}) {openThread === r.id ? '▴' : '▾'}
              </button>
            )}
            <button
              onClick={() => {
                togglePin({ id: r.id, title: r.title, kind: meta.label, tone: meta.tone });
                force((v) => v + 1);
              }}
              className={`ml-auto shrink-0 rounded-full border-[1.5px] px-3.5 py-1.5 text-xs font-bold transition-all duration-300 ${
                pinned
                  ? 'border-[var(--ink)] bg-[var(--coal)] text-[#f3ede3]'
                  : 'b-line t-muted hover:t-ink hover:border-[var(--ink)]'
              }`}
              aria-pressed={pinned}
            >
              {pinned ? 'Pinned ✓' : 'Pin to Deck'}
            </button>
          </div>

          {/* discussion — corrections & questions from the campus */}
          {r.live && openThread === r.id && (
            <div className="mt-4 rounded-xl bg-[var(--paper)] p-4 shadow-[inset_0_0_0_1.5px_var(--line)]">
              {(threads[r.id]?.items.length ?? 0) === 0 ? (
                <p className="text-xs t-faint">
                  {threads[r.id]?.loaded ? 'No notes yet — spot an error? Say so here.' : 'Loading discussion…'}
                </p>
              ) : (
                <ul className="space-y-3">
                  {threads[r.id].items.map((c) => (
                    <li key={c.id} className="flex items-start gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--cloud)] font-slab text-[0.65rem] font-bold text-[var(--ink)]">
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
                    value={commentDrafts[r.id] || ''}
                    onChange={(e) => setCommentDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        publishComment(r);
                      }
                    }}
                    placeholder="Note a correction or ask about this material…"
                    className="min-w-0 flex-1 rounded-full border-[1.5px] b-line bg-[var(--card)] px-4 py-2 text-xs t-ink placeholder:t-faint focus:border-[var(--coral)] focus:outline-none"
                  />
                  <button
                    onClick={() => publishComment(r)}
                    disabled={!(commentDrafts[r.id] || '').trim() || commentBusy === r.id}
                    className="rounded-full bg-[var(--coral)] px-4 py-2 text-xs font-bold text-white transition-opacity disabled:opacity-40"
                  >
                    {commentBusy === r.id ? '…' : 'Post'}
                  </button>
                </div>
              ) : (
                <p className="mt-4 border-t b-line pt-4 text-xs t-faint">
                  <Link to="/login" className="font-bold text-[var(--coral)]">Log in</Link> to join the discussion.
                </p>
              )}
            </div>
          )}
        </div>
      </article>
    );
  };

  return (
    <AppShell eyebrow="The knowledge vault" title="Library Vault">
      {usingSeeds && loaded && (
        <p className="mb-8 rounded-xl border-[1.5px] border-dashed b-line px-4 py-3 text-xs font-semibold t-muted">
          Showing the starter shelf — faculty-published items and community submissions appear here as they land.
        </p>
      )}

      <div className="grid gap-10 xl:grid-cols-[1.7fr_1fr]">
        <div className="min-w-0">
          {/* search + filters */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your knowledge vault…"
              className="w-full max-w-sm rounded-full border-[1.5px] b-line bg-[var(--card)] px-5 py-2.5 text-sm t-ink placeholder:t-faint focus:border-[var(--coral)] focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              {kinds.map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`rounded-full border-[1.5px] px-3.5 py-2 text-[0.65rem] font-bold tracking-widest transition-all duration-300 ${
                    kind === k
                      ? 'border-[var(--coral)] bg-[var(--coral)] text-white'
                      : 'b-line t-muted hover:t-ink hover:border-[var(--ink)]'
                  }`}
                >
                  {k === 'ALL' ? 'ALL' : kindMeta[k].label}
                </button>
              ))}
            </div>
          </div>

          {/* the verified shelf */}
          <div className="mt-10 flex items-baseline gap-3">
            <h2 className="slab-display text-xl t-ink">The verified shelf</h2>
            <span className="text-[0.65rem] font-bold tracking-widest t-faint">{shelf.length} QUALITY-CHECKED</span>
          </div>
          <p className="mt-1 text-xs t-faint">Faculty-reviewed material — vouched by the campus, discussed in the open.</p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {shelf.map((r) => renderCard(r, false))}
          </div>

          {/* community review queue */}
          {review.length > 0 && (
            <>
              <div className="mt-12 flex items-baseline gap-3">
                <h2 className="slab-display text-xl t-ink">In community review</h2>
                <span className="text-[0.65rem] font-bold tracking-widest t-faint">{review.length} AWAITING FACULTY</span>
              </div>
              <p className="mt-1 text-xs t-faint">
                Fresh uploads from the campus. Read them critically — your vouches tell faculty what deserves the shelf.
              </p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {review.map((r) => renderCard(r, true))}
              </div>
            </>
          )}

          {visible.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm t-faint">
              Nothing in the vault matches “{query}”.
            </p>
          )}
        </div>

        {/* pinned rail */}
        <aside className="space-y-5">
          <section className="rounded-[1.6rem] bg-[var(--coral)] p-6 text-white">
            <div className="flex items-center gap-2">
              <DoodleBulb className="h-5 w-5" />
              <p className="eyebrow opacity-80">Pinned to AI Deck</p>
            </div>
            <p className="slab-display mt-3 text-3xl">
              {pins.length} {pins.length === 1 ? 'resource' : 'resources'}
            </p>
            <p className="mt-2 text-sm leading-relaxed opacity-85">
              Pinned items ride along to the AI Deck — ask the mentor to summarise or quiz you on them.
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
                      style={{ backgroundColor: p.tone, color: 'var(--ink)' }}
                    >
                      {p.kind.split(' ')[0]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold t-ink">{p.title}</span>
                    <button
                      onClick={() => {
                        togglePin(p);
                        force((v) => v + 1);
                      }}
                      className="text-xs font-bold t-faint transition-colors hover:text-[var(--coral)]"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* submit to the vault */}
          <section className="rounded-[1.6rem] bg-[var(--mint)] p-6 text-[var(--ink)]">
            <div className="flex items-center gap-2">
              <DoodleBook className="h-5 w-5" />
              <h2 className="slab-display text-xl">Share to the vault</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed opacity-80">
              Uploads enter <strong>pending review</strong> — the campus reads, vouches and discusses them while faculty quality-checks.
            </p>
            {profile ? (
              <>
                <button
                  onClick={() => setShowSubmit((s) => !s)}
                  className="mt-4 w-full rounded-full border-[1.5px] border-[var(--ink)]/40 py-2.5 text-xs font-bold tracking-widest transition-colors hover:bg-[var(--coal)] hover:text-[#f3ede3]"
                >
                  {showSubmit ? 'CANCEL' : 'SUBMIT MATERIAL'}
                </button>
                {showSubmit && (
                  <div className="mt-4 space-y-3">
                    <input
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="Title — e.g. Variance Analysis one-pager"
                      className="w-full rounded-xl border-[1.5px] b-line bg-[var(--card)] px-4 py-2.5 text-sm placeholder:t-faint focus:border-[var(--coral)] focus:outline-none"
                    />
                    <select
                      value={form.kind}
                      onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as Kind }))}
                      className="w-full rounded-xl border-[1.5px] b-line bg-[var(--card)] px-4 py-2.5 text-sm focus:border-[var(--coral)] focus:outline-none"
                    >
                      {(Object.keys(kindMeta) as Kind[]).map((k) => (
                        <option key={k} value={k}>{kindMeta[k].label}</option>
                      ))}
                    </select>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      rows={2}
                      placeholder="One-line summary for fellow scholars…"
                      className="w-full resize-none rounded-xl border-[1.5px] b-line bg-[var(--card)] px-4 py-2.5 text-sm placeholder:t-faint focus:border-[var(--coral)] focus:outline-none"
                    />
                    <input
                      value={form.url}
                      onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                      placeholder="Link (optional) — https://…"
                      className="w-full rounded-xl border-[1.5px] b-line bg-[var(--card)] px-4 py-2.5 text-sm placeholder:t-faint focus:border-[var(--coral)] focus:outline-none"
                    />
                    {submitMsg && <p className="text-xs font-bold">{submitMsg}</p>}
                    <button
                      onClick={submit}
                      disabled={!form.title.trim() || submitBusy}
                      className="w-full rounded-full bg-[var(--coal)] py-2.5 text-xs font-bold tracking-widest text-[#f3ede3] transition-opacity disabled:opacity-40"
                    >
                      {submitBusy ? 'SUBMITTING…' : 'SEND FOR REVIEW'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <Link
                to="/login"
                className="mt-4 block w-full rounded-full border-[1.5px] border-[var(--ink)]/40 py-2.5 text-center text-xs font-bold tracking-widest transition-colors hover:bg-[var(--coal)] hover:text-[#f3ede3]"
              >
                LOG IN TO SUBMIT
              </Link>
            )}
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
