import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import AppShell from '@/components/app/AppShell';
import { DoodleClock, DoodlePeople, DoodleSpark } from '@/components/Doodles';
import { useAuth } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';

type Peer = { id: string; name: string | null; handle: string | null; avatar: string | null };

type Contract = {
  id: string;
  peer: Peer;
  purpose: string;
  duration: string;
  goal: string | null;
  streak: number;
  status: string;
  startDate: string;
  remaining: number;
  total: number;
  expired: boolean;
};

type RequestRow = {
  id: string;
  purpose: string;
  duration: string;
  note: string | null;
  created_at: string;
  direction: 'incoming' | 'outgoing';
  counterparty: Peer;
};

const durations = ['7 Days', '14 Days', '30 Days', 'Until Exam'] as const;

const purposes = [
  'Early-morning sprints',
  'MCQ drills',
  'CBQ case practice',
  'Mock review',
  'Formula grind',
  'Accountability check-ins',
];

const durationDays: Record<string, number> = {
  '7 Days': 7,
  '14 Days': 14,
  '30 Days': 30,
  'Until Exam': 90,
};

const inputCls =
  'mt-2 w-full rounded-xl border-[1.5px] b-line bg-[var(--card)] p-4 text-sm t-ink placeholder:t-faint focus:border-[var(--coral)] focus:outline-none';

const initialsOf = (name: string) =>
  name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'A';

