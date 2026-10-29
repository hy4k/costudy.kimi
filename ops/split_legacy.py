#!/usr/bin/env python3
"""CoStudy: split the 41 scrambled curated_pipeline rows into proper questions.
These legacy rows are run-on concatenations of Wiley-format questions: a partial
tail, then 'Question N <id> LOS: x.y.z <stem> <optA> <optB> <optC> Correct <optD>'
followed by per-option rationale chunks prefixed with private-use glyphs
(U+EB67 wrong / U+EB63 right) that restate each option and give its explanation.
Strategy per embedded question:
  1. if its stem already exists in the bank (from the OCR imports) -> nothing to do
  2. else parse it inline from the row text and insert as source_kind='wiley_ocr',
     quality_flag='recovered_legacy'
Finally deactivate every scrambled row (is_active=false, quality_flag
'scrambled_split') so nothing unusable stays live. Backup first.
Usage: split_legacy.py [--dry]
"""
import json, re, sys, urllib.request, urllib.parse, urllib.error, time, collections

DRY = "--dry" in sys.argv
KEY = None
for line in open("/root/costudy-api/.env"):
    if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
        KEY = line.split("=", 1)[1].strip().strip("\"'")
SB = "https://avtjxcdcjbwmggdimkgh.supabase.co/rest/v1"

