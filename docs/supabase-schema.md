# CoStudy Supabase Schema Map

Project: `https://avtjxcdcjbwmggdimkgh.supabase.co` — shared by the original costudy.in app and this redesign.
Compiled from the original repo's service layer (`services/*.ts`) and verified live against the project (anon key, Oct 2026).
**Update (same day):** a full OpenAPI spec pull (service role, from the owner's VPS) revealed the project actually has **100+ tables** — the app-facing subset is listed below, plus the vault-relevant ones.

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

## Library Vault contract (verified)

- **Verified shelf** = `library_items` — columns: `id, title, description, category, file_url, file_type, uploaded_by, created_at`. Anonymously readable; writes blocked for anon (RLS), authenticated insert expected.
- **Pending-review shelf** = `content_sources` rows with `source_kind = 'community_upload'` — columns: `id, source_kind, name, external_ref, metadata(jsonb), created_at`. Community submissions land here awaiting faculty review; `metadata` carries `{description, kind, submitted_by}`.
- The separate `ingestion_staging` / `ingestion_review_events` tables are the **internal question-bank pipeline** (CSV sources → review → publish) — deliberately NOT reused for community uploads.
- Optional future migration: add `status text not null default 'pending'` + `reviewed_by uuid` to `library_items` if uploads should live in the same table as curated items.

## Study Rooms contract (verified)

- **Rooms** = `study_rooms` — anon-readable. Rich columns: `name, category, description, color_theme, room_type, is_live, max_members, members_count, active_count, tags, topic, exam_window, cluster_streak, focus_minutes_today, total_focus_hours`.
- **Presence** = `room_presence` — one row per user currently in a room: `room_id, user_id, display_name, avatar_url, last_seen`. Anon-readable. Join = upsert own row (auth-gated, RLS blocks anon); leave = delete own row.
- **Membership** = `study_room_members` — durable membership with `role, status, signal_light, is_online, streak, progress` (presence is ephemeral; membership is durable).
- Realtime: `postgres_changes` on `room_presence` refreshes who's-in-the-room live; `INSERT` on `study_rooms` pulls in new clusters.
- Freshness: `last_seen` within 15 min counts as an occupied desk; older rows show as away.

## Mastery Path contract (verified)

- **Mock trend & mastery ring** = `mock_attempts` — anon-readable, real rows exist. Columns: `id, user_id, exam_id, scaled_score, started_at, completed_at, pass_threshold`. (Note: `mode`/`label` are reserved/blocked in PostGREST selects — avoid.) Per-user via `.eq('user_id', …)`.
- **Exam milestone** = `user_exam_targets` — `user_id, exam_window (text), created_at`. No date column: the cockpit shows the window text and derives an *approximate* countdown only when the window string parses (e.g. "Jan-2027").
- **Syllabus blocks** = `mcq_questions` — `part, section, question_text…` with real rows; the cockpit renders **question-bank coverage** per section (share of banked questions) instead of fabricated per-user mastery.
- **Badges** = `user_badges(user_id, badge_id, earned_at)` joined to `badges(name, icon, description, category)`.
- ⚠️ `user_progress` and `mastery_topics` are referenced by the original app's services but **do not exist** in this project — the original silently swallows those errors. If durable per-topic progress is wanted, both tables need a one-time migration.
- ⚠️ `mcq_responses` has no `user_id` column (only `id, question_id, is_correct` confirmed) — per-user topic accuracy isn't derivable yet.

## AI Deck contract (verified)

- **Question bank** = `mcq_questions` — full contract: `id, part, section, question_text, option_a, option_b, option_c, option_d, correct_answer, created_at`. Anon-readable; 20 real rows across 11 sections (Part 1 ×5 sections, Part 2 ×6). The mentor fetches the bank on load and grounds every answer in it: topic match → teaching note + an interactive drill card (real question, real options, self-check against the bank's `correct_answer`). Session drill score is tracked client-side.
- ⚠️ The bank has **no explanation/rationale column** — the mentor's teaching notes live in the page (keyed by section), not in the DB.
- **`ai_requests`** — this is the *backend API call log* for the original app's Gemini proxy (columns: `id, user_id, endpoint, model, provider, status, prompt_hash, prompt_tokens, completion_tokens, latency_ms, metadata(jsonb), created_at`). There is **no retrievable prompt/answer text** — answers can't be cached or replayed from it from the frontend. It is currently empty.
- **`ai_question_cache`** — stores AI-generated question *variants* (columns: `id, base_question_id, part, section, topic, difficulty, question_type, question_data(jsonb), quality_score, generation_model, times_shown, is_used, created_at`). Populated by the backend generation pipeline; currently empty. Future hook: surface `is_used` variants as extra drills.

## Redesign wiring status

| Feature | Status |
| --- | --- |
| Supabase client (same project + anon key) | Wired |
| Wall feed read + realtime | Wired |
| Wall broadcast (insert, auth-gated) | Wired |
| Likes (postgREST update) | Wired |
| Comment threads (`comments`, count via `comments(count)`) | Wired |
| Vault verified shelf (`library_items`) + pending shelf (`content_sources`) | Wired |
| Vault community submission (insert into `content_sources`, auth-gated) | Wired |
| Faculty review queue (approve → `library_items`, reject → delete) | Wired |
| Study Rooms (`study_rooms` + `room_presence`, realtime, join/leave) | Wired |
| Mastery Path (`mock_attempts`, `user_exam_targets`, `mcq_questions` coverage, `user_badges`) | Wired |
| AI Deck (`mcq_questions` bank-grounded mentor + drills) | Wired |
| Radar+ bookmarks | Local (no bookmark table exists yet — candidate: new `post_bookmarks` table) |
| Login / role routing / mentor path | Wired |
