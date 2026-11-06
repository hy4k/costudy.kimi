{
  "artifact": "CoStudy Friday zero-defect bank audit — production run excerpt",
  "run_at": "2026-11-06 (Asia/Calcutta)",
  "source": "Automated audit, run over SSH against production (costudy.in / Supabase)",
  "result": {
    "summary": "Bank audit PASS: 9711 active MCQs, zero defects, all frontend-reachable; CBQ: 11/11 sections serving, 11 live case(s).",
    "clean": true,
    "active_rows": 9711,
    "failures": [],
    "warnings": [
      "bad_stem_len: 16 short-but-complete stems (cosmetic)"
    ]
  },
  "companion_live_counts": {
    "active_mcqs_total": 9711,
    "part_1": 6156,
    "part_2": 3555,
    "untagged_active_rows": 0,
    "active_cbq_cases": 34,
    "active_cbq_tasks": 238,
    "cbq_section_groups_covered": "12 of 12 (6 per part)"
  },
  "note": "Audit JSON quoted verbatim from the production automation; companion counts from direct production-database queries on the same date. The audit's CBQ case count reflects its per-section serving drill; the canonical live case count is 34."
}
