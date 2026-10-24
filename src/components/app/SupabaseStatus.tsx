import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Status = 'checking' | 'live' | 'offline';

/**
 * Live beacon proving the frontend is talking to the production Supabase
 * project (same backend as the original costudy.in app). Performs a real
 * PostgREST handshake on mount — no fabricated status.
 */
export default function SupabaseStatus() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = (supabase as unknown as { supabaseUrl: string }).supabaseUrl;
        const key = (supabase as unknown as { supabaseKey: string }).supabaseKey;
        const res = await fetch(`${url}/rest/v1/`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(6000),
        });
        if (!cancelled) setStatus(res.ok ? 'live' : 'offline');
      } catch {
        if (!cancelled) setStatus('offline');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dot =
    status === 'live'
      ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]'
      : status === 'checking'
        ? 'bg-amber-400 animate-pulse'
        : 'bg-rose-500';
  const label =
    status === 'live' ? 'Supabase backend live' : status === 'checking' ? 'Checking backend…' : 'Backend unreachable';

  return (
    <section className="flex items-center gap-3 rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] px-5 py-4">
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      <div>
        <p className="text-xs font-bold tracking-widest t-ink">{label}</p>
        <p className="text-[0.65rem] t-faint">avtjxcdcjbwmggdimkgh.supabase.co · same project as production</p>
      </div>
    </section>
  );
}
