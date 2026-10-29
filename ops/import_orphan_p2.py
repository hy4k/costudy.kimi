#!/usr/bin/env python3
"""CoStudy: recover the 130 unique orphaned Part 2 questions from
/root/costudy-api/part2-questions.json into question_bank, then verify.
Screen: 4 distinct choices, valid correct_key, stem 25-1500, dedupe vs bank.
Usage: import_orphan_p2.py [--apply]
"""
import json, re, sys, urllib.request, urllib.parse, urllib.error, time, collections

APPLY = "--apply" in sys.argv
KEY = None
for line in open("/root/costudy-api/.env"):
    if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
        KEY = line.split("=", 1)[1].strip().strip("\"'")
SB = "https://avtjxcdcjbwmggdimkgh.supabase.co/rest/v1"

def req(method, path, body=None):
    h = {"apikey": KEY, "Authorization": "Bearer " + KEY}
    data = None
    if body is not None:
        h["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    r = urllib.request.Request(SB + path, data=data, method=method, headers=h)
    return urllib.request.urlopen(r, timeout=180)

def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", (s or "").lower())).strip()

# bank stems (all rows, active or not - never re-import known content)
bank = set()
off = 0
while True:
    page = json.load(req("GET", "/question_bank?select=question_text&limit=1000&offset=%d&order=id" % off))
    if not page:
        break
    for r in page:
        bank.add(norm(r["question_text"]))
    off += len(page)
    if len(page) < 1000:
        break
print("bank stems:", len(bank))

orph = json.load(open("/root/costudy-api/part2-questions.json"))
stats = collections.Counter()
proposed = []
for i, q in enumerate(orph):
    stem = (q.get("stem") or "").strip()
    choices = q.get("choices") or []
    texts = {c.get("key"): (c.get("text") or "").strip() for c in choices if c.get("key") in "ABCD"}
    ck = q.get("correct_key")
    if len(texts) != 4 or len(set(texts.values())) != 4 or any(len(t) < 2 for t in texts.values()):
        stats["bad_choices"] += 1
        continue
    if ck not in texts:
        stats["bad_key"] += 1
        continue
    if not 25 <= len(stem) <= 1500:
        stats["bad_stem"] += 1
        continue
    n = norm(stem)
    if n in bank:
        stats["already_in_bank"] += 1
        continue
    bank.add(n)
    sec = (q.get("section") or "").strip() or None
    proposed.append({
        "external_id": "legacy-p2-json-%03d" % (i + 1),
        "part": "Part 2",
        "section": ("Section " + sec) if sec and not sec.lower().startswith("section") else sec,
        "topic": q.get("topic"),
        "question_kind": "MCQ",
        "source_kind": "old_self_host",
        "question_text": stem,
        "options": texts,
        "correct_answer": ck,
        "explanation": None,
        "reference_links": [],
        "tags": ["legacy-p2-json"],
        "is_active": True,
        "quality_flag": "imported_legacy_p2",
    })
    stats["recovered"] += 1

print("STATS:", dict(stats))
for r in proposed[:3]:
    print("SAMPLE:", json.dumps({k: (v[:100] if isinstance(v, str) else v)
          for k, v in r.items() if k in ("question_text", "options", "correct_answer")}, ensure_ascii=False))

if not APPLY:
    sys.exit(0)

ins = dup = 0
for i in range(0, len(proposed), 200):
    batch = proposed[i:i + 200]
    try:
        req("POST", "/question_bank", batch)
        ins += len(batch)
    except urllib.error.HTTPError as e:
        print("batch failed; row-by-row")
        for row in batch:
            try:
                req("POST", "/question_bank", [row])
                ins += 1
            except urllib.error.HTTPError:
                dup += 1
    time.sleep(0.2)
print("inserted:", ins, "dups skipped:", dup)
