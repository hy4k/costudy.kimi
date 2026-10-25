import { useEffect, useState } from 'react';
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
};

/** Live auth state — loads the Supabase session, mirrors user_profiles, follows auth events. */
export function useAuth(): AuthState & {
  signIn: (email: string, pass: string) => Promise<Profile>;
  signUp: (name: string, email: string, pass: string, role: Role) => Promise<Profile>;
  signOut: () => Promise<void>;
} {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sync = async (user: { id: string; user_metadata?: Record<string, unknown>; email?: string } | null) => {
      if (!user) {
        setProfile(null);
        return;
      }
      const p = (await fetchProfile(user.id)) || (await ensureProfile(user.id, user.user_metadata || {}));
      if (!cancelled) setProfile(p);
    };

    supabase.auth.getSession().then(({ data }) => {
      sync(data.session?.user ?? null).finally(() => !cancelled && setReady(true));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      sync(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return {
    ready,
    profile,
    signIn: async (email, pass) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) throw new Error(error.message);
      const user = data.user;
      if (!user) throw new Error('Sign-in returned no user.');
      const p = (await fetchProfile(user.id)) || (await ensureProfile(user.id, user.user_metadata || {}));
      if (!p) throw new Error('Could not load your profile.');
      setProfile(p);
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
      setProfile(p);
      return p;
    },
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
    },
  };
}
