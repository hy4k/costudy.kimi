-- Shared whiteboard for study rooms: one row per room, strokes stored as
-- normalized-coordinate JSON so every desk draws the same picture.
create table if not exists public.room_whiteboards (
  room_id uuid primary key references public.study_rooms(id) on delete cascade,
  strokes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.room_whiteboards enable row level security;
drop policy if exists "Whiteboards visible to authenticated" on public.room_whiteboards;
create policy "Whiteboards visible to authenticated" on public.room_whiteboards
  for select to authenticated using (true);
drop policy if exists "Active members can draw" on public.room_whiteboards;
create policy "Active members can draw" on public.room_whiteboards
  for insert to authenticated with check (
    exists (select 1 from public.study_room_members m
      where m.room_id = room_whiteboards.room_id and m.user_id = auth.uid() and m.status = 'ACTIVE')
  );
drop policy if exists "Active members can update whiteboard" on public.room_whiteboards;
create policy "Active members can update whiteboard" on public.room_whiteboards
  for update to authenticated using (
    exists (select 1 from public.study_room_members m
      where m.room_id = room_whiteboards.room_id and m.user_id = auth.uid() and m.status = 'ACTIVE')
  ) with check (
    exists (select 1 from public.study_room_members m
      where m.room_id = room_whiteboards.room_id and m.user_id = auth.uid() and m.status = 'ACTIVE')
  );
alter publication supabase_realtime add table public.room_whiteboards;
