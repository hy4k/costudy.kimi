import { createClient } from '@supabase/supabase-js';

// Same Supabase project as the production costudy.in backend.
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY env vars override these fallbacks.
const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  'https://avtjxcdcjbwmggdimkgh.supabase.co';

const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2dGp4Y2RjamJ3bWdnZGlta2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMDUwNDksImV4cCI6MjA4OTY4MTA0OX0.rwZ7mV2KYU_5glsqxL1otqmo6ZxYnocu8WOXdYM1JC4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Direct async lock handler — avoids Navigator LockManager timeouts in iframes
    lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
      return await fn();
    },
  },
});
