-- Radar+ bookmarks: per-user post bookmarks that follow the student across devices.
-- Replaces the Wall page's localStorage-only bookmark set for authenticated users.
create table public.post_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);
alter table public.post_bookmarks enable row level security;

drop policy if exists "Owners can view own bookmarks" on public.post_bookmarks;
create policy "Owners can view own bookmarks" on public.post_bookmarks
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Owners can add bookmarks" on public.post_bookmarks;
create policy "Owners can add bookmarks" on public.post_bookmarks
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Owners can remove bookmarks" on public.post_bookmarks;
create policy "Owners can remove bookmarks" on public.post_bookmarks
  for delete to authenticated using (auth.uid() = user_id);
