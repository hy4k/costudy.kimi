import { useCallback, useEffect, useState } from 'react';
import { DoodleBulb, DoodleClock, DoodleNote, DoodleSpark } from '@/components/Doodles';
import { supabase } from '@/lib/supabase';

type Session = {
  id: string;
  title: string | null;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  author_id: string | null;
  author?: { name?: string } | null;
};

type PlanItem = {
  id: string;
  plan_date: string;
  topic: string;
  hours_planned: number | null;
  mcqs_planned: number | null;
  completed: boolean | null;
  notes: string | null;
};

type Mission = {
  id: string;
  title: string;
  target_value: number;
  current_value: number;
  status: string;
  metric: string;
};

const niceDate = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const tomorrow = new Date(today.getTime() + 86400000);
  const label = sameDay(d, today) ? 'Today' : sameDay(d, tomorrow) ? 'Tomorrow'
    : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return `${label} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
};

export default function RoomPlan({ roomId, meId }: { roomId: string; meId: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [mission, setMission] = useState<Mission | null>(null);
  const [sessForm, setSessForm] = useState({ title: '', date: '', time: '', mins: '60', desc: '' });
  const [planForm, setPlanForm] = useState({ date: '', topic: '', hours: '', mcqs: '', notes: '' });
  const [goalForm, setGoalForm] = useState({ title: '', target: '100' });
  const [showSess, setShowSess] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: s }, { data: p }, { data: m }] = await Promise.all([
      supabase
        .from('study_room_sessions')
        .select('id, title, description, start_time, end_time, status, author_id, author:user_profiles(name)')
        .eq('room_id', roomId)
        .order('start_time', { ascending: true }),
      supabase
        .from('room_study_plan')
        .select('id, plan_date, topic, hours_planned, mcqs_planned, completed, notes')
        .eq('room_id', roomId)
        .order('plan_date', { ascending: true }),
      supabase
        .from('study_room_missions')
        .select('id, title, target_value, current_value, status, metric')
        .eq('room_id', roomId)
        .eq('status', 'ACTIVE')
        .limit(1),
    ]);
    setSessions(((s as Session[]) || []).filter((x) => (x.status || 'SCHEDULED') !== 'CANCELLED' && x.start_time && new Date(x.start_time) > new Date(Date.now() - 6 * 3600 * 1000)));
    setPlan((p as PlanItem[]) || []);
    setMission(((m as Mission[]) || [])[0] || null);
  }, [roomId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`plan-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_room_sessions', filter: `room_id=eq.${roomId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_study_plan', filter: `room_id=eq.${roomId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_room_missions', filter: `room_id=eq.${roomId}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, load]);

  const addSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessForm.title.trim() || !sessForm.date || !sessForm.time) return;
    const start = new Date(`${sessForm.date}T${sessForm.time}`);
    const end = new Date(start.getTime() + Number(sessForm.mins) * 60000);
    const { error } = await supabase.from('study_room_sessions').insert({
      room_id: roomId,
      author_id: meId,
      title: sessForm.title.trim(),
      description: sessForm.desc.trim() || null,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: 'SCHEDULED',
    });
    if (error) {
      setNote(error.message);
      return;
    }
    setSessForm({ title: '', date: '', time: '', mins: '60', desc: '' });
    setShowSess(false);
    setNote('Session scheduled for the room.');
  };

  const cancelSession = async (id: string) => {
    await supabase.from('study_room_sessions').update({ status: 'CANCELLED' }).eq('id', id);
    setNote('Session cancelled.');
  };

  const addPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planForm.topic.trim() || !planForm.date) return;
    const { error } = await supabase.from('room_study_plan').insert({
      room_id: roomId,
      plan_date: planForm.date,
      topic: planForm.topic.trim(),
      hours_planned: Number(planForm.hours) || 0,
      mcqs_planned: Number(planForm.mcqs) || 0,
      notes: planForm.notes.trim() || null,
      created_by: meId,
    });
    if (error) {
      setNote(error.message);
      return;
    }
    setPlanForm({ date: '', topic: '', hours: '', mcqs: '', notes: '' });
    setShowPlan(false);
    setNote('Added to the room’s plan.');
  };

  const togglePlan = async (item: PlanItem) => {
    await supabase.from('room_study_plan').update({ completed: !item.completed }).eq('id', item.id);
  };

  const addGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalForm.title.trim()) return;
    const { error } = await supabase.from('study_room_missions').insert({
      room_id: roomId,
      title: goalForm.title.trim(),
      metric: 'QUESTIONS_SOLVED',
      target_value: Number(goalForm.target) || 100,
      current_value: 0,
      status: 'ACTIVE',
      created_by: meId,
    });
    if (error) {
      setNote(error.message);
      return;
    }
    setGoalForm({ title: '', target: '100' });
    setShowGoal(false);
    setNote('Room goal set — log progress as the room advances.');
  };

  const bumpGoal = async (add: number) => {
    if (!mission) return;
    const next = mission.current_value + add;
    await supabase
      .from('study_room_missions')
      .update({ current_value: next, status: next >= mission.target_value ? 'COMPLETED' : 'ACTIVE' })
      .eq('id', mission.id);
  };

  const inputCls =
    'rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-4 py-2.5 text-sm t-ink placeholder:t-faint focus:border-[var(--coral)] focus:outline-none';

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b b-line px-6 py-3">
        <DoodleClock className="h-5 w-5 text-[var(--coral)]" />
        <p className="eyebrow t-faint">Schedule &amp; study plan</p>
        <span className="ml-auto text-xs t-faint">
          {sessions.length} session{sessions.length === 1 ? '' : 's'} · {plan.length} plan item{plan.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-6" data-lenis-prevent>
        {/* schedule */}
        <div>
          <div className="flex items-center justify-between">
            <p className="eyebrow t-faint">Upcoming sessions</p>
            <button
              onClick={() => setShowSess((v) => !v)}
              className="rounded-full border-[1.5px] b-line px-3.5 py-1.5 text-[0.65rem] font-bold tracking-wide t-muted transition-colors hover:t-ink"
            >
              {showSess ? 'Close' : '+ Schedule'}
            </button>
          </div>
          {showSess && (
            <form onSubmit={addSession} className="mt-3 space-y-2 rounded-2xl border-[1.5px] border-dashed b-line p-4">
              <input value={sessForm.title} onChange={(e) => setSessForm({ ...sessForm, title: e.target.value })} placeholder="Session title — e.g. Variance formulas drill" className={`w-full ${inputCls}`} />
              <div className="flex flex-wrap gap-2">
                <input type="date" value={sessForm.date} onChange={(e) => setSessForm({ ...sessForm, date: e.target.value })} className={inputCls} />
                <input type="time" value={sessForm.time} onChange={(e) => setSessForm({ ...sessForm, time: e.target.value })} className={inputCls} />
                <select value={sessForm.mins} onChange={(e) => setSessForm({ ...sessForm, mins: e.target.value })} className={inputCls}>
                  {['45', '60', '90', '120'].map((m) => (
                    <option key={m} value={m}>{m} min</option>
                  ))}
                </select>
              </div>
              <input value={sessForm.desc} onChange={(e) => setSessForm({ ...sessForm, desc: e.target.value })} placeholder="What the room will cover (optional)" className={`w-full ${inputCls}`} />
              <button type="submit" className="pill-btn !px-5 !py-2 text-xs">Schedule it</button>
            </form>
          )}
          <ul className="mt-3 space-y-2.5">
            {sessions.map((s) => (
              <li key={s.id} className="rounded-xl border-[1.5px] b-line p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold t-ink">{s.title}</p>
                    <p className="mt-0.5 text-[0.7rem] font-semibold text-[var(--coral)]">{niceDate(s.start_time)}</p>
                    {s.description && <p className="mt-1 text-[0.7rem] leading-relaxed t-muted">{s.description}</p>}
                    <p className="mt-1 text-[0.6rem] t-faint">by {s.author?.name || 'a desk mate'}</p>
                  </div>
                  {s.author_id === meId && (
                    <button onClick={() => cancelSession(s.id)} className="text-[0.6rem] font-bold tracking-wide t-faint hover:text-[var(--coral)]">
                      Cancel
                    </button>
                  )}
                </div>
              </li>
            ))}
            {sessions.length === 0 && !showSess && (
              <li className="text-xs t-faint">Nothing scheduled — propose a group sprint and see who shows up.</li>
            )}
          </ul>
        </div>

        {/* study plan */}
        <div>
          <div className="flex items-center justify-between">
            <p className="eyebrow t-faint">This week’s plan</p>
            <button
              onClick={() => setShowPlan((v) => !v)}
              className="rounded-full border-[1.5px] b-line px-3.5 py-1.5 text-[0.65rem] font-bold tracking-wide t-muted transition-colors hover:t-ink"
            >
              {showPlan ? 'Close' : '+ Add plan item'}
            </button>
          </div>
          {showPlan && (
            <form onSubmit={addPlan} className="mt-3 space-y-2 rounded-2xl border-[1.5px] border-dashed b-line p-4">
              <div className="flex flex-wrap gap-2">
                <input type="date" value={planForm.date} onChange={(e) => setPlanForm({ ...planForm, date: e.target.value })} className={inputCls} />
                <input value={planForm.hours} onChange={(e) => setPlanForm({ ...planForm, hours: e.target.value })} placeholder="Hours" type="number" min="0" step="0.5" className={`w-24 ${inputCls}`} />
                <input value={planForm.mcqs} onChange={(e) => setPlanForm({ ...planForm, mcqs: e.target.value })} placeholder="MCQs" type="number" min="0" className={`w-24 ${inputCls}`} />
              </div>
              <input value={planForm.topic} onChange={(e) => setPlanForm({ ...planForm, topic: e.target.value })} placeholder="Topic — e.g. Internal controls frameworks" className={`w-full ${inputCls}`} />
              <input value={planForm.notes} onChange={(e) => setPlanForm({ ...planForm, notes: e.target.value })} placeholder="Note for the room (optional)" className={`w-full ${inputCls}`} />
              <button type="submit" className="pill-btn !px-5 !py-2 text-xs">Add to plan</button>
            </form>
          )}
          <ul className="mt-3 space-y-2.5">
            {plan.map((p) => (
              <li key={p.id} className="flex items-start gap-3 rounded-xl border-[1.5px] b-line p-3.5">
                <button
                  onClick={() => togglePlan(p)}
                  aria-label={p.completed ? 'Mark not done' : 'Mark done'}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-[0.6rem] font-bold transition-colors ${
                    p.completed ? 'border-[var(--coral)] bg-[var(--coral)] text-white' : 'b-line t-faint hover:border-[var(--coral)]'
                  }`}
                >
                  {p.completed ? '✓' : ''}
                </button>
                <div className="min-w-0">
                  <p className={`text-xs font-bold ${p.completed ? 't-faint line-through' : 't-ink'}`}>{p.topic}</p>
                  <p className="mt-0.5 text-[0.65rem] t-faint">
                    {new Date(p.plan_date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    {p.hours_planned ? ` · ${p.hours_planned}h` : ''}
                    {p.mcqs_planned ? ` · ${p.mcqs_planned} MCQs` : ''}
                  </p>
                  {p.notes && <p className="mt-1 text-[0.7rem] leading-relaxed t-muted">{p.notes}</p>}
                </div>
              </li>
            ))}
            {plan.length === 0 && !showPlan && (
              <li className="text-xs t-faint">No plan yet — agree on tomorrow’s target and pin it here.</li>
            )}
          </ul>
        </div>

        {/* room goal */}
        <div className="rounded-2xl bg-[var(--coal)] p-5 text-[#f3ede3]">
          <div className="flex items-center justify-between">
            <p className="eyebrow flex items-center gap-1.5 opacity-60">
              <DoodleBulb className="h-3.5 w-3.5" /> Room goal
            </p>
            {mission && (
              <button onClick={() => bumpGoal(10)} className="text-xs font-bold tracking-wide underline-offset-4 hover:underline">
                +10 solved
              </button>
            )}
          </div>
          {mission ? (
            <>
              <p className="slab-display mt-2 text-lg leading-snug">{mission.title}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--mint)]/20">
                <div
                  className="h-full rounded-full bg-[var(--mint)] transition-[width] duration-700"
                  style={{ width: `${Math.min(100, (mission.current_value / Math.max(1, mission.target_value)) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-[0.7rem] font-bold tracking-wide opacity-70">
                {mission.current_value} / {mission.target_value} questions solved{mission.status === 'COMPLETED' ? ' · 🏁 complete' : ''}
              </p>
            </>
          ) : (
            <div className="mt-2">
              <p className="text-xs leading-relaxed opacity-70">No active goal — set one and chase it together.</p>
              {showGoal ? (
                <form onSubmit={addGoal} className="mt-3 space-y-2">
                  <input value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} placeholder="e.g. 500 MCQs before the window closes" className="w-full rounded-xl border-[1.5px] border-[var(--mint)]/30 bg-transparent px-4 py-2.5 text-sm placeholder:text-[#f3ede3]/40 focus:border-[var(--mint)] focus:outline-none" />
                  <div className="flex gap-2">
                    <input value={goalForm.target} onChange={(e) => setGoalForm({ ...goalForm, target: e.target.value })} type="number" min="1" className="w-28 rounded-xl border-[1.5px] border-[var(--mint)]/30 bg-transparent px-4 py-2.5 text-sm focus:border-[var(--mint)] focus:outline-none" />
                    <button type="submit" className="rounded-full bg-[var(--mint)] px-5 py-2.5 text-xs font-bold text-[var(--ink)] hover:opacity-85">
                      Set goal
                    </button>
                    <button type="button" onClick={() => setShowGoal(false)} className="rounded-full px-3 py-2.5 text-xs font-bold opacity-60 hover:opacity-100">
                      Close
                    </button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setShowGoal(true)} className="mt-3 rounded-full border-[1.5px] border-[var(--mint)]/40 px-4 py-2 text-[0.65rem] font-bold tracking-wide hover:bg-[var(--mint)]/10">
                  + Set a goal
                </button>
              )}
            </div>
          )}
        </div>

        {note && (
          <p className="flex items-center gap-2 text-[0.65rem] t-faint">
            <DoodleSpark className="h-3.5 w-3.5" /> {note}
          </p>
        )}
      </div>

      <p className="flex items-center gap-2 border-t b-line px-6 py-3 text-[0.65rem] t-faint">
        <DoodleNote className="h-3.5 w-3.5" />
        Sessions, plan and goal sync live to everyone at a desk.
      </p>
    </div>
  );
}
