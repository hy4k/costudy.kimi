-- study_room_sessions.author_id previously had no relationship to
-- public.user_profiles, so the author:user_profiles(name) embed used by the
-- Plan tab failed silently and the sessions list stayed empty.
alter table public.study_room_sessions
  add constraint study_room_sessions_author_id_profiles_fkey
  foreign key (author_id) references public.user_profiles(id) on delete set null;
