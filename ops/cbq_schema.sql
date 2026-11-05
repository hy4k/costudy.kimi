-- CoStudy Phase 1 — CBQ (case-based questions) readiness.
-- Run once via the Supabase MCP (apply_migration) or dashboard SQL editor.
--
-- Pivot note: the canonical CBQ store is the EXISTING public.cbq_cases /
-- public.cbq_tasks / public.cbq_responses model (rich task types: mcq, multi,
-- num, list, dnd). This migration adds what the redesign needs around it:
--   RLS + grants  — students read verified+active cases; teachers author
--                   (verified=false), review and verify
--   pick_cbq_case() — the draw path the AI Deck uses (verified+active only)

-- ---- RLS -------------------------------------------------------------------

alter table public.cbq_cases enable row level security;
alter table public.cbq_tasks enable row level security;
alter table public.cbq_responses enable row level security;

-- students (anon or signed-in) read only verified, active cases
create policy cbq_cases_read on public.cbq_cases
  for select to anon, authenticated
  using (verified = true and active = true);

-- tasks are readable when their case is live
create policy cbq_tasks_read on public.cbq_tasks
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.cbq_cases c
      where c.id = case_id and c.verified = true and c.active = true
    )
  );

-- teachers author cases — always landing as unverified (pending review)
create policy cbq_cases_teacher_insert on public.cbq_cases
  for insert to authenticated
  with check (
    verified = false
    and exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.role = 'TEACHER'
    )
  );

-- teachers see every case (intake list + review queue)
create policy cbq_cases_teacher_read on public.cbq_cases
  for select to authenticated
  using (
    exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.role = 'TEACHER'
    )
  );

-- teachers verify/reject/edit any case
create policy cbq_cases_teacher_update on public.cbq_cases
  for update to authenticated
  using (
    exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.role = 'TEACHER'
    )
  );

-- teachers add tasks to any case
create policy cbq_tasks_teacher_insert on public.cbq_tasks
  for insert to authenticated
  with check (
    exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.role = 'TEACHER'
    )
  );

-- teachers read tasks of any case (review queue previews)
create policy cbq_tasks_teacher_read on public.cbq_tasks
  for select to authenticated
  using (
    exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.role = 'TEACHER'
    )
  );

-- students record responses; they read only their own
create policy cbq_responses_insert on public.cbq_responses
  for insert to authenticated
  with check (user_id = auth.uid());

create policy cbq_responses_read on public.cbq_responses
  for select to authenticated
  using (user_id = auth.uid());

-- ---- grants ----------------------------------------------------------------

grant select on public.cbq_cases to anon, authenticated;
grant select on public.cbq_tasks to anon, authenticated;
grant insert, select on public.cbq_responses to authenticated;
grant insert, select, update on public.cbq_cases to authenticated;
grant insert, select on public.cbq_tasks to authenticated;

-- ---- draw path -------------------------------------------------------------

-- One random verified+active case (optionally section-filtered) with its tasks
-- ordered by seq, as a single jsonb payload the AI Deck renders as a case drill.
create or replace function public.pick_cbq_case(p_part text, p_section text default null)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'case', to_jsonb(c),
    'tasks', coalesce(
      (select jsonb_agg(to_jsonb(t) order by t.seq)
       from public.cbq_tasks t
       where t.case_id = c.id),
      '[]'::jsonb
    )
  )
  from public.cbq_cases c
  where c.verified = true
    and c.active = true
    and c.part = p_part
    and (p_section is null or c.section = p_section)
  order by random()
  limit 1;
$$;

grant execute on function public.pick_cbq_case(text, text) to anon, authenticated;

-- After applying:
--   POST /rest/v1/rpc/pick_cbq_case {"p_part":"Part 1"} -> case + tasks
--   GET  /rest/v1/cbq_cases?select=title,verified&verified=eq.true -> live sets
