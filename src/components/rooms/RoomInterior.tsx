import { useEffect, useRef, useState } from 'react';
import { DoodleClock, DoodleNote, DoodlePeople, DoodleSpark } from '@/components/Doodles';
import RoomWhiteboard from '@/components/rooms/RoomWhiteboard';
import RoomPlan from '@/components/rooms/RoomPlan';
import type { Profile } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';

type RoomLite = {
  id: string;
  name: string;
  topic: string;
  tone: string;
  ink: string;
  maxMembers: number;
};

type Msg = {
  id: string;
  author: string;
  isYou: boolean;
  isAi: boolean;
  body: string;
  time: string;
};

type MemberRow = {
  id: string;
  role: string;
  streak: number | null;
  is_online: boolean | null;
  user?: { name?: string } | null;
};

type ResourceRow = {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  file_url: string | null;
};

type PresenceRow = { name: string; userId: string; fresh: boolean };

const initialsOf = (name: string) =>
  name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'A';

const relTime = (iso?: string) => {
  if (!iso) return '';
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} hr ago`;
};

const SPRINT_SECONDS = 25 * 60;

export default function RoomInterior({
  room,
  profile,
  presence,
  onLeft,
}: {
  room: RoomLite;
  profile: Profile;
  presence: PresenceRow[];
  onLeft: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [inviteHandle, setInviteHandle] = useState('');
  const [resForm, setResForm] = useState({ title: '', summary: '', category: 'Formula Sheet', file_url: '' });
  const [showResForm, setShowResForm] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(SPRINT_SECONDS);
  const [running, setRunning] = useState(false);
  const [panel, setPanel] = useState<'chat' | 'board' | 'plan'>('chat');
  const [scribing, setScribing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const roomId = room.id;

  // chat history + live inserts
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('room_messages')
      .select('id, content, is_ai, created_at, author_id, author:user_profiles(name)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (cancelled) return;
        setMsgs(
          ((data as ({ id: string; content?: string; is_ai?: boolean; created_at?: string; author_id?: string; author?: { name?: string } | null })[]) || []).map((m) => ({
            id: m.id,
            author: m.is_ai ? 'AI Scribe' : m.author?.name || 'Scholar',
            isYou: m.author_id === profile.id && !m.is_ai,
            isAi: !!m.is_ai,
            body: m.content || '',
            time: relTime(m.created_at),
          })),
        );
      });
    const channel = supabase
      .channel(`room-chat-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const m = payload.new as { id: string; content?: string; is_ai?: boolean; created_at?: string; author_id?: string; author?: { name?: string } | null };
          if (m.author_id === profile.id) return; // already added optimistically
          setMsgs((cur) =>
            cur.some((x) => x.id === m.id)
              ? cur
              : [
                  ...cur,
                  {
                    id: m.id,
                    author: m.is_ai ? 'AI Scribe' : (m.author as { name?: string } | null)?.name || 'Scholar',
                    isYou: false,
                    isAi: !!m.is_ai,
                    body: m.content || '',
                    time: relTime(m.created_at),
                  },
                ],
          );
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId, profile.id]);

  // members + resources, live
  const loadSide = async () => {
    const [{ data: mem }, { data: res }] = await Promise.all([
      supabase
        .from('study_room_members')
        .select('id, role, streak, is_online, user:user_profiles(name)')
        .eq('room_id', roomId)
        .eq('status', 'ACTIVE')
        .order('joined_at', { ascending: true }),
      supabase
        .from('study_room_resources')
        .select('id, title, summary, category, file_url')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false }),
    ]);
    setMembers((mem as MemberRow[]) || []);
    setResources((res as ResourceRow[]) || []);
  };

  useEffect(() => {
    loadSide();
    const channel = supabase
      .channel(`room-side-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_room_members', filter: `room_id=eq.${roomId}` }, loadSide)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_room_resources', filter: `room_id=eq.${roomId}` }, loadSide)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs.length]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setRunning(false);
          return SPRINT_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const { data } = await supabase
      .from('room_messages')
      .insert([{ room_id: roomId, author_id: profile.id, content: text }])
      .select('id, created_at')
      .single();
    setMsgs((cur) => [
      ...cur,
      {
        id: (data as { id: string } | null)?.id || crypto.randomUUID(),
        author: profile.name,
        isYou: true,
        isAi: false,
        body: text,
        time: 'just now',
      },
    ]);
  };

  // AI study scribe — digests the room's thread and pulls one live question
  // from the canonical bank as a next step, then posts it as an AI chat note.
  const scribe = async () => {
    setScribing(true);
    try {
      const part = /part\s*2/i.test(room.topic) ? 'Part 2' : 'Part 1';
      const { data } = await supabase.rpc('pick_practice_mcqs', { p_part: part, p_count: 1 });
      const q = (Array.isArray(data) ? data[0] : null) as {
        question_text?: string;
        section?: string | null;
        options?: Record<string, string>;
        correct_answer?: string;
        explanation?: string | null;
      } | null;

      const recent = msgs
        .filter((m) => !m.isAi)
        .slice(-3)
        .map((m) => `· “${m.body.slice(0, 90)}${m.body.length > 90 ? '…' : ''}” — ${m.author}`);

      let body = `✦ Scribe note · ${room.name}\n`;
      body += recent.length
        ? `What this room chewed on just now:\n${recent.join('\n')}`
        : 'The room is just warming up — quiet thread, loud potential.';

      if (q?.question_text) {
        const ans = String(q.correct_answer || '').toUpperCase();
        body += `\n\nFrom the live bank (${part}${q.section ? ` · ${q.section}` : ''}) — one to try next:\n${q.question_text}`;
        if (ans) body += `\nAnswer: ${ans}${q.options?.[ans] ? `. ${q.options[ans]}` : ''}`;
        if (q.explanation) {
          body += `\nWhy: ${q.explanation.slice(0, 220)}${q.explanation.length > 220 ? '…' : ''}`;
        }
      }

      const { error } = await supabase
        .from('room_messages')
        .insert({ room_id: roomId, author_id: profile.id, content: body, is_ai: true });
      if (!error) {
        setMsgs((cur) => [
          ...cur,
          { id: crypto.randomUUID(), author: 'AI Scribe', isYou: false, isAi: true, body, time: 'just now' },
        ]);
      }
    } finally {
      setScribing(false);
    }
  };

  const invite = async () => {
    const h = inviteHandle.trim().toLowerCase().replace(/^@/, '');
    if (!h) return;
    setNote(null);
    const { data: user } = await supabase.from('user_profiles').select('id, name, handle').eq('handle', h).maybeSingle();
    if (!user) {
      setNote(`No student found with the handle “${h}”.`);
      return;
    }
    const u = user as { id: string; name: string };
    if (u.id === profile.id) {
      setNote('That’s you — you’re already here.');
      return;
    }
    const { error } = await supabase.from('study_room_members').insert({
      room_id: roomId,
      user_id: u.id,
      role: 'MEMBER',
      status: 'INVITED',
    });
    setInviteHandle('');
    setNote(error ? error.message : `Invited ${u.name} — they’ll see the room as pending on their list.`);
  };

  const addResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resForm.title.trim()) return;
    const { error } = await supabase.from('study_room_resources').insert({
      room_id: roomId,
      title: resForm.title.trim(),
      summary: resForm.summary.trim() || null,
      category: resForm.category,
      file_url: resForm.file_url.trim() || null,
      uploaded_by: profile.id,
    });
    if (error) {
      setNote(error.message);
      return;
    }
    setResForm({ title: '', summary: '', category: 'Formula Sheet', file_url: '' });
    setShowResForm(false);
    setNote('Resource shelved for the room.');
    await loadSide();
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <section className="mb-10 overflow-hidden rounded-[1.8rem] border-[1.5px] b-line bg-[var(--card)]">
      {/* room header */}
      <div className="flex flex-wrap items-center gap-4 px-7 py-6" style={{ backgroundColor: room.tone, color: room.ink }}>
        <div className="min-w-0 flex-1">
          <p className="eyebrow opacity-70">{room.topic}</p>
          <h2 className="slab-display mt-1 truncate text-2xl md:text-3xl">{room.name}</h2>
        </div>
        <span className="rounded-full border border-current px-3 py-1 text-[0.6rem] font-bold tracking-widest opacity-80">
          {presence.filter((p) => p.fresh).length} / {room.maxMembers} AT THEIR DESK
        </span>
        <button
          onClick={onLeft}
          className="rounded-full px-5 py-2.5 text-xs font-bold tracking-wide transition-opacity hover:opacity-75"
          style={{ backgroundColor: room.ink, color: room.tone }}
        >
          Leave room
        </button>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1.6fr_1fr]">
        {/* chat + whiteboard */}
        <div className="flex flex-col border-b b-line lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 border-b b-line px-6 py-3">
            <div className="flex rounded-full border-[1.5px] b-line p-1">
              {(['chat', 'board', 'plan'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setPanel(t)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold tracking-wide transition-colors ${
                    panel === t ? 'bg-[var(--coral)] text-white' : 't-muted hover:t-ink'
                  }`}
                >
                  {t === 'chat' ? 'Chat' : t === 'board' ? 'Whiteboard' : 'Plan'}
                </button>
              ))}
            </div>
            {panel === 'chat' ? (
              <>
                <span className="text-xs t-faint">{msgs.length} messages</span>
                <button
                  onClick={scribe}
                  disabled={scribing}
                  className="ml-auto flex items-center gap-1.5 rounded-full border-[1.5px] border-[var(--coral)] px-4 py-1.5 text-xs font-bold text-[var(--coral)] transition-colors hover:bg-[var(--coral)] hover:text-white disabled:opacity-50"
                >
                  <DoodleSpark className="h-3.5 w-3.5" />
                  {scribing ? 'Scribing…' : 'Scribe note'}
                </button>
              </>
            ) : (
              <span className="ml-auto text-xs t-faint">{panel === 'board' ? 'shared canvas' : 'what the room chases'}</span>
            )}
          </div>
          {panel === 'board' ? (
            <RoomWhiteboard roomId={roomId} />
          ) : panel === 'plan' ? (
            <RoomPlan roomId={roomId} meId={profile.id} />
          ) : (
            <>
          <div ref={scrollRef} className="h-[46vh] space-y-4 overflow-y-auto p-6" data-lenis-prevent>
            {msgs.length === 0 && (
              <p className="rounded-xl border-[1.5px] border-dashed b-line px-4 py-6 text-center text-xs font-semibold t-muted">
                Quiet for now — say what you’re working on and set the tone.
              </p>
            )}
            {msgs.map((m) =>
              m.isAi ? (
                <div key={m.id} className="rounded-2xl border-[1.5px] border-dashed border-[var(--coral)]/50 bg-[var(--coral)]/5 p-5">
                  <p className="mb-2 flex items-center gap-1.5 text-[0.65rem] font-bold tracking-widest text-[var(--coral)]">
                    <DoodleSpark className="h-3.5 w-3.5" /> AI SCRIBE · {m.time}
                  </p>
                  <p className="whitespace-pre-line text-sm leading-relaxed t-ink">{m.body}</p>
                </div>
              ) : (
              <div key={m.id} className={`flex ${m.isYou ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${m.isYou ? 'text-right' : ''}`}>
                  {!m.isYou && (
                    <p className="mb-1 text-[0.65rem] font-bold tracking-wide t-faint">
                      {m.author} · {m.time}
                    </p>
                  )}
                  <p
                    className={`inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.isYou
                        ? 'rounded-br-md bg-[var(--coral)] text-white'
                        : 'rounded-bl-md bg-[var(--paper)] t-ink shadow-[inset_0_0_0_1.5px_var(--line)]'
                    }`}
                  >
                    {m.body}
                  </p>
                </div>
              </div>
              ),
            )}
          </div>
          <div className="border-t b-line p-4">
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), send())}
                placeholder="Share a thought with the room…"
                className="flex-1 rounded-full border-[1.5px] b-line bg-[var(--paper)] px-5 py-3 text-sm t-ink placeholder:t-faint focus:border-[var(--coral)] focus:outline-none"
              />
              <button
                onClick={send}
                disabled={!draft.trim()}
                className="pill-btn !px-6 !py-3 text-sm disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
            </>
          )}
        </div>

        {/* side rail */}
        <div className="space-y-6 p-6">
          {/* timer */}
          <div className="rounded-2xl bg-[var(--coal)] p-5 text-[#f3ede3]">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow flex items-center gap-1.5 opacity-60">
                <DoodleClock className="h-3.5 w-3.5" /> Shared sprint
              </span>
              <button onClick={() => setRunning((r) => !r)} className="text-xs font-bold tracking-wide underline-offset-4 hover:underline">
                {running ? 'Pause' : 'Start'}
              </button>
            </div>
            <p className="slab-display mt-2 text-center text-4xl tabular-nums">{mm}:{ss}</p>
          </div>

          {/* members */}
          <div>
            <p className="eyebrow flex items-center gap-1.5 t-faint">
              <DoodlePeople className="h-4 w-4" /> Members · {members.length}
            </p>
            <ul className="mt-3 space-y-2.5">
              {members.map((m) => {
                const name = m.user?.name || 'Scholar';
                const isYou = name === profile.name;
                return (
                  <li key={m.id} className="flex items-center gap-3">
                    <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[var(--line)] font-slab text-[0.65rem] font-bold t-ink">
                      {initialsOf(name)}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--card)] ${
                          m.is_online ? 'bg-emerald-500' : 'bg-[var(--line)]'
                        }`}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold t-ink">
                        {name}
                        {isYou ? ' (you)' : ''}
                      </span>
                      <span className="block text-[0.65rem] t-faint">
                        {m.role === 'ADMIN' ? 'Room lead' : 'Member'}
                        {m.streak ? ` · ${m.streak}-day streak` : ''}
                      </span>
                    </span>
                  </li>
                );
              })}
              {members.length === 0 && <li className="text-xs t-faint">Just you so far — invite a study partner.</li>}
            </ul>
          </div>

          {/* invite */}
          <div className="rounded-2xl bg-[#e9c46a]/20 p-4">
            <p className="eyebrow t-faint">Invite by handle</p>
            <div className="mt-2 flex gap-2">
              <input
                value={inviteHandle}
                onChange={(e) => setInviteHandle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), invite())}
                placeholder="@studybuddy"
                className="w-full min-w-0 flex-1 rounded-full border-[1.5px] b-line bg-[var(--card)] px-4 py-2 text-sm t-ink placeholder:t-faint focus:border-[var(--coral)] focus:outline-none"
              />
              <button onClick={invite} className="pill-btn shrink-0 !px-4 !py-2 text-xs">
                Invite
              </button>
            </div>
            {note && <p className="mt-2 text-[0.7rem] font-semibold t-muted">{note}</p>}
          </div>

          {/* resources */}
          <div>
            <div className="flex items-center justify-between">
              <p className="eyebrow flex items-center gap-1.5 t-faint">
                <DoodleNote className="h-4 w-4" /> Room shelf · {resources.length}
              </p>
              <button
                onClick={() => setShowResForm((s) => !s)}
                className="text-xs font-bold t-muted transition-colors hover:t-ink"
              >
                {showResForm ? 'Close' : '+ Add'}
              </button>
            </div>
            {showResForm && (
              <form onSubmit={addResource} className="mt-3 space-y-2 rounded-2xl border-[1.5px] b-line p-4">
                <input
                  value={resForm.title}
                  onChange={(e) => setResForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Title — e.g. Variance analysis formula sheet"
                  required
                  className="w-full rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-3 py-2.5 text-xs t-ink placeholder:t-faint focus:border-[var(--coral)] focus:outline-none"
                />
                <input
                  value={resForm.summary}
                  onChange={(e) => setResForm((f) => ({ ...f, summary: e.target.value }))}
                  placeholder="One-line summary (optional)"
                  className="w-full rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-3 py-2.5 text-xs t-ink placeholder:t-faint focus:border-[var(--coral)] focus:outline-none"
                />
                <div className="flex gap-2">
                  <select
                    value={resForm.category}
                    onChange={(e) => setResForm((f) => ({ ...f, category: e.target.value }))}
                    className="rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-3 py-2.5 text-xs t-ink focus:border-[var(--coral)] focus:outline-none"
                  >
                    {['Formula Sheet', 'Notes', 'Practice Set', 'Video', 'Other'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <button type="submit" className="pill-btn !px-4 !py-2 text-xs">
                    Shelve it
                  </button>
                </div>
              </form>
            )}
            <ul className="mt-3 space-y-2.5">
              {resources.map((r) => (
                <li key={r.id} className="rounded-xl border-[1.5px] b-line p-3.5">
                  <p className="text-xs font-bold t-ink">{r.title}</p>
                  {r.summary && <p className="mt-1 text-[0.7rem] leading-relaxed t-muted">{r.summary}</p>}
                  <p className="mt-1.5 text-[0.6rem] font-bold tracking-widest t-faint">
                    {(r.category || 'NOTE').toUpperCase()}
                    {r.file_url ? ' · LINK ATTACHED' : ''}
                  </p>
                </li>
              ))}
              {resources.length === 0 && !showResForm && (
                <li className="text-xs t-faint">Nothing shelved yet — pin the notes this room keeps re-sharing.</li>
              )}
            </ul>
          </div>

          <p className="flex items-center gap-2 text-[0.65rem] t-faint">
            <DoodleSpark className="h-3.5 w-3.5" />
            Chat, members and shelf are live for everyone seated at a desk.
          </p>
        </div>
      </div>
    </section>
  );
}
