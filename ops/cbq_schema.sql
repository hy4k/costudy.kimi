-- CoStudy Phase 1 — CBQ (case-based questions) readiness.
-- Run once in: Supabase dashboard -> SQL editor -> New query -> paste -> Run.
--
-- Why: CMA US has launched scenario-based/case items and the platform has no
-- home for them. This migration creates the canonical CBQ track:
--   cbq_scenarios  — one case/passage per row (pending -> approved -> rejected)
--   cbq_items      — the linked MCQ-style items under each scenario
--   pick_cbq_set() — the draw path the AI Deck uses (approved sets only)
-- Students read approved sets only; mentors submit pending sets and review
-- each other's (mirrors the vault review pattern in the Mentor cockpit).

create table if not exists public.cbq_scenarios (
  id uuid primary key default gen_random_uuid(),
  part text not null check (part in ('Part 1', 'Part 2')),
  section text,
  title text not null,
  scenario_text text not null,
  source_kind text not null default 'mentor',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_by uuid,
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cbq_items (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.cbq_scenarios(id) on delete cascade,
  question_text text not null,
  options jsonb not null,
  correct_answer text not null check (correct_answer in ('A', 'B', 'C', 'D')),
  explanation text,
  difficulty text,
  sort_order integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists cbq_items_scenario_idx on public.cbq_items (scenario_id);
create index if not exists cbq_scenarios_status_idx on public.cbq_scenarios (status, part);

-- RLS ----------------------------------------------------------------------

alter table public.cbq_scenarios enable row level security;
alter table public.cbq_items enable row level security;

-- everyone reads approved scenarios
create policy cbq_scenarios_read on public.cbq_scenarios
  for select to anon, authenticated
  using (status = 'approved');

-- everyone reads active items that belong to an approved scenario
create policy cbq_items_read on public.cbq_items
  for select to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1 from public.cbq_scenarios s
      where s.id = scenario_id and s.status = 'approved'
    )
  );

-- mentors submit scenarios (always as pending, owned by them)
create policy cbq_scenarios_mentor_insert on public.cbq_scenarios
  for insert to authenticated
  with check (
    submitted_by = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'TEACHER'
    )
  );

-- mentors see every scenario (review queue + their own submissions)
create policy cbq_scenarios_mentor_read on public.cbq_scenarios
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'TEACHER'
    )
  );

-- mentors review/promote any scenario (approve or reject)
create policy cbq_scenarios_mentor_update on public.cbq_scenarios
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'TEACHER'
    )
  );

-- mentors add items to their own scenarios
create policy cbq_items_mentor_insert on public.cbq_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.cbq_scenarios s
      where s.id = scenario_id and s.submitted_by = auth.uid()
    )
  );

-- mentors read items under their own scenarios (intake preview, review)
create policy cbq_items_mentor_read on public.cbq_items
  for select to authenticated
  using (
    exists (
      select 1 from public.cbq_scenarios s
      where s.id = scenario_id and s.submitted_by = auth.uid()
    )
  );

-- grants -------------------------------------------------------------------

grant select on public.cbq_scenarios to anon, authenticated;
grant select on public.cbq_items to anon, authenticated;
grant insert on public.cbq_scenarios to authenticated;
grant insert on public.cbq_items to authenticated;
grant update on public.cbq_scenarios to authenticated;

-- draw path ----------------------------------------------------------------

-- One random approved scenario (optionally section-filtered) with its active
-- items, as a single jsonb payload the AI Deck renders as a case drill.
create or replace function public.pick_cbq_set(p_part text, p_section text default null)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'scenario', to_jsonb(s),
    'items', coalesce(
      (select jsonb_agg(to_jsonb(i) order by i.sort_order)
       from public.cbq_items i
       where i.scenario_id = s.id and i.is_active),
      '[]'::jsonb
    )
  )
  from public.cbq_scenarios s
  where s.status = 'approved'
    and s.part = p_part
    and (p_section is null or s.section = p_section)
  order by random()
  limit 1;
$$;

grant execute on function public.pick_cbq_set(text, text) to anon, authenticated;

