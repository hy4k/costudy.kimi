import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import AppShell from '@/components/app/AppShell';
import { DoodleBook, DoodleBulb, DoodleSpark } from '@/components/Doodles';
import { useAuth } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';

type MentorRow = {
  id: string;
  name: string | null;
  handle: string | null;
  bio: string | null;
  specialties: string[] | null;
  years_experience: number | null;
  hourly_rate: number | null;
  avatar_url: string | null;
};

type Course = {
  id: string;
  mentor_id: string;
  title: string;
  description: string | null;
  price: number;
  duration_weeks: number;
  schedule_text: string | null;
  max_students: number;
  mentor?: { name?: string } | null;
};

type MyRoom = { id: string; name: string };

const initials = (n?: string | null) =>
  (n || 'M').split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

export default function Mentors() {
  const { ready, profile } = useAuth();
  const [mentors, setMentors] = useState<MentorRow[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [myRooms, setMyRooms] = useState<MyRoom[]>([]);
  const [query, setQuery] = useState('');
  const [part, setPart] = useState<'ALL' | 'Part 1' | 'Part 2'>('ALL');
  const [hireFor, setHireFor] = useState<MentorRow | null>(null);
  const [hire, setHire] = useState({ roomId: '', date: '', time: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('user_profiles')
      .select('id, name, handle, bio, specialties, years_experience, hourly_rate, avatar_url')
      .in('role', ['TEACHER', 'teacher', 'EXPERT'])
      .order('years_experience', { ascending: false })
      .then(({ data }) => setMentors((data as MentorRow[]) || []));
    supabase
      .from('mentor_courses')
      .select('id, mentor_id, title, description, price, duration_weeks, schedule_text, max_students, mentor:user_profiles(name)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => setCourses((data as Course[]) || []));
  }, []);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('study_room_members')
      .select('room_id, room:study_rooms(name)')
      .eq('user_id', profile.id)
      .eq('status', 'ACTIVE')
      .then(({ data }) =>
        setMyRooms(
          ((data as { room_id: string; room?: { name?: string } }[]) || []).map((r) => ({
            id: r.room_id,
            name: r.room?.name || 'Room',
          })),
        ),
      );
  }, [profile]);

  const filtered = mentors.filter((m) => {
    const q = query.trim().toLowerCase();
    const hay = `${m.name || ''} ${m.handle || ''} ${(m.specialties || []).join(' ')} ${m.bio || ''}`.toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (part !== 'ALL') {
      const specs = (m.specialties || []).join(' ').toLowerCase();
      if (!specs.includes(part.toLowerCase())) return false;
    }
    return true;
  });

  const sendHire = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !hireFor) return;
    if (!hire.roomId || !hire.date || !hire.time) {
      setNote('Pick a room, date and time so the mentor knows the plan.');
      return;
    }
    setBusy(true);
    const agreed = hireFor.hourly_rate || 0;
    const when = new Date(`${hire.date}T${hire.time}`);
    const { error } = await supabase.from('mentor_invitations').insert({
      room_id: hire.roomId,
      mentor_id: hireFor.id,
      inviter_id: profile.id,
      agreed_fee: agreed,
      costudy_fee: Math.ceil(agreed * 0.2),
      status: 'PENDING',
      session_date: when.toISOString(),
      note: hire.note.trim() || null,
    });
    setBusy(false);
    if (error) {
      setNote(error.message);
      return;
    }
    setNote(`Hire request sent to ${hireFor.name || 'the mentor'} — you’ll see them in your room once accepted.`);
    setHireFor(null);
    setHire({ roomId: '', date: '', time: '', note: '' });
  };

  const enroll = async (c: Course) => {
    if (!profile) return;
    setBusy(true);
    const { error: e1 } = await supabase.from('student_enrollments').insert({
      teacher_id: c.mentor_id,
      student_id: profile.id,
      status: 'ACTIVE',
    });
    const { error: e2 } = await supabase.from('session_payments').insert({
      user_id: profile.id,
      amount: c.price,
      status: 'PENDING',
    });
    setBusy(false);
    if (e1 || e2) {
      setNote((e1 || e2)?.message || 'Enrolment failed — try again.');
      return;
    }
    setNote(`Enrolled in “${c.title}” — ${c.mentor?.name || 'the mentor'} will reach out to schedule the first session.`);
  };

  return (
    <AppShell eyebrow="Faculty for hire" title="Find a mentor">
      {!ready || !profile ? (
        <section className="max-w-lg rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-8">
          <p className="slab-display text-2xl t-ink">Log in to hire a mentor.</p>
          <p className="mt-3 text-sm leading-relaxed t-muted">
            Mentors teach inside live study rooms — chat, whiteboard, plan and drills included.
          </p>
          <Link to="/login" className="pill-btn mt-6 inline-block !px-6 !py-3 text-sm">
            Log in
          </Link>
        </section>
      ) : (
        <>
          {/* course offers */}
          {courses.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center gap-2">
                <DoodleBook className="h-5 w-5 text-[var(--coral)]" />
                <h2 className="slab-display text-2xl t-ink">Open cohorts &amp; offers</h2>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {courses.map((c) => (
                  <article key={c.id} className="flex flex-col justify-between rounded-[1.4rem] bg-[#e7fec7] p-6 text-[#21221f]">
                    <div>
                      <p className="eyebrow opacity-70">{c.mentor?.name || 'Faculty'} · {c.duration_weeks} weeks · {c.max_students} seats</p>
                      <h3 className="slab-display mt-2 text-xl leading-snug">{c.title}</h3>
                      {c.description && <p className="mt-2 text-sm leading-relaxed opacity-75">{c.description}</p>}
                      {c.schedule_text && (
                        <p className="mt-3 inline-block rounded-full bg-[#21221f] px-3 py-1 text-[0.65rem] font-bold tracking-wide text-[#e7fec7]">
                          {c.schedule_text}
                        </p>
                      )}
                    </div>
                    <div className="mt-5 flex items-center justify-between">
                      <span className="slab-display text-2xl">{c.price > 0 ? `₹${Number(c.price).toLocaleString('en-IN')}` : 'Free'}</span>
                      <button
                        onClick={() => enroll(c)}
                        disabled={busy || profile.role === 'TEACHER'}
                        className="rounded-full bg-[#21221f] px-5 py-2.5 text-xs font-bold text-[#e7fec7] transition-opacity hover:opacity-85 disabled:opacity-40"
                      >
                        Enroll
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* filters */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search mentors, subjects, specialties…"
              className="w-full max-w-sm rounded-full border-[1.5px] b-line bg-[var(--card)] px-5 py-2.5 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
            />
            {(['ALL', 'Part 1', 'Part 2'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPart(p)}
                className={`rounded-full border-[1.5px] px-4 py-2 text-xs font-bold tracking-wide transition-colors ${
                  part === p ? 'border-[#ea4467] bg-[#ea4467] text-white' : 'b-line t-muted hover:t-ink'
                }`}
              >
                {p === 'ALL' ? 'ALL' : p.toUpperCase()}
              </button>
            ))}
          </div>

          {note && (
            <p className="mb-6 rounded-xl border-[1.5px] border-dashed b-line px-4 py-3 text-xs font-semibold t-muted">{note}</p>
          )}

          {/* mentor cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((m) => (
              <article key={m.id} className="flex min-h-[220px] flex-col justify-between rounded-[1.4rem] border-[1.5px] b-line bg-[var(--card)] p-6">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#21221f] font-slab text-sm font-bold text-[#e7fec7]">
                      {initials(m.name)}
                    </span>
                    <div>
                      <h3 className="slab-display text-lg leading-snug t-ink">{m.name || 'Faculty mentor'}</h3>
                      <p className="text-xs t-faint">@{m.handle}</p>
                    </div>
                    <span className="ml-auto rounded-full bg-[#e7fec7] px-3 py-1 text-[0.6rem] font-bold tracking-widest text-[#21221f]">
                      {m.years_experience ? `${m.years_experience} YRS` : 'MENTOR'}
                    </span>
                  </div>
                  {m.bio && <p className="mt-3 text-xs leading-relaxed t-muted">{m.bio}</p>}
                  {(m.specialties || []).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {m.specialties!.map((s) => (
                        <span key={s} className="rounded-full border-[1.5px] b-line px-2.5 py-1 text-[0.6rem] font-bold tracking-wide t-muted">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <span className="slab-display text-xl t-ink">
                    {m.hourly_rate ? `₹${m.hourly_rate.toLocaleString('en-IN')}/hr` : 'Rate on request'}
                  </span>
                  <button
                    onClick={() => {
                      setHireFor(m);
                      setHire((h) => ({ ...h, roomId: myRooms[0]?.id || '' }));
                    }}
                    disabled={profile.role === 'TEACHER' && m.id === profile.id}
                    className="rounded-full bg-[var(--coral)] px-5 py-2.5 text-xs font-bold text-white transition-opacity hover:opacity-85 disabled:opacity-40"
                  >
                    {profile.role === 'TEACHER' && m.id === profile.id ? 'That’s you' : 'Hire'}
                  </button>
                </div>
              </article>
            ))}
            {filtered.length === 0 && (
              <p className="t-faint col-span-full py-10 text-center text-sm">
                No mentors match “{query}” yet — check back as faculty joins.
              </p>
            )}
          </div>

          <p className="mt-8 flex items-center gap-2 text-[0.65rem] t-faint">
            <DoodleSpark className="h-3.5 w-3.5" />
            Mentors teach inside your study rooms — sessions, whiteboard, plan and drills all included. CoStudy keeps a small platform fee on every hire.
          </p>
        </>
      )}

      {/* hire modal */}
      {hireFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#21221f]/60 p-4 backdrop-blur-sm"
          onClick={() => setHireFor(null)}
        >
          <div
            className="w-full max-w-md rounded-[1.6rem] bg-[var(--card)] p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#21221f] font-slab text-xs font-bold text-[#e7fec7]">
                {initials(hireFor.name)}
              </span>
              <div>
                <h3 className="slab-display text-xl t-ink">Hire {hireFor.name}</h3>
                <p className="text-xs t-faint">
                  {hireFor.hourly_rate ? `₹${hireFor.hourly_rate.toLocaleString('en-IN')}/hr · CoStudy fee ₹${Math.ceil((hireFor.hourly_rate || 0) * 0.2).toLocaleString('en-IN')} ` : 'Fee agreed on accept'}
                </p>
              </div>
            </div>
            <form onSubmit={sendHire} className="mt-5 space-y-3">
              <label className="block">
                <span className="eyebrow t-faint">Teach in which room?</span>
                {myRooms.length ? (
                  <select
                    value={hire.roomId}
                    onChange={(e) => setHire({ ...hire, roomId: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-4 py-3 text-sm t-ink focus:border-[var(--ink)] focus:outline-none"
                  >
                    {myRooms.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1.5 rounded-xl border-[1.5px] border-dashed b-line px-4 py-3 text-xs font-semibold t-muted">
                    You need a room first — <Link to="/rooms" className="font-bold text-[var(--coral)]">open one</Link>, then hire.
                  </p>
                )}
              </label>
              <div className="flex gap-2">
                <input type="date" value={hire.date} onChange={(e) => setHire({ ...hire, date: e.target.value })} className="flex-1 rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-4 py-3 text-sm t-ink focus:border-[var(--ink)] focus:outline-none" />
                <input type="time" value={hire.time} onChange={(e) => setHire({ ...hire, time: e.target.value })} className="flex-1 rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-4 py-3 text-sm t-ink focus:border-[var(--ink)] focus:outline-none" />
              </div>
              <textarea
                value={hire.note}
                onChange={(e) => setHire({ ...hire, note: e.target.value })}
                rows={3}
                placeholder="What should the session focus on? (optional — goes with your request)"
                className="w-full resize-none rounded-xl border-[1.5px] b-line bg-[var(--paper)] p-4 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
              />
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={busy || myRooms.length === 0} className="pill-btn flex-1 !py-3 text-sm disabled:opacity-40">
                  {busy ? 'Sending…' : 'Send hire request'}
                </button>
                <button type="button" onClick={() => setHireFor(null)} className="rounded-full border-[1.5px] b-line px-5 py-3 text-xs font-bold t-muted hover:t-ink">
                  Cancel
                </button>
              </div>
            </form>
            <p className="mt-4 flex items-center gap-2 text-[0.65rem] t-faint">
              <DoodleBulb className="h-3.5 w-3.5" />
              On accept, the mentor joins your room and a kickoff session is scheduled automatically.
            </p>
          </div>
        </div>
      )}
    </AppShell>
  );
}
