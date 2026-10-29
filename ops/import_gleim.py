#!/usr/bin/env python3
"""CoStudy: import Gleim + HOCK CMA PDFs from Google Drive into Supabase question_bank.
Runs on the VPS. Walks Drive folders via embeddedfolderview (no auth needed for
'anyone with link' shares), downloads Q/A PDF pairs, parses with pdftotext,
screens, dedupes, bulk-inserts via service-role REST.
Usage: import_gleim.py <part 1|2> [--dry]
"""
import json, re, subprocess, sys, urllib.request, urllib.error, urllib.parse, html, time, os, collections

PART = sys.argv[1] if len(sys.argv) > 1 else "2"
DRY = "--dry" in sys.argv

KEY = None
for line in open("/root/costudy-api/.env"):
    if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
        KEY = line.split("=", 1)[1].strip().strip("\"'")
SB = "https://avtjxcdcjbwmggdimkgh.supabase.co/rest/v1"

# Section folders per part (Drive folder ids)
SECTIONS = {
    "2": {
        "A": ("1aQmTvjsaqnj925nlfe5ES5yIY6Et4pJ-", "Financial Statement Analysis"),
        "B": ("1YQPJfZfa0jMKc-WNPqn6KZEZW1PIYSLm", "Corporate Finance"),
        "C": ("1_ekuRZ8vymxtWX901g7cjHCzJncF0H7b", "Decision Analysis"),
        "D": ("1LkADHohphd9o9FEs-oci0vUNaPqY4uRG", "Risk Management"),
        "E": ("1js2L9xf2aPos53fnLZdkYNMjzS5NT6tx", "Investment Decisions"),
    },
    "1": {
        "A": ("1ypQFBfifj_1S6HWyYrHMZ_Qo2BGJcPJu", "External Financial Reporting"),
        "B": ("1vGQ91nXKZNBqHugvu1XW0TWCNNm6gexO", "Planning, Budgeting, and Forecasting"),
        "C": ("1Qfy6vq1kkdA2KMZXALDZKu8C0aBB_uvt", "Performance Management"),
        "D": ("1KBhe3GSmTPM02mtnZNVdePfwUen8Wr18", "Cost Management"),
        "E": ("1Ofo8FxRcX7cKKyIAIf1CBTx7RQmeMQH8", "Internal Controls"),
    },
}[PART]

WORK = "/tmp/gleim-import"
os.makedirs(WORK, exist_ok=True)

def http_get(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=timeout).read()

def list_folder(folder_id):
    """Return [{id,title,kind}] of direct children via the embedded folder view."""
    raw = http_get("https://drive.google.com/embeddedfolderview?id=%s#list" % folder_id).decode("utf-8", "ignore")
    items = []
    for m in re.finditer(r'flip-entry" id="entry-([A-Za-z0-9_-]+)".*?flip-entry-title">([^<]+)<', raw, re.S):
        block = m.group(0)
        items.append({
            "id": m.group(1),
            "title": html.unescape(m.group(2)).strip(),
            "kind": "folder" if "/folders/" in block else "file",
        })
    return items

def download(file_id, dest):
    data = http_get("https://drive.google.com/uc?export=download&id=%s" % file_id, timeout=300)
    open(dest, "wb").write(data)
    return len(data)

def pdftotext(pdf, txt):
    subprocess.run(["pdftotext", "-layout", pdf, txt], check=True)
    return open(txt, encoding="utf-8", errors="ignore").read()

ARABIC_RE = re.compile(r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u202A-\u202E\u2066-\u2069]")
TM_RE = re.compile(r"(?:https?://)?t\.me/\S+", re.I)

def strip_watermarks(text):
    """Remove pirated-watermark content (Arabic script / Telegram links), inline-safe."""
    text = TM_RE.sub(" ", text)
    text = ARABIC_RE.sub(" ", text)
    return re.sub(r"[ \t]{2,}", " ", text)

# ---------- Gleim parsing ----------

