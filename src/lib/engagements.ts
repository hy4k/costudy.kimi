import { useEffect } from 'react';
import { supabase } from './supabase';

/* ---------------------------------------------------------------------------
 * Vouch & view engine — the community trust layer for vault resources and
 * wall posts. One engagement row per member per item (unique constraint),
 * so counts can never be inflated by a single account.
 * ------------------------------------------------------------------------- */

export type EngageType = 'vault' | 'post';

export type EngageCounts = {
  /** resource_id -> vouch count */
  vouches: Record<string, number>;
  /** resource_id -> view count */
  views: Record<string, number>;
  /** resource_ids the current user has vouched */
  mine: Set<string>;
};

const EMPTY: EngageCounts = { vouches: {}, views: {}, mine: new Set() };

/** Authenticity ladder — more vouches, more trust. */
export const vouchTier = (n: number): string | null =>
  n >= 15 ? 'Anchor resource' : n >= 8 ? 'Trusted' : n >= 3 ? 'Community-vouched' : null;

export const postTier = (n: number): string | null =>
  n >= 15 ? 'Trusted voice' : n >= 8 ? 'Community-backed' : n >= 3 ? 'Verified signal' : null;

/** Load vouch + view counts (and my own vouches) for a set of resource ids. */
export async function loadEngagements(type: EngageType, ids: string[], userId?: string): Promise<EngageCounts> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return EMPTY;
  const { data, error } = await supabase
    .from('engagements')
    .select('resource_id, kind, user_id')
    .eq('resource_type', type)
    .in('resource_id', unique);
  if (error || !data) return EMPTY;
  const out: EngageCounts = { vouches: {}, views: {}, mine: new Set() };
  (data as { resource_id: string; kind: string; user_id: string }[]).forEach((r) => {
    if (r.kind === 'vouch') {
      out.vouches[r.resource_id] = (out.vouches[r.resource_id] || 0) + 1;
      if (userId && r.user_id === userId) out.mine.add(r.resource_id);
    } else if (r.kind === 'view') {
      out.views[r.resource_id] = (out.views[r.resource_id] || 0) + 1;
    }
  });
  return out;
}

/** Insert or retract a vouch. Returns the new state (true = vouched). */
export async function setVouch(type: EngageType, resourceId: string, userId: string, vouched: boolean): Promise<boolean> {
  if (vouched) {
    const { error } = await supabase
      .from('engagements')
      .insert([{ resource_type: type, resource_id: resourceId, user_id: userId, kind: 'vouch' }]);
    if (error) return false;
    return true;
  }
  await supabase
    .from('engagements')
    .delete()
    .eq('resource_type', type)
    .eq('resource_id', resourceId)
    .eq('user_id', userId)
    .eq('kind', 'vouch');
  return false;
}

/** Record a view once per member per item (unique constraint dedupes). */
export async function recordView(type: EngageType, resourceId: string, userId: string): Promise<void> {
  await supabase
    .from('engagements')
    .insert([{ resource_type: type, resource_id: resourceId, user_id: userId, kind: 'view' }])
    .then(() => {});
}

/** Live vouch/view counts — subscribe to engagement changes for one type. */
export function useEngagementLive(type: EngageType, onChange: (payload: { event: string; resource_id: string; user_id: string; kind: string }) => void) {
  useEffect(() => {
    const channel = supabase
      .channel(`engage-${type}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'engagements', filter: `resource_type=eq.${type}` }, (p) => onChange({ ...(p.new as { resource_id: string; user_id: string; kind: string }), event: 'INSERT' }))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'engagements', filter: `resource_type=eq.${type}` }, (p) => onChange({ ...(p.old as { resource_id: string; user_id: string; kind: string }), event: 'DELETE' }))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);
}