export default function Contracts() {
  const { profile, ready } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);

  // new request form
  const [handleInput, setHandleInput] = useState('');
  const [foundPeer, setFoundPeer] = useState<Peer | null>(null);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [purpose, setPurpose] = useState(purposes[0]);
  const [duration, setDuration] = useState<(typeof durations)[number]>('7 Days');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const peersByIds = useCallback(async (ids: string[]) => {
    const uniq = [...new Set(ids)].filter(Boolean);
    if (uniq.length === 0) return new Map<string, Peer>();
    const { data } = await supabase.from('user_profiles').select('id, name, handle, avatar').in('id', uniq);
    const map = new Map<string, Peer>();
    ((data as Peer[]) || []).forEach((p) => map.set(p.id, p));
    return map;
  }, []);

  const load = useCallback(async () => {
    if (!profile) return;

    const [{ data: rows }, { data: reqs }] = await Promise.all([
      supabase
        .from('alignments')
        .select('id, peer_id, purpose, duration, goal, streak, status, start_date')
        .eq('user_id', profile.id)
        .in('status', ['ACTIVE', 'PAUSED'])
        .order('start_date', { ascending: false }),
      supabase
        .from('alignment_requests')
        .select('id, sender_id, receiver_id, purpose, duration, note, created_at')
        .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false }),
    ]);

    const peers = await peersByIds([
      ...((rows as { peer_id: string }[]) || []).map((r) => r.peer_id),
      ...((reqs as { sender_id: string; receiver_id: string }[]) || []).flatMap((r) => [r.sender_id, r.receiver_id]),
    ]);

    const now = Date.now();
    const list: Contract[] = ((rows as { id: string; peer_id: string; purpose: string; duration: string; goal: string | null; streak: number; status: string; start_date: string }[]) || []).map((r) => {
      const total = durationDays[r.duration] ?? 30;
      const elapsed = (now - new Date(r.start_date).getTime()) / 86400000;
      const remaining = Math.max(0, Math.ceil(total - elapsed));
      return {
        id: r.id,
        peer: peers.get(r.peer_id) || { id: r.peer_id, name: 'A student', handle: null, avatar: null },
        purpose: r.purpose,
        duration: r.duration,
        goal: r.goal,
        streak: r.streak,
        status: r.status,
        startDate: r.start_date,
        remaining,
        total,
        expired: remaining <= 0,
      };
    });
    setContracts(list);

    setRequests(
      ((reqs as { id: string; sender_id: string; receiver_id: string; purpose: string; duration: string; note: string | null; created_at: string }[]) || []).map((r) => ({
        id: r.id,
        purpose: r.purpose,
        duration: r.duration,
        note: r.note,
        created_at: r.created_at,
        direction: r.sender_id === profile.id ? 'outgoing' : 'incoming',
        counterparty: peers.get(r.sender_id === profile.id ? r.receiver_id : r.sender_id) || {
          id: r.sender_id === profile.id ? r.receiver_id : r.sender_id,
          name: 'A student',
          handle: null,
          avatar: null,
        },
      })),
    );
  }, [profile, peersByIds]);

  useEffect(() => {
    if (ready && profile) load();
  }, [ready, profile, load]);

  // realtime — offers and answers land without a refresh
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('partners-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alignment_requests', filter: `receiver_id=eq.${profile.id}` },
        () => {
          void load();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alignment_requests', filter: `sender_id=eq.${profile.id}` },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  if (!ready || !profile) {
    return (
      <AppShell title="Study Partners" eyebrow="Contracts">
        <p className="t-muted">Loading your contracts…</p>
      </AppShell>
    );
  }

  const lookup = async () => {
    setFoundPeer(null);
    setLookupMsg(null);
    const h = handleInput.trim().toLowerCase().replace(/^@/, '').replace(/\s/g, '_');
    if (!h) return;
    if (h === profile.handle) {
      setLookupMsg("That's you — pick a study partner, not a mirror.");
      return;
    }
    const { data } = await supabase.from('user_profiles').select('id, name, handle, avatar').eq('handle', h).maybeSingle();
    if (data) setFoundPeer(data as Peer);
    else setLookupMsg(`No student found with handle @${h} — invite them below instead.`);
  };

  const sendRequest = async () => {
    if (!foundPeer) return;
    setSending(true);
    setFormMsg(null);
    const { error } = await supabase.from('alignment_requests').insert({
      sender_id: profile.id,
      receiver_id: foundPeer.id,
      purpose,
      duration,
      note: note.trim() || null,
      status: 'PENDING',
    });
    setSending(false);
    if (error) {
      setFormMsg(error.message);
      return;
    }
    setFormMsg(`Request sent to @${foundPeer.handle}. It expires in 7 days if not answered.`);
    setFoundPeer(null);
    setHandleInput('');
    setNote('');
    load();
  };

  const respond = async (req: RequestRow, accept: boolean) => {
    if (accept) {
      const base = {
        purpose: req.purpose,
        duration: req.duration,
        goal: req.note,
        streak: 0,
        start_date: new Date().toISOString(),
      };
      await supabase.from('alignments').insert([
        { ...base, user_id: profile.id, peer_id: req.counterparty.id, status: 'ACTIVE' },
        { ...base, user_id: req.counterparty.id, peer_id: profile.id, status: 'ACTIVE' },
      ]);
    }
    await supabase
      .from('alignment_requests')
      .update({ status: accept ? 'ACCEPTED' : 'DECLINED', responded_at: new Date().toISOString() })
      .eq('id', req.id);
    load();
  };

  const checkIn = async (c: Contract) => {
    const now = new Date().toISOString();
    await Promise.all([
      supabase.from('alignments').update({ streak: c.streak + 1, updated_at: now }).eq('id', c.id),
      supabase
        .from('alignments')
        .update({ streak: c.streak + 1, updated_at: now })
        .eq('user_id', c.peer.id)
        .eq('peer_id', profile.id),
    ]);
    setContracts((cs) => cs.map((x) => (x.id === c.id ? { ...x, streak: x.streak + 1 } : x)));
  };

  const endEarly = async (c: Contract) => {
    const now = new Date().toISOString();
    await Promise.all([
      supabase.from('alignments').update({ status: 'ARCHIVED', updated_at: now }).eq('id', c.id),
      supabase
        .from('alignments')
        .update({ status: 'ARCHIVED', updated_at: now })
        .eq('user_id', c.peer.id)
        .eq('peer_id', profile.id),
    ]);
    load();
  };

  const renew = async (c: Contract) => {
    // mutual consent: a renewal is a fresh request to the peer
    await supabase.from('alignment_requests').insert({
      sender_id: profile.id,
      receiver_id: c.peer.id,
      purpose: c.purpose,
      duration: c.duration,
      note: `Renewal of our ${c.duration.toLowerCase()} contract${c.goal ? ` — ${c.goal}` : ''}`,
      status: 'PENDING',
    });
    setFormMsg(`Renewal proposal sent to @${c.peer.handle || c.peer.name}.`);
  };

  const inviteLink = `${window.location.origin}/login?mode=signup&ref=${profile.handle}`;
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setFormMsg(inviteLink);
    }
  };

  const active = contracts.filter((c) => !c.expired);
  const finished = contracts.filter((c) => c.expired);
  const incoming = requests.filter((r) => r.direction === 'incoming');
  const outgoing = requests.filter((r) => r.direction === 'outgoing');

  return (
    <AppShell title="Study Partners" eyebrow="Step 3 · Study contracts">
      {/* why contracts */}
      <section className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-[1.8rem] border-[1.5px] b-line bg-[var(--card)] p-7 md:p-9">
        <div className="max-w-2xl">
          <p className="eyebrow text-[var(--coral)]">Privacy by design</p>
          <p className="slab-display mt-2 text-2xl t-ink md:text-3xl">
            A contract, not a follower count.
          </p>
          <p className="mt-3 text-sm leading-relaxed t-muted">
            Two students, one shared goal, a fixed window — a week, a month, or
            until the exam. Contracts end on their own unless you both renew, so
            studying with someone you just met stays safe, mutual, and
            time-boxed.
          </p>
        </div>
        <DoodleClock className="hidden h-20 w-20 t-ink opacity-20 md:block" />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* left: new request + inbox */}
        <div className="space-y-6">
          <section className="rounded-[1.8rem] border-[1.5px] b-line bg-[var(--card)] p-7 md:p-9">
            <p className="eyebrow t-faint">New contract</p>
            <h2 className="slab-display mt-2 text-2xl t-ink">Propose a partnership</h2>

            <div className="mt-6">
              <label htmlFor="ct-handle" className="eyebrow t-faint">Partner&rsquo;s handle</label>
              <div className="mt-2 flex gap-2">
                <input
                  id="ct-handle"
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), lookup())}
                  className={inputCls}
                  placeholder="@nightowl_mumbai"
                />
                <button onClick={lookup} className="shrink-0 rounded-xl bg-[var(--coal)] px-5 text-sm font-bold text-[#fcfbfa] transition-transform hover:-translate-y-0.5">
                  Find
                </button>
              </div>
              {lookupMsg && <p className="mt-2 text-sm font-semibold text-[var(--coral)]">{lookupMsg}</p>}
              {foundPeer && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-[1.2rem] bg-[var(--mint)] p-4">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--coal)] font-slab text-xs font-bold text-white">
                      {(foundPeer.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold t-ink">{foundPeer.name}</span>
                      <span className="block text-xs t-muted">@{foundPeer.handle}</span>
                    </span>
                  </span>
                  <DoodlePeople className="h-6 w-6 shrink-0 t-ink opacity-40" />
                </div>
              )}
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="ct-purpose" className="eyebrow t-faint">What for</label>
                <select id="ct-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} className={inputCls}>
                  {purposes.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ct-duration" className="eyebrow t-faint">How long</label>
                <select id="ct-duration" value={duration} onChange={(e) => setDuration(e.target.value as (typeof durations)[number])} className={inputCls}>
                  {durations.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="ct-note" className="eyebrow t-faint">The deal (one line)</label>
              <input
                id="ct-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={inputCls}
                placeholder="e.g. 5:30 AM IST sprints, 40 MCQs each, report on the Wall"
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button onClick={sendRequest} disabled={!foundPeer || sending} className="pill-btn !px-6 !py-3 text-sm disabled:opacity-40">
                {sending ? 'Sending…' : 'Send contract offer'}
              </button>
              {formMsg && <p className="text-sm font-semibold t-muted">{formMsg}</p>}
            </div>
          </section>

          {/* inbox */}
          <section className="rounded-[1.8rem] border-[1.5px] b-line bg-[var(--card)] p-7 md:p-9">
            <div className="flex items-center justify-between">
              <p className="eyebrow t-faint">Inbox</p>
              {incoming.length > 0 && (
                <span className="rounded-full bg-[var(--coral)] px-2.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-widest text-white">
                  {incoming.length} waiting
                </span>
              )}
            </div>

            {incoming.length === 0 && outgoing.length === 0 && (
              <p className="mt-4 rounded-[1.2rem] bg-[var(--line)]/40 p-5 text-sm t-muted">
                No pending offers. Propose a contract above, or invite a friend
                to CoStudy and contract with them.
              </p>
            )}

            <ul className="mt-4 space-y-3">
              {incoming.map((r) => (
                <li key={r.id} className="rounded-[1.2rem] border-[1.5px] border-[var(--coral)]/40 bg-[var(--coral)]/5 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--coral)] font-slab text-xs font-bold text-white">
                        {initialsOf(r.counterparty.name || 'A')}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold t-ink">
                          {r.counterparty.name} <span className="t-muted">@{r.counterparty.handle}</span>
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-[var(--coral)]">
                          {r.purpose} · {r.duration}
                        </p>
                        {r.note && <p className="mt-1.5 text-xs italic t-muted">&ldquo;{r.note}&rdquo;</p>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => respond(r, true)} className="rounded-full bg-[var(--coral)] px-4 py-2 text-xs font-bold text-white transition-transform hover:-translate-y-0.5">
                        Accept
                      </button>
                      <button onClick={() => respond(r, false)} className="rounded-full border-[1.5px] b-line px-4 py-2 text-xs font-bold t-muted hover:t-ink">
                        Decline
                      </button>
                    </div>
                  </div>
                </li>
              ))}
              {outgoing.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border-[1.5px] b-line p-5">
                  <div>
                    <p className="text-sm font-bold t-ink">
                      Offer sent to {r.counterparty.name} <span className="t-muted">@{r.counterparty.handle}</span>
                    </p>
                    <p className="mt-0.5 text-xs t-faint">
                      {r.purpose} · {r.duration} · waiting for their answer
                    </p>
                  </div>
                  <span className="text-xs t-faint">pending</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* right: active contracts + growth */}
        <div className="space-y-6">
          <section className="rounded-[1.8rem] border-[1.5px] b-line bg-[var(--card)] p-7 md:p-9">
            <div className="flex items-center justify-between">
              <p className="eyebrow t-faint">Active contracts</p>
              <span className="rounded-full bg-[var(--mint)] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#4a7a2e]">
                {active.length} live
              </span>
            </div>

            {active.length === 0 && (
              <p className="mt-4 rounded-[1.2rem] bg-[var(--line)]/40 p-5 text-sm t-muted">
                No live contracts yet. Accept an offer or propose one — early
                mornings are easier when someone is waiting for you.
              </p>
            )}

            <ul className="mt-4 space-y-4">
              {active.map((c) => {
                const pct = Math.min(100, Math.round(((c.total - c.remaining) / c.total) * 100));
                return (
                  <li key={c.id} className="rounded-[1.4rem] border-[1.5px] b-line p-5 transition-shadow duration-300 hover:shadow-[0_18px_44px_-26px_rgba(23,19,14,0.35)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--coal)] font-slab text-xs font-bold text-[#f3ede3]">
                          {initialsOf(c.peer.name || 'A')}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-base font-bold t-ink">
                            {c.peer.name} <span className="t-muted">@{c.peer.handle}</span>
                          </p>
                          <p className="mt-0.5 text-xs font-semibold text-[var(--coral)]">
                            {c.purpose} · {c.duration}
                          </p>
                          {c.goal && <p className="mt-1.5 text-xs italic t-muted">&ldquo;{c.goal}&rdquo;</p>}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-[var(--mint)] px-3 py-1 text-xs font-bold text-[var(--ink)]">
                        {c.streak}d streak
                      </span>
                    </div>

                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-widest t-muted">
                        <span>{c.remaining} {c.remaining === 1 ? 'day' : 'days'} left</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
                        <div
                          className="h-full rounded-full bg-[var(--coral)] transition-[width] duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => checkIn(c)} className="rounded-full bg-[var(--coal)] px-4 py-2 text-xs font-bold text-[#fcfbfa] transition-transform hover:-translate-y-0.5">
                        Check in today
                      </button>
                      <Link to="/rooms" className="rounded-full border-[1.5px] b-line px-4 py-2 text-xs font-bold t-muted hover:t-ink">
                        Study together →
                      </Link>
                      <button onClick={() => renew(c)} className="rounded-full border-[1.5px] b-line px-4 py-2 text-xs font-bold t-muted hover:t-ink">
                        Propose renewal
                      </button>
                      <button onClick={() => endEarly(c)} className="ml-auto rounded-full px-4 py-2 text-xs font-bold text-[var(--coral)]/70 hover:text-[var(--coral)]">
                        End early
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {finished.length > 0 && (
              <div className="mt-6 border-t b-line pt-5">
                <p className="eyebrow t-faint">Finished</p>
                <ul className="mt-3 space-y-2">
                  {finished.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[1.2rem] bg-[var(--line)]/40 p-4 text-sm">
                      <span className="t-muted">
                        {c.peer.name} · {c.purpose} · ended {c.remaining === 0 ? 'on schedule' : ''}
                      </span>
                      <button onClick={() => renew(c)} className="font-bold text-[var(--coral)] hover:underline">
                        Renew
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* growth: invite */}
          <section className="relative overflow-hidden rounded-[1.8rem] bg-[var(--coal)] p-7 text-[#fcfbfa] md:p-9">
            <DoodleSpark className="pointer-events-none absolute -right-4 -top-4 w-28 rotate-12 text-[#fcfbfa]/10" />
            <p className="eyebrow text-[var(--coral)]">Grow the circle</p>
            <h2 className="slab-display mt-2 text-2xl">Contracts work best with friends.</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#fcfbfa]/70">
              Invite a study buddy from your college or coaching class. When they
              join with your link, find them by handle and send your first
              contract — you both keep the streak alive.
            </p>
            <button onClick={copyInvite} className="pill-btn mt-6 !border-[1.5px] !border-[#fcfbfa]/30 !bg-transparent !px-6 !py-3 text-sm">
              {copied ? 'Copied ✓' : 'Copy your invite link'}
            </button>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