OUTLINE_RE = re.compile(r"^\s*\d+:\s*\(\d+\)\s+(.+?)\s*$")
Q_RE = re.compile(r"Question:\s*(\d+)\s*(.*)")
OPT_RE = re.compile(r"^\s+([A-D])\.\s+(.*)$")
FACT_RE = re.compile(r"^\s*Fact Pattern:\s*(.*)$")
CORRECT_RE = re.compile(r"Answer \(([A-D])\) is correct")
ANS_OPT_RE = re.compile(r"^\s*([A-D])\.\s+(.+)$")  # answers PDFs sometimes left-align options

def parse_questions(text):
    """Return ordered list of {idx, num, fact, stem, options} in appearance order."""
    lines = text.replace("\r", "").split("\n")
    qs = []
    fact_buf = None
    fact_open = False
    cur = None
    opt_key = None

    def flush():
        nonlocal cur
        if cur and len(cur["options"]) >= 2:
            cur["stem"] = " ".join(cur["stem_parts"]).strip()
            if cur.get("fact"):
                cur["stem"] = (cur["fact"] + " " + cur["stem"]).strip()
            del cur["stem_parts"]
            cur["idx"] = len(qs)
            qs.append(cur)
        cur = None

    last_topic = None
    for ln in lines:
        m = OUTLINE_RE.match(ln)
        if m:
            last_topic = m.group(1).strip()
            continue
        m = FACT_RE.match(ln)
        if m:
            fact_buf = [m.group(1).strip()]
            fact_open = True
            continue
        if fact_open:
            if Q_RE.match(ln):
                fact_open = False  # pattern complete; keep serving it to later questions
            elif ln.strip():
                fact_buf.append(ln.strip())
                continue
        m = Q_RE.match(ln)
        if m:
            flush()
            cur = {"num": int(m.group(1)), "topic": last_topic,
                   "fact": " ".join(fact_buf).strip() if fact_buf else None,
                   "stem_parts": [m.group(2).strip()] if m.group(2).strip() else [],
                   "options": {}}
            opt_key = None
            continue
        if cur is None:
            continue
        m = OPT_RE.match(ln)
        if m:
            opt_key = m.group(1)
            cur["options"][opt_key] = m.group(2).strip()
            continue
        t = ln.strip()
        if not t:
            continue
        if opt_key and opt_key in cur["options"]:
            cur["options"][opt_key] += " " + t
        else:
            cur["stem_parts"].append(t)
    flush()
    return qs

def parse_answers(text):
    """Return ordered list of answer blocks in appearance order:
    {num, letter, explanation, opts} — opts are the option texts restated in the
    answers PDF, used to validate pairing with question blocks."""
    lines = text.replace("\r", "").split("\n")
    blocks = []
    cur = None
    cur_opt = None
    expl_active = False

    def flush():
        nonlocal cur
        if cur and cur["letter"]:
            cur["explanation"] = re.sub(r"\s+", " ", " ".join(cur["expl_parts"])).strip()[:800]
            del cur["expl_parts"]
            blocks.append(cur)
        cur = None

    for ln in lines:
        if OUTLINE_RE.match(ln):
            continue
        m = Q_RE.match(ln)
        if m:
            flush()
            cur = {"num": int(m.group(1)), "letter": None,
                   "opts": {}, "expl_parts": []}
            cur_opt = None
            expl_active = False
            continue
        if cur is None:
            continue
        m = ANS_OPT_RE.match(ln)
        if m:
            cur_opt = m.group(1)
            cur["opts"][cur_opt] = m.group(2).strip()
            expl_active = False
            continue
        m = CORRECT_RE.search(ln)
        if m:
            cur["letter"] = m.group(1)
            rest = ln.split("is correct", 1)[1].strip(" .") if "is correct" in ln else ""
            cur["expl_parts"] = [rest] if rest else []
            expl_active = True
            continue
        t = ln.strip()
        if not t:
            continue
        if re.match(r"Answer \([A-D]\) is", t):
            cur_opt = None  # analysis follows; stop extending the option text
            continue
        if expl_active:
            cur["expl_parts"].append(t)
        elif cur_opt:
            cur["opts"][cur_opt] += " " + t
    flush()
    return blocks

