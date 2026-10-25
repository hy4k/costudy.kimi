import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import Header from '@/components/Header';
import { DoodleBulb, DoodleNote, DoodlePeople } from '@/components/Doodles';
import { useAuth, type Role } from '@/lib/authStore';

const roles: {
  key: Role;
  title: string;
  copy: string;
  cta: string;
  Doodle: typeof DoodlePeople;
}[] = [
  {
    key: 'STUDENT',
    title: 'Student',
    copy: 'Take a desk on the wall, bank goals, raid the vault, sit mocks.',
    cta: 'Enter as a student',
    Doodle: DoodleNote,
  },
  {
    key: 'TEACHER',
    title: 'Mentor',
    copy: 'Broadcast to the faculty room, post bounties, audit essays, guide paths.',
    cta: 'Enter as a mentor',
    Doodle: DoodleBulb,
  },
];

export default function Login() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [role, setRole] = useState<Role>('STUDENT');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const profile = mode === 'signin' ? await signIn(email, pass) : await signUp(name, email, pass, role);
      navigate(profile.role === 'TEACHER' ? '/mentor' : '/wall', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — try again.');
    } finally {
      setBusy(false);
    }
  };

  const active = roles.find((r) => r.key === role)!;

  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-5 pb-16 pt-28 sm:px-8">
        <p className="eyebrow mb-3 text-[#ea4467]">Two doors, one campus</p>
        <h1 className="slab-display max-w-xl text-4xl t-ink md:text-5xl">
          {mode === 'signin' ? 'Pick up where you left off.' : 'Claim your seat.'}
        </h1>

        {/* role switch */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {roles.map((r) => (
            <button
              key={r.key}
              onClick={() => setRole(r.key)}
              className={`group flex items-start gap-4 rounded-[1.6rem] border-[1.5px] p-6 text-left transition-all duration-500 ${
                role === r.key
                  ? 'border-[#ea4467] bg-[var(--card)] shadow-[8px_8px_0_0_var(--line)]'
                  : 'b-line hover:border-[var(--ink)]'
              }`}
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors duration-500 ${
                  role === r.key ? 'bg-[#ea4467] text-white' : 'bg-[var(--card)] t-ink'
                }`}
              >
                <r.Doodle className="h-6 w-6" />
              </span>
              <span>
                <span className="slab-display block text-2xl t-ink">{r.title}</span>
                <span className="mt-1 block text-sm leading-relaxed t-muted">{r.copy}</span>
                <span
                  className={`mt-3 inline-block rounded-full px-3 py-1 text-[0.65rem] font-bold tracking-widest transition-colors duration-500 ${
                    role === r.key ? 'bg-[#e7fec7] text-[#21221f]' : 'b-line t-faint'
                  }`}
                >
                  {r.cta}
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* form */}
        <form onSubmit={submit} className="mt-8 max-w-xl space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="auth-name" className="eyebrow t-faint">Full name</label>
              <input
                id="auth-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-2 w-full rounded-xl border-[1.5px] b-line bg-[var(--card)] p-4 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
                placeholder={role === 'TEACHER' ? 'Dr. Anita Desai' : 'Rohan Sharma'}
              />
            </div>
          )}
          <div>
            <label htmlFor="auth-email" className="eyebrow t-faint">Email</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-2 w-full rounded-xl border-[1.5px] b-line bg-[var(--card)] p-4 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="auth-pass" className="eyebrow t-faint">Password</label>
            <input
              id="auth-pass"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              required
              minLength={6}
              className="mt-2 w-full rounded-xl border-[1.5px] b-line bg-[var(--card)] p-4 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
              placeholder="Six characters minimum"
            />
          </div>

          {error && (
            <p className="rounded-xl border-[1.5px] border-[#ea4467] bg-[#ea4467]/10 px-4 py-3 text-sm font-semibold t-ink">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button type="submit" disabled={busy} className="pill-btn !px-6 !py-3 text-sm disabled:opacity-40">
              {busy ? 'Syncing…' : mode === 'signin' ? active.cta : `Create ${role === 'TEACHER' ? 'mentor' : 'student'} account`}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
              }}
              className="link-underline text-sm font-semibold t-muted hover:t-ink"
            >
              {mode === 'signin' ? 'New here? Create an account' : 'Already registered? Sign in'}
            </button>
          </div>
          <p className="flex items-center gap-2 text-xs t-faint">
            <DoodlePeople className="h-4 w-4" />
            Students land on the Study Wall · Mentors land in the Faculty Room.
          </p>
        </form>

        <Link to="/" className="link-underline mt-12 inline-block w-fit text-sm font-semibold t-muted hover:t-ink">
          ← Back to the site
        </Link>
      </main>
    </div>
  );
}
