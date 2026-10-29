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

- **The real question bank** = `question_bank` — **15,324 rows total**: `id, external_id, part, section, topic, question_kind, difficulty, source_kind, question_text, options(jsonb {"A"…"D"}), correct_answer, explanation, reference_links(jsonb), tags, is_active, quality_flag, created_at, updated_at`. **10,397 active MCQs** after the Oct 2027 zero-defect cleanup — **every active row is drill-shaped and frontend-reachable**: complete A–D options, valid `correct_answer`, distinct options, zero artifact/PUA residue (Part 1 6,978 / Part 2 3,424; `section` may be NULL — the RPC draw ignores section). CBQ case-based questions remain absent everywhere — `question_kind` has no CBQ type.
- **Direct table reads are RLS-blocked for anon** (returns `[]`). The frontend uses the existing **`pick_practice_mcqs(p_part text, p_section text, p_count int)` RPC** — anon-executable, SECURITY-style access, returns random **active** MCQs with full `options`, `correct_answer`, and `explanation`. Verified: respects `is_active`, random per call.
- **Oct 2027 recovery pass** (service-role, run on owner's VPS): screened all 5,253 inactive MCQs (complete A–D options, valid `correct_answer`, distinct options, stem 25–600 chars), deduped against active stems and within the set → **1,975 reactivated** (`quality_flag='recovered'`; 1,231 include explanations). ~3,300 remain inactive — genuinely broken (`no_answer`, `missing_options`, `truncated_scrape` per their `quality_flag`).
- **Oct 2027 Gleim Drive import** (VPS pipeline, `ops/import_gleim.py`): walked the owner's shared Drive folder (Wiley/Hock/Gleim per section), downloaded Gleim PDFs no-auth, parsed with `pdftotext` — Part 2 uses separate Questions/Answers PDFs paired by option-text matching in a sliding window; Part 1 uses combined Q&A PDFs with inline `Answer (X) is correct` markers. Watermarks (Arabic presentation-form text + Telegram links) stripped inline. Screened (complete A–D, valid key, distinct options, stem 25–1500 chars) + deduped vs active stems → **+777 inserted** (`source_kind='gleim_drive'`, `quality_flag='imported_gleim'`): Part 2 +579 (130→763), Part 1 +198.
- **Oct 2027 HOCK Drive import** (same pipeline, HOCK branch): per section, `Section X Questions.pdf` + `Section X Answers.pdf` — headers `N. Question ID: <id> (Topic: …)` (topic can wrap), options bulleted (U+F0B7) A–D, answers restate options with the correct one suffixed `correct` glued to the text (`sales.correct`, `20%correct`, also on wrapped continuation lines; guarded so the word "incorrect" never matches). Paired with the same sliding-window option-text matcher; `external_id` embeds part + question number because Hock files mix cross-part review questions. → **+1,880 inserted** (`source_kind='hock_drive'`, `quality_flag='imported_hock'`): Part 2 +844, Part 1 +1,036. **Active bank now 9,773 MCQs** (P1 7,831 / P2 1,770); 7,087 carry worked explanations.
- ⚠️ CBQ (case-based questions) confirmed absent from Drive and DB — no `question_kind` for it exists; new content type would need a schema addition. Wiley files are ~477 MB scans needing OCR before parsing (feasibility probe pending).
- **Oct 2027 Wiley OCR batch** (`ops/ocr_wiley.py` on the VPS, runs detached): the ten Wiley section PDFs are true scans (no text layer; "Nuance PDF Create 8", ~450 MB / ~1,200 pages each for P2-2019, much smaller for P1-2021). Pipeline enumerates the Wiley folders no-auth, downloads via the Drive virus-scan confirm flow with last-page render validation + retries, then `pdftoppm` → `tesseract` in 40-page batches (PDF lives outside the image scratch dir; one file at a time on the 3.9G tmpfs). OCR text lands in `/root/wiley-text/p<part>-<sec>.txt` with `===== PAGE N =====` markers.
- **Oct 2027 Wiley format parser + import** (`ops/import_wiley.py`): parses the finished OCR text files (Wiley layout: `Question N <id> LOS: x.y.z`, stem, options a–d, per-option rationale blocks keyed by private-use glyphs U+EB63 (correct) / U+EB67 (wrong)). Primary parse keys on the glyph rules; a **marker-fallback** pass re-parses with an `@`/h-glyph correctness rule for questions whose glyphs OCR'd ambiguously — those rows carry `quality_flag='imported_wiley_marker'` (686 active) so mentors can filter them for review. Active Wiley-sourced rows now **4,222** (`imported_wiley` 3,332 + `imported_wiley_marker` 686 + `recovered_legacy` 204); ~932 further Wiley questions were deliberately skipped (multiple ambiguous @ glyphs — quality call).
- **Oct 2027 scrambled legacy split** (`ops/split_legacy.py` + `ops/recover_v3.py`): 41 `curated_pipeline` rows turned out to be run-on concatenations of dozens of Wiley-format question blocks each (up to 300+). Verified true block layout: the options list carries the marker `' Correct '` **in place**, immediately before the correct option (any letter A–D), followed by glyph-keyed rationale chunks. `split_legacy.py` (pass 1, correct-assumed-last variant) split 12 rows fully → 95 clean questions recovered (`quality_flag='recovered_legacy'`), 161 embedded questions confirmed already in bank, rows deactivated (`quality_flag='scrambled_split'`). `recover_v3.py` (pass 2) models the true layout: correct option recovered from the U+EB63 restatement, wrong options from U+EB67 restatements (option order), options after the correct one scanned from the list remainder with a **unique-consistent-split gate** (exactly one k must yield a valid 4-option question) → **+109 more recovered**, +144 confirmed already covered, 1 more row deactivated. Totals: 13 rows deactivated, 204 `recovered_legacy` questions, 28 rows held ~884 segments whose verdict/marker text is OCR-damaged (unrecoverable by parsing; several belong to a different Wiley edition absent from the OCR corpus). Full row backups on the VPS: `/root/scrambled_rows_backup.json` + `/root/scrambled_rows_backup_v3.json`.
- **Oct 2027 zero-defect cleanup** (`ops/master_cleanup.py`, `--apply` on the VPS; verifiers `ops/verify_bank.py`, `ops/test_rpc.py`): final quality pass over the whole active bank. **Stage 1** fixed 197 rows in place (PUA bullet glyph U+F0B7 → `·` in stems/options/explanations). **Stage 2** quarantined 3,345 unfixable active rows (`is_active=false`): 744 with no `correct_answer` and no salvage source, 2,387 with missing/incomplete options (incl. the 28 legacy scrambled rows — they were servable by the RPC and showed learners run-on garbage — and old `curated_pipeline` rows whose scraped options/answers never made it into the jsonb columns), 214 essays/`Additional`-part rows (not MCQ-drillable). **Stage 3** deduped within (part, normalized stem): 235 `duplicate_inactive`, keep-best by explanation completeness + import source. Final verification: artifact audit **zero flags** on all active rows; structural sweep clean (valid keys, 4 distinct options, no PUA/control chars); 5 ambiguous same-text-option rows also quarantined. **Reachability proven**: all 10,397 active rows sit in Part 1/Part 2 and draw correctly through `pick_practice_mcqs` (800-draw empirical test, 0 malformed). Everything touched backed up to `/root/master_cleanup_backup.json`. Remaining cross-part duplicate stems (877 groups) are legitimate review questions present in both parts.
- **Data residency (Oct 2027 inventory, verified)**: `question_bank` in project `avtjxcdcjbwmggdimkgh` is the single canonical MCQ store — 23,096 rows total / 10,397 active; nothing else serves the frontend. Related stores audited: `ingestion_staging` (13,797 rows) is the original upload→review→publish pipeline whose PUBLISHED rows were copied into `question_bank` (upstream staging, not a competing copy); `content_chunks` (43,860) + `content_documents` (101) are the RAG tutor's textbook corpus, not MCQs; `mcq_questions` (20) is a dormant mock seed; essay/CBQ/mock tables hold only native content (counts in the single digits). A planned `practice_question_bank` table was never created (SQL sits unused in costudy-api). VPS filesystem: `/root/costudy-api/part2-questions.json` (144 orphaned Part 2 questions, unreferenced by code) + `/root/wiley-text/` OCR source text are the only local question files; original GitHub repo carries 2-line seed stubs only. The separate FETS EX Supabase project contains no question tables. Weekly zero-defect audit (structural + artifact + RPC reachability) runs Fridays 01:45 IST and flags any drift.
- The Deck pairs live syllabus teaching notes (in-page, keyed by section) with an RPC-drawn drill card: answer → bank's worked `explanation` unlocks; session drill score tracked client-side.
- ⚠️ `mcq_questions` (the 20-row table) is just a tiny seed — superseded by `question_bank` for drills.
- **`ai_requests`** — the *backend API call log* for the original app's LLM proxy (columns: `id, user_id, endpoint, model, provider, status, prompt_hash, prompt_tokens, completion_tokens, latency_ms, metadata(jsonb), created_at`). No retrievable prompt/answer text; currently empty.
- **`ai_question_cache`** — AI-generated question *variants* (`id, base_question_id, part, section, topic, difficulty, question_type, question_data(jsonb), quality_score, generation_model, times_shown, is_used, created_at`), populated by the backend pipeline; currently empty.
- **Backend AI service** (`/root/costudy-api/server.js` on the VPS, port 8080): real RAG tutor `POST /api/ask-cma` (embeds query → retrieves `content_chunks` — 43,860 rows → GPT-4o-mini / Anthropic fallback, returns cited sources). ⚠️ Not wired to the site (no nginx proxy) and **currently broken — OpenAI quota exhausted; chat path doesn't fall back to Anthropic** despite a configured key.

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
| AI Deck (`question_bank` via `pick_practice_mcqs` RPC: notes + drills + explanations) | Wired |
| Radar+ bookmarks | Local (no bookmark table exists yet — candidate: new `post_bookmarks` table) |
| Login / role routing / mentor path | Wired |