SUBUNIT_RE = re.compile(r"^\s*Subunit\s+\d+:\s+(.+?)\s*$")

def parse_qa_combined(text):
    """Part 1 Gleim 'Q&A' PDFs: questions with inline Answer (X) is correct/incorrect
    analysis. Returns ordered list of complete rows-in-waiting."""
    lines = text.replace("\r", "").split("\n")
    qs = []
    fact_buf = None
    fact_open = False
    topic = None
    cur = None
    cur_opt = None
    expl_active = False

    def flush():
        nonlocal cur
        if cur and cur.get("letter") and len(cur["options"]) >= 2:
            cur["stem"] = " ".join(cur["stem_parts"]).strip()
            if cur.get("fact"):
                cur["stem"] = (cur["fact"] + " " + cur["stem"]).strip()
            del cur["stem_parts"]
            cur["idx"] = len(qs)
            cur["explanation"] = re.sub(r"\s+", " ", " ".join(cur["expl_parts"])).strip()[:800] or None
            del cur["expl_parts"]
            qs.append(cur)
        cur = None

    for ln in lines:
        m = SUBUNIT_RE.match(ln)
        if m:
            topic = m.group(1).strip()
            continue
        m = FACT_RE.match(ln)
        if m:
            fact_buf = [m.group(1).strip()]
            fact_open = True
            continue
        if fact_open:
            if Q_RE.match(ln):
                fact_open = False
            elif ln.strip():
                fact_buf.append(ln.strip())
                continue
        m = Q_RE.match(ln)
        if m:
            flush()
            cur = {"num": int(m.group(1)), "topic": topic, "letter": None,
                   "fact": " ".join(fact_buf).strip() if fact_buf else None,
                   "stem_parts": [m.group(2).strip()] if m.group(2).strip() else [],
                   "options": {}, "expl_parts": []}
            cur_opt = None
            expl_active = False
            continue
        if cur is None:
            continue
        m = OPT_RE.match(ln) or ANS_OPT_RE.match(ln)
        if m:
            cur_opt = m.group(1)
            cur["options"][cur_opt] = m.group(2).strip()
            expl_active = False
            continue
        m = CORRECT_RE.search(ln)
        if m:
            cur["letter"] = m.group(1)
            rest = ln.split("is correct", 1)[1].strip(" .") if "is correct" in ln else ""
            if rest:
                cur["expl_parts"].append(rest)
            expl_active = True
            continue
        t = ln.strip()
        if not t:
            continue
        if re.match(r"Answer \([A-D]\) is", t):
            cur_opt = None
            expl_active = False
            continue
        if expl_active:
            cur["expl_parts"].append(t)
        elif cur_opt and cur_opt in cur["options"]:
            cur["options"][cur_opt] += " " + t
        else:
            cur["stem_parts"].append(t)
    flush()
    return qs

# ---------- HOCK parsing ----------
# Layout per section: "Section X Questions.pdf" and "Section X Answers.pdf".
# Questions file:
#   226. Question ID: CMA 1295 2.21 (Topic: Comparative Financial Statement
#   Analysis)
#   <stem lines, tables possible>
#   · A. $47,000
#   · B. $50,000
#   with indented continuations. Numbering is continuous across the section.
# Answers file: same headers, options restated with the correct one suffixed
# ".correct", then "Correct Answer Explanation:" + paragraphs, then
# "Explanation for Choice X:" per distractor (ignored).

