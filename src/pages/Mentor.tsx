import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import AppShell from '@/components/app/AppShell';
import { DoodleBulb, DoodleNote, DoodlePeople, DoodleSpark } from '@/components/Doodles';
import { useAuth } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';

type Broadcast = {
  id: string;
  content: string;
  type: string;
  likes: number;
  created_at: string;
};

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

  useEffect(() => {
    if (ready && profile?.role !== 'TEACHER') navigate('/wall', { replace: true });
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
