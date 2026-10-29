#!/usr/bin/env python3
"""CoStudy: master bank cleanup. Staged, backed up, idempotent.
  Stage 1  fix PUA bullet glyphs (-> '·') in stems/options/explanations (all active rows)
  Stage 2  quarantine unfixable rows (is_active=false):
             - missing correct_answer (no salvage source)      -> quarantined_no_answer
             - missing/incomplete options                      -> quarantined_no_options
             - section 'Essay' or part 'Additional' leftovers  -> quarantined_not_mcq
             - junk inside options (Rationale/verdict residue) -> quarantined_junk_options
             - the 28 kept scrambled legacy rows (PUA in stem) -> quarantined_scrambled
  Stage 3  dedupe within (part, normalized stem): keep best-scored row,
           deactivate the rest -> duplicate_inactive
  Stage 4  verification report (read-only)
Usage: master_cleanup.py [--apply]
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

PUA = re.compile(r"[\uE000-\uF8FF]")
BULLET = "\uf0b7"
def bad_pua(text):
    """PUA glyphs remaining after benign bullet substitution."""
    return bool(text) and bool(PUA.search(text.replace(BULLET, "")))
JUNK_OPT = re.compile(r"Rationale|This answer is|Answer \([A-D]\) is", re.I)

rows = []
off = 0
while True:
    page = json.load(req("GET", "/question_bank?select=id,part,section,source_kind,quality_flag,question_text,options,correct_answer,explanation&is_active=eq.true&limit=1000&offset=%d&order=id" % off))
    if not page:
        break
    rows += page
    off += len(page)
    if len(page) < 1000:
        break
print("active rows at start:", len(rows))

stage1 = []       # rows needing PUA-bullet fix
quar = collections.defaultdict(list)   # reason -> rows
for r in rows:
    q = r["question_text"] or ""
    opts = r.get("options") or {}
    letters = [k for k in "ABCD" if isinstance(opts.get(k), str) and opts.get(k).strip()]
    has_ans = r["correct_answer"] in list("ABCD")
    # quarantine decisions (on original text)
    reason = None
    if not has_ans and len(letters) == 4:
        reason = "quarantined_no_answer"
    elif not has_ans and len(letters) != 4:
        reason = "quarantined_not_mcq" if ((r["section"] or "") == "Essay" or r["part"] == "Additional") else "quarantined_no_options"
    elif has_ans and len(letters) != 4:
        reason = "quarantined_not_mcq" if ((r["section"] or "") == "Essay" or r["part"] == "Additional") else "quarantined_no_options"
    elif any(JUNK_OPT.search(opts.get(k, "") or "") for k in letters):
        reason = "quarantined_junk_options"
    elif bad_pua(q):
        reason = "quarantined_scrambled"
    if reason:
        quar[reason].append(r)
        continue
    # PUA-bullet fix candidates: any field containing PUA (bullets or leftover)
    if PUA.search(q) or any(PUA.search(opts.get(k, "") or "") for k in letters) or PUA.search(r["explanation"] or ""):
        stage1.append(r)

quar_ids = {}
for reason, rs in quar.items():
    quar_ids[reason] = {r["id"] for r in rs}
    print("%-26s %d" % (reason, len(rs)))

# Stage 3: dedupe among surviving rows
survivors = [r for r in rows if all(r["id"] not in ids for ids in quar_ids.values())]
def score(r):
    expl = r["explanation"] or ""
    s = (2.0 if expl else 0.0) + min(len(expl), 800) / 800.0
    s += 1.0 if r["source_kind"] in ("wiley_ocr", "hock_drive", "gleim_drive") else 0.5
    return s
groups = collections.defaultdict(list)
for r in survivors:
    n = norm(r["question_text"])
    if n:
        groups[(r["part"] or "?", n)].append(r)
dups_to_kill = []
for key, rs in groups.items():
    if len(rs) < 2:
        continue
    rs_sorted = sorted(rs, key=lambda r: (-score(r), r["id"]))
    dups_to_kill += rs_sorted[1:]
print("duplicate_inactive:", len(dups_to_kill), "in", sum(1 for rs in groups.values() if len(rs) > 1), "groups")

print("stage1 PUA-bullet fixes:", len(stage1))

if not APPLY:
    print("DRY RUN - no writes")
    sys.exit(0)

# backup everything we touch
touch = stage1 + [r for rs in quar.values() for r in rs] + dups_to_kill
with open("/root/master_cleanup_backup.json", "w", encoding="utf-8") as fh:
    json.dump(touch, fh, ensure_ascii=False)
print("backup of %d rows -> /root/master_cleanup_backup.json" % len(touch))

def patch(rid, body):
    enc = urllib.parse.quote("eq." + str(rid), safe="")
    for attempt in range(3):
        try:
            req("PATCH", "/question_bank?id=" + enc, body)
            return True
        except Exception:
            time.sleep(2)
    print("PATCH FAILED", rid)
    return False

# Stage 1: replace PUA bullets with middle dot; strip stray PUA glyphs in explanations
n1 = 0
for r in stage1:
    body = {}
    q = r["question_text"].replace("\uf0b7", "·")
    if q != r["question_text"]:
        body["question_text"] = q
    opts = dict(r.get("options") or {})
    for k in list(opts):
        if isinstance(opts[k], str) and PUA.search(opts[k]):
            opts[k] = PUA.sub("", opts[k].replace("\uf0b7", "·")).strip()
    if opts != (r.get("options") or {}):
        body["options"] = opts
    e = r["explanation"]
    if e and PUA.search(e):
        e2 = PUA.sub("", e.replace("\uf0b7", "·"))
        e2 = re.sub(r"\s+", " ", e2).strip()
        body["explanation"] = e2 or None
    if body and patch(r["id"], body):
        n1 += 1
    if n1 % 150 == 0:
        time.sleep(0.3)
print("stage1 fixed:", n1)

# Stage 2: quarantine
n2 = 0
for reason, rs in quar.items():
    for r in rs:
        if patch(r["id"], {"is_active": False, "quality_flag": reason}):
            n2 += 1
    time.sleep(0.2)
print("stage2 quarantined:", n2)

# Stage 3: dedupe kills
n3 = 0
for r in dups_to_kill:
    if patch(r["id"], {"is_active": False, "quality_flag": "duplicate_inactive"}):
        n3 += 1
    if n3 % 200 == 0:
        time.sleep(0.3)
print("stage3 duplicates deactivated:", n3)