H_HEAD_RE = re.compile(r"^\s*(\d+)\.\s*Question ID:\s*(.+?)\s*(?:\((.*))?$")
H_OPT_RE = re.compile(r"^\s*(?:\uf0b7|\u2022|\u25aa|\u2023|-)?\s*([A-D])\.\s+(.+)$")
H_ANS_OPT_RE = re.compile(r"^\s*(?:\uf0b7|\u2022|\u25aa|\u2023)?\s*([A-D])\.\s+(.+?)\s*$")
H_JUNK_RE = re.compile(
    r"^\s*(?:Hock\s+P[12]\s+20\d\d|HOCK|Part\s+\d\b.*|Section\s+[A-E]\b.*|"
    r"Questions?|Answers?|Page\s+\d+|\d{1,4})\s*$", re.I)
H_EXPL_START = re.compile(r"^\s*Correct Answer Explanation:\s*(.*)$")
H_DIST_START = re.compile(r"^\s*Explanation for Choice\s+[A-D]:\s*(.*)$", re.I)
H_NOT_ANSWERED = re.compile(r"Question was not answered", re.I)
# Correct marker is the word "correct" glued straight onto the option text:
# "sales.correct", "20%correct", "(20%).correct". The char before it must be
# punctuation (a letter would mean a word like "incorrect").
H_CORRECT_SUFFIX = re.compile(r"([^A-Za-z\s])correct\s*$")

def _hock_strip_correct(txt):
    m = H_CORRECT_SUFFIX.search(txt)
    if m:
        return txt[:m.end(1)].strip(), True
    return txt, False

def _hock_topic_closed(cur):
    return bool(cur["topic_parts"]) and cur["topic_parts"][-1].rstrip().endswith(")")

def parse_hock_questions(text):
    """Return ordered list of {idx, num, qid, topic, stem, options}."""
    lines = text.replace("\r", "").split("\n")
    qs = []
    cur = None
    opt_key = None

    def flush():
        nonlocal cur
        if cur and len(cur["options"]) >= 2:
            cur["stem"] = " ".join(cur["stem_parts"]).strip()
            del cur["stem_parts"]
            cur["topic"] = re.sub(r"\s+", " ", " ".join(cur["topic_parts"])).strip().rstrip(")").strip() or None
            if cur["topic"] and cur["topic"].lower().startswith("topic:"):
                cur["topic"] = cur["topic"][6:].strip() or None
            del cur["topic_parts"]
            cur["idx"] = len(qs)
            qs.append(cur)
        cur = None

    for ln in lines:
        t = ln.strip()
        if not t or H_JUNK_RE.match(ln):
            continue
        m = H_HEAD_RE.match(ln)
        if m:
            flush()
            cur = {"num": int(m.group(1)), "qid": m.group(2).strip(),
                   "topic_parts": [m.group(3).strip()] if m.group(3) else [],
                   "stem_parts": [], "options": {}}
            opt_key = None
            continue
        if cur is None:
            continue
        # Topic wrap: until the parenthesis closes, non-empty lines are topic.
        if not cur["stem_parts"] and not cur["options"] and not _hock_topic_closed(cur) \
                and len(cur["topic_parts"]) < 4:
            cur["topic_parts"].append(t)
            continue
        m = H_OPT_RE.match(ln)
        if m:
            opt_key = m.group(1)
            cur["options"][opt_key] = m.group(2).strip()
            continue
        if opt_key and opt_key in cur["options"] and (ln.startswith((" ", "\t")) or ln.startswith("\uf0b7")):
            cur["options"][opt_key] += " " + t
            continue
        cur["stem_parts"].append(t)
    flush()
    return qs

