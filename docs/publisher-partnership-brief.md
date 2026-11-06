# CoStudy × Publisher Partnership Brief — Negotiating a CBQ Content License From Strength

**Date:** 2026-11-06 · **Status:** Decision document (Phase 4 of the CBQ sourcing roadmap) · **Companion:** [cbq-content-sourcing-report.md](cbq-content-sourcing-report.md) (research base, Sections 3–5) · **Audience:** Midhun (principal) and counsel, before any publisher contact

---

## 1. The Decision on the Table

Phase 4 asks one question: *does CoStudy license CBQ content from a publisher, co-brand with one, or decline the lane entirely and keep building the original-content pipeline?* This brief argues the answer is a **sequenced yes**: pursue the partnership lane now — while CoStudy's post-Phase-1–3 position is at its strongest — but negotiate from the posture of a platform that does not *need* a deal, because the organic pipeline already works.

Three facts define the negotiating position. **First, the market discontinuity is real and current:** since the September/October 2026 window, CBQs are the only written-section format on English-language CMA exams worldwide, and every competitor's essay-era practice material went format-obsolete overnight ([UWorld exam-format explainer](https://accounting.uworld.com/blog/cma-review/cma-exam-update-case-based-questions/)). **Second, dedicated CBQ content remains the scarcest asset in the market:** Gleim — the deepest CBQ catalog — advertises 75+ case-based questions, UWorld fields 28, and Becker lists 26 ([Crush the CPA Exam on Gleim 2026](https://crushthecpaexam.com/gleim-cma-review/), [UWorld QBank page](https://accounting.uworld.com/cma-review/practice-questions/)). **Third, CoStudy is no longer a supplicant in this market:** after Phases 1–3 it operates an exam-faithful CBQ engine with 34 live cases across all 12 syllabus sections, a 9,711-question MCQ bank that is fully sectioned, deduplicated, and mechanically audited every week, and a mentor verification queue that gives every shipped item a named human author. A platform that owns a working pipeline negotiates a license as an *accelerator*, never as a *lifeline* — and that distinction is worth real money at the table.

## 2. CoStudy's Asset Inventory (The "From Strength" Ledger)

These are the numbers to put in front of any publisher. Every figure below is verifiable live in the production database; the Friday audit re-proves them automatically.

| Asset | Current state | Why a publisher cares |
|---|---|---|
| MCQ bank | **9,711 active questions**, 0 untagged, 0 duplicates, 0 scrambled rows; both parts, all sections | Roughly 1.5–2.3× the MCQ volume of any single competitor's bank |
| CBQ corpus | **34 live cases** (12/12 section-groups), 7 tasks per case, 5 interactive task types | Already ~45% of Gleim's dedicated CBQ count, and served interactively rather than as PDF-style sets |
| CBQ engine | Narrative + typed exhibits + drag-and-drop, numeric-with-tolerance, multi-select, list, single-answer; `pick_cbq_case` RPC; Prometric-style interaction patterns | This is the hard part most publishers have not built; it is CoStudy's leverage in a reverse-direction deal |
| Quality apparatus | Haladyna-rule codex (`ops/item_lint.py`) catching 20/20 injected flaw classes; arithmetic key validation; Friday zero-defect audit incl. CBQ drill | De-risks any co-branded content — the publisher's brand rides on CoStudy's QA rails |
| Human verification | Mentor cockpit intake → verify/reject queue; every active item has a named human reviewer | Satisfies the human-authorship requirement that makes content copyrightable and exclusively ownable |
| Provenance discipline | Per-item prompt/draft/review/edit logging; generation strictly from the public CSO/LOS spec | The chain-of-title ledger a publisher's counsel will ask about before any co-branding |
| Syllabus map | Explicit 12-section CSO 2024 mapping with exam weights, coverage analytics per section | Lets a partner target gaps surgically instead of bulk-dumping a bank |

