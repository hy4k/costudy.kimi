-- study_room_members.user_id previously only referenced auth.users, so PostgREST
-- could not resolve the user:user_profiles(name) embed used by the room interior.
-- This adds the missing relationship to public.user_profiles.
alter table public.study_room_members
  add constraint study_room_members_user_id_profiles_fkey
  foreign key (user_id) references public.user_profiles(id) on delete cascade;