def parse_hock_answers(text):
    """Return ordered list of blocks {num, letter, explanation, opts}."""
    lines = text.replace("\r", "").split("\n")
    blocks = []
    cur = None
    cur_opt = None
    mode = "none"  # none | main | dist

    def flush():
        nonlocal cur
        if cur and cur["letter"]:
            cur["explanation"] = re.sub(r"\s+", " ", " ".join(cur["expl_parts"])).strip()[:800]
            del cur["expl_parts"]
            blocks.append(cur)
        cur = None

    for ln in lines:
        t = ln.strip()
        if not t or H_JUNK_RE.match(ln):
            continue
        m = H_HEAD_RE.match(ln)
        if m:
            flush()
            cur = {"num": int(m.group(1)), "letter": None, "opts": {}, "expl_parts": []}
            cur_opt = None
            mode = "none"
            continue
        if cur is None:
            continue
        if H_NOT_ANSWERED.search(t):
            continue
        m = H_DIST_START.match(ln)
        if m:
            mode = "dist"
            continue
        m = H_EXPL_START.match(ln)
        if m:
            mode = "main"
            if m.group(1):
                cur["expl_parts"].append(m.group(1))
            continue
        if mode == "dist":
            continue
        m = H_ANS_OPT_RE.match(ln)
        if m and mode == "none":
            txt, was_correct = _hock_strip_correct(m.group(2).strip())
            if was_correct:
                cur["letter"] = m.group(1)
            cur_opt = m.group(1)
            cur["opts"][cur_opt] = txt
            continue
        if mode == "main":
            cur["expl_parts"].append(t)
            continue
        if cur_opt and cur_opt in cur["opts"] and (ln.startswith((" ", "\t")) or ln.startswith("\uf0b7")):
            txt, was_correct = _hock_strip_correct(t)
            if was_correct:
                cur["letter"] = cur_opt
            cur["opts"][cur_opt] += " " + txt
    flush()
    return blocks

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
    """Batch-insert; on conflict fall back to row-by-row so one bad row can't
    sink 199 good ones, and the failing constraint/row is logged.
    Returns the number of rows actually inserted."""
    inserted = 0
    for i in range(0, len(rows), 200):
        batch = rows[i:i + 200]
        try:
            sb_post("/question_bank", batch)
            inserted += len(batch)
        except urllib.error.HTTPError as e:
            print("  batch %d-%d failed: HTTP %s %s; retrying row-by-row"
                  % (i, i + len(batch), e.code, e.read().decode()[:300]), flush=True)
            for r in batch:
                try:
                    sb_post("/question_bank", [r])
                    inserted += 1
                except urllib.error.HTTPError as e2:
                    stats["insert_failed"] += 1
                    print("  ROW FAILED %s: HTTP %s %s"
                          % (r["external_id"], e2.code, e2.read().decode()[:250]), flush=True)
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

# ---------- matching / row building ----------

def match_blocks(qs, blocks, stats):
    """Pair question blocks with answer blocks via option-text similarity in a
    sliding window — either PDF may skip questions, so order alone can't be trusted."""
    used = set()

    def score_pair(opts, a):
        letter = a["letter"]
        if not letter or letter not in "ABCD":
            return -1
        qo = {k: norm(v) for k, v in opts.items()}
        ao = {k: norm(v) for k, v in a["opts"].items()}
        if qo.get(letter) and ao.get(letter) and qo[letter] != ao[letter] and qo[letter][:40] != ao[letter][:40]:
            return -1
        same = sum(1 for k in "ABCD" if qo.get(k) and ao.get(k) and (qo[k] == ao[k] or qo[k][:40] == ao[k][:40]))
        return same

    matched = {}
    for qi, q in enumerate(qs):
        opts = q["options"]
        best = None
        best_score = 2  # require at least 3 matching options
        for bi in range(max(0, qi - 4), min(len(blocks), qi + 5)):
            if bi in used:
                continue
            s = score_pair(opts, blocks[bi])
            if s > best_score:
                best = bi
                best_score = s
        if best is not None:
            used.add(best)
            matched[qi] = blocks[best]
        else:
            stats["answer_mismatch"] += 1
    return matched

