#!/usr/bin/env python3
"""CoStudy: v3 recovery for scrambled curated_pipeline rows (second pass).

TRUE block layout (verified against raw segments):
    Question N <id> LOS: x.y.z
    <stem> <optA> <optB> <optC> <optD>     <- options list with the marker
    ' Correct ' INSERTED IN PLACE right before the correct option (any letter)
    <glyph-rationale chunks: <W> wrong restatement+verdict+expl, <R> correct restatement+expl>

Recovery model:
  * correct option  = longest prefix of the post-' Correct ' list-remainder that
                      prefixes the <R> chunk restatement (>=8 chars)
  * wrong options   = <W>-chunk restatements (chunks with verdict sentences),
                      in option order
  * correct letter  = count of wrong options that sit BEFORE the marker; the
                      wrongs AFTER it must be found in the list-remainder, in
                      order; unknown texts between them = options whose
                      rationale chunk is lost (recoverable only AFTER correct)
  * try every split point k; accept only if EXACTLY ONE k yields a consistent
    4-option question (strong self-consistency gate against damaged text)

Modes: --dry (default) | --apply (insert + deactivate fully-covered rows)
"""
import json, re, sys, urllib.request, urllib.parse, urllib.error, time, collections

APPLY = "--apply" in sys.argv
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

HDR_RE = re.compile(r"Question (\d+)\s+\S+(?:\s+\S+?)?\s+LOS:\s*(\S+)", re.I)
WRONG_G, RIGHT_G = "\ueb67", "\ueb63"
VERDICT_SPLIT_RE = re.compile(r"This answer is (?:in)?correct\.?|This is (?:an )?incorrect answer\.?|Reconsider ", re.I)
WS = re.compile(r"\s+")
coll = lambda s: WS.sub(" ", s).strip()

def find_ordered(text, items):
    """Return list of positions of each item in text, in order, or None if any missing."""
    pos, cursor = [], 0
    for it in items:
        p = text.find(it, cursor)
        if p < 0:
            return None
        pos.append(p)
        cursor = p + len(it)
    return pos

def parse_seg(seg):
    if " Correct " not in seg:
        return None, "no_correct_marker"
    head, rest = seg.split(" Correct ", 1)
    head_c, rest_c = coll(head), coll(rest)
    # rationale chunks
    wchunks = re.split(re.escape(WRONG_G), rest)
    list_remainder_c = coll(wchunks[0])          # correct + options after correct
    wrongs = []
    for ch in wchunks[1:]:
        ch = ch.strip()
        if not ch:
            continue
        m = VERDICT_SPLIT_RE.search(ch)
        if m:
            wrongs.append(coll(ch[:m.start()]))
    # correct option from the <R> chunk restatement
    rparts = re.split(re.escape(RIGHT_G), rest)
    correct_opt = expl = None
    if len(rparts) > 1:
        rchunk = re.split(re.escape(WRONG_G), rparts[1])[0]
        b = coll(rchunk)
        best = 0
        for L in range(min(len(list_remainder_c), len(b)), 7, -1):
            if b.startswith(list_remainder_c[:L]):
                best = L
                break
        if best:
            correct_opt = list_remainder_c[:best].strip()
            rem_c = list_remainder_c[best:].strip()
            eraw = b[best:].strip()
            m = VERDICT_SPLIT_RE.search(eraw)
            if m:
                eraw = eraw[m.end():].strip()
            expl = eraw or None
    if not correct_opt or not list_remainder_c:
        return None, "no_correct_restatement"
    if not wrongs:
        return None, "no_wrong_restatements"
    # try every split point k: wrongs[:k] before marker (must be in head),
    # wrongs[k:] after correct (must be in list-remainder, in order)
    cands = []
    for k in range(0, len(wrongs) + 1):
        before, after = wrongs[:k], wrongs[k:]
        if not all(len(o) >= 3 for o in before):
            continue
        hb = find_ordered(head_c, before) if before else []
        if before and hb is None:
            continue
        # scan remainder AFTER the correct option: known after-wrongs in order,
        # gaps = unknown options whose rationale chunk is lost
        items, cursor, ok = [], 0, True
        for kw in after:
            p = rem_c.find(kw, cursor)
            if p < 0:
                ok = False
                break
            if p > cursor:
                items.append(rem_c[cursor:p].strip())
            items.append(kw)
            cursor = p + len(kw)
        if not ok:
            continue
        if cursor < len(rem_c):
            items.append(rem_c[cursor:].strip())
        after_opts = [o for o in items if o and len(o) >= 3]
        options = before + [correct_opt] + after_opts
        if len(options) != 4:
            continue
        if len(set(options)) != 4:
            continue
        if any(len(o) > 600 for o in options):
            continue
        letter = "ABCD"[k]
        stem = coll(head_c[:hb[0]]) if before else head_c
        cands.append({"stem": stem, "options": options, "letter": letter,
                      "explanation": expl, "k": k})
    if not cands:
        return None, "no_consistent_split"
    if len(cands) > 1:
        # identical outcome from multiple k is fine only if identical options
        sigs = {(c["stem"], tuple(c["options"]), c["letter"]) for c in cands}
        if len(sigs) > 1:
            return None, "ambiguous_k"
        cands = cands[:1]
    c = cands[0]
    if not 25 <= len(c["stem"]) <= 1500:
        return None, "bad_stem"
    e = c["explanation"]
    if e:
        e = re.sub(r"\s*Therefore, this is (?:the|an) (?:correct|incorrect) answer\.?", "", e, flags=re.I).strip()[:800]
        c["explanation"] = e or None
    return c, "ok"