The honest counterweight to keep in the room: CoStudy's 34 cases are *original authored* cases, not retired-exam items, and the deepest competitors still outcount CoStudy in CBQ volume today. The pitch is therefore not "we are bigger" — it is "we are the only platform whose CBQ layer is interactive, audited, fully mapped, and legally clean, and it compounds weekly."

## 3. Target Map — Who to Approach, in What Order, and Why

The research in Section 3 of the sourcing report ranked the seven source families; this map converts that ranking into an outreach sequence. Ordering reflects probability of a deal *and* strategic value of the deal, not prestige.

### Tier 1 — open now

| Target | Opening angle | Their incentive | Watch-outs |
|---|---|---|---|
| **Gleim** (Traditional $1,499 / Premium $1,799 / MegaBank $999) | License a CBQ subset, or co-brand "Gleim cases on CoStudy engine" | Deepest CBQ catalog (75+ sets) but static delivery; they already productize a standalone bank (MegaBank), so bank-as-licensed-asset is a concept they understand | Family-owned, conservative; expect slow legal; protect against exclusivity demands that would cage CoStudy's own pipeline |
| **Surgent** | White-label CoStudy's CBQ engine to modernize their limited case-based line | Surgent competes on adaptive MCQ tech with weak CBQ content — CoStudy's engine is exactly their gap | Smaller deal size; ensure rev-share floors |

### Tier 2 — open after Tier 1 signals

| Target | Opening angle | Their incentive | Watch-outs |
|---|---|---|---|
| **UWorld** (6,200+ MCQs, 28 CBQs, Premier/Elite) | Co-branded CBQ sets or joint authoring program | UWorld is an IMA strategic partner with brand gravity but a thin CBQ count; CoStudy's volume + engine could fill their case line faster than in-house authoring | Their IMA relationship may make them a *gatekeeper* rather than a partner; terms may demand CoStudy content exclusivity — decline |
| **Becker** (26 case-based questions) | Same as UWorld | Premium brand, smallest CBQ shelf of the majors | Corporate parent (Adtalem) procurement is slow; content teams turn over |
| **HOCK** | Budget-tier content license (MCQ + any case material) | HOCK is price-led with 4,000+ MCQs and minimal case content; licensing out is incremental revenue | Quality variance; audit their items through the codex before any co-brand |

### Tier 3 — long lane (relationship, not supply)

| Target | Nature of relationship |
|---|---|
| **Harvard / Ivey / The Case Centre** | Teaching-case licenses permit *assignment*, not slicing into auto-graded tasks — so no content deal yet. But IMA is itself a registered Case Centre contributor, and a CoStudy–Case Centre institutional license (~$3,200/yr class of spend) becomes interesting the day CoStudy runs cohort programs. Revisit when the mentor-cohort product launches |
| **AICPA-CIMA** | CIMA's pre-seen and post-exam kits are all-rights-reserved and blueprint-mismatched — unusable as content, invaluable as calibration reference. No deal to pursue; keep studying their case difficulty and marking philosophy |
| **IMA / ICMA** | Not a content source (the live item bank is never shared, and sharing actual exam items is prohibited conduct). But IMA's endorsement/affiliate lane is the credibility multiplier for any co-branded set — worth a parallel conversation once a publisher term sheet exists |

### Explicit non-targets

- **FreeFellow** — not a partner; it is the existence proof that an independent platform can legally build original items to the public CSO, and it sets the competitive floor. Track them; don't court them.
- **Any per-seat course purchase** — buying Gleim/UWorld seats to extract content is a copyright violation per IMA's own conduct statement and poisons CoStudy's clean-provenance story. This is a bright red line for every deal below.

## 4. Deal Structures — Four Shapes, Ranked

**Shape D — Engine licensing (reverse direction).** CoStudy licenses its CBQ engine + QA apparatus to a publisher, who fills it with their own authored cases. CoStudy becomes infrastructure. *Best margin, best moat, slowest sales cycle.* Lead with this at Tier 1 conversations — even if it doesn't close, it reframes every subsequent negotiation: CoStudy is a vendor-publisher hybrid, not a content buyer.

