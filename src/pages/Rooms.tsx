import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import AppShell from '@/components/app/AppShell';
import { DoodleHeadphones } from '@/components/Doodles';
import RoomInterior from '@/components/rooms/RoomInterior';
import CreateRoomModal from '@/components/rooms/CreateRoomModal';
import { useAuth } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';

type DbRoom = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  color_theme: string | null;
  room_type: string | null;
  is_live: boolean | null;
  members_count: number | null;
  active_count: number | null;
  max_members: number | null;
  topic: string | null;
  exam_window: string | null;
  tags: string[] | null;
  cluster_streak: number | null;
  total_focus_hours: number | null;
  creator_id: string | null;
  created_at: string;
};

type DbPresence = {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  last_seen: string | null;
};

type Room = {
  id: string;
  name: string;
  topic: string;
  category: string | null;
  tags: string[];
  tone: string;
  ink: string;
  maxMembers: number;
  isLive: boolean;
  streak: number | null;
  live?: boolean;
};

type PresenceRow = { name: string; userId: string; isYou: boolean; fresh: boolean };

type Membership = { status: string; role: string };

const palette: [string, string][] = [
  ['var(--coral)', '#ffffff'],
  ['#c6b3a2', 'var(--ink)'],
  ['var(--mint)', 'var(--ink)'],
  ['#d9e6f3', 'var(--ink)'],
  ['#f3f1ee', 'var(--ink)'],
  ['#2b2926', '#fcfbfa'],
];

const toneFor = (room: DbRoom, index: number): [string, string] => {
  const theme = (room.color_theme || '').trim();
  if (theme.startsWith('#')) return [theme, theme === '#2b2926' ? '#fcfbfa' : 'var(--ink)'];
  return palette[index % palette.length];
};

const initialsOf = (name: string) =>
  name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'A';

/* Starter clusters — shown only until live rooms exist. */
const seed: Room[] = [
  { id: 'seed-1', name: 'Ethics & Governance — morning grind', topic: 'Part 1 · Ethics', category: 'Ethics', tags: ['#part1'], tone: 'var(--coral)', ink: '#ffffff', maxMembers: 8, isLive: true, streak: 12 },
  { id: 'seed-2', name: 'Variance Analysis deep dive', topic: 'Part 1 · Performance Mgmt', category: 'Performance Management', tags: ['#part1'], tone: '#c6b3a2', ink: 'var(--ink)', maxMembers: 8, isLive: true, streak: 7 },
  { id: 'seed-3', name: 'Internal Controls flash sprint', topic: 'Part 1 · Controls', category: 'Internal Controls', tags: ['#part1'], tone: 'var(--mint)', ink: 'var(--ink)', maxMembers: 8, isLive: false, streak: 3 },
  { id: 'seed-4', name: 'Corporate Finance quiet room', topic: 'Part 2 · Corp Finance', category: 'Corporate Finance', tags: ['#part2'], tone: '#d9e6f3', ink: 'var(--ink)', maxMembers: 8, isLive: true, streak: 21 },
  { id: 'seed-5', name: 'Decision Analysis whiteboard club', topic: 'Part 2 · Decision Analysis', category: 'Decision Analysis', tags: ['#part2'], tone: '#f3f1ee', ink: 'var(--ink)', maxMembers: 8, isLive: true, streak: 5 },
  { id: 'seed-6', name: 'Final-review war room (P1+P2)', topic: 'Mixed · Mock season', category: 'Mock Season', tags: ['#mixed'], tone: '#2b2926', ink: '#fcfbfa', maxMembers: 10, isLive: true, streak: 30 },
];

const SPRINT_SECONDS = 25 * 60;
const FRESH_MINUTES = 15;