# ---------- active bank stems ----------
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
print("active stems:", len(stems), flush=True)

# ---------- active scrambled curated rows ----------
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
print("active scrambled rows:", len(affected), flush=True)

stats = collections.Counter()
proposed = []
per_row_missing = {}
for r in affected:
    q = r["question_text"]
    segs = re.split(r"(?=Question \d+\s+\S+(?:\s+\S+?)?\s+LOS:\s*\S+)", q)
    missing = []
    for seg in segs[1:]:
        m = HDR_RE.match(seg)
        if not m:
            continue
        parsed, reason = parse_seg(seg[m.end():])
        if not parsed:
            stats["fail_" + reason] += 1
            missing.append((m.group(1), reason))
            continue
        stem = parsed["stem"]
        n = norm(stem)
        if n in stems:
            stats["already_in_bank"] += 1
            continue
        stems.add(n)
        los = m.group(2)
        pm = re.match(r"(\d)\.([A-E])", los or "")
        part = pm.group(1) if pm else (r["part"] or "").replace("Part ", "") or "1"
        sec = pm.group(2) if pm else (r["section"] or "").replace("Section ", "") or "A"
        proposed.append({
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
            "_row_id": r["id"],
        })
        stats["recovered"] += 1
    per_row_missing[r["id"]] = missing

print("STATS:", dict(stats), flush=True)
for r in proposed[:4]:
    print("SAMPLE: %s" % json.dumps({k: (v[:110] if isinstance(v, str) else v)
          for k, v in r.items() if k in ("question_text", "options", "correct_answer", "explanation")}, ensure_ascii=False), flush=True)

fully_covered = [rid for rid, miss in per_row_missing.items() if not miss]
still_missing = {rid: miss for rid, miss in per_row_missing.items() if miss}
print("rows fully covered after pass:", len(fully_covered))
print("rows still holding missing segs:", len(still_missing))
with open("/tmp/recover_v3_proposed.json", "w", encoding="utf-8") as fh:
    json.dump(proposed, fh, ensure_ascii=False)
with open("/tmp/recover_v3_covered.json", "w") as fh:
    json.dump(fully_covered, fh)
print("proposed: %d rows -> /tmp/recover_v3_proposed.json" % len(proposed), flush=True)

if not APPLY:
    sys.exit(0)

# backup this batch's full row texts before any write
backup = []
for r in affected:
    full = json.load(req("GET", "/question_bank?id=eq.%s" % urllib.parse.quote(str(r["id"]), safe="")))
    backup += full
with open("/root/scrambled_rows_backup_v3.json", "w", encoding="utf-8") as fh:
    json.dump(backup, fh, ensure_ascii=False)
print("backup:", len(backup), "rows -> /root/scrambled_rows_backup_v3.json", flush=True)

ins = dup = 0
for i in range(0, len(proposed), 200):
    batch = [{k: v for k, v in row.items() if not k.startswith("_")} for row in proposed[i:i + 200]]
    try:
        req("POST", "/question_bank", batch)
        ins += len(batch)
    except urllib.error.HTTPError as e:
        print("batch failed %s; row-by-row" % e.read().decode()[:160], flush=True)
        for row in batch:
            try:
                req("POST", "/question_bank", [row])
                ins += 1
            except urllib.error.HTTPError as e2:
                dup += 1
    time.sleep(0.2)
print("inserted:", ins, "duplicates(=already covered):", dup, flush=True)

deact = 0
for rid in fully_covered:
    req("PATCH", "/question_bank?id=eq.%s" % urllib.parse.quote(str(rid), safe=""),
        {"is_active": False, "quality_flag": "scrambled_split"})
    deact += 1
print("deactivated:", deact, "still active (real gaps):", len(still_missing), flush=True)
