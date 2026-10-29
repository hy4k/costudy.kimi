-- CoStudy: replace the ad-hoc pick_practice_mcqs RPC.
-- Why: the current function (created manually in the dashboard, not in any repo)
-- hard-excludes Part 1 + Section E (Internal Controls) — 437 verified active rows
-- are unreachable through the only draw path the AI Deck uses. Verified empirically:
-- 13/14 (part x section) paths serve; Part 1 Section E returns 0 even unsectioned.
-- This replacement keeps the exact signature and return shape the frontend relies
-- on (setof question_bank, anon-executable, security definer) and removes only
-- the hardcoded exclusion. Essays stay excluded via the question_kind filter.
--
-- Run once in: Supabase dashboard -> SQL editor -> New query -> paste -> Run.

create or replace function public.pick_practice_mcqs(p_part text, p_section text, p_count integer)
returns setof public.question_bank
language sql
security definer
set search_path = public
as $$
  select *
  from public.question_bank
  where is_active = true
    and part = p_part
    and (p_section is null or section = p_section)
    and upper(question_kind) = 'MCQ'
  order by random()
  limit greatest(coalesce(p_count, 1), 1);
$$;

grant execute on function public.pick_practice_mcqs(text, text, integer) to anon;
grant execute on function public.pick_practice_mcqs(text, text, integer) to authenticated;

-- After running, verify from the VPS:
--   python3 -  (copy of ops/rpc_drill.py)  -> expect 14/14 OK
