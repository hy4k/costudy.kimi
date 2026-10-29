#!/usr/bin/env python3
"""CoStudy: end-to-end AI Deck drill — call pick_practice_mcqs exactly as the
frontend does (anon key), across every (part, section) combination.

Usage: copy to the VPS and run with python3 (reads SUPABASE_SERVICE_ROLE_KEY
from /root/costudy-api/.env for the URL; the anon key below is the same one
embedded in the frontend bundle, i.e. the real user path).

Exit code 0 = all paths serve fully-formed questions.
Exit code 1 = at least one path failed (printed).
"""
import json, sys, requests

ANON = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
        "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2dGp4Y2RjamJ3bWdnZGlta2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMDUwNDksImV4cCI6MjA4OTY4MTA0OX0."
        "rwZ7mV2KYU_5glsqxL1otqmo6ZxYnocu8WOXdYM1JC4")

URL = None
for line in open("/root/costudy-api/.env"):
    if line.startswith("SUPABASE_URL="):
        URL = line.split("=", 1)[1].strip().strip("\"'").rstrip("/")
assert URL, "SUPABASE_URL not found"
H = {"apikey": ANON, "Authorization": "Bearer " + ANON, "Content-Type": "application/json"}

def call(part, section, n=3):
    body = {"p_part": part, "p_count": n}
    if section is not None:
        body["p_section"] = section
    r = requests.post(f"{URL}/rest/v1/rpc/pick_practice_mcqs", headers=H, data=json.dumps(body))
    return r.status_code, (r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text[:200])

fails = []
total = 0
for part in ("Part 1", "Part 2"):
    for sec in ["Section A", "Section B", "Section C", "Section D", "Section E", "Section F", None]:
        sc, data = call(part, sec)
        n = len(data) if isinstance(data, list) else -1
        ok = 0
        if isinstance(data, list):
            for q in data:
                o = q.get("options") or {}
                if q.get("question_text") and all(str(o.get(k, "")) for k in "ABCD") \
                        and q.get("correct_answer") in "ABCD":
                    ok += 1
        status = "OK" if sc == 200 and n > 0 and ok == n else "FAIL"
        if status == "FAIL":
            fails.append((part, sec, sc, n))
        total += max(n, 0)
        print(f"{part:7s} {str(sec):10s} -> HTTP {sc} | {n} drawn | fully-formed {ok} | {status}")

# unsectioned distribution probe: every section of the part must appear naturally
import collections
seen = collections.Counter()
N = 0
for _ in range(60):
    sc, data = call("Part 1", None, 10)
    if isinstance(data, list):
        for q in data:
            seen[q.get("section")] += 1
            N += 1
print(f"\nPart 1 unsectioned x{N} draws by section:", dict(sorted(seen.items(), key=lambda kv: str(kv[0]))))
if seen.get("Section E", 0) == 0:
    print("NOTE: Part 1 Section E never served even unsectioned -> exclusion is inside the RPC function body.")
    fails.append(("Part 1", "Section E (unsectioned reachability)", 200, 0))

print("\ntotal drawn:", total)
print("failures:", fails if fails else "NONE")
sys.exit(1 if fails else 0)
