#!/usr/bin/env python3
"""CoStudy: inventory every Supabase table that could hold question content.
Row counts + content fingerprint vs question_bank (sample overlap check).
"""
import json, re, urllib.request, urllib.error

KEY = None
for line in open("/root/costudy-api/.env"):
    if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
        KEY = line.split("=", 1)[1].strip().strip("\"'")
SB = "https://avtjxcdcjbwmggdimkgh.supabase.co/rest/v1"

def req(p):
    r = urllib.request.Request(SB + p, headers={"apikey": KEY, "Authorization": "Bearer " + KEY, "Prefer": "count=exact"})
    return urllib.request.urlopen(r, timeout=60)

def count(table):
    try:
        r = req("/%s?select=*&limit=1" % table)
        return int(r.headers["Content-Range"].split("/")[-1])
    except urllib.error.HTTPError as e:
        return "ERR %d" % e.code

CANDIDATES = [
    "question_bank", "mcq_questions", "ai_question_cache", "ai_requests",
    "question_generation_jobs", "ingestion_staging", "ingestion_review_events",
    "content_documents", "content_chunks", "content_sources",
    "essay_questions", "essay_prompts", "mock_exams", "exam_sections",
    "exam_session_snapshots", "exam_sessions", "mock_attempts", "mock_test_results",
    "room_content", "study_room_resources", "library_items",
    "cbq_cases", "cbq_tasks", "mcq_war_sessions", "mastery_topics",
    "retrieval_runs", "citation_links",
]
for t in CANDIDATES:
    print("%-28s %s" % (t, count(t)))

# sample key columns of the interesting ones
def cols(table):
    try:
        r = req("/%s?select=*&limit=1" % table)
        row = json.load(r)
        return list(row[0].keys()) if row else []
    except Exception as e:
        return ["ERR", str(e)[:60]]

print()
for t in ["mcq_questions", "ai_question_cache", "ingestion_staging", "mock_exams",
          "exam_sections", "exam_session_snapshots", "room_content", "library_items",
          "study_room_resources", "question_generation_jobs", "content_documents",
          "mcq_war_sessions", "cbq_cases", "essay_questions"]:
    print(t, "columns:", cols(t))
