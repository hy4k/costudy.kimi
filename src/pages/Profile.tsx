import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import AppShell from '@/components/app/AppShell';
import { DoodleNote, DoodlePeople, DoodleSpark } from '@/components/Doodles';
import { useAuth } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';

type RawProfile = {
  id: string;
  name: string | null;
  handle: string | null;
  bio: string | null;
  avatar: string | null;
  role: string | null;
  primary_exam: string | null;
  exam_window: string | null;
  strategic_milestone: string | null;
  signal_level: string | null;
  specialties: string[] | null;
  years_experience: number | null;
  hourly_rate: number | null;
  tier: string | null;
  streak_days: number | null;
  total_mocks: number | null;
  total_essays: number | null;
  city: string | null;
  country: string | null;
  learning_style: string | null;
  experience_level: string | null;
  created_at: string | null;
};

type EditForm = {
  name: string;
  handle: string;
  bio: string;
  primary_exam: string;
  strategic_milestone: string;
  avatar: string;
  specialties: string;
  years_experience: string;
  hourly_rate: string;
};

const inputCls =
  'mt-2 w-full rounded-xl border-[1.5px] b-line bg-[var(--card)] p-4 text-sm t-ink placeholder:t-faint focus:border-[var(--coral)] focus:outline-none';
const labelCls = 'eyebrow t-faint';

type MockRow = {
  id: string;
  label: string;
  when: string;
  detail: string;
  score: string;
  passed: boolean | null;
};

type PostRow = {
  id: string;
  type: string | null;
  content: string;
  likes: number | null;
  replies: number | null;
  when: string;
};

