import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from './supabase';

export type Role = 'STUDENT' | 'TEACHER';
export type Level = 'LEARNER' | 'SCHOLAR' | 'EXPERT';

export type Profile = {
  id: string;
  name: string;
  handle: string;
  role: Role;
  level: Level;
  avatar: string | null;
  examFocus: string;
  reputation: number;
};

type RawProfile = {
  id: string;
  name?: string;
  handle?: string;
  role?: string;
  level?: string;
  avatar?: string | null;
  exam_focus?: string;
  reputation?: number | null;
};

const levelMap: Record<string, Level> = {
  STARTER: 'LEARNER',
  LEARNER: 'LEARNER',
  SCHOLAR: 'SCHOLAR',
  EXPERT: 'EXPERT',
  MENTOR: 'EXPERT',
};

const normalize = (p: RawProfile): Profile => ({
  id: p.id,
  name: p.name || 'CMA Aspirant',
  handle: p.handle || 'aspirant',
  role: (p.role || 'STUDENT').toUpperCase() === 'TEACHER' ? 'TEACHER' : 'STUDENT',
  level: levelMap[(p.level || 'STARTER').toUpperCase()] || 'LEARNER',
  avatar: p.avatar || null,
  examFocus: p.exam_focus || 'CMA Part 1',
  reputation: typeof p.reputation === 'number' ? p.reputation : 0,
});

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return normalize(data as RawProfile);
}

async function ensureProfile(userId: string, metadata: Record<string, unknown>): Promise<Profile | null> {
  const existing = await fetchProfile(userId);
  if (existing) return existing;
  const name = (metadata.full_name as string) || 'CMA Aspirant';
  const role = ((metadata.role as string) || 'STUDENT').toUpperCase();
  const handle = name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20) || 'aspirant';
  const { data, error } = await supabase
    .from('user_profiles')
    .insert([{ id: userId, name, handle, role, level: 'STARTER' }])
    .select()
    .maybeSingle();
  if (error || !data) return null;
  return normalize(data as RawProfile);
}

export type AuthState = {
  ready: boolean;
  profile: Profile | null;
  /** Last known role, remembered across reloads so the nav never flashes the wrong menu. */
  cachedRole: Role | null;
};

/* ---------------------------------------------------------------------------
 * Module-level singleton. One Supabase subscription for the whole app —
 * every useAuth() hook reads the same snapshot, so navigating between pages
 * never re-fetches the session and never re-renders with a stale role.
 * ------------------------------------------------------------------------- */

const ROLE_KEY = 'costudy-role';

const readCachedRole = (): Role | null => {
  try {
    const r = localStorage.getItem(ROLE_KEY);
    return r === 'TEACHER' || r === 'STUDENT' ? r : null;
  } catch {
    return null;
  }
};

let state: AuthState = {
  ready: false,
  profile: null,
  cachedRole: typeof window === 'undefined' ? null : readCachedRole(),
};

const listeners = new Set<() => void>();

const sameProfile = (a: Profile | null, b: Profile | null) =>
  a === b || (!!a && !!b && a.id === b.id && a.role === b.role && a.level === b.level &&
    a.name === b.name && a.handle === b.handle && a.avatar === b.avatar &&
    a.examFocus === b.examFocus && a.reputation === b.reputation);

const emit = (patch: Partial<AuthState>) => {
  const next: AuthState = { ...state, ...patch };
  if (
    next.ready === state.ready &&
    next.cachedRole === state.cachedRole &&
    sameProfile(next.profile, state.profile)
  ) {
    return;
  }
  state = next;
  listeners.forEach((l) => l());
};

const applyProfile = (p: Profile | null) => {
  if (p) {
    try {
      localStorage.setItem(ROLE_KEY, p.role);
    } catch {
      /* storage unavailable — nav just falls back to a fresh guess */
    }
  }
  emit({ profile: p, cachedRole: p ? p.role : state.cachedRole });
};

type SessionUser = { id: string; user_metadata?: Record<string, unknown>; email?: string } | null;

const sync = async (user: SessionUser) => {
  if (!user) {
    applyProfile(null);
    return;
  }
  const p = (await fetchProfile(user.id)) || (await ensureProfile(user.id, user.user_metadata || {}));
  applyProfile(p);
};

let booted = false;
const boot = () => {
  if (booted) return;
  booted = true;
  supabase.auth.getSession().then(({ data }) => {
    sync(data.session?.user ?? null).finally(() => emit({ ready: true }));
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    sync((session?.user as SessionUser) ?? null);
  });
};

/** Live auth state — one shared store for the whole app. */
export function useAuth(): AuthState & {
  refresh: () => Promise<void>;
  signIn: (email: string, pass: string) => Promise<Profile>;
  signUp: (name: string, email: string, pass: string, role: Role) => Promise<Profile>;
  signOut: () => Promise<void>;
} {
  useEffect(() => {
    boot();
  }, []);

  const snap = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => state,
    () => state,
  );

  return {
    ...snap,
    refresh: async () => {
      const { data } = await supabase.auth.getSession();
      const user = (data.session?.user as SessionUser) ?? null;
      if (!user) {
        applyProfile(null);
        return;
      }
      const p = await fetchProfile(user.id);
      if (p) applyProfile(p);
    },
    signIn: async (email, pass) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) throw new Error(error.message);
      const user = data.user;
      if (!user) throw new Error('Sign-in returned no user.');
      const p = (await fetchProfile(user.id)) || (await ensureProfile(user.id, user.user_metadata || {}));
      if (!p) throw new Error('Could not load your profile.');
      applyProfile(p);
      return p;
    },
    signUp: async (name, email, pass, role) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: { data: { full_name: name, role } },
      });
      if (error) {
        if (error.message.includes('Database error')) {
          throw new Error('Server synchronization issue — try signing in instead, or retry shortly.');
        }
        throw new Error(error.message);
      }
      const user = data.user;
      if (!user) throw new Error('Sign-up returned no user.');
      const p = (await ensureProfile(user.id, { full_name: name, role })) || {
        id: user.id,
        name,
        handle: 'aspirant',
        role,
        level: 'LEARNER' as Level,
        avatar: null,
        examFocus: 'CMA Part 1',
        reputation: 0,
      };
      applyProfile(p);
      return p;
    },
    signOut: async () => {
      await supabase.auth.signOut();
      applyProfile(null);
    },
  };
}
