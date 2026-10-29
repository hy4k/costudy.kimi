#!/usr/bin/env python3
"""CoStudy: audit + clean question_bank of foreign text/symbols that don't belong
in questions, options, or explanations (page headers, internal IDs, URLs,
watermark runs, verdict boilerplate, OCR glyph noise). Run on the VPS.
Plain run = audit only. --fix = backup affected rows to JSON on disk, then PATCH.
Cleaning is regex-mechanical: it only removes known boilerplate, never rewrites
content, and is idempotent.
"""
import json, re, sys, urllib.request, urllib.parse, collections, time

FIX = "--fix" in sys.argv
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

PATTERNS = {
    "url": re.compile(r"https?://|www\.\S+", re.I),
    "hock_page_header": re.compile(r"Hock P[12] 20\d\d", re.I),
    "wiley_page_header": re.compile(r"CMA Exam Review - Part \d", re.I),
    "arabic": re.compile(r"[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]"),
    "telegram": re.compile(r"t\.me/\S+", re.I),
    "page_marker": re.compile(r"===== PAGE"),
    "los_prefix": re.compile(r"\bLOS:\s*\d|tb\.\w+\.\w+_\d", re.I),
    "qid_header": re.compile(r"Question ID:", re.I),
    "not_answered": re.compile(r"Question was not answered", re.I),
    "rationale_word": re.compile(r"(?m)^Rationale\b|Lesson Reference|Bloom Code", re.I),
    "your_answer": re.compile(r"\bYour Answer\b"),
    "efficientlearning": re.compile(r"efficientlearning", re.I),
    "verdict_residue": re.compile(r"this is (?:the|an) (?:correct|incorrect) answer|^(?:Correct|Incorrect)\.\s", re.I),
    "answer_analysis_residue": re.compile(r"Answer \([A-D]\) is (?:in)?correct", re.I),
    "glyph_section": re.compile(r"\u00a7\s?\d"),
    "glyph_copy": re.compile(r"[©®™]"),
    "page_count_tail": re.compile(r"\d{1,4}/1214\b"),
}

def clean_text(t, aggressive=False):
    """Remove boilerplate from one text field. Idempotent."""
    if not t:
        return t
    s = t
    s = re.sub(r"https?://\S+", " ", s)
    s = re.sub(r"\S*efficientlearning\S*", " ", s, flags=re.I)
    s = re.sub(r"t\.me/\S+", " ", s, flags=re.I)
    s = re.sub(r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u202A-\u202E\u2066-\u2069]+", " ", s)
    s = re.sub(r"Hock P[12] 20\d\d", " ", s, flags=re.I)
    s = re.sub(r"\d{1,2}/\d{1,2}/\d{4} CMA Exam Review - Part \d[^\n]*", " ", s, flags=re.I)
    s = re.sub(r"CMA Exam Review - Part \d", " ", s, flags=re.I)
    s = re.sub(r"\b\d{1,4}/1214\b", " ", s)
    s = re.sub(r"Question was not answered", " ", s, flags=re.I)
    s = re.sub(r"[ \t]{2,}", " ", s)
    s = re.sub(r"\u00a7(?=\s?\d)", "$", s)
    s = s.replace("©", "").replace("®", "").replace("™", "")
    # verdict boilerplate anywhere in the field
    s = re.sub(r"\s*Therefore, this is (?:the|an) (?:correct|incorrect) answer\.?", " ", s, flags=re.I)
    s = re.sub(r"\s*This is (?:the|an) (?:correct|incorrect) answer\.?", " ", s, flags=re.I)
    s = re.sub(r"^(?:Correct|Incorrect)\.\s*", "", s, flags=re.I)
    s = re.sub(r"\s*Bloom Code:\s*\S+\s*", " ", s, flags=re.I)
    s = re.sub(r"\s*Difficulty:\s*\S+\s*", " ", s, flags=re.I)
    # per-option analysis boilerplate (curated_pipeline old scrape inlined it)
    s = re.sub(r"\s*Answer \([A-D]\) is (?:in)?correct\.?", " ", s)
    # rationale separators in curated explanations
    s = re.sub(r"\s*Rationale\s+", " ", s, flags=re.I)
    s = re.sub(r"\s*Your Answer\s*", " ", s, flags=re.I)
    if aggressive:
        # stems only: strip leading internal-ID / LOS / Question-ID prefixes
        s = re.sub(r"^\s*\d+\.\s*Question ID:\s*[^\s(]+(?:\s+[^\s(]+)*?\s*\(Topic:[^)]*\)\s*", "", s)
        s = re.sub(r"^\s*\S+(?:\s+\S+){1,3}\s+LOS:\s*\S+\s+", "", s)
        s = re.sub(r"\s*Lesson Reference:.*?Bloom Code:\s*\S+\s*", " ", s)
        s = re.sub(r"\s*Lesson Reference:[^\n]*", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

stats = collections.Counter()
samples = {}
total_rows = 0
off = 0
hits = []
while True:
    page = json.load(req("GET", "/question_bank?select=id,source_kind,question_text,options,explanation&is_active=eq.true&limit=1000&offset=%d&order=id" % off))
    if not page:
        break
    for row in page:
        total_rows += 1
        fields = {"q": row["question_text"] or "", "e": row["explanation"] or ""}
        for k, v in (row.get("options") or {}).items():
            fields["o" + k] = v if isinstance(v, str) else ""
        names = set()
        for name, pat in PATTERNS.items():
            for fname, text in fields.items():
                if pat.search(text):
                    names.add(name)
                    samples.setdefault((name, row["source_kind"]), "%s :: %s" % (fname, text[:90]))
        if names:
            for n in names:
                stats["%s|%s" % (n, row["source_kind"])] += 1
            if FIX:
                hits.append(row)
    off += len(page)
    if len(page) < 1000:
        break

print("active rows scanned:", total_rows)
flat = collections.Counter()
for k, v in stats.items():
    name, src = k.rsplit("|", 1)
    flat[(name, src)] = v
for (name, src), v in sorted(flat.items()):
    print("%-26s %-16s %5d   e.g. %s" % (name, src, v, samples.get((name, src), "")))

if FIX:
    with open("/root/question_bank_artifact_backup.json", "w", encoding="utf-8") as fh:
        json.dump(hits, fh, ensure_ascii=False)
    print("backup of %d affected rows -> /root/question_bank_artifact_backup.json" % len(hits))
    cleaned = 0
    for row in hits:
        body = {}
        nq = clean_text(row["question_text"], aggressive=True)
        if nq != (row["question_text"] or ""):
            body["question_text"] = nq
        ne = clean_text(row["explanation"], aggressive=False)
        if ne != (row["explanation"] or ""):
            body["explanation"] = ne or None
        opts = row.get("options") or {}
        new_opts = {k: clean_text(v, aggressive=False) if isinstance(v, str) else v for k, v in opts.items()}
        if new_opts != opts:
            body["options"] = new_opts
        if not body:
            continue
        enc = urllib.parse.quote("eq." + str(row["id"]), safe="")
        try:
            req("PATCH", "/question_bank?id=" + enc, body)
            cleaned += 1
        except Exception as e:
            print("PATCH failed for id", row["id"], e)
        if cleaned % 200 == 0:
            time.sleep(0.3)
    print("rows cleaned:", cleaned)