export default function Profile() {
  const navigate = useNavigate();
  const { profile, ready, refresh, signOut } = useAuth();
  const isTeacher = profile?.role === 'TEACHER';

  const [raw, setRaw] = useState<RawProfile | null>(null);
  const [mocks, setMocks] = useState<MockRow[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [partnerCount, setPartnerCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<EditForm>({
    name: '',
    handle: '',
    bio: '',
    primary_exam: 'CMA Part 1',
    strategic_milestone: '',
    avatar: '',
    specialties: '',
    years_experience: '',
    hourly_rate: '',
  });

  useEffect(() => {
    if (!ready) return;
    if (!profile) {
      navigate('/login', { replace: true });
      return;
    }
    supabase
      .from('user_profiles')
      .select('*')
      .eq('id', profile.id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) return;
        const r = data as RawProfile;
        setRaw(r);
        setForm({
          name: r.name || '',
          handle: r.handle || '',
          bio: r.bio || '',
          primary_exam: r.primary_exam || 'CMA Part 1',
          strategic_milestone: r.strategic_milestone || '',
          avatar: r.avatar || '',
          specialties: (r.specialties || []).join(', '),
          years_experience: r.years_experience?.toString() || '',
          hourly_rate: r.hourly_rate?.toString() || '',
        });

        // study activity: mock history + wall posts + contracts
        const [attemptsRes, legacyRes, postsRes, partnersRes] = await Promise.all([
          supabase
            .from('mock_attempts')
            .select('id, section, completed_at, started_at, total_score, scaled_score, mcq_correct, mcq_total, passed')
            .eq('user_id', profile.id)
            .order('completed_at', { ascending: false })
            .limit(5),
          supabase
            .from('mock_test_results')
            .select('id, test_name, score, scaled_score, passed, created_at')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('posts')
            .select('id, type, content, likes, created_at, comments(count)')
            .eq('author_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('alignments')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', profile.id)
            .eq('status', 'ACTIVE'),
        ]);

        const attemptRows: MockRow[] = (attemptsRes.data || []).map((a) => ({
          id: a.id,
          label: a.section || 'Mock exam',
          when: a.completed_at || a.started_at || '',
          detail:
            typeof a.mcq_correct === 'number' && typeof a.mcq_total === 'number'
              ? `${a.mcq_correct}/${a.mcq_total} MCQs correct`
              : '',
          score: a.scaled_score != null ? `${a.scaled_score}/500` : a.total_score != null ? `${a.total_score}%` : '—',
          passed: a.passed ?? null,
        }));
        const legacyRows: MockRow[] = (legacyRes.data || []).map((t) => ({
          id: t.id,
          label: t.test_name || 'Mock test',
          when: t.created_at || '',
          detail: t.score != null ? `raw ${t.score}` : '',
          score: t.scaled_score != null ? `${t.scaled_score}/500` : '—',
          passed: t.passed ?? null,
        }));
        setMocks(
          [...attemptRows, ...legacyRows]
            .sort((x, y) => new Date(y.when).getTime() - new Date(x.when).getTime())
            .slice(0, 5),
        );
        setPosts(
          (postsRes.data || []).map((p) => ({
            id: p.id,
            type: p.type,
            content: p.content,
            likes: p.likes,
            replies: Array.isArray(p.comments) && p.comments.length > 0 ? p.comments[0].count : 0,
            when: p.created_at,
          })),
        );
        setPartnerCount(partnersRes.count ?? 0);
      });
  }, [ready, profile, navigate]);

  if (!ready || !profile) {
    return (
      <AppShell title="Your profile" eyebrow="Identity">
        <p className="t-muted">Loading your desk…</p>
      </AppShell>
    );
  }

  const initials = profile.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const accent = isTeacher ? '#6f9c3e' : 'var(--coral)';

  const pickFile = () => editing && fileRef.current?.click();
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('That photo is over 2 MB — pick a smaller one.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setForm((f) => ({ ...f, avatar: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const payload: Record<string, unknown> = {
      name: form.name.trim() || profile.name,
      handle: form.handle.trim().toLowerCase().replace(/\s/g, '_') || profile.handle,
      bio: form.bio,
      primary_exam: form.primary_exam,
      strategic_milestone: form.strategic_milestone,
      avatar: form.avatar,
      updated_at: new Date().toISOString(),
    };
    if (isTeacher) {
      payload.specialties = form.specialties.split(',').map((s) => s.trim()).filter(Boolean);
      payload.years_experience = Number(form.years_experience) || 0;
      payload.hourly_rate = Number(form.hourly_rate) || 0;
    }
    const { error: err } = await supabase.from('user_profiles').update(payload).eq('id', profile.id);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    await refresh();
    setSaved(true);
    setEditing(false);
    const { data } = await supabase.from('user_profiles').select('*').eq('id', profile.id).maybeSingle();
    if (data) setRaw(data as RawProfile);
    setTimeout(() => setSaved(false), 2500);
  };

  const logout = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const stats = [
    { label: 'Day streak', value: raw?.streak_days ?? 0 },
    { label: 'Mocks taken', value: raw?.total_mocks ?? 0 },
    { label: 'Essays written', value: raw?.total_essays ?? 0 },
    { label: 'Study partners', value: partnerCount },
  ];

  return (
    <AppShell title="Your profile" eyebrow="Identity & settings">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      {/* identity card */}
      <section className="relative overflow-hidden rounded-[1.8rem] border-[1.5px] b-line bg-[var(--card)] p-8 md:p-12">
        <DoodleSpark className="pointer-events-none absolute -right-4 -top-4 w-28 rotate-12 text-[var(--coral)]/10" />
        <div className="flex flex-col items-start gap-8 md:flex-row md:items-center md:gap-12">
          <button
            onClick={pickFile}
            className={`relative shrink-0 rounded-[2rem] shadow-[8px_8px_0_0_var(--line)] ${
              editing ? 'cursor-pointer transition-transform hover:scale-[1.02]' : 'cursor-default'
            }`}
            aria-label={editing ? 'Change profile photo' : 'Profile photo'}
          >
            {form.avatar || raw?.avatar ? (
              <img
                src={form.avatar || raw?.avatar || ''}
                alt={profile.name}
                className={`h-32 w-32 rounded-[2rem] object-cover md:h-40 md:w-40 ${
                  editing ? 'opacity-60' : ''
                }`}
              />
            ) : (
              <span
                className="flex h-32 w-32 items-center justify-center rounded-[2rem] font-slab text-4xl font-bold text-white md:h-40 md:w-40"
                style={{ backgroundColor: accent }}
              >
                {initials}
              </span>
            )}
            {editing && (
              <span className="absolute inset-0 flex items-center justify-center rounded-[2rem] text-xs font-bold uppercase tracking-widest text-white">
                Change
              </span>
            )}
            <span
              className="absolute -bottom-3 -right-3 flex h-10 w-10 items-center justify-center rounded-full border-4 border-[var(--card)] text-white"
              style={{ backgroundColor: accent }}
            >
              {isTeacher ? '★' : '✓'}
            </span>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="rounded-full px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-white"
                style={{ backgroundColor: accent }}
              >
                {isTeacher ? 'Mentor · Faculty' : 'Student'}
              </span>
              <span className="rounded-full border-[1.5px] b-line px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.16em] t-muted">
                {raw?.primary_exam || profile.examFocus}
              </span>
              {raw?.tier && (
                <span className="rounded-full bg-[var(--mint)] px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[var(--ink)]">
                  {raw.tier} tier
                </span>
              )}
            </div>

            <h2 className="slab-display mt-4 break-words text-4xl t-ink md:text-5xl">
              {profile.name}
            </h2>
            <p className="mt-1 font-mono text-sm t-muted">@{profile.handle}</p>

            {raw?.bio && !editing && (
              <p className="mt-4 max-w-xl leading-relaxed t-muted">{raw.bio}</p>
            )}
            {(raw?.strategic_milestone || raw?.exam_window) && !editing && (
              <p className="mt-2 text-sm font-semibold t-muted">
                {raw.strategic_milestone && <>Goal: {raw.strategic_milestone} · </>}
                {raw.exam_window && <>Window: {raw.exam_window}</>}
              </p>
            )}
            {isTeacher && raw?.specialties && raw.specialties.length > 0 && !editing && (
              <p className="mt-2 flex flex-wrap gap-2">
                {raw.specialties.map((s) => (
                  <span key={s} className="rounded-full bg-[var(--line)] px-3 py-1 text-xs font-semibold t-ink">
                    {s}
                  </span>
                ))}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-4">
              {!editing && (
                <>
                  <button onClick={() => setEditing(true)} className="pill-btn !px-6 !py-3 text-sm">
                    Edit profile
                  </button>
                  <button
                    onClick={logout}
                    className="rounded-full border-[1.5px] b-line px-6 py-3 text-sm font-bold t-muted transition-colors hover:border-[var(--coral)] hover:text-[var(--coral)]"
                  >
                    Sign out
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* stats */}
      <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            to={s.label === 'Study partners' ? '/contracts' : '/profile'}
            className={`block rounded-[1.4rem] border-[1.5px] b-line p-5 text-center transition-transform hover:-translate-y-0.5 ${
              s.label === 'Study partners' ? 'bg-[#e9c46a]/25' : 'bg-[var(--card)]'
            }`}
          >
            <p className="slab-display text-3xl t-ink md:text-4xl">{s.value}</p>
            <p className="eyebrow mt-1 t-faint">{s.label}</p>
            {s.label === 'Study partners' && (
              <p className="eyebrow mt-2 text-[10px] normal-case tracking-normal t-faint">
                Manage contracts →
              </p>
            )}
          </Link>
        ))}
      </section>

      {/* study activity */}
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-[1.8rem] border-[1.5px] b-line bg-[var(--card)] p-7 md:p-9">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="slab-display text-2xl t-ink">Mock history</h3>
            <Link to="/path" className="link-underline text-xs font-bold uppercase tracking-widest t-muted hover:t-ink">
              Mastery Path →
            </Link>
          </div>
          {mocks.length === 0 ? (
            <p className="rounded-[1.2rem] bg-[var(--line)]/40 p-6 text-sm t-muted">
              No mocks yet — your finished attempts land here with scores and pass marks.
            </p>
          ) : (
            <ul className="space-y-3">
              {mocks.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-4 rounded-[1.2rem] border-[1.5px] b-line p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold t-ink">{m.label}</p>
                    <p className="text-xs t-faint">
                      {m.when ? new Date(m.when).toLocaleDateString() : '—'}
                      {m.detail && <> · {m.detail}</>}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="slab-display text-xl t-ink">{m.score}</span>
                    {m.passed === true && (
                      <span className="rounded-full bg-[var(--mint)] px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-widest text-[#4a7a2e]">
                        Pass
                      </span>
                    )}
                    {m.passed === false && (
                      <span className="rounded-full bg-[var(--coral)]/10 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-widest text-[var(--coral)]">
                        Retry
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-[1.8rem] border-[1.5px] b-line bg-[var(--card)] p-7 md:p-9">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="slab-display text-2xl t-ink">On the Wall</h3>
            <Link to="/wall" className="link-underline text-xs font-bold uppercase tracking-widest t-muted hover:t-ink">
              Study Wall →
            </Link>
          </div>
          {posts.length === 0 ? (
            <p className="rounded-[1.2rem] bg-[var(--line)]/40 p-6 text-sm t-muted">
              Nothing posted yet — share a note or a win and it shows up here.
            </p>
          ) : (
            <ul className="space-y-3">
              {posts.map((p) => (
                <li key={p.id} className="rounded-[1.2rem] border-[1.5px] b-line p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-bold t-ink">
                      {p.type ? `${p.type} · ` : ''}
                      {p.content}
                    </p>
                    <span className="shrink-0 text-xs t-faint">
                      {p.when ? new Date(p.when).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs t-muted">
                    ▲ {p.likes ?? 0} · {p.replies ?? 0} replies
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* edit form */}
      {editing && (
        <form
          onSubmit={save}
          className="mt-6 space-y-5 rounded-[1.8rem] border-[1.5px] b-line bg-[var(--card)] p-8 md:p-10"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="pf-name" className={labelCls}>Full name</label>
              <input
                id="pf-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                className={inputCls}
                placeholder="Your name"
              />
            </div>
            <div>
              <label htmlFor="pf-handle" className={labelCls}>Handle</label>
              <input
                id="pf-handle"
                value={form.handle}
                onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
                required
                className={inputCls}
                placeholder="your_handle"
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="pf-exam" className={labelCls}>Exam focus</label>
              <select
                id="pf-exam"
                value={form.primary_exam}
                onChange={(e) => setForm((f) => ({ ...f, primary_exam: e.target.value }))}
                className={inputCls}
              >
                <option>CMA Part 1</option>
                <option>CMA Part 2</option>
                <option>Both parts</option>
              </select>
            </div>
            <div>
              <label htmlFor="pf-goal" className={labelCls}>Current goal</label>
              <input
                id="pf-goal"
                value={form.strategic_milestone}
                onChange={(e) => setForm((f) => ({ ...f, strategic_milestone: e.target.value }))}
                className={inputCls}
                placeholder="e.g. Finish Part 1 syllabus by March"
              />
            </div>
          </div>

          <div>
            <label htmlFor="pf-bio" className={labelCls}>{isTeacher ? 'Professional bio' : 'Short bio'}</label>
            <textarea
              id="pf-bio"
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="A line or two about you…"
            />
          </div>

          {isTeacher && (
            <div className="grid gap-5 rounded-[1.4rem] bg-[var(--line)]/40 p-6 md:grid-cols-3">
              <div>
                <label htmlFor="pf-spec" className={labelCls}>Specialties</label>
                <input
                  id="pf-spec"
                  value={form.specialties}
                  onChange={(e) => setForm((f) => ({ ...f, specialties: e.target.value }))}
                  className={inputCls}
                  placeholder="Variance analysis, CBQ drills…"
                />
              </div>
              <div>
                <label htmlFor="pf-years" className={labelCls}>Years of experience</label>
                <input
                  id="pf-years"
                  type="number"
                  min={0}
                  value={form.years_experience}
                  onChange={(e) => setForm((f) => ({ ...f, years_experience: e.target.value }))}
                  className={inputCls}
                  placeholder="8"
                />
              </div>
              <div>
                <label htmlFor="pf-rate" className={labelCls}>Hourly rate (₹)</label>
                <input
                  id="pf-rate"
                  type="number"
                  min={0}
                  value={form.hourly_rate}
                  onChange={(e) => setForm((f) => ({ ...f, hourly_rate: e.target.value }))}
                  className={inputCls}
                  placeholder="1200"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-xl border-[1.5px] border-[var(--coral)] bg-[var(--coral)]/10 px-4 py-3 text-sm font-semibold t-ink">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button type="submit" disabled={busy} className="pill-btn !px-6 !py-3 text-sm disabled:opacity-40">
              {busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="link-underline text-sm font-semibold t-muted hover:t-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {!editing && (
        <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[1.4rem] border-[1.5px] b-line bg-[var(--card)] p-6">
          <p className="flex items-center gap-2 text-sm t-muted">
            <DoodlePeople className="h-5 w-5" />
            Student of the CMA US commons since{' '}
            {raw?.created_at ? new Date(raw.created_at).toLocaleDateString() : '—'}
          </p>
          <Link to="/" className="link-underline flex items-center gap-2 text-sm font-semibold t-muted hover:t-ink">
            <DoodleNote className="h-5 w-5" />
            Back to the site
          </Link>
        </section>
      )}
    </AppShell>
  );
}
