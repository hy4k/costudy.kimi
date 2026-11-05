#!/usr/bin/env python3
"""CoStudy: end-to-end CBQ drill — call pick_cbq_case exactly as the AI Deck
does (anon key), for every syllabus section of both parts, validating the full
case bundle: title, narrative, exhibits, and every task (prompt, answer,
explanation).

A section with at least one live (verified+active) case MUST serve a fully
formed bundle — any defect there is a hard FAIL. A section with no live case
yet is reported as a coverage gap (WARNING), not a failure.

Usage: copy to the VPS and run with python3 (reads SUPABASE_SERVICE_ROLE_KEY
from /root/costudy-api/.env for the URL; the anon key below is the same one
embedded in the frontend bundle, i.e. the real user path).

Exit code 0 = no malformed bundles served.
Exit code 1 = at least one malformed bundle (printed).

Summary line: CBQ_RESULT ok=<n> total=<m> cases=<c> gaps=<g>
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

SECTIONS = {
    "Part 1": ["External Financial Reporting", "Planning, Budgeting and Forecasting",
               "Performance Management", "Cost Management", "Internal Controls"],
    "Part 2": ["Financial Statement Analysis", "Corporate Finance", "Decision Analysis",
               "Risk Management", "Investment Decisions", "Professional Ethics"],
}

def valid_case(case, tasks):
    if not isinstance(case, dict) or not case.get("title") or not case.get("narrative"):
        return False, "case missing title/narrative"
    for ex in case.get("exhibits") or []:
        if not isinstance(ex, dict) or not ex.get("label"):
            return False, "exhibit missing label"
        rows = ex.get("rows")
        if rows is not None and not isinstance(rows, list):
            return False, "exhibit rows not a list"
    if not tasks:
        return False, "no tasks"
    for t in tasks:
        if not t.get("prompt") or not t.get("answer") or not t.get("explanation"):
            return False, "task missing prompt/answer/explanation"
        ans = t.get("answer") or {}
        typ = t.get("type")
        if typ == "mcq" and ans.get("value") not in "ABCDE":
            return False, "mcq task bad answer key"
        if typ == "multi" and not isinstance(ans.get("values"), list):
            return False, "multi task bad answer"
        if typ == "num" and ans.get("value") is None:
            return False, "num task missing numeric value"
        if typ in ("list", "dnd") and not ans:
            return False, "%s task empty answer" % typ
    return True, "ok"

def call(part, section):
    body = {"p_part": part, "p_section": section}
    r = requests.post(f"{URL}/rest/v1/rpc/pick_cbq_case", headers=H, data=json.dumps(body))
    try:
        data = r.json()
    except Exception:
        data = None
    return r.status_code, data

fails = []
gaps = []
ok_n = 0
total_n = 0
cases_seen = set()
for part, sections in SECTIONS.items():
    for sec in sections:
        sc, data = call(part, sec)
        case = (data or {}).get("case") if isinstance(data, dict) else None
        tasks = (data or {}).get("tasks") if isinstance(data, dict) else None
        if sc == 200 and not case:
            gaps.append((part, sec))
            print(f"{part:7s} {sec:38s} -> HTTP {sc} | no live case yet | GAP")
            total_n += 1
            continue
        ok, why = valid_case(case, tasks)
        status = "OK" if sc == 200 and ok else "FAIL"
        if status == "FAIL":
            fails.append((part, sec, sc, why))
        else:
            ok_n += 1
            cases_seen.add(case.get("id"))
        total_n += 1
        print(f"{part:7s} {sec:38s} -> HTTP {sc} | tasks {len(tasks or [])} | {why} | {status}")

print(f"\ncoverage gaps: {gaps if gaps else 'NONE'}")
print(f"CBQ_RESULT ok={ok_n} total={total_n} cases={len(cases_seen)} gaps={len(gaps)}")
print("failures:", fails if fails else "NONE")
sys.exit(1 if fails else 0)
