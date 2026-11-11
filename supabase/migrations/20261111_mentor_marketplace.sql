-- Mentor marketplace: course offers + hire invitations between students and mentors.
-- Reuses the pre-existing mentor_invitations table (agreed_fee / costudy_fee
-- already model the platform cut).
create table public.mentor_courses (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.user_profiles(id) on delete cascade,
  title text not null,
  description text,
  price numeric not null default 0,
  duration_weeks integer not null default 4,
  schedule_text text,
  max_students integer not null default 10,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.mentor_courses enable row level security;

drop policy if exists "Courses visible to authenticated" on public.mentor_courses;
create policy "Courses visible to authenticated" on public.mentor_courses
  for select to authenticated using (true);

drop policy if exists "Mentors can publish courses" on public.mentor_courses;
create policy "Mentors can publish courses" on public.mentor_courses
  for insert to authenticated with check (auth.uid() = mentor_id);

drop policy if exists "Mentors can update own courses" on public.mentor_courses;
create policy "Mentors can update own courses" on public.mentor_courses
  for update to authenticated using (auth.uid() = mentor_id) with check (auth.uid() = mentor_id);

-- students create hire invitations; both parties can always see them
drop policy if exists "Students can invite mentors" on public.mentor_invitations;
create policy "Students can invite mentors" on public.mentor_invitations
  for insert to authenticated with check (auth.uid() = inviter_id);

drop policy if exists "Invite parties can view invitations" on public.mentor_invitations;
create policy "Invite parties can view invitations" on public.mentor_invitations
  for select to authenticated using (auth.uid() = mentor_id or auth.uid() = inviter_id);

alter table public.mentor_invitations add column if not exists note text;
