import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { DoodleBulb, DoodleNote, DoodlePeople, DoodleSpark } from '@/components/Doodles';
import { useAuth, type Role } from '@/lib/authStore';

const roles: {
  key: Role;
  title: string;
  copy: string;
  cta: string;
  accent: string;
  Doodle: typeof DoodlePeople;
}[] = [
  {
    key: 'STUDENT',
    title: 'Aspirant',
    copy: 'Take a desk on the wall, bank goals, raid the vault, sit mocks.',
    cta: 'Enter as a student',
    accent: '#eb6b57',
    Doodle: DoodleNote,
  },
  {
    key: 'TEACHER',
    title: 'Mentor',
    copy: 'Broadcast to the faculty room, post bounties, audit essays, guide paths.',
    cta: 'Enter as a mentor',
    accent: '#10b981',
    Doodle: DoodleBulb,
  },
];

const inputCls =
  'w-full rounded-2xl border-2 border-white/10 bg-white/5 px-6 py-4 text-sm font-semibold text-white outline-none transition-all placeholder:font-medium placeholder:text-white/30 focus:border-white/30 focus:bg-white/10';

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { signIn, signUp } = useAuth();
  const [role, setRole] = useState<Role>('STUDENT');
  const [mode, setMode] = useState<'signin' | 'signup'>(params.get('mode') === 'signup' ? 'signup' : 'signin');
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
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0b0f19] p-4 font-sans sm:p-6">
      {/* ambient glow */}
      <div className="pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px] animate-pulse rounded-full bg-[#eb6b57]/15 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-48 -left-40 h-[480px] w-[480px] rounded-full bg-emerald-500/10 blur-[140px]" />

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5 sm:px-10">
        <span className="font-slab text-lg font-bold tracking-tight text-white">
          Co<span className="text-[#eb6b57]">Study</span>
          <span className="ml-2 rounded-full border border-white/15 px-2 py-0.5 align-middle text-[0.55rem] font-black tracking-[0.2em] text-white/60">
            CMA US
          </span>
        </span>
        <Link
          to="/"
          className="rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          ← Back to the site
        </Link>
      </div>

      {/* the glass panel */}
      <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-2xl lg:grid-cols-2">
        {/* brand side */}
        <div className="relative hidden flex-col justify-between border-r border-white/5 bg-gradient-to-br from-white/[0.04] to-transparent p-12 lg:flex">
          <div>
            <p className="eyebrow text-[#eb6b57]">Official CMA US study protocol</p>
            <h1 className="slab-display mt-6 text-6xl font-bold uppercase leading-[0.9] tracking-tight text-white">
              Master
              <br />
              CMA
              <br />
              <span className="text-[#eb6b57]">together.</span>
            </h1>
            <p className="mt-6 max-w-sm text-base italic leading-relaxed text-white/50">
              Beyond a platform — your strategy for the CMA US. Live rooms, a 10,000+ question bank,
              faculty on hire, and a wall that never sleeps.
            </p>
          </div>
          <ul className="space-y-3">
            {[
              { icon: DoodleSpark, text: '10,000+ verified MCQs & CBQ cases' },
              { icon: DoodlePeople, text: 'Study rooms with live presence' },
              { icon: DoodleNote, text: 'Mentors teach inside your rooms' },
            ].map((f, i) => (
              <li key={i} className="flex items-center gap-3 text-sm font-semibold text-white/70">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                  <f.icon className="h-4 w-4 text-[#eb6b57]" />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        {/* form side */}
        <div className="p-8 sm:p-12">
          <p className="eyebrow text-white/40">{mode === 'signin' ? 'Candidate login' : 'Register new profile'}</p>
          <h2 className="slab-display mt-3 text-3xl text-white sm:text-4xl">
            {mode === 'signin' ? 'Pick up where you left off.' : 'Claim your seat.'}
          </h2>

          {/* role switch */}
          <div className="mt-8 flex gap-2">
            {roles.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRole(r.key)}
                className={`flex flex-1 items-center gap-2.5 rounded-2xl border-2 px-4 py-3 text-left transition-all duration-300 ${
                  role === r.key
                    ? 'border-transparent text-white shadow-lg'
                    : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white/80'
                }`}
                style={role === r.key ? { backgroundColor: r.accent } : undefined}
              >
                <r.Doodle className="h-5 w-5 shrink-0" />
                <span>
                  <span className="block text-sm font-black leading-tight">{r.title}</span>
                  <span className={`block text-[0.65rem] ${role === r.key ? 'text-white/75' : 'text-white/35'}`}>
                    {r.key === 'STUDENT' ? 'The campus' : 'The faculty room'}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === 'signup' && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputCls}
                placeholder={role === 'TEACHER' ? 'Dr. Anita Desai' : 'Rohan Sharma'}
                aria-label="Full name"
              />
            )}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputCls}
              placeholder={role === 'TEACHER' ? 'Faculty ID (Email)' : 'Aspirant ID (Email)'}
              aria-label="Email"
            />
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              required
              minLength={6}
              className={inputCls}
              placeholder="Secure Access Key"
              aria-label="Password"
            />

            {error && (
              <p className="rounded-2xl border border-[#eb6b57]/40 bg-[#eb6b57]/15 px-5 py-3 text-sm font-semibold text-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl py-4 text-sm font-black uppercase tracking-[0.25em] text-white shadow-2xl transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50"
              style={{ backgroundColor: active.accent, boxShadow: `0 16px 40px -12px ${active.accent}66` }}
            >
              {busy ? 'Syncing…' : mode === 'signin' ? 'Authorize Entry' : `Create ${role === 'TEACHER' ? 'mentor' : 'student'} account`}
            </button>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setError(null);
                }}
                className="text-xs font-bold text-white/50 transition-colors hover:text-white"
              >
                {mode === 'signin' ? 'Register New Profile →' : '← Already registered? Sign in'}
              </button>
              <span className="text-[0.65rem] font-semibold text-white/30">
                Students land on the Wall · Mentors in the Cockpit
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
