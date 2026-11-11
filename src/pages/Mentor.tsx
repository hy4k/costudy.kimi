import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import AppShell from '@/components/app/AppShell';
import { DoodleBook, DoodleBulb, DoodleNote, DoodlePeople, DoodleSpark } from '@/components/Doodles';
import { useAuth } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';

type Broadcast = {
  id: string;
  content: string;
  type: string;
  likes: number;
  created_at: string;
};

type QueueItem = {
  id: string;
  name: string;
  external_ref: string | null;
  metadata: { description?: string; kind?: string; submitted_by?: string } | null;
  created_at: string;
};

type CbqMine = {
  id: string;
  title: string;
  part: string;
  section: string | null;
  verified: boolean;
  active: boolean;
  created_at: string;
};

type CbqItemDraft = {
  prompt: string;
  options: string[];
  correct: number;
  explanation: string;
};

const emptyCbqItem = (): CbqItemDraft => ({
  prompt: '',
  options: ['', '', '', ''],
  correct: 0,
  explanation: '',
});

const relTime = (iso: string) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function Mentor() {
  const navigate = useNavigate();
  const { ready, profile, signOut } = useAuth();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<Broadcast[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueLoaded, setQueueLoaded] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  // CBQ intake + review
  const [cbqPart, setCbqPart] = useState<'Part 1' | 'Part 2'>('Part 1');
  const [cbqSection, setCbqSection] = useState('');
  const [cbqTitle, setCbqTitle] = useState('');
  const [cbqText, setCbqText] = useState('');
  const [cbqItems, setCbqItems] = useState<CbqItemDraft[]>([emptyCbqItem(), emptyCbqItem(), emptyCbqItem()]);
  const [cbqBusy, setCbqBusy] = useState(false);
  const [cbqMsg, setCbqMsg] = useState<string | null>(null);
  const [cbqMine, setCbqMine] = useState<CbqMine[]>([]);
  const [cbqPending, setCbqPending] = useState<CbqMine[]>([]);
  // mentor marketplace
  type HireInvite = {
    id: string;
    room_id: string | null;
    inviter_id: string;
    agreed_fee: number | null;
    costudy_fee: number | null;
    status: string | null;
    session_date: string | null;
    note: string | null;
    created_at: string;
    inviter?: { name?: string; handle?: string } | null;
    room?: { name?: string } | null;
  };
  type CourseRow = {
    id: string;
    title: string;
    description: string | null;
    price: number;
    duration_weeks: number;
    schedule_text: string | null;
    max_students: number;
    is_active: boolean;
  };
  type StudentRow = { id: string; student_id: string; created_at: string; student?: { name?: string; handle?: string } | null };
  type BountyRow = {
    id: string;
    task: string;
    reward: number | null;
    type: string | null;
    status: string | null;
    created_at: string;
  };
  type ClassroomRow = { room_id: string; role: string | null; room?: { name?: string; topic?: string } | null };
  type RevenueStat = { paid: number; pending: number; platformCut: number; sessions: number };
  type StudentDetail = {
    id: string;
    name: string;
    handle: string;
    streak_days: number | null;
    total_mocks: number | null;
    exam_window: string | null;
    primary_exam: string | null;
    recent: { id: string; content: string; created_at: string }[];
  };
  const [invites, setInvites] = useState<HireInvite[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [market, setMarket] = useState({ bio: '', specialties: '', years_experience: '', hourly_rate: '' });
  const [courseForm, setCourseForm] = useState({ title: '', description: '', price: '', duration_weeks: '4', schedule_text: '', max_students: '10' });
  const [showCourse, setShowCourse] = useState(false);
  const [hireMsg, setHireMsg] = useState<string | null>(null);
  const [hireBusy, setHireBusy] = useState<string | null>(null);
  // bounties + classrooms + revenue + student deep-dive
  const [bounties, setBounties] = useState<BountyRow[]>([]);
  const [bountyForm, setBountyForm] = useState({ task: '', reward: '', type: 'CREDITS' as 'CREDITS' | 'BADGE' });
  const [bountyBusy, setBountyBusy] = useState(false);
  const [bountyMsg, setBountyMsg] = useState<string | null>(null);
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [revenue, setRevenue] = useState<RevenueStat>({ paid: 0, pending: 0, platformCut: 0, sessions: 0 });
  const [studentDetail, setStudentDetail] = useState<StudentDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState<string | null>(null);

  const loadCbq = () => {
    if (!profile) return;
    supabase
      .from('cbq_cases')
      .select('id, title, part, section, verified, active, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        const all = (data as CbqMine[]) || [];
        setCbqMine(all.filter((s) => s.verified && s.active).slice(0, 5));
        setCbqPending(all.filter((s) => !s.verified && s.active));
      });
  };

  useEffect(() => {
    if (ready && profile && profile.role !== 'TEACHER') navigate('/wall', { replace: true });
  }, [ready, profile, navigate]);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('posts')
      .select('id, content, type, likes, created_at')
      .eq('author_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setMine((data as Broadcast[]) || []));
    supabase
      .from('content_sources')
      .select('id, name, external_ref, metadata, created_at')
      .eq('source_kind', 'community_upload')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setQueue((data as QueueItem[]) || []);
        setQueueLoaded(true);
      });
    loadCbq();
  }, [profile]);

  // mentor marketplace loaders
  const loadMarketplace = () => {
    if (!profile) return;
    supabase
      .from('mentor_invitations')
      .select('id, room_id, inviter_id, agreed_fee, costudy_fee, status, session_date, note, created_at, inviter:user_profiles!mentor_invitations_inviter_id_fkey(name, handle)')
      .eq('mentor_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(async ({ data }) => {
        const rows = (data as HireInvite[]) || [];
        setInvites(rows);
        const ids = [...new Set(rows.map((r) => r.room_id).filter((x): x is string => !!x))];
        if (ids.length) {
          const { data: rooms } = await supabase.from('study_rooms').select('id, name').in('id', ids);
          const map = new Map(((rooms as { id: string; name: string }[]) || []).map((r) => [r.id, r.name]));
          setInvites((cur) => cur.map((r) => ({ ...r, room: r.room_id ? { name: map.get(r.room_id) || 'a room' } : null })));
        }
      });
    supabase
      .from('mentor_courses')
      .select('id, title, description, price, duration_weeks, schedule_text, max_students, is_active')
      .eq('mentor_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setCourses((data as CourseRow[]) || []));
    supabase
      .from('student_enrollments')
      .select('id, student_id, created_at, student:user_profiles!student_enrollments_student_id_fkey(name, handle)')
      .eq('teacher_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setStudents((data as StudentRow[]) || []));
    supabase
      .from('user_profiles')
      .select('bio, specialties, years_experience, hourly_rate')
      .eq('id', profile.id)
      .single()
      .then(({ data }) => {
        const p = data as { bio?: string | null; specialties?: string[] | null; years_experience?: number | null; hourly_rate?: number | null } | null;
        if (p) {
          setMarket({
            bio: p.bio || '',
            specialties: (p.specialties || []).join(', '),
            years_experience: p.years_experience ? String(p.years_experience) : '',
            hourly_rate: p.hourly_rate ? String(p.hourly_rate) : '',
          });
        }
      });
    supabase
      .from('mentor_bounties')
      .select('id, task, reward, type, status, created_at')
      .eq('teacher_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setBounties((data as BountyRow[]) || []));
    supabase
      .from('study_room_members')
      .select('room_id, role, room:study_rooms(name)')
      .eq('user_id', profile.id)
      .eq('status', 'ACTIVE')
      .order('joined_at', { ascending: false })
      .then(({ data }) => setClassrooms((data as ClassroomRow[]) || []));
    // revenue: session payments tied to my sessions + my accepted platform cuts
    supabase
      .from('study_room_sessions')
      .select('id')
      .eq('author_id', profile.id)
      .then(async ({ data: sessRows }) => {
        const ids = ((sessRows as { id: string }[]) || []).map((r) => r.id);
        let paid = 0;
        let pending = 0;
        if (ids.length) {
          const { data: pays } = await supabase
            .from('session_payments')
            .select('amount, status')
            .in('session_id', ids);
          ((pays as { amount: number | string; status: string | null }[]) || []).forEach((p) => {
            if (p.status === 'PAID') paid += Number(p.amount) || 0;
            else pending += Number(p.amount) || 0;
          });
        }
        const { data: accInv } = await supabase
          .from('mentor_invitations')
          .select('costudy_fee')
          .eq('mentor_id', profile.id)
          .eq('status', 'ACCEPTED');
        const platformCut = ((accInv as { costudy_fee: number | null }[]) || []).reduce(
          (sum, r) => sum + (Number(r.costudy_fee) || 0),
          0,
        );
        setRevenue({ paid, pending, platformCut, sessions: ids.length });
      });
  };

  useEffect(() => {
    if (profile) loadMarketplace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  if (!ready || !profile) {
    return (
      <AppShell eyebrow="Faculty room" title="Mentor cockpit">
        <section className="max-w-lg rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-8">
          <p className="slab-display text-2xl t-ink">This room needs a mentor key.</p>
          <p className="mt-3 text-sm leading-relaxed t-muted">
            Sign in with a mentor account to broadcast to the faculty wall, or head back to the commons.
          </p>
          <Link to="/login" className="pill-btn mt-6 inline-block !px-6 !py-3 text-sm">
            Log in as mentor
          </Link>
        </section>
      </AppShell>
    );
  }

  const broadcast = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('posts')
      .insert([{ author_id: profile.id, content: text, type: 'RESOURCE', tags: ['#faculty'], likes: 0 }])
      .select('id, content, type, likes, created_at');
    setBusy(false);
    if (err || !data) {
      setError(err?.message || 'Broadcast failed — try again.');
      return;
    }
    setMine((m) => [data[0] as Broadcast, ...m]);
    setDraft('');
  };

  const removeFromQueue = (id: string) => setQueue((q) => q.filter((x) => x.id !== id));

  // ---- mentor marketplace ----
  const respondHire = async (inv: HireInvite, accept: boolean) => {
    if (!profile || hireBusy) return;
    setHireBusy(inv.id);
    setHireMsg(null);
    await supabase.from('mentor_invitations').update({ status: accept ? 'ACCEPTED' : 'DECLINED' }).eq('id', inv.id);
    if (accept) {
      // ongoing engagement
      const { data: ex } = await supabase
        .from('student_enrollments')
        .select('id')
        .eq('teacher_id', profile.id)
        .eq('student_id', inv.inviter_id)
        .maybeSingle();
      if (!ex) {
        await supabase.from('student_enrollments').insert({ teacher_id: profile.id, student_id: inv.inviter_id, status: 'ACTIVE' });
      }
      // mentor joins the room
      if (inv.room_id) {
        const { data: mem } = await supabase
          .from('study_room_members')
          .select('id')
          .eq('room_id', inv.room_id)
          .eq('user_id', profile.id)
          .maybeSingle();
        if (!mem) {
          await supabase.from('study_room_members').insert({
            room_id: inv.room_id,
            user_id: profile.id,
            role: 'MENTOR',
            status: 'ACTIVE',
            is_online: true,
            joined_at: new Date().toISOString(),
          });
        }
        // kickoff session on the plan
        const start = inv.session_date ? new Date(inv.session_date) : new Date(Date.now() + 2 * 86400000);
        const { data: sess } = await supabase
          .from('study_room_sessions')
          .insert({
            room_id: inv.room_id,
            author_id: profile.id,
            title: `Mentorship kickoff · ${inv.inviter?.name || 'new student'}`,
            description: inv.note || null,
            start_time: start.toISOString(),
            end_time: new Date(start.getTime() + 60 * 60000).toISOString(),
            status: 'SCHEDULED',
          })
          .select('id')
          .single();
        // payment ledger for the platform cut
        if (sess) {
          await supabase.from('session_payments').insert({
            session_id: (sess as { id: string }).id,
            user_id: inv.inviter_id,
            amount: inv.agreed_fee || 0,
            status: 'PENDING',
            label: 'Mentorship session',
            costudy_fee: inv.costudy_fee || 0,
          });
        }
      }
      setHireMsg(`Accepted — you’re in ${inv.room?.name || 'the room'} and the kickoff is on the room’s Plan tab.`);
    } else {
      setHireMsg('Declined — the student is free to ask again or pick another mentor.');
    }
    setHireBusy(null);
    loadMarketplace();
  };

  const saveMarket = async () => {
    if (!profile) return;
    const { error } = await supabase
      .from('user_profiles')
      .update({
        bio: market.bio.trim() || null,
        specialties: market.specialties.split(',').map((s) => s.trim()).filter(Boolean),
        years_experience: Number(market.years_experience) || 0,
        hourly_rate: Number(market.hourly_rate) || 0,
      })
      .eq('id', profile.id);
    setHireMsg(error ? error.message : 'Marketplace profile saved — students see it on the Mentors page.');
  };

  const addCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !courseForm.title.trim()) return;
    const { error } = await supabase.from('mentor_courses').insert({
      mentor_id: profile.id,
      title: courseForm.title.trim(),
      description: courseForm.description.trim() || null,
      price: Number(courseForm.price) || 0,
      duration_weeks: Number(courseForm.duration_weeks) || 4,
      schedule_text: courseForm.schedule_text.trim() || null,
      max_students: Number(courseForm.max_students) || 10,
      is_active: true,
    });
    if (error) {
      setHireMsg(error.message);
      return;
    }
    setCourseForm({ title: '', description: '', price: '', duration_weeks: '4', schedule_text: '', max_students: '10' });
    setShowCourse(false);
    setHireMsg('Course published — it now shows on the Mentors page.');
    loadMarketplace();
  };

  const toggleCourse = async (c: CourseRow) => {
    await supabase.from('mentor_courses').update({ is_active: !c.is_active }).eq('id', c.id);
    loadMarketplace();
  };

  const offerOnWall = async (c: CourseRow) => {
    if (!profile) return;
    const text = `📚 ${c.title} — ${c.duration_weeks}-week cohort${c.schedule_text ? ` · ${c.schedule_text}` : ''}${c.price > 0 ? ` · ₹${Number(c.price).toLocaleString('en-IN')}` : ' · free'}. Open on the Mentors page.`;
    const { error } = await supabase.from('posts').insert([{ author_id: profile.id, content: text, type: 'RESOURCE', tags: ['#faculty', '#offer'], likes: 0 }]);
    setHireMsg(error ? error.message : `“${c.title}” offered to the wall.`);
  };

  // ---- bounties / student deep-dive ----------------------------------------
  const postBounty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || bountyBusy) return;
    const task = bountyForm.task.trim();
    if (!task) return;
    setBountyBusy(true);
    setBountyMsg(null);
    const reward = Number(bountyForm.reward) || 0;
    const { data: row, error } = await supabase
      .from('mentor_bounties')
      .insert({ teacher_id: profile.id, task, reward, type: bountyForm.type, status: 'OPEN' })
      .select('id, task, reward, type, status, created_at')
      .single();
    if (error) {
      setBountyBusy(false);
      setBountyMsg(error.message);
      return;
    }
    await supabase.from('posts').insert([
      {
        author_id: profile.id,
        content: `🎯 Bounty: ${task}${reward > 0 ? ` — ${bountyForm.type === 'CREDITS' ? `₹${reward.toLocaleString('en-IN')} credits` : `“${bountyForm.type.toLowerCase()}” badge`} for the best answer` : ''}. Mentors track it in the cockpit.`,
        type: 'RESOURCE',
        tags: ['#faculty', '#bounty'],
        likes: 0,
      },
    ]);
    setBountyBusy(false);
    setBountyForm({ task: '', reward: '', type: 'CREDITS' });
    setBounties((cur) => [row as BountyRow, ...cur]);
    setBountyMsg('Bounty posted — it’s live on the wall and tracked here.');
  };

  const toggleBounty = async (b: BountyRow) => {
    const next = (b.status || 'OPEN') === 'OPEN' ? 'CLOSED' : 'OPEN';
    await supabase.from('mentor_bounties').update({ status: next }).eq('id', b.id);
    setBounties((cur) => cur.map((x) => (x.id === b.id ? { ...x, status: next } : x)));
  };

  const openStudentDetail = async (studentId: string) => {
    if (!profile || detailBusy) return;
    setDetailBusy(studentId);
    const [{ data: p }, { data: recent }] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('id, name, handle, streak_days, total_mocks, exam_window, primary_exam')
        .eq('id', studentId)
        .single(),
      supabase
        .from('posts')
        .select('id, content, created_at')
        .eq('author_id', studentId)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);
    setDetailBusy(null);
    const prof = p as Omit<StudentDetail, 'recent'> | null;
    if (!prof) return;
    setStudentDetail({ ...prof, recent: (recent as StudentDetail['recent']) || [] });
  };

  const approve = async (item: QueueItem) => {
    if (reviewing) return;
    setReviewing(item.id);
    setReviewMsg(null);
    // promote to the verified shelf
    const { error: insErr } = await supabase.from('library_items').insert([{
      title: item.name,
      description: item.metadata?.description || null,
      category: item.metadata?.kind || null,
      file_url: item.external_ref,
      file_type: item.metadata?.kind || null,
      uploaded_by: profile!.id,
    }]);
    if (insErr) {
      setReviewing(null);
      setReviewMsg(`Approve failed: ${insErr.message}`);
      return;
    }
    // clear the pending row
    const { error: delErr } = await supabase.from('content_sources').delete().eq('id', item.id);
    setReviewing(null);
    if (delErr) {
      setReviewMsg(`Published to the vault, but clearing the queue failed: ${delErr.message}`);
      return;
    }
    removeFromQueue(item.id);
    setReviewMsg(`“${item.name}” is now on the verified shelf.`);
  };

  const reject = async (item: QueueItem) => {
    if (reviewing) return;
    setReviewing(item.id);
    setReviewMsg(null);
    const { error } = await supabase.from('content_sources').delete().eq('id', item.id);
    setReviewing(null);
    if (error) {
      setReviewMsg(`Reject failed: ${error.message}`);
      return;
    }
    removeFromQueue(item.id);
    setReviewMsg(`“${item.name}” was rejected and removed from the queue.`);
  };

  // --- CBQ intake + review -------------------------------------------------
  const updateCbqItem = (i: number, patch: Partial<CbqItemDraft>) =>
    setCbqItems((items) => items.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  const submitCbq = async () => {
    if (cbqBusy) return;
    const items = cbqItems.filter((it) => it.prompt.trim() && it.options[0].trim() && it.options[1].trim());
    if (!cbqTitle.trim() || !cbqText.trim() || items.length === 0) {
      setCbqMsg('A case needs a title, the narrative, and at least one complete task.');
      return;
    }
    setCbqBusy(true);
    setCbqMsg(null);
    const { data: sc, error: scErr } = await supabase
      .from('cbq_cases')
      .insert([
        {
          part: cbqPart,
          section: cbqSection.trim() || null,
          title: cbqTitle.trim(),
          narrative: cbqText.trim(),
          exhibits: [],
          difficulty: 'Medium',
          source: 'mentor',
        },
      ])
      .select('id');
    if (scErr || !sc || !sc[0]) {
      setCbqBusy(false);
      setCbqMsg(`Submit failed: ${scErr?.message || 'no row returned'}`);
      return;
    }
    const caseId = sc[0].id as string;
    const { error: itErr } = await supabase.from('cbq_tasks').insert(
      items.map((it, i) => ({
        case_id: caseId,
        seq: i + 1,
        type: 'mcq',
        marks: 10,
        prompt: it.prompt.trim(),
        hint: null,
        payload: { options: it.options.map((o) => o.trim()) },
        answer: { value: 'ABCDEF'[it.correct] },
        explanation: it.explanation.trim() || null,
      })),
    );
    setCbqBusy(false);
    if (itErr) {
      setCbqMsg(`Case saved, but tasks failed: ${itErr.message}`);
      return;
    }
    setCbqTitle('');
    setCbqSection('');
    setCbqText('');
    setCbqItems([emptyCbqItem(), emptyCbqItem(), emptyCbqItem()]);
    setCbqMsg(`“${cbqTitle.trim()}” is in the pending queue — a faculty peer verifies it before students see it.`);
    loadCbq();
  };

  const reviewCbq = async (s: CbqMine, action: 'approve' | 'reject') => {
    if (reviewing) return;
    setReviewing(s.id);
    setCbqMsg(null);
    const patch = action === 'approve' ? { verified: true } : { active: false };
    const { error } = await supabase.from('cbq_cases').update(patch).eq('id', s.id);
    setReviewing(null);
    if (error) {
      setCbqMsg(`Review failed: ${error.message}`);
      return;
    }
    setCbqMsg(
      action === 'approve'
        ? `“${s.title}” verified — it's live on the AI Deck CBQ track.`
        : `“${s.title}” rejected and hidden from the track.`,
    );
    loadCbq();
  };

  return (
    <AppShell eyebrow="The faculty room" title={`${profile.name.split(' ')[0]}'s cockpit`}>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {/* broadcast composer */}
          <section className="rounded-[1.6rem] bg-[#2b2926] p-6 text-[#fcfbfa] md:p-8">
            <div className="flex items-center gap-2">
              <DoodleSpark className="h-5 w-5 text-[var(--mint)]" />
              <p className="eyebrow text-[var(--mint)]">Broadcast to the wall</p>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder="Post a note, a bounty, a correction — the whole campus hears it…"
              className="mt-4 w-full resize-none rounded-xl border-[1.5px] border-[#fcfbfa]/25 bg-[#fcfbfa]/10 p-4 text-sm text-[#fcfbfa] placeholder:text-[#fcfbfa]/50 focus:border-[var(--mint)] focus:outline-none"
            />
            {error && <p className="mt-3 rounded-lg bg-[var(--coral)]/25 px-3 py-2 text-xs font-semibold">{error}</p>}
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-[#fcfbfa]/60">Broadcasts land on the Study Wall as FACULTY.</p>
              <button
                onClick={broadcast}
                disabled={!draft.trim() || busy}
                className="rounded-full bg-[var(--mint)] px-5 py-2.5 text-sm font-bold text-[var(--ink)] transition-opacity disabled:opacity-40"
              >
                {busy ? 'Sending…' : 'Broadcast'}
              </button>
            </div>
          </section>

          {/* hire requests */}
          <section className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <DoodlePeople className="h-5 w-5 t-muted" />
                <h2 className="slab-display text-2xl t-ink">Hire requests</h2>
              </div>
              <span className="rounded-full bg-[var(--mint)] px-3 py-1 text-[0.65rem] font-bold tracking-widest text-[var(--ink)]">
                {invites.filter((i) => (i.status || 'PENDING') === 'PENDING').length} PENDING
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed t-faint">
              Students hire you into their study room. Accepting joins you to the room, schedules a kickoff
              session on its Plan tab, and opens a payment line with the platform fee attached.
            </p>
            {hireMsg && (
              <p className="mt-4 rounded-xl border-[1.5px] border-dashed b-line px-4 py-3 text-xs font-semibold t-muted">{hireMsg}</p>
            )}
            <ul className="mt-4 space-y-3">
              {invites.map((inv) => {
                const pending = (inv.status || 'PENDING') === 'PENDING';
                return (
                  <li key={inv.id} className="rounded-xl border-[1.5px] b-line p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold t-ink">
                          {inv.inviter?.name || 'A student'} <span className="t-faint">@{inv.inviter?.handle}</span>
                        </p>
                        <p className="mt-1 text-xs t-muted">
                          {inv.room?.name || 'Your pick of room'} ·{' '}
                          {inv.session_date
                            ? new Date(inv.session_date).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                            : 'date to agree'}
                          {' · '}
                          {inv.agreed_fee ? `₹${Number(inv.agreed_fee).toLocaleString('en-IN')} (CoStudy cut ₹${Number(inv.costudy_fee || 0).toLocaleString('en-IN')})` : 'fee on agree'}
                        </p>
                        {inv.note && <p className="mt-2 text-xs italic leading-relaxed t-muted">“{inv.note}”</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {pending ? (
                          <>
                            <button
                              onClick={() => respondHire(inv, true)}
                              disabled={hireBusy === inv.id}
                              className="rounded-full bg-[var(--coral)] px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-85 disabled:opacity-40"
                            >
                              {hireBusy === inv.id ? 'Working…' : 'Accept'}
                            </button>
                            <button
                              onClick={() => respondHire(inv, false)}
                              disabled={hireBusy === inv.id}
                              className="rounded-full border-[1.5px] b-line px-4 py-2 text-xs font-bold t-muted hover:t-ink"
                            >
                              Decline
                            </button>
                          </>
                        ) : (
                          <span className={`rounded-full px-3 py-1 text-[0.6rem] font-bold tracking-widest ${inv.status === 'ACCEPTED' ? 'bg-[var(--mint)] text-[var(--ink)]' : 'bg-[var(--paper)] t-faint'}`}>
                            {inv.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
              {invites.length === 0 && (
                <li className="text-xs t-faint">No requests yet — they arrive here the moment a student hits Hire on your card.</li>
              )}
            </ul>
          </section>

          {/* student bounties */}
          <section className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-6 md:p-8">
            <div className="flex items-center gap-2">
              <DoodleSpark className="h-5 w-5 t-muted" />
              <h2 className="slab-display text-2xl t-ink">Student bounties</h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed t-faint">
              Put a prize on a question, a case, or a challenge — the wall hears about it and the best
              student answer earns the reward.
            </p>
            {bountyMsg && (
              <p className="mt-4 rounded-xl border-[1.5px] border-dashed b-line px-4 py-3 text-xs font-semibold t-muted">{bountyMsg}</p>
            )}
            <form onSubmit={postBounty} className="mt-4 space-y-2.5">
              <input
                value={bountyForm.task}
                onChange={(e) => setBountyForm({ ...bountyForm, task: e.target.value })}
                placeholder="The task — e.g. Build the cleanest variance-analysis walkthrough for Marlow Ltd"
                className="w-full rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-4 py-3 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
              />
              <div className="flex flex-wrap gap-2">
                <input
                  value={bountyForm.reward}
                  onChange={(e) => setBountyForm({ ...bountyForm, reward: e.target.value })}
                  type="number"
                  min="0"
                  placeholder="Reward (0 = honour only)"
                  className="w-48 rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-4 py-3 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
                />
                <select
                  value={bountyForm.type}
                  onChange={(e) => setBountyForm({ ...bountyForm, type: e.target.value as 'CREDITS' | 'BADGE' })}
                  className="rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-3 py-3 text-sm t-ink focus:border-[var(--ink)] focus:outline-none"
                >
                  <option value="CREDITS">Study credits</option>
                  <option value="BADGE">Badge</option>
                </select>
                <button type="submit" disabled={bountyBusy || !bountyForm.task.trim()} className="pill-btn !px-6 !py-3 text-sm disabled:opacity-40">
                  {bountyBusy ? 'Posting…' : 'Post bounty'}
                </button>
              </div>
            </form>
            {bounties.length > 0 && (
              <ul className="mt-5 space-y-2.5 border-t b-line pt-4">
                {bounties.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="min-w-0 flex-1 font-semibold t-ink">{b.task}</span>
                    <span className="t-faint">
                      {b.reward && Number(b.reward) > 0
                        ? b.type === 'CREDITS'
                          ? `₹${Number(b.reward).toLocaleString('en-IN')}`
                          : b.type
                        : 'honour'}
                    </span>
                    <button
                      onClick={() => toggleBounty(b)}
                      className={`rounded-full px-3 py-1 text-[0.6rem] font-bold tracking-widest transition-opacity hover:opacity-75 ${
                        (b.status || 'OPEN') === 'OPEN' ? 'bg-[var(--mint)] text-[var(--ink)]' : 'b-line t-faint'
                      }`}
                    >
                      {(b.status || 'OPEN') === 'OPEN' ? 'OPEN' : 'CLOSED'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* my classrooms */}
          <section className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-6 md:p-8">
            <div className="flex items-center gap-2">
              <DoodleBook className="h-5 w-5 t-muted" />
              <h2 className="slab-display text-2xl t-ink">My classrooms</h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed t-faint">
              Every room you teach in — from accepted hire requests and direct invites.
            </p>
            {classrooms.length === 0 ? (
              <p className="mt-4 text-xs t-faint">No rooms yet — accept a hire request and the room appears here.</p>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {classrooms.map((c) => (
                  <li key={c.room_id} className="rounded-xl border-[1.5px] b-line p-4">
                    <p className="text-sm font-bold t-ink">{c.room?.name || 'Study room'}</p>
                    <p className="mt-1 text-[0.65rem] font-bold tracking-widest t-faint">{(c.role || 'MENTOR').toUpperCase()}</p>
                    <Link to="/rooms" className="link-underline mt-2 inline-block text-xs font-bold tracking-widest t-ink">
                      OPEN ROOM →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* revenue */}
          <section className="rounded-[1.6rem] bg-[#2b2926] p-6 text-[#fcfbfa] md:p-8">
            <div className="flex items-center gap-2">
              <DoodleBulb className="h-5 w-5 text-[var(--mint)]" />
              <h2 className="slab-display text-2xl">Revenue</h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#fcfbfa]/60">
              Payments on sessions you run. Students pay through Razorpay; the platform fee is yours to track, not to collect.
            </p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              <li className="rounded-xl bg-[#fcfbfa]/10 p-4">
                <p className="text-[0.65rem] font-bold tracking-widest text-[var(--mint)]">COLLECTED</p>
                <p className="slab-display mt-1 text-2xl">₹{revenue.paid.toLocaleString('en-IN')}</p>
              </li>
              <li className="rounded-xl bg-[#fcfbfa]/10 p-4">
                <p className="text-[0.65rem] font-bold tracking-widest text-[var(--mint)]">AWAITING PAYMENT</p>
                <p className="slab-display mt-1 text-2xl">₹{revenue.pending.toLocaleString('en-IN')}</p>
              </li>
              <li className="rounded-xl bg-[#fcfbfa]/10 p-4">
                <p className="text-[0.65rem] font-bold tracking-widest text-[var(--mint)]">CO STUDY FEE (PLATFORM)</p>
                <p className="slab-display mt-1 text-2xl">₹{revenue.platformCut.toLocaleString('en-IN')}</p>
              </li>
              <li className="rounded-xl bg-[#fcfbfa]/10 p-4">
                <p className="text-[0.65rem] font-bold tracking-widest text-[var(--mint)]">SESSIONS LED</p>
                <p className="slab-display mt-1 text-2xl">{revenue.sessions}</p>
              </li>
            </ul>
            <p className="mt-4 text-[0.65rem] text-[#fcfbfa]/50">
              Numbers update as students complete Razorpay checkouts — pending flips to collected on payment.
            </p>
          </section>

          {/* courses */}
          <section className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <DoodleBook className="h-5 w-5 t-muted" />
                <h2 className="slab-display text-2xl t-ink">Courses &amp; cohorts</h2>
              </div>
              <button
                onClick={() => setShowCourse((v) => !v)}
                className="rounded-full border-[1.5px] b-line px-4 py-2 text-xs font-bold t-muted hover:t-ink"
              >
                {showCourse ? 'Close' : '+ New course'}
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed t-faint">
              Published offers show on the Mentors page; “Offer on wall” posts them to the Study Wall as faculty.
            </p>
            {showCourse && (
              <form onSubmit={addCourse} className="mt-4 space-y-3 rounded-2xl border-[1.5px] border-dashed b-line p-4">
                <input value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} placeholder="Course title — e.g. Part 1 Decision Analysis intensive" className="w-full rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-4 py-3 text-sm font-semibold t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none" />
                <textarea value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} rows={3} placeholder="What students walk away with" className="w-full resize-none rounded-xl border-[1.5px] b-line bg-[var(--paper)] p-4 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none" />
                <div className="flex flex-wrap gap-2">
                  <input value={courseForm.price} onChange={(e) => setCourseForm({ ...courseForm, price: e.target.value })} type="number" min="0" placeholder="Price ₹ (0 = free)" className="w-40 rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-4 py-3 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none" />
                  <input value={courseForm.duration_weeks} onChange={(e) => setCourseForm({ ...courseForm, duration_weeks: e.target.value })} type="number" min="1" placeholder="Weeks" className="w-24 rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-4 py-3 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none" />
                  <input value={courseForm.max_students} onChange={(e) => setCourseForm({ ...courseForm, max_students: e.target.value })} type="number" min="1" placeholder="Seats" className="w-24 rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-4 py-3 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none" />
                </div>
                <input value={courseForm.schedule_text} onChange={(e) => setCourseForm({ ...courseForm, schedule_text: e.target.value })} placeholder="Schedule — e.g. Tue & Sat, 7:00 AM IST" className="w-full rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-4 py-3 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none" />
                <button type="submit" className="pill-btn !px-5 !py-2.5 text-xs">Publish course</button>
              </form>
            )}
            <ul className="mt-4 space-y-3">
              {courses.map((c) => (
                <li key={c.id} className="rounded-xl border-[1.5px] b-line p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm font-bold ${c.is_active ? 't-ink' : 't-faint line-through'}`}>{c.title}</p>
                      <p className="mt-1 text-xs t-muted">
                        {c.duration_weeks} weeks · {c.max_students} seats · {Number(c.price) > 0 ? `₹${Number(c.price).toLocaleString('en-IN')}` : 'free'}
                        {c.schedule_text ? ` · ${c.schedule_text}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => offerOnWall(c)} className="rounded-full bg-[var(--mint)] px-3.5 py-1.5 text-[0.65rem] font-bold text-[var(--ink)] hover:opacity-85">
                        Offer on wall
                      </button>
                      <button onClick={() => toggleCourse(c)} className="rounded-full border-[1.5px] b-line px-3.5 py-1.5 text-[0.65rem] font-bold t-muted hover:t-ink">
                        {c.is_active ? 'Unpublish' : 'Publish'}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
              {courses.length === 0 && !showCourse && (
                <li className="text-xs t-faint">No courses yet — package what you teach and publish it here.</li>
              )}
            </ul>
          </section>

          {/* marketplace profile */}
          <section className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-6 md:p-8">
            <div className="flex items-center gap-2">
              <DoodleBulb className="h-5 w-5 t-muted" />
              <h2 className="slab-display text-2xl t-ink">Marketplace profile</h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed t-faint">
              This is your card on the Mentors page — what students see before they hire you.
            </p>
            <textarea
              value={market.bio}
              onChange={(e) => setMarket({ ...market, bio: e.target.value })}
              rows={3}
              placeholder="One short paragraph — who you coach and what you’re known for"
              className="mt-4 w-full resize-none rounded-xl border-[1.5px] b-line bg-[var(--paper)] p-4 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
            />
            <input
              value={market.specialties}
              onChange={(e) => setMarket({ ...market, specialties: e.target.value })}
              placeholder="Specialties — comma separated, e.g. CMA US Part 1, Internal Controls, Essay coaching"
              className="mt-3 w-full rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-4 py-3 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <input value={market.years_experience} onChange={(e) => setMarket({ ...market, years_experience: e.target.value })} type="number" min="0" placeholder="Years of experience" className="w-48 rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-4 py-3 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none" />
              <input value={market.hourly_rate} onChange={(e) => setMarket({ ...market, hourly_rate: e.target.value })} type="number" min="0" placeholder="Hourly rate ₹" className="w-40 rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-4 py-3 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none" />
              <button onClick={saveMarket} className="pill-btn !px-6 !py-3 text-sm">
                Save profile
              </button>
            </div>
          </section>

          {/* CBQ case intake */}
          <section className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <DoodleNote className="h-5 w-5 t-muted" />
                <h2 className="slab-display text-2xl t-ink">CBQ case intake</h2>
              </div>
              <span className="rounded-full bg-[var(--mint)] px-3 py-1 text-[0.65rem] font-bold tracking-widest text-[var(--ink)]">
                {cbqMine.length} LIVE · {cbqPending.length} AWAITING REVIEW
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed t-faint">
              Case-based questions land in the AI Deck as scenario + linked items. Submissions stay
              pending until another faculty member approves them — the same verified-shelf rule as the vault.
            </p>
            {cbqMsg && (
              <p className="mt-4 rounded-xl border-[1.5px] border-dashed b-line px-4 py-3 text-xs font-semibold t-muted">{cbqMsg}</p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr]">
              <select
                value={cbqPart}
                onChange={(e) => setCbqPart(e.target.value as 'Part 1' | 'Part 2')}
                className="rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-3 py-2.5 text-sm t-ink focus:border-[var(--ink)] focus:outline-none"
              >
                <option>Part 1</option>
                <option>Part 2</option>
              </select>
              <input
                value={cbqSection}
                onChange={(e) => setCbqSection(e.target.value)}
                placeholder="Syllabus area — e.g. Internal Controls, Decision Analysis"
                className="rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-3 py-2.5 text-sm t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
              />
            </div>
            <input
              value={cbqTitle}
              onChange={(e) => setCbqTitle(e.target.value)}
              placeholder="Case title — the hook students see"
              className="mt-3 w-full rounded-xl border-[1.5px] b-line bg-[var(--paper)] px-3 py-2.5 text-sm font-semibold t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
            />
            <textarea
              value={cbqText}
              onChange={(e) => setCbqText(e.target.value)}
              rows={4}
              placeholder="The scenario passage — the company, the numbers, the tension. Everything the items refer back to…"
              className="mt-3 w-full resize-y rounded-xl border-[1.5px] b-line bg-[var(--paper)] p-3 text-sm leading-relaxed t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
            />
            <div className="mt-4 space-y-3">
              {cbqItems.map((it, i) => (
                <div key={i} className="rounded-xl bg-[var(--paper)] p-4 shadow-[inset_0_0_0_1.5px_var(--line)]">
                  <div className="flex items-center justify-between">
                    <p className="text-[0.65rem] font-bold tracking-widest t-faint">ITEM {i + 1}</p>
                    {cbqItems.length > 1 && (
                      <button
                        onClick={() => setCbqItems((items) => items.filter((_, j) => j !== i))}
                        className="text-xs font-bold t-faint transition-colors hover:text-[var(--coral)]"
                      >
                        remove
                      </button>
                    )}
                  </div>
                  <input
                    value={it.prompt}
                    onChange={(e) => updateCbqItem(i, { prompt: e.target.value })}
                    placeholder="Task prompt"
                    className="mt-2 w-full rounded-lg border-[1.5px] b-line bg-[var(--card)] px-3 py-2 text-xs font-medium t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
                  />
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {it.options.map((opt, oi) => (
                      <input
                        key={oi}
                        value={opt}
                        onChange={(e) =>
                          updateCbqItem(i, {
                            options: it.options.map((x, j) => (j === oi ? e.target.value : x)),
                          })
                        }
                        placeholder={`Option ${'ABCDEF'[oi]}`}
                        className="rounded-lg border-[1.5px] b-line bg-[var(--card)] px-3 py-2 text-xs t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={it.correct}
                      onChange={(e) => updateCbqItem(i, { correct: Number(e.target.value) })}
                      className="rounded-lg border-[1.5px] b-line bg-[var(--card)] px-2.5 py-2 text-xs font-bold t-ink focus:border-[var(--ink)] focus:outline-none"
                    >
                      {it.options.map((_, oi) => (
                        <option key={oi} value={oi}>
                          Answer {'ABCDEF'[oi]}
                        </option>
                      ))}
                    </select>
                    <input
                      value={it.explanation}
                      onChange={(e) => updateCbqItem(i, { explanation: e.target.value })}
                      placeholder="Worked explanation (unlocks after answering)"
                      className="min-w-0 flex-1 rounded-lg border-[1.5px] b-line bg-[var(--card)] px-3 py-2 text-xs t-ink placeholder:t-faint focus:border-[var(--ink)] focus:outline-none"
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={() => setCbqItems((items) => [...items, emptyCbqItem()])}
                className="rounded-full border-[1.5px] border-dashed b-line px-4 py-2 text-xs font-bold t-muted transition-colors hover:t-ink hover:border-[var(--ink)]"
              >
                + Add another item
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs t-faint">Students never see pending cases — approve peers' work to grow the track.</p>
              <button
                onClick={submitCbq}
                disabled={cbqBusy}
                className="rounded-full bg-[#2b2926] px-5 py-2.5 text-sm font-bold text-[#fcfbfa] transition-opacity disabled:opacity-40"
              >
                {cbqBusy ? 'Submitting…' : 'Submit for review'}
              </button>
            </div>
            {cbqMine.length > 0 && (
              <ul className="mt-5 space-y-2 border-t b-line pt-4">
                {cbqMine.slice(0, 5).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="min-w-0 flex-1 truncate font-semibold t-ink">{s.title}</span>
                    <span className="shrink-0 font-bold tracking-widest t-faint">{s.part.toUpperCase()}{s.section ? ` · ${s.section}` : ''}</span>
                    <span className="shrink-0 rounded-full bg-[var(--mint)] px-2 py-0.5 text-[0.6rem] font-bold text-[var(--ink)]">
                      LIVE
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* CBQ review queue */}
          {cbqPending.length > 0 && (
            <section className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-6 md:p-8">
              <div className="flex items-center gap-2">
                <DoodleBook className="h-5 w-5 t-muted" />
                <h2 className="slab-display text-2xl t-ink">CBQ review queue</h2>
              </div>
              <ul className="mt-5 space-y-3">
                {cbqPending.map((s) => (
                  <li key={s.id} className="rounded-xl bg-[var(--paper)] p-4 shadow-[inset_0_0_0_1.5px_var(--line)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold t-ink">{s.title}</p>
                        <p className="mt-1 text-[0.65rem] font-bold tracking-widest t-faint">
                          {s.part.toUpperCase()}{s.section ? ` · ${s.section}` : ''} · {relTime(s.created_at)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => reviewCbq(s, 'approve')}
                          disabled={reviewing === s.id}
                          className="rounded-full bg-[#6f9c3e] px-4 py-2 text-xs font-bold text-white transition-opacity disabled:opacity-40"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => reviewCbq(s, 'reject')}
                          disabled={reviewing === s.id}
                          className="rounded-full border-[1.5px] border-[var(--coral)] px-4 py-2 text-xs font-bold text-[var(--coral)] transition-opacity disabled:opacity-40"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* vault review queue */}
          <section className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <DoodleBook className="h-5 w-5 t-muted" />
                <h2 className="slab-display text-2xl t-ink">Vault review queue</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-[0.65rem] font-bold tracking-widest ${queue.length > 0 ? 'bg-[var(--coral)] text-white' : 'b-line t-faint'}`}>
                {queue.length} AWAITING
              </span>
            </div>
            {reviewMsg && (
              <p className="mt-4 rounded-xl border-[1.5px] border-dashed b-line px-4 py-3 text-xs font-semibold t-muted">{reviewMsg}</p>
            )}
            {!queueLoaded ? (
              <p className="mt-4 text-sm t-faint">Loading the queue…</p>
            ) : queue.length === 0 ? (
              <p className="mt-4 text-sm t-faint">
                The review queue is clear — community submissions will appear here the moment students share to the vault.
              </p>
            ) : (
              <ul className="mt-5 space-y-3">
                {queue.map((item) => (
                  <li key={item.id} className="rounded-xl bg-[var(--paper)] p-4 shadow-[inset_0_0_0_1.5px_var(--line)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold t-ink">{item.name}</p>
                        <p className="mt-1 text-xs leading-relaxed t-muted">
                          {item.metadata?.description || 'No summary provided.'}
                        </p>
                        <p className="mt-1.5 text-[0.65rem] font-bold tracking-widest t-faint">
                          {item.metadata?.kind?.toUpperCase() || 'NOTES'} · by {item.metadata?.submitted_by || 'Community'} · {relTime(item.created_at)}
                        </p>
                        {item.external_ref && (
                          <a href={item.external_ref} target="_blank" rel="noreferrer" className="link-underline mt-1 inline-block text-xs font-semibold text-[var(--coral)]">
                            Open link ↗
                          </a>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => approve(item)}
                          disabled={reviewing === item.id}
                          className="rounded-full bg-[#6f9c3e] px-4 py-2 text-xs font-bold text-white transition-opacity disabled:opacity-40"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => reject(item)}
                          disabled={reviewing === item.id}
                          className="rounded-full border-[1.5px] border-[var(--coral)] px-4 py-2 text-xs font-bold text-[var(--coral)] transition-opacity disabled:opacity-40"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* recent broadcasts */}
          <section className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-6 md:p-8">
            <h2 className="slab-display text-2xl t-ink">Your recent broadcasts</h2>
            {mine.length === 0 ? (
              <p className="mt-4 text-sm t-faint">
                Silence so far. Your first broadcast appears here and on the Study Wall at once.
              </p>
            ) : (
              <ul className="mt-5 space-y-3">
                {mine.map((b) => (
                  <li key={b.id} className="rounded-xl bg-[var(--paper)] p-4 shadow-[inset_0_0_0_1.5px_var(--line)]">
                    <p className="line-clamp-2 text-sm font-medium t-ink">{b.content}</p>
                    <p className="mt-1.5 text-[0.65rem] font-bold tracking-widest t-faint">
                      {b.type} · ▲ {b.likes} · {relTime(b.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* right rail */}
        <aside className="space-y-4">
          <section className="rounded-[1.6rem] bg-[var(--mint)] p-6 text-[var(--ink)]">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2b2926] font-slab text-sm font-bold text-[#fcfbfa]">
                {profile.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
              </span>
              <div>
                <p className="slab-display text-xl">{profile.name}</p>
                <p className="text-xs font-bold tracking-widest opacity-70">FACULTY · {profile.level}</p>
              </div>
            </div>
            <ul className="mt-5 space-y-2.5 text-sm font-medium">
              <li className="flex justify-between border-b border-[var(--ink)]/15 pb-2"><span>Focus</span><span className="font-slab font-bold">{profile.examFocus}</span></li>
              <li className="flex justify-between border-b border-[var(--ink)]/15 pb-2"><span>Reputation</span><span className="font-slab font-bold">{profile.reputation}</span></li>
              <li className="flex justify-between"><span>Broadcasts</span><span className="font-slab font-bold">{mine.length}</span></li>
            </ul>
            <button
              onClick={() => signOut().then(() => navigate('/'))}
              className="mt-5 w-full rounded-full border-[1.5px] border-[var(--ink)]/30 py-2 text-xs font-bold tracking-widest transition-colors hover:bg-[var(--ink)] hover:text-[var(--mint)]"
            >
              Sign out
            </button>
          </section>

          <section className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-6">
            <div className="flex items-center gap-2">
              <DoodlePeople className="h-5 w-5 t-muted" />
              <h2 className="slab-display text-xl t-ink">My students</h2>
            </div>
            <ul className="mt-4 space-y-2.5">
              {students.map((s) => (
                <li key={s.id} className="text-sm">
                  <button
                    onClick={() => openStudentDetail(s.student_id)}
                    disabled={detailBusy === s.student_id}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--paper)] disabled:opacity-50"
                  >
                    <span className="font-semibold t-ink">{s.student?.name || 'Student'}</span>
                    <span className="text-[0.65rem] t-faint">{detailBusy === s.student_id ? 'loading…' : `joined ${relTime(s.created_at)}`}</span>
                  </button>
                  {studentDetail?.id === s.student_id && (
                    <div className="mt-1.5 rounded-xl border-[1.5px] border-dashed b-line p-3.5 text-xs">
                      <p className="font-bold t-ink">
                        {studentDetail.name} <span className="t-faint">@{studentDetail.handle}</span>
                      </p>
                      <ul className="mt-2.5 space-y-1.5 t-muted">
                        <li className="flex justify-between gap-3"><span>Study streak</span><span className="font-bold t-ink">{studentDetail.streak_days ?? 0} days</span></li>
                        <li className="flex justify-between gap-3"><span>Mocks taken</span><span className="font-bold t-ink">{studentDetail.total_mocks ?? 0}</span></li>
                        <li className="flex justify-between gap-3"><span>Exam window</span><span className="font-bold t-ink">{studentDetail.exam_window || 'not set'}</span></li>
                        <li className="flex justify-between gap-3"><span>Exam</span><span className="font-bold t-ink">{studentDetail.primary_exam || '—'}</span></li>
                      </ul>
                      {studentDetail.recent.length > 0 && (
                        <div className="mt-3 border-t b-line pt-2.5">
                          <p className="text-[0.6rem] font-bold tracking-widest t-faint">RECENT WALL POSTS</p>
                          {studentDetail.recent.map((r) => (
                            <p key={r.id} className="mt-1.5 line-clamp-2 t-muted">“{r.content}”</p>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => setStudentDetail(null)}
                        className="mt-3 text-[0.6rem] font-bold tracking-widest t-faint transition-colors hover:text-[var(--coral)]"
                      >
                        CLOSE
                      </button>
                    </div>
                  )}
                </li>
              ))}
              {students.length === 0 && (
                <li className="text-xs t-faint">No students yet — accept a hire request or publish a course.</li>
              )}
            </ul>
            <Link to="/mentors" className="link-underline mt-5 inline-block text-xs font-bold tracking-widest t-ink">
              PREVIEW THE MENTORS PAGE →
            </Link>
          </section>

          <section className="rounded-[1.6rem] border-[1.5px] b-line bg-[var(--card)] p-6">
            <div className="flex items-center gap-2">
              <DoodleBulb className="h-5 w-5 t-muted" />
              <h2 className="slab-display text-xl t-ink">Mentor moves</h2>
            </div>
            <ul className="mt-4 space-y-3 text-sm t-muted">
              <li className="flex gap-2.5"><DoodleNote className="h-4 w-4 mt-0.5 shrink-0" /> Broadcasts post as FACULTY-tagged posts on the shared wall.</li>
              <li className="flex gap-2.5"><DoodlePeople className="h-4 w-4 mt-0.5 shrink-0" /> Students answering your threads appear on the Study Wall feed.</li>
            </ul>
            <Link to="/wall" className="link-underline mt-5 inline-block text-xs font-bold tracking-widest t-ink">
              VIEW THE WALL →
            </Link>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