def req(method, path, body=None, prefer=None):
    h = {"apikey": KEY, "Authorization": "Bearer " + KEY}
    if body is not None:
        h["Content-Type"] = "application/json"
    if prefer:
        h["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(SB + path, data=data, method=method, headers=h)
    return urllib.request.urlopen(r, timeout=180)

def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", (s or "").lower())).strip()

# ---------- bank stems ----------
def active_stems():
    r0 = req("GET", "/question_bank?select=question_text&is_active=eq.true&limit=1", prefer="count=exact")
    total = int(r0.headers["Content-Range"].split("/")[-1])
    stems = set()
    off = 0
    while off < total:
        expected = min(1000, total - off)
        for _ in range(5):
            page = json.load(req("GET", "/question_bank?select=question_text&is_active=eq.true&limit=1000&offset=%d&order=id" % off))
            if len(page) == expected:
                break
            time.sleep(2)
        else:
            raise RuntimeError("pagination stalled at %d" % off)
        stems |= {norm(r["question_text"]) for r in page}
        off += len(page)
    return stems

# ---------- inline parsing ----------
HDR_RE = re.compile(r"Question (\d+)\s+\S+(?:\s+\S+?)?\s+LOS:\s*(\S+)", re.I)
WRONG_G, RIGHT_G = "\ueb67", "\ueb63"
VERDICT_SPLIT_RE = re.compile(r"This answer is (?:in)?correct\.?|This is (?:an )?incorrect answer\.?|Reconsider ", re.I)
WS = re.compile(r"\s+")

def parse_inline(seg):
    """Parse one embedded question from a header segment.
    Returns {stem, options{A..D}, letter, explanation} or None."""
    if " Correct " not in seg:
        return None
    head, rest = seg.split(" Correct ", 1)
    # wrong chunks split on the wrong glyph; keep right-glyph parts attached
    wrong_chunks = re.split(re.escape(WRONG_G), rest)
    # first element of wrong_chunks ends with optD text + maybe right chunk
    right_part = ""
    tail_after_d = wrong_chunks[0]
    if RIGHT_G in tail_after_d:
        optd_text, right_part = tail_after_d.split(RIGHT_G, 1)
    else:
        optd_text = tail_after_d
    wrong_chunks = wrong_chunks[1:]
    wrongs = []
    for ch in wrong_chunks:
        ch = ch.strip()
        if not ch:
            continue
        m = VERDICT_SPLIT_RE.search(ch)
        if not m:
            continue
        wrongs.append({"opt": ch[:m.start()].strip(), "expl": ch[m.end():].strip()})
    if len(wrongs) < 2 or not optd_text.strip():
        return None
    # correct explanation
    expl_d = ""
    if right_part:
        right_part = right_part.strip()
        m = VERDICT_SPLIT_RE.search(right_part)
        expl_d = (right_part[m.end():].strip() if m else right_part)
    # locate wrong option texts inside head (in order)
    positions = []
    cursor = 0
    for w in wrongs:
        p = head.find(w["opt"], cursor)
        if p < 0:
            # fuzzy: try normalized prefix of 40 chars
            probe = WS.sub(" ", w["opt"])[:40]
            p = head.find(probe, cursor)
        if p < 0:
            return None
        positions.append(p)
        cursor = p + 1
    stem = WS.sub(" ", head[:positions[0]]).strip()
    options = []
    for i, w in enumerate(wrongs):
        end = positions[i + 1] if i + 1 < len(positions) else len(head)
        options.append(WS.sub(" ", head[positions[i]:end]).strip())
    if len(options) != 3:
        return None
    options.append(WS.sub(" ", optd_text).strip())
    if len(set(options)) != 4 or any(not o for o in options):
        return None
    correct_idx = len(options) - 1  # correct option always trails ' Correct '
    expl = expl_d or None
    if expl:
        expl = re.sub(r"\s*Therefore, this is (?:the|an) (?:correct|incorrect) answer\.?", "", expl, flags=re.I).strip()[:800]
    return {"stem": stem, "options": options, "letter": "ABCD"[correct_idx], "explanation": expl}

# ---------- main ----------
stems = active_stems()
print("active stems:", len(stems), flush=True)

rows = []
off = 0
while True:
    page = json.load(req("GET", "/question_bank?select=id,question_text,part,section&source_kind=eq.curated_pipeline&is_active=eq.true&limit=1000&offset=%d&order=id" % off))
    if not page:
        break
    rows += page
    off += len(page)
    if len(page) < 1000:
        break
pat = re.compile(r"(Question ID:|\bLOS:\s*\d|tb\.\w+\.\w+_\d|Lesson Reference)", re.I)
affected = [r for r in rows if r["question_text"] and pat.search(r["question_text"])]
print("scrambled rows:", len(affected), flush=True)

stats = collections.Counter()
new_rows = []
per_row_unrecovered = {}
for r in affected:
    q = r["question_text"]
    segs = re.split(r"(?=Question \d+\s+\S+(?:\s+\S+?)?\s+LOS:\s*\S+)", q)
    unrecovered = 0
    for seg in segs[1:]:
        m = HDR_RE.match(seg)
        if not m:
            continue
        parsed = parse_inline(seg[m.end():])
        if not parsed:
            stats["inline_parse_fail"] += 1
            unrecovered += 1
            continue
        stem = WS.sub(" ", parsed["stem"]).strip()
        if not 25 <= len(stem) <= 1500:
            stats["bad_stem"] += 1
            unrecovered += 1
            continue
        n = norm(stem)
        if n in stems:
            stats["already_in_bank"] += 1
            continue
        stems.add(n)
        los = m.group(2)
        pm = re.match(r"(\d)\.([A-E])", los or "")
        part = pm.group(1) if pm else (r["part"] or "").replace("Part ", "") or "1"
        sec = pm.group(2) if pm else (r["section"] or "").replace("Section ", "") or "A"
        new_rows.append({
            "external_id": "wiley-legacy-p%s-sec%s-q%s" % (part, sec.lower(), m.group(1)),
            "part": "Part " + part,
            "section": "Section " + sec,
            "topic": None,
            "question_kind": "MCQ",
            "source_kind": "wiley_ocr",
            "question_text": stem,
            "options": {k: parsed["options"][i] for i, k in enumerate("ABCD")},
            "correct_answer": parsed["letter"],
            "explanation": parsed["explanation"],
            "reference_links": [],
            "tags": ["wiley", "legacy-recovery", "part-%s" % part.lower(), "section-%s" % sec.lower()],
            "is_active": True,
            "quality_flag": "recovered_legacy",
        })
        stats["recovered"] += 1
    per_row_unrecovered[r["id"]] = unrecovered

print("STATS:", dict(stats), flush=True)
for r in new_rows[:2]:
    print("SAMPLE: %s" % json.dumps({k: (v[:130] if isinstance(v, str) else v)
          for k, v in r.items() if k in ("question_text", "options", "correct_answer", "explanation")}, ensure_ascii=False), flush=True)

if DRY:
    sys.exit(0)

# backup affected rows
backup = []
for r in affected:
    full = json.load(req("GET", "/question_bank?id=eq.%s" % urllib.parse.quote(str(r["id"]), safe="")))
    backup += full
with open("/root/scrambled_rows_backup.json", "w", encoding="utf-8") as fh:
    json.dump(backup, fh, ensure_ascii=False)
print("backup:", len(backup), "rows -> /root/scrambled_rows_backup.json", flush=True)

# insert recovered questions
ins = 0
for i in range(0, len(new_rows), 200):
    batch = new_rows[i:i + 200]
    try:
        req("POST", "/question_bank", batch)
        ins += len(batch)
    except urllib.error.HTTPError as e:
        print("batch failed %s; row-by-row" % e.read().decode()[:200], flush=True)
        for row in batch:
            try:
                req("POST", "/question_bank", [row])
                ins += 1
            except urllib.error.HTTPError as e2:
                print("ROW FAILED %s: %s" % (row["external_id"], e2.read().decode()[:200]), flush=True)
    time.sleep(0.2)
print("inserted:", ins, flush=True)

# deactivate scrambled rows (keep any that still hold unrecovered questions)
deact = kept = 0
for r in affected:
    if per_row_unrecovered.get(r["id"], 0) > 0:
        kept += 1
        continue
    req("PATCH", "/question_bank?id=eq.%s" % urllib.parse.quote(str(r["id"]), safe=""),
        {"is_active": False, "quality_flag": "scrambled_split"})
    deact += 1
print("deactivated:", deact, "kept (unrecovered content):", kept, flush=True)