**Shape B — Co-branded CBQ sets.** Joint sets ("{Publisher} × CoStudy CBQ Series") authored by the publisher's SMEs, screened by CoStudy's codex, served on CoStudy's engine; revenue share on the set. *Fastest to market, strongest brand transfer.* This is the recommended primary structure: the publisher contributes author networks and brand, CoStudy contributes format fidelity and QA, and both parties' marketing tells the same CBQ-transition story.

**Shape A — Content license.** Straight annual license for a defined CBQ subset, converted to CoStudy's task types. *Simplest legal shape, weakest differentiation.* Appropriate only for backfill depth (e.g., licensing a legacy essay→CBQ-converted shelf from Wiley-era material) at a low fixed fee. Do not pay royalties on content CoStudy's pipeline can originate within two quarters.

**Shape C — Acquisition of a bank.** Buying a retired/secondary question bank outright. *Not recommended now.* Every bank on the market carries the provenance problems CoStudy just spent weeks cleaning out of its own; ownership transfers the liability with the assets.

**Recommendation:** open with Shape D at Gleim and Surgent simultaneously; treat Shape B as the fallback-to-primary at UWorld/Becker once Tier 1 responds; cap any Shape A license at a fixed fee below the pipeline's two-quarter replacement cost (Section 6).

## 5. Term Sheet Skeleton

The clauses that matter, with CoStudy-favorable positions to anchor on. Everything here is a planning-grade position, not legal advice — counsel converts these into draft language.

| Clause | CoStudy anchor position | Rationale |
|---|---|---|
| **Grant scope** | Named CBQ items (by ID/list), interactive-format adaptation rights included, derivative works *within CoStudy's platform only* | Prevents the partner from claiming CoStudy's task-type adaptations as their own |
| **Exclusivity** | Non-exclusive by default; consider *field-of-use* exclusivity (e.g., "interactive CBQ delivery in South Asia") only if priced ≥ 2× the non-exclusive fee | Exclusivity cages the organic pipeline — CoStudy's core asset |
| **Compensation** | Co-branded (B): 15–25% of net set revenue to CoStudy + per-item verification fee for codex/mentor screening. Licensed content (A): fixed annual fee, no royalty | CoStudy's QA labor is real cost and real value; royalties on licensed-in content invert the leverage |
| **AI clauses** | Mutual: partner warrants content is human-authored or properly licensed; CoStudy warrants its *pipeline* may use AI assistance under provenance logging; **no AI-training rights in either direction without separate written consent** | The AI-non-copyrightability trap cuts both ways; training rights are the new oil — never give them away in a boilerplate clause |
| **Warranty & indemnity** | Partner warrants originality and non-infringement, indemnifies CoStudy; CoStudy warrants QA process, not outcome | CoStudy's provenance ledger makes this asymmetry defensible and is a genuine negotiating asset |
| **Term & termination** | 2-year initial, renewal by mutual agreement; CoStudy may terminate for content-quality failure (defined: codex pass rate < 95% after two remediation cycles) | Keeps the partner's brand standards aligned with CoStudy's audit discipline |
| **Audit** | Mutual audit rights; CoStudy's weekly automated audit shared with partner as a standing report | Transparency as a feature — few competitors can offer a live audit feed |
| **CSO currency** | Partner obligation to update licensed content within 90 days of any ICMA CSO/LOS change | Exam-spec drift silently rots banks; CoStudy's pipeline handles it natively |

## 6. Economics — When a Deal Pays for Itself

The BATNA is known and priced: the organic pipeline ships 2–3 verified cases/week at mentor-time cost, roughly 100–150 new live cases per year. Against Gleim's 75 sets and UWorld's 28, CoStudy reaches parity-or-leadership in dedicated CBQ count within one exam cycle *without any deal*. Therefore:

