#!/usr/bin/env python3
"""CoStudy: import Wiley CMA questions from OCR'd Wiley section text into Supabase question_bank.
Reads /root/wiley-text/p<part>-<sec>.txt (produced by ops/ocr_wiley.py) for files whose
OCR batch has finished (<tag>.done marker present). Wiley format (efficientlearning
print-out): 'Question N' header, 'Lesson Reference'/'Difficulty'/'Bloom Code' metadata,
stem, then per-option 'Rationale' blocks that restate the option on the first line.
Correctness is decided by the verdict sentence inside each rationale ('this is an
incorrect answer' / 'this is the correct answer' / 'This answer is incorrect'), never
by the OCR'd checkbox glyph (©/@/€ are unreliable). Importable: exactly one correct
or exactly one sole-non-incorrect block out of 4.
Usage: import_wiley.py [--part 1|2] [--sec A..E] [--dry]
"""
import json, re, sys, urllib.request, urllib.error, os, time, collections, glob

DRY = "--dry" in sys.argv
def argval(name):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else None
PART_F = argval("--part")
SEC_F = argval("--sec")

KEY = None
for line in open("/root/costudy-api/.env"):
    if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
        KEY = line.split("=", 1)[1].strip().strip("\"'")
SB = "https://avtjxcdcjbwmggdimkgh.supabase.co/rest/v1"
TEXT_DIR = "/root/wiley-text"

# ---------- supabase ----------

def sb_get(path):
    req = urllib.request.Request(SB + path, headers={"apikey": KEY, "Authorization": "Bearer " + KEY})
    return json.load(urllib.request.urlopen(req, timeout=120))

def sb_post(path, body):
    req = urllib.request.Request(SB + path, data=json.dumps(body).encode(), method="POST",
        headers={"apikey": KEY, "Authorization": "Bearer " + KEY,
                 "Content-Type": "application/json", "Prefer": "return=minimal"})
    urllib.request.urlopen(req, timeout=120)

def sb_post_rows(rows, stats):
    inserted = 0
    for i in range(0, len(rows), 200):
        batch = rows[i:i + 200]
        try:
            sb_post("/question_bank", batch)
            inserted += len(batch)
        except urllib.error.HTTPError as e:
            print("  batch failed: HTTP %s %s; retrying row-by-row" % (e.code, e.read().decode()[:250]), flush=True)
            for r in batch:
                try:
                    sb_post("/question_bank", [r])
                    inserted += 1
                except urllib.error.HTTPError as e2:
                    stats["insert_failed"] += 1
                    print("  ROW FAILED %s: HTTP %s %s" % (r["external_id"], e2.code, e2.read().decode()[:200]), flush=True)
        time.sleep(0.2)
    return inserted

def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", (s or "").lower())).strip()

def active_stems():
    # exact total first — short/partial pages must be retried, never accepted,
    # or dedupe silently misses stems
    req = urllib.request.Request(SB + "/question_bank?select=question_text&is_active=eq.true&limit=1",
        headers={"apikey": KEY, "Authorization": "Bearer " + KEY, "Prefer": "count=exact"})
    total = int(urllib.request.urlopen(req, timeout=120).headers["Content-Range"].split("/")[-1])
    stems = set()
    off = 0
    while off < total:
        expected = min(1000, total - off)
        page = None
        for attempt in range(5):
            page = sb_get("/question_bank?select=question_text&is_active=eq.true&limit=1000&offset=%d&order=id" % off)
            if len(page) == expected:
                break
            print("  stems page at offset %d short (%d/%d), retrying" % (off, len(page), expected), flush=True)
            time.sleep(2)
        else:
            raise RuntimeError("pagination stalled at offset %d of %d" % (off, total))
        stems |= {norm(r["question_text"]) for r in page}
        off += len(page)
    return stems

# ---------- wiley parsing ----------

Q_SPLIT_RE = re.compile(r"(?m)^Question (\d+)\s*$")
RATIONALE_RE = re.compile(r"(?m)^Rationale\s*$")
LESSON_RE = re.compile(r"(?m)^Lesson Reference:\s*(.+?)\s*$")
DIFF_RE = re.compile(r"(?m)^Difficulty:\s*(\S+)")
BLOOM_RE = re.compile(r"(?m)^Bloom Code:")
INCORRECT_RE = re.compile(r"this is an incorrect answer|this answer is incorrect", re.I)
CORRECT_RE = re.compile(r"this is (?:the|a) correct answer|this answer is correct", re.I)
VERDICT_TAIL_RE = re.compile(r"\s*Therefore, this is (?:the|an) (?:correct|incorrect) answer\.?\s*$", re.I)
VERDICT_HEAD_RE = re.compile(r"^(?:Correct|Incorrect)\.\s*", re.I)
# Wiley 2021 P1 files glue an internal ID + "LOS: x.y.z" learning-objective tag
# onto the front of every stem, e.g. "1A.1.b tb.fin.inc.010_1805 LOS: 1.A.1.b <stem>"
LOS_PREFIX_RE = re.compile(r"^\S+\s+\S+\s+LOS:\s*\S+\s+")
# leading checkbox glyphs / OCR junk before the option text on the rationale's first line
# (CMA content is $-denominated; €/¥ at line start are checkbox-glyph noise, not currency)
OPT_JUNK_RE = re.compile(r"^\s*[^0-9A-Za-z$\u00a3(.-]+")

def fix_ocr_symbols(s):
    """OCR misreads in this corpus: § for $ next to digits (rare elsewhere)."""
    return re.sub(r"\u00a7(?=\s?\d)", "$", s)

