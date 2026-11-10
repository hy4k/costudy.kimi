-- Policies for the pre-existing schedule / study-plan / goal tables so the
-- room interior can use them live:
--  * session authors may update (cancel/reschedule) their own sessions
--  * active room members may set and advance a room goal
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'study_room_sessions') then
    alter publication supabase_realtime add table public.study_room_sessions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'room_study_plan') then
    alter publication supabase_realtime add table public.room_study_plan;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'study_room_missions') then
    alter publication supabase_realtime add table public.study_room_missions;
  end if;
end $$;

drop policy if exists "Authors can update their sessions" on public.study_room_sessions;
create policy "Authors can update their sessions" on public.study_room_sessions
  for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);

drop policy if exists "Active members can set room goals" on public.study_room_missions;
create policy "Active members can set room goals" on public.study_room_missions
  for insert to authenticated with check (
    auth.uid() = created_by and
    exists (select 1 from public.study_room_members m
      where m.room_id = study_room_missions.room_id and m.user_id = auth.uid() and m.status = 'ACTIVE')
  );

drop policy if exists "Active members can update room goals" on public.study_room_missions;
create policy "Active members can update room goals" on public.study_room_missions
  for update to authenticated using (
    exists (select 1 from public.study_room_members m
      where m.room_id = study_room_missions.room_id and m.user_id = auth.uid() and m.status = 'ACTIVE')
  ) with check (
    exists (select 1 from public.study_room_members m
      where m.room_id = study_room_missions.room_id and m.user_id = auth.uid() and m.status = 'ACTIVE')
  );
