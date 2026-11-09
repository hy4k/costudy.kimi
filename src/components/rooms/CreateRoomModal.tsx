import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/authStore';

const tones = [
  ['#ea4467', '#ffffff'],
  ['#c6b3a2', '#21221f'],
  ['#e7fec7', '#21221f'],
  ['#d9e6f3', '#21221f'],
  ['#f3f1ee', '#21221f'],
  ['#2b2926', '#fcfbfa'],
] as const;

const categories = [
  'CMA US Part 1',
  'CMA US Part 2',
  'Internal Controls',
  'Cost Management',
  'Decision Analysis',
  'Professional Ethics',
  'Mock Season',
  'General',
];

export default function CreateRoomModal({
  profile,
  onCreated,
  onClose,
}: {
  profile: Profile;
  onCreated: (roomId: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('CMA US Part 1');
  const [description, setDescription] = useState('');
  const [topics, setTopics] = useState('');
  const [privacy, setPrivacy] = useState<'PUBLIC' | 'INVITE_ONLY'>('PUBLIC');
  const [tone, setTone] = useState(0);
  const [maxMembers, setMaxMembers] = useState(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    const { data, error: insErr } = await supabase
      .from('study_rooms')
      .insert({
        name: name.trim(),
        category,
        description: description.trim() || null,
        creator_id: profile.id,
        room_type: privacy,
        color_theme: tones[tone][0],
        max_members: maxMembers,
        is_live: true,
        target_topics: topics
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        members_count: 1,
      })
      .select('id')
      .single();
    if (insErr || !data) {
      setBusy(false);
      setError(insErr?.message || 'Could not open the room — try again.');
      return;
    }
    const roomId = (data as { id: string }).id;
    // creator takes the lead seat
    await supabase.from('study_room_members').insert({
      room_id: roomId,
      user_id: profile.id,
      role: 'ADMIN',
      status: 'ACTIVE',
      is_online: true,
    });
    await supabase.from('room_presence').insert({
      room_id: roomId,
      user_id: profile.id,
      display_name: profile.name,
      last_seen: new Date().toISOString(),
    });
    onCreated(roomId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[1.8rem] border-[1.5px] b-line bg-[var(--card)] p-8"
      >
        <p className="eyebrow text-[var(--coral)]">New study room</p>
        <h2 className="slab-display mt-2 text-3xl t-ink">Open a room.</h2>
        <p className="mt-2 text-sm t-muted">
          You’ll be the room lead — invite classmates by handle once it’s open.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="cr-name" className="eyebrow t-faint">Room name</label>
            <input
              id="cr-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Part 1 variance analysis dawn club"
              className="mt-2 w-full rounded-xl border-[1.5px] b-line bg-[var(--paper)] p-4 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cr-cat" className="eyebrow t-faint">Cluster</label>
              <select
                id="cr-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-2 w-full rounded-xl border-[1.5px] b-line bg-[var(--paper)] p-4 text-sm t-ink focus:border-[var(--ink)] focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="cr-size" className="eyebrow t-faint">Desks (max)</label>
              <select
                id="cr-size"
                value={maxMembers}
                onChange={(e) => setMaxMembers(Number(e.target.value))}
                className="mt-2 w-full rounded-xl border-[1.5px] b-line bg-[var(--paper)] p-4 text-sm t-ink focus:border-[var(--ink)] focus:outline-none"
              >
                {[4, 6, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="cr-desc" className="eyebrow t-faint">What happens here (optional)</label>
            <textarea
              id="cr-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Quiet sprints, one mock debrief a week…"
              className="mt-2 w-full rounded-xl border-[1.5px] b-line bg-[var(--paper)] p-4 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="cr-topics" className="eyebrow t-faint">Target topics (comma-separated, optional)</label>
            <input
              id="cr-topics"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="Variance analysis, Flexible budgeting"
              className="mt-2 w-full rounded-xl border-[1.5px] b-line bg-[var(--paper)] p-4 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
            />
          </div>
          <div>
            <span className="eyebrow t-faint">Colour mood</span>
            <div className="mt-2 flex gap-2">
              {tones.map(([bg, ink], i) => (
                <button
                  key={bg}
                  type="button"
                  onClick={() => setTone(i)}
                  aria-label={`Colour ${i + 1}`}
                  className={`h-9 w-9 rounded-full transition-transform ${tone === i ? 'scale-110 ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--card)]' : 'hover:scale-105'}`}
                  style={{ backgroundColor: bg, color: ink }}
                >
                  {tone === i ? '✓' : ''}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="eyebrow t-faint">Who can walk in</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(
                [
                  ['PUBLIC', 'Open to every student'],
                  ['INVITE_ONLY', 'Invite only'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPrivacy(key)}
                  className={`rounded-xl border-[1.5px] px-4 py-3 text-left text-xs font-bold transition-colors ${
                    privacy === key ? 'border-[var(--coral)] bg-[var(--coral)]/10 t-ink' : 'b-line t-muted hover:t-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border-[1.5px] border-[#ea4467] bg-[#ea4467]/10 px-4 py-3 text-xs font-semibold t-ink">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button type="submit" disabled={busy} className="pill-btn !px-6 !py-3 text-sm disabled:opacity-40">
            {busy ? 'Opening…' : 'Open the room'}
          </button>
          <button type="button" onClick={onClose} className="pill-btn pill-btn--ghost !px-6 !py-3 text-sm">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