-- seed: two clearly-marked sample sets so the track is demoable the moment the
-- migration lands. source_kind 'sample' — replace with real mentor content.
insert into public.cbq_scenarios (part, section, title, scenario_text, source_kind, status)
values
  ('Part 1', 'Internal Controls',
   'Meridian Appliances — the bookkeeper who never took a day off',
   'Meridian Appliances is a family-run retail chain with 14 stores. Priya, the sole bookkeeper for 9 years, records cash receipts, reconciles the bank statements, approves supplier refunds below $2,000, and even posts the adjusting entries at month-end. She has never taken a vacation longer than two days. When an external consultant is finally brought in, she insists on sitting in every meeting with store managers and becomes visibly anxious when anyone asks to see the refund log, which she keeps in a personal spreadsheet rather than the accounting system.',
   'sample', 'approved'),
  ('Part 2', 'Decision Analysis',
   'Nova Gear — the make-or-buy call on gear housings',
   'Nova Gear manufactures bicycle drivetrains. It currently machines gear housings in-house: unit direct materials $8, direct labor $12, variable overhead $5, and allocated fixed overhead $7 per unit, at a volume of 60,000 units a year. A Taiwanese supplier has offered to supply the same housings at $27 each. Nova''s production manager estimates that if the housings are bought, $180,000 of the fixed overhead (supervisors and equipment leases tied to the machining cell) would be avoided, while the rest is corporate allocation that will not change. The freed capacity has no alternative use.',
   'sample', 'approved');

insert into public.cbq_items (scenario_id, question_text, options, correct_answer, explanation, difficulty, sort_order)
select s.id, v.*
from public.cbq_scenarios s, (values
  ('Which control weakness MOST directly enables fraud at Meridian?',
   '{"A":"Segregation of duties is collapsed — one person controls custody, recording and authorization of cash","B":"The company has too few stores for proper supervision","C":"Month-end adjusting entries are posted manually","D":"The refund log is kept electronically instead of on paper"}',
   'A',
   'Priya combines custody (bank reconciliations, cash), recording (posting entries), and authorization (supplier refunds). Collapsed segregation of duties is the classic fraud-enabling condition; the other options are symptoms or distractors.',
   'core', 1),
  ('Requiring a second person to approve refunds and moving bank reconciliations to a different employee would primarily strengthen which COSO component?',
   '{"A":"Risk assessment","B":"Control activities","C":"Control environment","D":"Information and communication"}',
   'B',
   'Specific approval requirements and independent reconciliations are control activities — the policies and procedures that implement management''s directives. Control environment is the tone/foundation, not a specific procedure.',
   'core', 2),
  ('Priya''s refusal to take vacations is a red flag because:',
   '{"A":"It violates labor regulations on mandatory leave","B":"Mandatory vacations are a detective control — ongoing fraud often requires the perpetrator''s presence to conceal it","C":"Fatigue reduces the accuracy of the general ledger","D":"Auditors require at least one week of absence per employee"}',
   'B',
   'Forced vacations are a detective control: schemes like lapping or skimming need daily attention to stay hidden. Absence is when concealed discrepancies surface. The other options invent requirements that do not exist.',
   'stretch', 3)
) as v(q, o, a, e, d, so)
where s.title like 'Meridian%';

insert into public.cbq_items (scenario_id, question_text, options, correct_answer, explanation, difficulty, sort_order)
select s.id, v.*
from public.cbq_scenarios s, (values
  ('In a make-or-buy analysis, the relevant unit cost of making the housings in-house is:',
   '{"A":"$32 — all costs including allocated overhead","B":"$25 — direct materials, labor and variable overhead only","C":"$20 — direct materials and labor only","D":"$27 — the supplier''s quoted price"}',
   'B',
   'Relevant costs are future and incremental. Allocated fixed overhead that continues either way is excluded, so $8 + $12 + $5 = $25. The $7 allocation is unavoidable and therefore irrelevant to the decision.',
   'core', 1),
  ('The total relevant cost of making for the year is:',
   '{"A":"$1,920,000","B":"$1,500,000","C":"$1,620,000","D":"$2,520,000"}',
   'B',
   '$25 relevant unit cost × 60,000 units = $1,500,000. Buying costs $27 × 60,000 = $1,620,000 — so making is cheaper before considering the avoidable fixed overhead.',
   'core', 2),
  ('Including the avoidable fixed overhead of $180,000, Nova should:',
   '{"A":"Buy — total buy cost $1,620,000 beats make cost $1,680,000","B":"Make — total make cost $1,680,000 still beats buy cost $1,620,000 only if capacity has alternative use; here make cost is $1,500,000 + $180,000 = $1,680,000 vs buy $1,620,000, so buy","C":"Buy — the freed capacity can be sold","D":"Make — the differential favors making by $60,000"}',
   'B',
   'Make: $1,500,000 relevant production cost + $180,000 avoidable fixed = $1,680,000. Buy: $1,620,000 and the remaining fixed overhead continues under either option. Buy saves $60,000 a year, and the freed capacity has no alternative use, so there is no opportunity cost to offset it.',
   'stretch', 3)
) as v(q, o, a, e, d, so)
where s.title like 'Nova Gear%';

-- After running, verify from anywhere with the anon key:
--   POST /rest/v1/rpc/pick_cbq_set {"p_part":"Part 1"}  -> scenario + 3 items
--   GET  /rest/v1/cbq_scenarios?select=id,title,status   -> 2 approved rows