def make_row(q, a, part, sec_letter, source, eid, stems, stats):
    opts = q["options"]
    if not {"A", "B", "C", "D"}.issubset(opts.keys()):
        stats["bad_options"] += 1
        return None
    if any(not (opts[k] or "").strip() for k in "ABCD"):
        stats["empty_option"] += 1
        return None
    letter = a["letter"]
    stem = re.sub(r"\s+", " ", q["stem"]).strip()
    if not 25 <= len(stem) <= 1500:
        stats["bad_stem"] += 1
        return None
    n = norm(stem)
    if not n or n in stems:
        stats["duplicate"] += 1
        return None
    stems.add(n)
    pub = source.split("_")[0]
    return {
        "external_id": eid,
        "part": "Part " + part,
        "section": "Section " + sec_letter,
        "topic": q.get("topic"),
        "question_kind": "MCQ",
        "source_kind": source,
        "question_text": stem,
        "options": {k: opts[k].strip() for k in "ABCD"},
        "correct_answer": letter,
        "explanation": a.get("explanation") or None,
        "reference_links": [],
        "tags": [pub, "part-%s" % part.lower(), "section-%s" % sec_letter.lower()],
        "is_active": True,
        "quality_flag": "imported_" + pub,
    }

# ---------- main ----------

stats = collections.Counter()
stems = active_stems()
print("existing active stems:", len(stems), flush=True)

