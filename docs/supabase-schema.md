# CoStudy Supabase Schema Map

Project: `https://avtjxcdcjbwmggdimkgh.supabase.co` — shared by the original costudy.in app and this redesign.
Compiled from the original repo's service layer (`services/*.ts`) and verified live against the project (anon key, Oct 2026).

## Tables

| Table | Purpose | Used by |
| --- | --- | --- |
| `user_profiles` | One row per auth user: `id` (uuid, = auth.users id), `name`, `handle`, `role` (`STUDENT`/`TEACHER`), `level` (`STARTER`/`SCHOLAR`/`EXPERT`), `avatar`, `exam_focus`, `reputation`, plus profile/reputation JSON | everything (join target) |
| `posts` | Study Wall feed | Study Wall, Mentor broadcasts |
| `comments` | Thread replies on posts (`post_id`, `parent_id`) | post discussions |
| `notifications` | User notification inbox | bell, toasts |
| `chat_conversations` / `chat_participants` / `chat_messages` | Doubt desk DMs | chatService |
| `wallet_transactions` | Coin/point ledger | wallet |
| `referral_codes` / `referral_usage` / `referrals` | Referral program | referralService |
| `teacher_broadcasts` | Faculty announcements | teachers lounge |
| `mentor_bounties` | Mentor-posted bounties | wall bounties |
| `study_room_resources` | Room-attached materials | study rooms |
| `user_progress` | Mastery path progress | path engine |
| `student_enrollments` | Course/room enrollments | rooms |
| `mock_exams` | Mock test definitions + results | mock engine |
| `mentor_invitations` | Mentor onboarding invites | admin |
| `content_reports` | Moderation queue | admin |
| `admin_actions` | Audit log | admin panel |

## Study Wall contract (verified)

```ts
// read
supabase.from('posts')
  .select('*, author:user_profiles(name, role, level)')
  .order('created_at', { ascending: false })

// write
supabase.from('posts').insert({
  author_id: userId,   // uuid → user_profiles.id
  content: string,
  type: 'QUESTION' | 'RESOURCE' | 'DISCUSS' | ...,   // see PostType in original types.ts
  tags: string[],
  likes: 0,
})
```

- `posts` is **readable anonymously** (verified live); it is currently **empty** — the first real broadcast creates the feed.
- Writes require an **authenticated** session (Supabase RLS); the redesign's composer is therefore login-gated.
- Realtime: `supabase.channel('wall-posts').on('postgres_changes', { event: 'INSERT', table: 'posts' }, …)` — the redesign subscribes so new broadcasts appear instantly. (Requires the `posts` table in the `supabase_realtime` publication.)

## Auth & role routing (mirrors original app)

1. `supabase.auth.signUp({ email, password, options: { data: { full_name, role } } })` — role is passed in user metadata so the DB trigger can seed `user_profiles`.
2. `supabase.auth.signInWithPassword({ email, password })`.
3. Profile resolved via `user_profiles` row (`getUserProfile`); created just-in-time if missing (`createUserProfile`).
4. Routing: `role === 'TEACHER'` → **Faculty Room** (`/mentor` in the redesign); students land on the Study Wall (`/wall`).

## Redesign wiring status

| Feature | Status |
| --- | --- |
| Supabase client (same project + anon key) | Wired |
| Wall feed read + realtime | Wired |
| Wall broadcast (insert, auth-gated) | Wired |
| Likes (postgREST update) | Wired |
| Radar+ bookmarks | Local (no bookmark table exists yet — candidate: new `post_bookmarks` table) |
| Login / role routing / mentor path | Wired |
| Vault, Rooms, AI Deck, Mastery Path data | Local curated data (next phase) |