- **Walk-away threshold for Shape A:** any fixed annual fee exceeding the loaded cost of originating the equivalent content in two quarters of pipeline time (mentor hours × rate + AI tooling) is a decline. At current cadence that bounds a whole-bank license in the low four figures USD annually — which no publisher will accept, which is the point: Shape A almost never clears, and knowing that in advance is negotiating power.
- **Shape B break-even:** a co-branded set pays for itself if it sells > ~40 seats/quarter at typical CMA prep price points, *before* counting the brand halo. Anchor the revenue share high (25%) because CoStudy carries the delivery, QA, and audit infrastructure.
- **Shape D valuation:** engine licensing should be priced as SaaS — per-active-seat or per-case-served, with a floor. Do not accept a one-time fee; the engine appreciates with every case CoStudy adds.
- **The real prize is time-to-narrative:** a signed Gleim or UWorld co-brand, announced before the next exam window, positions CoStudy as *the* CBQ platform while competitors are still converting essays. That marketing value — not the content — is what justices accepting terms slightly worse than the pure economics.

## 7. Risk Register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Partner demands platform exclusivity | High at UWorld/Becker | Pre-commit to walk-away; field-of-use exclusivity is the only acceptable compromise |
| Licensed content carries provenance defects (copied exam items, NC-licensed OER text) | Medium | Codex + provenance audit *before* activation; the warranty/indemnity clause above; spot-check 10% of items manually |
| CSO update leaves licensed shelf stale while organic bank updates natively | Medium-high | 90-day currency clause; route partner content through the same Friday audit so staleness is visible |
| Deal distracts from the pipeline that created the leverage | Medium | Hard rule: organic cadence (2–3 cases/week) never dips during negotiations; the pipeline is the BATNA and must stay warm |
| Co-brand partner's quality failure damages CoStudy's audit-clean reputation | Low-medium | Codex pass-rate termination trigger; co-branded items visually separated in the product |
| Asia essay-window closes (CN/TW/JP transition to CBQ) while CoStudy holds essay assets | Low near-term | See Section 8 — essay rows stay dormant, costs nothing |

## 8. The Asia Sidebar — Essay-Format Localization Decision

China, Taiwan, and Japan continue to offer essays on both English and local-language exams while the rest of the world is CBQ-only, with the transition expected no earlier than the 2027 cycle per the research base. CoStudy holds 125 dormant, verified-quality essay-era rows — a latent asset for exactly these markets. **Recommendation: documented deferral.** Do not fund a JP/CN/TW essay variant now; the English-global CBQ market is larger, open today, and unconquered. Revisit when one of three triggers fires: (a) IMA announces a dated CBQ switch for those markets, (b) CoStudy crosses 50 live CBQ cases and has spare mentor capacity, or (c) a localized-market partner (a Japan/Taiwan coaching provider) offers to fund the adaptation. Log this as a *decline-for-now with triggers*, which satisfies the Phase 4 success metric's format-decision half without spending a rupee prematurely.

## 9. 90-Day Action Plan

| Week | Action | Owner |
|---|---|---|
| 1 | Counsel reviews this brief; approve target order and red lines (esp. exclusivity and AI clauses) | Midhun + counsel |
| 1–2 | Produce the outbound one-pager: asset ledger (Section 2), live engine demo link, Friday audit excerpt | CoStudy ops |
| 2 | Contact Gleim (content/licensing) and Surgent (partnerships) with Shape D proposal | Midhun |
| 3–4 | Hold discovery calls; log positions against the term sheet skeleton; no term sheets signed | Midhun |
| 4–6 | If Tier 1 shows life, open UWorld/Becker with Shape B; if silent, proceed with documented-decline memo and double pipeline cadence to 4 cases/week for one quarter | Midhun |
| 6–12 | Negotiate one term sheet to signature or write the decline memo; either outcome closes Phase 4 | Midhun + counsel |

**Closing note:** the strongest version of this negotiation is the one where CoStudy keeps shipping original cases the whole time. Every week the pipeline runs, the ask gets smaller and the offer gets better. The brief's final advice is therefore operational, not rhetorical: protect the Friday cadence above all — it is the source of the strength.

---

*This brief is a product-strategy planning document, not legal advice; the licensing positions herein should be confirmed by counsel before any binding commitment. Market figures cited are as published by providers and reviewers in 2026 and linked inline.*
