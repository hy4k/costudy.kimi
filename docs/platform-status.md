# CoStudy Platform Status

> Single reference for what's live on **costudy.in** — every page, its features, and the exact Supabase table behind each.
> Last verified end-to-end: **2026-11-20** (full click-through regression on the live site, both student and mentor sessions).
> Companion doc: [supabase-schema.md](./supabase-schema.md) — deep schema history of the question bank and vault pipelines.

## Infrastructure

| Layer | What | Where |
| --- | --- | --- |
| Frontend | React + Vite SPA, bundle `index-DCD2uPim.js` | Hostinger VPS `root@72.61.171.192`, `/var/www/html/costudy.in/public_html` |
| Database | Supabase project `avtjxcdcjbwmggdimkgh` (shared with the original app) | `https://avtjxcdcjbwmggdimkgh.supabase.co` |
| Payments | Razorpay: `payment-order`, `payment-verify`, `razorpay-webhook` edge functions | Supabase functions |
| Source of truth | `github.com/hy4k/costudy.kimi` (`main`) | deploy = build → tar/scp/ssh to VPS |

## Page-by-page

### Landing `/`
Anonymous hero page. Logged-in users are routed straight to the Study Wall (Wall-first flow).

### Login `/login`
Aspirant (student) and Mentor (faculty) entries. **Backing:** `supabase.auth` + `user_profiles` (role `STUDENT`/`TEACHER`). Role decides landing: students → `/wall`, mentors → `/mentor`.

### Study Wall `/wall` — the home feed
| Feature | Backing table |
| --- | --- |
| Feed + realtime new posts | `posts` (+ `comments(count)`), `supabase_realtime` publication |
| Broadcast composer (QUESTION / RESOURCE / MCQ / SHARE / PEER AUDIT) | `posts` insert, auth-gated (RLS) |
| Vouch authenticity layer | `engagements` (`resource_type='post'`, `kind='vouch'`, one per user, toggleable) + baseline `posts.likes` |
| Discussion threads | `resource_comments` (author → `user_profiles`) |
| Radar+ (bookmarks / watch list) | **localStorage — no table yet** (candidate: `post_bookmarks`) |

### Study Rooms `/rooms` + room interior
| Feature | Backing table |
| --- | --- |
| Live room clusters + who's inside | `study_rooms` + `room_presence` (upsert on join, delete on leave; `last_seen` < 15 min = at desk), realtime |
| Durable membership | `study_room_members` (role/status/signal light/streak/progress) |
| Create a room / invite | `study_rooms` insert + `study_room_members` |
| Room chat | `room_messages` |
| Shared whiteboard | `room_whiteboards` |
| Schedule & study plan tabs | `study_room_sessions` (upcoming sessions) + `room_study_plan` (weekly items) + `study_room_missions` (room goal) |
| Shared sprint timer | client-side (no persistence) |

### AI Deck `/ai`
| Feature | Backing |
| --- | --- |
| Mentor teaching notes | in-page syllabus notes per section |
| MCQ drills — **9,711 active questions** | `question_bank` via `pick_practice_mcqs(p_part, p_section, p_count)` RPC (anon-executable; 14/14 part×section paths verified serving; worked `explanation` unlocks on answer) |
| CBQ case track — **34 verified cases** | `cbq_cases` + `cbq_tasks` via `pick_cbq_case` RPC |
| Drill score / accuracy today | client-side (localStorage) |

### Library Vault `/vault`
| Feature | Backing table |
| --- | --- |
| Verified shelf (openable cards) | `library_items` |
| Community submissions → faculty review queue | `content_sources` (`source_kind='community_upload'`) |
| Vouch / watch / discussion on resources | `engagements` (`resource_type='vault'`, `kind='vouch'|'view'`) + `resource_comments` |
| Faculty approve/reject | approve → copy into `library_items` (vouches/comments migrate `src-` → `lib-`); reject → delete + wipe engagements |
| Contribute form | `content_sources` insert |

### Mastery Path `/path`
Calm single-glance page: mock status, exam window setter, next best step.
**Backing:** `mock_attempts` (+ legacy `mock_test_results`), `user_exam_targets`.

### Your Desk `/desk`
Start-here page: where-you-stand strip (streak / mocks / essays / rooms created / partners), profile setup checklist, rooms-created summary, the CoStudy loop explainer.
**Backing:** `user_profiles` + counts from `mock_attempts`, `study_rooms`, `alignments`.

### Study Partners `/contracts`
Privacy-by-design study contracts: propose by handle, subject, fixed window (week / month / until exam), auto-expire unless renewed.
**Backing:** `alignments` (contracts, `status` ACTIVE/…) + `alignment_requests` (proposals).

### Mentors marketplace `/mentors`
Faculty discovery: mentor profiles, structured cohort courses with Enroll, 1:1 Hire with hourly rates.
**Backing:** `mentor_courses`, `mentor_invitations`, `student_enrollments`, `session_payments` (Razorpay), `user_profiles` (teacher fields: specialties / years / rate).

### Mentor cockpit `/mentor`
Tabbed command deck (tab choice persisted):
- **Action desk** — hire requests, vault review queue, CBQ intake queue
- **Create** — wall broadcasts (`posts` as FACULTY), CBQ case intake, bounties (`mentor_bounties`)
- **Teach** — classrooms + courses (`study_rooms`, `mentor_courses`)
- **Earn** — revenue from `session_payments` + platform fee + marketplace profile

**Backing:** same marketplace tables + `session_payments`.

### Profile `/profile`
Identity hero (avatar upload ≤2 MB base64, role/exam/tier chips, bio, goal, mentor specialties), stats strip, mock history + wall activity panels, inline edit panel (mentor-only fieldset for specialties/years/rate), sign out.
**Backing:** `user_profiles` (+ `mock_attempts`, `mock_test_results`, `posts`, `alignments` counts).

## Data integrity

- **`question_bank` is the single canonical MCQ store** — nothing else serves the frontend. Audited Oct 2026: no competing copies (`mcq_questions` is a dormant 20-row seed; `ingestion_staging` is upstream pipeline history; `content_chunks`/`content_documents` are the RAG textbook corpus).
- Bank history: 15,324 raw rows → zero-defect cleanup → orphan recovery + Gleim + HOCK + Wiley OCR imports → scrambled-legacy split → bank-wide dedup → **hard-deleted 878 retired rows**. 9,711 active, all drill-shaped, all reachable through the RPC.
- Weekly zero-defect audit (structural + artifact + RPC reachability) runs **Fridays 01:45 IST**.

## Known caveats (deliberate, documented)

| Item | Status |
| --- | --- |
| Radar+ bookmarks | localStorage only — no `post_bookmarks` table yet |
| `user_progress` / `mastery_topics` | referenced by the original app but don't exist in this project; mastery is derived from `mock_attempts` + bank coverage instead |
| `mcq_responses` | has no `user_id` — per-user topic accuracy not derivable |
| `ai_requests` / `ai_question_cache` | exist but empty (original LLM proxy log / variant cache) |
| Backend RAG tutor on VPS (`/root/costudy-api/server.js`, port 8080) | **not wired to the site** (no nginx proxy) and currently broken — OpenAI quota exhausted, chat path doesn't fall back to Anthropic. The AI Deck is unaffected: it teaches from in-page notes + the live bank, not the LLM proxy. |
| CBQ authoring | 34 faculty-reviewed cases live; the sourcing pipeline for more is documented in the workspace `cbq-content-sourcing-report.md` |
