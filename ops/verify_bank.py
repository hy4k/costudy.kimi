#!/usr/bin/env python3
"""CoStudy: full structural + hygiene verification of the ACTIVE question bank.
Read-only. Reports: invalid options/keys, bad stems, PUA/control chars,
null kinds, part distribution (incl. 'Additional'), duplicate active stems.
"""
import json, re, urllib.request, collections, time

KEY = None
for line in open("/root/costudy-api/.env"):
    if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
        KEY = line.split("=", 1)[1].strip().strip("\"'")
SB = "https://avtjxcdcjbwmggdimkgh.supabase.co/rest/v1"

def req(p):
    r = urllib.request.Request(SB + p, headers={"apikey": KEY, "Authorization": "Bearer " + KEY})
    return urllib.request.urlopen(r, timeout=180)

def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", (s or "").lower())).strip()

PUA = re.compile(r"[\uE000-\uF8FF]")
CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")

rows = []
off = 0
while True:
    page = json.load(req("/question_bank?select=id,part,section,question_kind,source_kind,quality_flag,question_text,options,correct_answer,explanation&is_active=eq.true&limit=1000&offset=%d&order=id" % off))
    if not page:
        break
    rows += page
    off += len(page)
    if len(page) < 1000:
        break
print("active rows:", len(rows))

issues = collections.Counter()
samples = {}
kind_null = 0
parts = collections.Counter()
sections_by_part = collections.defaultdict(collections.Counter)
stem_map = collections.defaultdict(list)

for r in rows:
    parts[r["part"]] += 1
    sections_by_part[r["part"]][r["section"]] += 1
    if not r["question_kind"]:
        kind_null += 1
    q = r["question_text"] or ""
    opts = r.get("options") or {}
    letters = [k for k in "ABCD" if isinstance(opts.get(k), str) and opts.get(k).strip()]
    if len(letters) != 4:
        issues["options_not_4"] += 1
        samples.setdefault("options_not_4", "%s :: %s" % (r["id"][:8], q[:70]))
    ca = r["correct_answer"]
    if not ca or str(ca) not in list("ABCD") or len(str(ca)) != 1:
        issues["bad_correct_answer"] += 1
        samples.setdefault("bad_correct_answer", "%s :: %r" % (r["id"][:8], ca))
    vals = [opts.get(k, "").strip() for k in "ABCD"]
    if len(set(v for v in vals if v)) != len([v for v in vals if v]) and all(vals):
        issues["dup_options"] += 1
        samples.setdefault("dup_options", "%s :: %s" % (r["id"][:8], q[:60]))
    if not 25 <= len(q) <= 1500:
        issues["bad_stem_len"] += 1
        samples.setdefault("bad_stem_len", "%s :: len=%d %s" % (r["id"][:8], len(q), q[:60]))
    for fname, text in [("q", q), ("e", r["explanation"] or "")] + [("o" + k, opts.get(k, "")) for k in "ABCD"]:
        if PUA.search(text):
            issues["pua_" + fname] += 1
            samples.setdefault("pua_" + fname, "%s :: %s" % (r["id"][:8], text[:60]))
        if CTRL.search(text):
            issues["ctrl_" + fname] += 1
    n = norm(q)
    if n:
        stem_map[n].append(r["id"])

print("null question_kind:", kind_null)
print("parts:", dict(parts))
for p, secs in sections_by_part.items():
    print("  sections of %r: %s" % (p, dict(secs)))
print()
for k, v in sorted(issues.items()):
    print("%-22s %5d   e.g. %s" % (k, v, samples.get(k, "")))
dups = {n: ids for n, ids in stem_map.items() if len(ids) > 1}
print("duplicate normalized stems among active:", len(dups))
for n, ids in list(dups.items())[:8]:
    print("   %d copies :: %s" % (len(ids), n[:80]))