for sec_letter, (sec_folder, sec_name) in SECTIONS.items():
    children = list_folder(sec_folder)
    pub_folders = {}
    for c in children:
        if c["kind"] != "folder":
            continue
        t = c["title"].strip().lower()
        if "gleim" in t:
            pub_folders.setdefault("gleim", c)
        elif "hock" in t:
            pub_folders.setdefault("hock", c)
    rows = []

    # ----- Gleim branch -----
    if "gleim" in pub_folders:
        files = [f for f in list_folder(pub_folders["gleim"]["id"]) if f["kind"] == "file" and f["title"].lower().endswith(".pdf")]
        if PART == "1":
            unit_files = {re.search(r"U\s*(\d+)", f["title"]).group(1): f
                          for f in files if re.search(r"U\s*\d+\s*Q&A", f["title"], re.I)}
            print("Sec %s (%s): %d Gleim Q&A files" % (sec_letter, sec_name, len(unit_files)), flush=True)
        else:
            qfiles = {re.search(r"Unit\s*(\d+)", f["title"]).group(1): f for f in files if "question" in f["title"].lower()}
            afiles = {re.search(r"Unit\s*(\d+)", f["title"]).group(1): f for f in files if "answer" in f["title"].lower()}
            unit_files = {u: (q, afiles.get(u)) for u, q in qfiles.items()}
            print("Sec %s (%s): %d Gleim question files, %d answer files" % (sec_letter, sec_name, len(qfiles), len(afiles)), flush=True)

        for unit in sorted(unit_files.keys(), key=int):
            try:
                if PART == "1":
                    qf = unit_files[unit]
                    qpdf = os.path.join(WORK, "qa_%s_%s.pdf" % (sec_letter, unit))
                    if not os.path.exists(qpdf):
                        download(qf["id"], qpdf)
                    qs = parse_qa_combined(strip_watermarks(pdftotext(qpdf, qpdf + ".txt")))
                    blocks = None
                else:
                    qf, af = unit_files[unit]
                    if not af:
                        print("  unit %s: no answer file, skipped" % unit)
                        continue
                    qpdf = os.path.join(WORK, "q_%s_%s.pdf" % (sec_letter, unit))
                    apdf = os.path.join(WORK, "a_%s_%s.pdf" % (sec_letter, unit))
                    if not os.path.exists(qpdf):
                        download(qf["id"], qpdf)
                    if not os.path.exists(apdf):
                        download(af["id"], apdf)
                    qs = parse_questions(strip_watermarks(pdftotext(qpdf, qpdf + ".txt")))
                    blocks = parse_answers(strip_watermarks(pdftotext(apdf, apdf + ".txt")))
            except Exception as e:
                print("  unit %s: download/parse error %s" % (unit, e))
                stats["unit_error"] += 1
                continue
            if PART == "1":
                matched = {qi: q for qi, q in enumerate(qs)}  # inline answers: self-matched
            else:
                if len(qs) != len(blocks):
                    stats["count_mismatch"] += abs(len(qs) - len(blocks))
                matched = match_blocks(qs, blocks, stats)

            unit_rows = 0
            for qi, q in enumerate(qs):
                a = matched.get(qi)
                if not a:
                    if PART == "1":
                        stats["answer_mismatch"] += 1
                    continue
                r = make_row(q, a, PART, sec_letter, "gleim_drive",
                             "gleim-p%s-sec%s-u%s-i%03d" % (PART, sec_letter.lower(), unit, q["idx"]),
                             stems, stats)
                if r:
                    rows.append(r)
                    unit_rows += 1
            stats["parsed"] += unit_rows
            if PART == "1":
                print("  unit %s: %d questions (%d validated)" % (unit, len(qs), unit_rows), flush=True)
            else:
                print("  unit %s: %d questions, %d answer blocks (%d validated)" % (unit, len(qs), len(blocks), unit_rows), flush=True)

    # ----- HOCK branch -----
    if "hock" in pub_folders:
        hfiles = [f for f in list_folder(pub_folders["hock"]["id"]) if f["kind"] == "file" and f["title"].lower().endswith(".pdf")]
        h_q = next((f for f in hfiles if "question" in f["title"].lower()), None)
        h_a = next((f for f in hfiles if "question" not in f["title"].lower() and "answer" in f["title"].lower()), None)
        if not h_q or not h_a:
            print("Sec %s: HOCK folder present but missing Q/A PDFs" % sec_letter, flush=True)
        else:
            try:
                qpdf = os.path.join(WORK, "h_q_p%s_%s.pdf" % (PART, sec_letter))
                apdf = os.path.join(WORK, "h_a_p%s_%s.pdf" % (PART, sec_letter))
                if not os.path.exists(qpdf):
                    download(h_q["id"], qpdf)
                if not os.path.exists(apdf):
                    download(h_a["id"], apdf)
                qs = parse_hock_questions(strip_watermarks(pdftotext(qpdf, qpdf + ".txt")))
                blocks = parse_hock_answers(strip_watermarks(pdftotext(apdf, apdf + ".txt")))
            except Exception as e:
                print("  HOCK: download/parse error %s" % e)
                stats["unit_error"] += 1
                qs, blocks = [], []
            if len(qs) != len(blocks):
                stats["count_mismatch"] += abs(len(qs) - len(blocks))
            matched = match_blocks(qs, blocks, stats)
            sec_rows = 0
            for qi, q in enumerate(qs):
                a = matched.get(qi)
                if not a:
                    continue
                # Include part + question number: Hock section files mix in
                # cross-part review questions, so the bare qid slug can collide
                # with rows already imported from the other part's files.
                eid = "hock-p%s-%s-q%s" % (PART, re.sub(r"[^A-Za-z0-9]+", "-", q["qid"]).strip("-").lower(), q["num"])
                r = make_row(q, a, PART, sec_letter, "hock_drive", eid, stems, stats)
                if r:
                    rows.append(r)
                    sec_rows += 1
            stats["parsed"] += sec_rows
            print("  HOCK: %d questions, %d answer blocks (%d validated)" % (len(qs), len(blocks), sec_rows), flush=True)

    if DRY:
        print("  DRY RUN: would insert %d rows for Sec %s" % (len(rows), sec_letter))
        for r in rows[:1]:
            print("  SAMPLE: %s" % json.dumps({k: (v[:160] if isinstance(v, str) else v) for k, v in r.items() if k in ("question_text", "options", "correct_answer", "explanation", "topic")}, ensure_ascii=False))
        continue
    sb_inserted = sb_post_rows(rows, stats)
    stats["inserted"] += sb_inserted
    print("Sec %s: %d rows built, %d inserted" % (sec_letter, len(rows), sb_inserted), flush=True)

print("STATS:", dict(stats))