def clean_text(t):
    t = re.sub(r"(?m)^===== PAGE \d+ =====$", " ", t)
    t = re.sub(r"(?m)^\d{1,2}/\d{1,2}/\d{4} CMA Exam Review.*$", " ", t)
    t = re.sub(r"(?m)^https?://\S+$", " ", t)
    t = re.sub(r"(?m)^https?://\S+", " ", t)  # url fragments glued to page numbers
    return t

def parse_wiley(text):
    """Return ordered list of {num, topic, difficulty, stem, options{A..D}, letter, explanation}."""
    text = clean_text(text)
    parts = Q_SPLIT_RE.split(text)
    out = []
    for i in range(1, len(parts) - 1, 2):
        num = int(parts[i])
        body = parts[i + 1]
        blocks = RATIONALE_RE.split(body)
        stem_area = blocks[0]
        rationales = blocks[1:]
        if len(rationales) != 4:
            continue
        m = LESSON_RE.search(stem_area)
        topic = m.group(1).strip() if m else None
        dm = DIFF_RE.search(stem_area)
        difficulty = dm.group(1).strip().lower() if dm else None
        # stem lines: drop metadata + interactive-artifact lines
        stem_lines = []
        for ln in stem_area.split("\n"):
            s = ln.strip()
            if not s:
                continue
            if LESSON_RE.match(s) or DIFF_RE.match(s) or BLOOM_RE.match(s):
                continue
            if s.lower() in ("your answer", "answer"):
                continue
            stem_lines.append(s)
        # per rationale: option line + explanation
        opts_raw, expls, cls = [], [], []
        for b in rationales:
            lines = [ln.strip() for ln in b.split("\n") if ln.strip()]
            if not lines:
                cls.append("empty")
                opts_raw.append("")
                expls.append("")
                continue
            opt = OPT_JUNK_RE.sub("", lines[0]).strip()
            expl = re.sub(r"\s+", " ", " ".join(lines[1:])).strip()
            opts_raw.append(opt)
            expls.append(expl)
            if INCORRECT_RE.search(expl):
                cls.append("I")
            elif CORRECT_RE.search(expl):
                cls.append("C")
            else:
                cls.append("?")
        # correctness: exactly one C (rest I), or exactly one ? (rest I)
        if cls.count("C") == 1 and cls.count("I") == 3:
            correct_idx = cls.index("C")
        elif cls.count("?") == 1 and cls.count("I") == 3:
            correct_idx = cls.index("?")
        else:
            continue
        # option texts: prefer the clean copy from the stem area when it matches
        consumed = set()
        options = []
        for opt in opts_raw:
            nopt = norm(opt)
            clean = opt
            for k, s in enumerate(stem_lines):
                if k in consumed:
                    continue
                if norm(s) and norm(s) == nopt:
                    clean = s
                    consumed.add(k)
                    break
            options.append(clean)
        if len(set(o for o in options if o)) != 4 or any(not o for o in options):
            continue
        stem = " ".join(s for k, s in enumerate(stem_lines) if k not in consumed).strip()
        stem = fix_ocr_symbols(LOS_PREFIX_RE.sub("", stem)).strip()
        options = [fix_ocr_symbols(o) for o in options]
        expl = VERDICT_TAIL_RE.sub("", expls[correct_idx]).strip()
        expl = VERDICT_HEAD_RE.sub("", expl).strip()[:800]
        out.append({"num": num, "topic": topic, "difficulty": difficulty,
                    "stem": stem, "options": options, "letter": "ABCD"[correct_idx],
                    "explanation": expl or None})
    return out

# ---------- main ----------

stats = collections.Counter()
stems = active_stems()
print("existing active stems:", len(stems), flush=True)

files = sorted(glob.glob(os.path.join(TEXT_DIR, "p?-?.txt")))
for path in files:
    tag = os.path.basename(path)[:-4]
    part, sec = tag[1], tag[3]
    if PART_F and part != PART_F:
        continue
    if SEC_F and sec != SEC_F:
        continue
    if not os.path.exists(os.path.join(TEXT_DIR, tag + ".done")):
        print("%s: OCR not finished yet, skipping" % tag)
        continue
    qs = parse_wiley(open(path, encoding="utf-8", errors="ignore").read())
    rows = []
    for q in qs:
        stem = re.sub(r"\s+", " ", q["stem"]).strip()
        if not 25 <= len(stem) <= 1500:
            stats["bad_stem"] += 1
            continue
        n = norm(stem)
        if not n or n in stems:
            stats["duplicate"] += 1
            continue
        stems.add(n)
        rows.append({
            "external_id": "wiley-p%s-sec%s-q%d" % (part, sec.lower(), q["num"]),
            "part": "Part " + part,
            "section": "Section " + sec,
            "topic": q.get("topic"),
            "question_kind": "MCQ",
            "source_kind": "wiley_ocr",
            "question_text": stem,
            "options": {k: q["options"][i] for i, k in enumerate("ABCD")},
            "correct_answer": q["letter"],
            "explanation": q["explanation"],
            "reference_links": [],
            "tags": ["wiley", "part-%s" % part.lower(), "section-%s" % sec.lower()],
            "is_active": True,
            "quality_flag": "imported_wiley",
        })
    print("%s: %d parsed -> %d validated" % (tag, len(qs), len(rows)), flush=True)
    if rows:
        print("  SAMPLE: %s" % json.dumps({k: (v[:150] if isinstance(v, str) else v)
              for k, v in rows[0].items() if k in ("question_text", "options", "correct_answer", "explanation", "topic")}, ensure_ascii=False))
    if DRY:
        continue
    ins = sb_post_rows(rows, stats)
    stats["inserted"] += ins
    print("%s: inserted %d" % (tag, ins), flush=True)

print("STATS:", dict(stats))
