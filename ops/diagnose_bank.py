#!/usr/bin/env python3
"""CoStudy: diagnose broken-row populations in the active bank (read-only).
Cross-tabs issues x source_kind; samples each population.
"""
import json, re, urllib.request, collections

KEY = None
for line in open("/root/costudy-api/.env"):
    if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
        KEY = line.split("=", 1)[1].strip().strip("\"'")
SB = "https://avtjxcdcjbwmggdimkgh.supabase.co/rest/v1"
def req(p):
    r = urllib.request.Request(SB + p, headers={"apikey": KEY, "Authorization": "Bearer " + KEY})
    return urllib.request.urlopen(r, timeout=180)

PUA = re.compile(r"[\uE000-\uF8FF]")
rows = []
off = 0
while True:
    page = json.load(req("/question_bank?select=id,part,section,source_kind,quality_flag,question_text,options,correct_answer,explanation&is_active=eq.true&limit=1000&offset=%d&order=id" % off))
    if not page:
        break
    rows += page
    off += len(page)
    if len(page) < 1000:
        break
print("active rows:", len(rows))

pop = collections.defaultdict(list)   # issue -> row ids
src_of = collections.defaultdict(collections.Counter)
for r in rows:
    q = r["question_text"] or ""
    opts = r.get("options") or {}
    letters = [k for k in "ABCD" if isinstance(opts.get(k), str) and opts.get(k).strip()]
    issues = []
    if len(letters) != 4:
        issues.append("opts")
    if not r["correct_answer"] or str(r["correct_answer"]) not in list("ABCD"):
        issues.append("ans")
    if len(q) > 1500:
        issues.append("long")
    if PUA.search(q):
        issues.append("puaq")
    if (r["section"] or "") == "Essay" or r["part"] == "Additional":
        issues.append("essay/addl")
    key = "+".join(sorted(set(issues))) if issues else "CLEAN"
    pop[key].append(r["id"])
    src_of[key][r["source_kind"]] += 1

for k in sorted(pop, key=lambda k: -len(pop[k])):
    print("%-28s %5d   by source: %s" % (k, len(pop[k]), dict(src_of[k])))

print()
# samples: one embedded-format row, one long stem, one essay, one additional
def show(rid):
    r = json.load(req("/question_bank?id=eq.%s&select=id,part,section,source_kind,question_text,options,correct_answer" % rid))[0]
    q = r["question_text"]
    print("--- %s [%s|%s|%s] stem len=%d" % (r["id"][:8], r["source_kind"], r["part"], r["section"], len(q)))
    print("STEM:", repr(q[:400]))
    print("OPTS:", json.dumps(r["options"], ensure_ascii=False)[:200])
    print("ANS:", r["correct_answer"])

for key, want in [("puaq", 1), ("long", 1), ("essay/addl", 1)]:
    for rid in pop.get(key, [])[:want]:
        show(rid)