export default function Rooms() {
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<string>('ALL');
  const [liveRooms, setLiveRooms] = useState<Room[]>([]);
  const [presence, setPresence] = useState<Record<string, PresenceRow[]>>({});
  const [loaded, setLoaded] = useState(false);
  const [busyRoom, setBusyRoom] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(SPRINT_SECONDS);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>(['Sprint room joined — cameras optional.']);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [memberships, setMemberships] = useState<Record<string, Membership>>({});

  const loadMemberships = async () => {
    if (!profile) {
      setMemberships({});
      return;
    }
    const { data } = await supabase
      .from('study_room_members')
      .select('room_id, status, role')
      .eq('user_id', profile.id);
    const map: Record<string, Membership> = {};
    for (const row of (data as { room_id: string; status: string; role: string }[]) || []) {
      map[row.room_id] = { status: row.status, role: row.role };
    }
    setMemberships(map);
  };

  // join (or refresh) membership whenever my presence changes rooms
  const joinMembership = async (roomId: string) => {
    if (!profile) return;
    const existing = await supabase
      .from('study_room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', profile.id)
      .maybeSingle();
    const role = memberships[roomId]?.role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
    const payload = { role, status: 'ACTIVE', is_online: true, last_active_at: new Date().toISOString() };
    if (existing.data) {
      await supabase.from('study_room_members').update(payload).eq('id', (existing.data as { id: string }).id);
    } else {
      await supabase.from('study_room_members').insert({ room_id: roomId, user_id: profile.id, joined_at: new Date().toISOString(), ...payload });
    }
    await loadMemberships();
  };

  const loadPresence = async (roomIds: string[]) => {
    if (roomIds.length === 0) {
      setPresence({});
      return;
    }
    const { data } = await supabase
      .from('room_presence')
      .select('id, room_id, user_id, display_name, last_seen')
      .in('room_id', roomIds)
      .order('last_seen', { ascending: false });
    const map: Record<string, PresenceRow[]> = {};
    for (const row of (data as DbPresence[]) || []) {
      const fresh =
        !!row.last_seen && Date.now() - new Date(row.last_seen).getTime() < FRESH_MINUTES * 60000;
      (map[row.room_id] ||= []).push({
        name: row.display_name || 'Scholar',
        userId: row.user_id,
        isYou: !!profile && row.user_id === profile.id,
        fresh,
      });
    }
    setPresence(map);
  };

  // initial load
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('study_rooms')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(60)
      .then(async ({ data }) => {
        if (cancelled) return;
        const rows = (data as DbRoom[]) || [];
        setLiveRooms(
          rows.map((r, i) => {
            const [tone, ink] = toneFor(r, i);
            return {
              id: r.id,
              name: r.name,
              topic: r.topic || r.category || 'Open cluster',
              category: r.category,
              tags: r.tags || [],
              tone,
              ink,
              maxMembers: r.max_members || 8,
              isLive: r.is_live ?? true,
              streak: r.cluster_streak,
              live: true,
            };
          }),
        );
        await loadPresence(rows.map((r) => r.id));
        await loadMemberships();
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // realtime — presence and new rooms update live
  useEffect(() => {
    const channel = supabase
      .channel('rooms-presence')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_presence' }, () => {
        loadPresence(liveRooms.map((r) => r.id));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'study_rooms' }, () => {
        // refresh the room list when a new cluster opens
        supabase
          .from('study_rooms')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(60)
          .then(({ data }) => {
            const rows = (data as DbRoom[]) || [];
            setLiveRooms((cur) => {
              const seen = new Set(cur.map((r) => r.id));
              const added = rows
                .filter((r) => !seen.has(r.id))
                .map((r, i) => {
                  const [tone, ink] = toneFor(r, cur.length + i);
                  return {
                    id: r.id, name: r.name, topic: r.topic || r.category || 'Open cluster',
                    category: r.category, tags: r.tags || [], tone, ink,
                    maxMembers: r.max_members || 8, isLive: r.is_live ?? true,
                    streak: r.cluster_streak, live: true,
                  };
                });
              return added.length ? [...added, ...cur] : cur;
            });
            loadPresence(rows.map((r) => r.id));
          });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRooms.map((r) => r.id).join(','), profile?.id]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setRunning(false);
          setLog((l) => [`Sprint complete — 25 min banked.`, ...l].slice(0, 4));
          return SPRINT_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  const rooms = liveRooms.length > 0 ? liveRooms : seed;
  const usingSeeds = liveRooms.length === 0;

  const categories = useMemo(
    () => ['ALL', ...Array.from(new Set(rooms.map((r) => r.category).filter((c): c is string => !!c)))],
    [rooms],
  );

  const filtered = useMemo(
    () =>
      rooms.filter(
        (r) =>
          (cat === 'ALL' || r.category === cat) &&
          (r.name + r.topic + r.tags.join(' ')).toLowerCase().includes(query.toLowerCase()),
      ),
    [rooms, query, cat],
  );

  const joinedLiveRoom = profile ? liveRooms.find((r) => (presence[r.id] || []).some((p) => p.isYou)) : undefined;
  const myRoomPresence = joinedLiveRoom ? presence[joinedLiveRoom.id] || [] : [];
  const openRoom = openId ? liveRooms.find((r) => r.id === openId) : undefined;
  const openRoomPresence = openRoom ? presence[openRoom.id] || [] : [];

  const acceptInvite = async (room: Room) => {
    if (!profile) return;
    setBusyRoom(room.id);
    const { error } = await supabase
      .from('study_room_members')
      .update({ status: 'ACTIVE', last_active_at: new Date().toISOString() })
      .eq('room_id', room.id)
      .eq('user_id', profile.id);
    setBusyRoom(null);
    if (error) {
      setRoomError(error.message);
      return;
    }
    await loadMemberships();
    setLog((l) => [`Accepted the invite to “${room.name}” — take a desk when you’re ready.`, ...l].slice(0, 4));
  };

  const enterRoom = async (room: Room) => {
    const inRoom = (presence[room.id] || []).some((p) => p.isYou);
    if (!inRoom) await toggleJoin(room);
    setOpenId(room.id);
  };

  const leaveRoom = async () => {
    if (openRoom) await toggleJoin(openRoom);
    setOpenId(null);
  };

  const handleCreated = async (roomId: string) => {
    setShowCreate(false);
    const { data } = await supabase.from('study_rooms').select('*').eq('id', roomId).single();
    if (data) {
      const row = data as DbRoom;
      setLiveRooms((cur) =>
        cur.some((r) => r.id === row.id)
          ? cur
          : [
              {
                id: row.id,
                name: row.name,
                topic: row.topic || row.category || 'Open cluster',
                category: row.category,
                tags: row.tags || [],
                tone: (row.color_theme || '').startsWith('#') ? (row.color_theme as string) : 'var(--coral)',
                ink: row.color_theme === '#2b2926' ? '#fcfbfa' : 'var(--ink)',
                maxMembers: row.max_members || 8,
                isLive: row.is_live ?? true,
                streak: row.cluster_streak,
                live: true,
              },
              ...cur,
            ],
      );
    }
    await loadMemberships();
    await loadPresence(liveRooms.map((r) => r.id).concat(roomId));
    setOpenId(roomId);
    setLog((l) => [`You opened a new room — you’re the lead.`, ...l].slice(0, 4));
  };

  const toggleJoin = async (room: Room) => {
    setRoomError(null);
    if (!room.live) {
      setLog((l) => [`“${room.name}” is a starter room — it goes live when the campus opens it.`, ...l].slice(0, 4));
      return;
    }
    if (!profile) return;
    setBusyRoom(room.id);
    const inRoom = (presence[room.id] || []).some((p) => p.isYou);
    if (inRoom) {
      const { error } = await supabase
        .from('room_presence')
        .delete()
        .eq('room_id', room.id)
        .eq('user_id', profile.id);
      await supabase
        .from('study_room_members')
        .update({ is_online: false, last_active_at: new Date().toISOString() })
        .eq('room_id', room.id)
        .eq('user_id', profile.id);
      setBusyRoom(null);
      if (error) {
        setRoomError(error.message);
        return;
      }
      if (openId === room.id) setOpenId(null);
      setLog((l) => [`Left “${room.name}”.`, ...l].slice(0, 4));
    } else {
      const existing = await supabase
        .from('room_presence')
        .select('id')
        .eq('room_id', room.id)
        .eq('user_id', profile.id)
        .maybeSingle();
      const payload = {
        room_id: room.id,
        user_id: profile.id,
        display_name: profile.name,
        last_seen: new Date().toISOString(),
      };
      const { error } = existing.data
        ? await supabase.from('room_presence').update(payload).eq('id', (existing.data as { id: string }).id)
        : await supabase.from('room_presence').insert([{ id: crypto.randomUUID(), ...payload }]);
      setBusyRoom(null);
      if (error) {
        setRoomError(error.message);
        return;
      }
      await joinMembership(room.id);
      setLog((l) => [`Took a desk in “${room.name}”.`, ...l].slice(0, 4));
    }
    await loadPresence(liveRooms.map((r) => r.id));
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const progress = 1 - seconds / SPRINT_SECONDS;

  return (
    <AppShell eyebrow="Live clusters" title="Study Rooms">
      {openRoom && profile ? (
        <RoomInterior
          room={openRoom}
          profile={profile}
          presence={openRoomPresence}
          onLeft={leaveRoom}
        />
      ) : (
        <>
      {/* my desk — sprint stays local; the faces are real presence */}
      <section className="mb-10 grid gap-6 rounded-[1.8rem] bg-[var(--mint)] p-7 text-[var(--ink)] md:grid-cols-[1.2fr_1fr] md:p-10" aria-label="Your desk">
        <div>
          <p className="eyebrow opacity-70">Your desk</p>
          <h2 className="slab-display mt-2 text-2xl md:text-3xl">
            {joinedLiveRoom ? joinedLiveRoom.name : 'Deep work, together'}
          </h2>
          <div className="mt-5 flex items-center gap-3">
            {(joinedLiveRoom ? myRoomPresence : []).slice(0, 6).map((p, i) => (
              <span
                key={`${p.name}-${i}`}
                title={`${p.name} · ${p.fresh ? 'in the room now' : 'away'}`}
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--mint)] font-slab text-xs font-bold ${
                  p.isYou ? 'bg-[var(--coral)] text-white' : p.fresh ? 'bg-[var(--coal)] text-[#f3ede3]' : 'bg-[#6f9c3e]/60 text-[#f3ede3]'
                }`}
                style={{ marginLeft: i ? -12 : 0 }}
              >
                {initialsOf(p.name)}
              </span>
            ))}
            <span className="ml-2 text-sm font-semibold opacity-70">
              {joinedLiveRoom
                ? `${myRoomPresence.length} of ${joinedLiveRoom.maxMembers} desks occupied — real presence`
                : 'Log in and take a desk to see who is really in the room.'}
            </span>
          </div>
          <p className="mt-6 max-w-md text-sm leading-relaxed opacity-75">
            Shared timer keeps the whole room in the same sprint. When it rings,
            everyone surfaces together — stretch, breathe, compare notes.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => setRunning((r) => !r)} className="pill-btn">
              {running ? 'Pause sprint' : 'Start sprint'}
            </button>
            <span className="pill-btn pill-btn--ghost !border-[var(--ink)] !text-[var(--ink)] hover:!bg-[var(--coal)] hover:!text-[#f3ede3]">
              <DoodleHeadphones className="h-4 w-4" />
              Room muted · presence only
            </span>
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-2xl bg-[var(--coal)] p-6 text-[#f3ede3]">
          <div className="flex items-baseline justify-between">
            <span className="eyebrow opacity-60">Shared timer</span>
            <span className="text-xs font-semibold opacity-60">{Math.round(progress * 100)}%</span>
          </div>
          <p className="slab-display my-4 text-center text-6xl tabular-nums md:text-7xl">
            {mm}:{ss}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--mint)]/20">
            <div
              className="h-full rounded-full bg-[var(--mint)] transition-[width] duration-1000 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <ul className="mt-5 space-y-1.5 text-xs opacity-70">
            {log.map((l, i) => (
              <li key={i}>· {l}</li>
            ))}
          </ul>
        </div>
      </section>

      {roomError && (
        <p className="mb-6 rounded-xl border-[1.5px] border-[var(--coral)] bg-[var(--coral)]/10 px-4 py-3 text-xs font-semibold t-ink">
          {roomError}
        </p>
      )}

      {usingSeeds && loaded && (
        <p className="mb-6 rounded-xl border-[1.5px] border-dashed b-line px-4 py-3 text-xs font-semibold t-muted">
          Showing starter clusters — live rooms and real presence appear here as the campus opens them.
        </p>
      )}

      {/* filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search active study clusters or topics…"
          className="w-full max-w-sm rounded-full border-[1.5px] b-line bg-[var(--card)] px-5 py-2.5 text-sm t-ink placeholder:t-faint focus:border-[var(--coral)] focus:outline-none"
        />
        {profile && (
          <button
            onClick={() => setShowCreate(true)}
            className="pill-btn pill-btn--ghost text-xs"
          >
            + Open a new room
          </button>
        )}
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full border-[1.5px] px-4 py-2 text-xs font-bold tracking-wide transition-colors ${
                cat === c ? 'border-[var(--coral)] bg-[var(--coral)] text-white' : 'b-line t-muted hover:t-ink'
              }`}
            >
              {c === 'ALL' ? 'ALL' : c.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* cluster grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((r) => {
          const rows = presence[r.id] || [];
          const isIn = rows.some((p) => p.isYou);
          const membership = memberships[r.id];
          const isInvited = membership?.status === 'INVITED';
          const count = r.live ? rows.filter((p) => p.fresh || p.isYou).length : 0;
          const cap = r.maxMembers;
          const full = count >= cap;
          return (
            <article
              key={r.id}
              className="flex min-h-[220px] flex-col justify-between rounded-[1.4rem] p-6 transition-transform duration-500 ease-out-soft hover:-translate-y-1"
              style={{ backgroundColor: r.tone, color: r.ink }}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="eyebrow opacity-70">{r.topic}</p>
                  <span className="rounded-full border border-current px-2.5 py-1 text-[0.6rem] font-bold tracking-widest opacity-80">
                    {r.isLive ? 'LIVE' : 'QUIET'}
                  </span>
                </div>
                <h3
                  className="slab-display mt-3 cursor-pointer text-xl leading-snug transition-opacity hover:opacity-70"
                  onClick={() => profile && enterRoom(r)}
                  title={profile ? 'Enter room' : undefined}
                >
                  {r.name}
                </h3>
                {r.live && rows.length > 0 && (
                  <div className="mt-3 flex items-center gap-1.5">
                    {rows.slice(0, 5).map((p, i) => (
                      <span
                        key={`${p.name}-${i}`}
                        title={`${p.name} · seen ${p.fresh ? 'just now' : 'recently'}`}
                        className={`flex h-7 w-7 items-center justify-center rounded-full font-slab text-[0.6rem] font-bold ${
                          p.fresh ? 'bg-current' : 'border border-current opacity-50'
                        }`}
                        style={p.fresh ? { color: r.tone } : undefined}
                      >
                        {initialsOf(p.name)}
                      </span>
                    ))}
                    {rows.length > 5 && (
                      <span className="text-[0.65rem] font-bold opacity-70">+{rows.length - 5} more</span>
                    )}
                  </div>
                )}
                {r.live && r.streak != null && r.streak > 0 && (
                  <p className="mt-2 text-[0.65rem] font-bold tracking-widest opacity-60">
                    CLUSTER STREAK · {r.streak} DAYS
                  </p>
                )}
              </div>
              <div className="mt-6">
                <div className="mb-2 flex justify-between text-xs font-semibold opacity-75">
                  <span>{count} / {cap} desks</span>
                  <span>{full ? 'FULL' : r.isLive ? 'LIVE' : 'QUIET'}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-current opacity-20">
                  <div
                    className="h-full rounded-full bg-current transition-[width] duration-700"
                    style={{ width: `${Math.min(100, (count / cap) * 100)}%` }}
                  />
                </div>
                {profile ? (
                  <button
                    onClick={() =>
                      isInvited ? acceptInvite(r) : isIn ? enterRoom(r) : toggleJoin(r)
                    }
                    disabled={busyRoom === r.id || (!isIn && !isInvited && full && r.live)}
                    className={`mt-4 w-full rounded-full py-2.5 text-sm font-bold transition-all duration-300 ${
                      isIn || isInvited ? '' : full && r.live ? 'opacity-30' : 'hover:opacity-80'
                    }`}
                    style={
                      isIn || isInvited
                        ? { backgroundColor: r.ink, color: r.tone }
                        : { boxShadow: 'inset 0 0 0 1.5px currentColor' }
                    }
                  >
                    {busyRoom === r.id
                      ? 'Syncing…'
                      : isInvited
                        ? 'Accept invite'
                        : isIn
                          ? 'Enter room'
                          : full && r.live
                            ? 'Room full'
                            : r.live
                              ? 'Take a desk'
                              : 'Starter room'}
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className="mt-4 block w-full rounded-full py-2.5 text-center text-sm font-bold transition-all duration-300 hover:opacity-80"
                    style={{ boxShadow: 'inset 0 0 0 1.5px currentColor' }}
                  >
                    Log in to take a desk
                  </Link>
                )}
              </div>
            </article>
          );
        })}
        {filtered.length === 0 && (
          <p className="t-faint col-span-full py-10 text-center text-sm">
            No clusters match “{query}” — try another topic.
          </p>
        )}
      </div>
        </>
      )}
      {showCreate && profile && (
        <CreateRoomModal
          profile={profile}
          onCreated={handleCreated}
          onClose={() => setShowCreate(false)}
        />
      )}
    </AppShell>
  );
}
