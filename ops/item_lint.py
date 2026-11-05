# -*- coding: utf-8 -*-
"""Haladyna-style mechanical item linter for CoStudy question & CBQ-task content.

Codifies the classic item-writing flaws (Haladyna, Downing & Rodriguez 2002)
as deterministic checks so no drafted question ships with:
  - broken structure (wrong option count, missing key, mismatched payloads)
  - "all/none of the above" giveaways
  - negative stems ("NOT"/"EXCEPT") unless explicitly allowlisted
  - artifact leakage (Question ID markers, answer-key markers, PUA glyphs)
  - numeric answers whose explanation never states the keyed value
  - duplicate options / degenerate drag-drop or matching payloads

Usage:
  python item_lint.py <tasks.json> [--cases <cases.json>]   lint payload files
  python item_lint.py --selftest                            inject 20 flaw
                                                            classes, measure
                                                            catch rate
Exit code 0 = zero errors (warnings allowed), 1 = errors found.
"""
import json, re, sys, unicodedata

ARTIFACT_PAT = re.compile(
    r"(Question\s*ID\s*[:#]|ANSWER\s*KEY|Correct answer\s*[:：]|answer\s*is\s*[:：]"
    r"|\bHOCK\b|\bGleim\b|\bWiley\b|\uf0b7|[ \t]{3,})",
    re.I)
NEGATIVE_PAT = re.compile(
    r"\b(which|what|select|choose|all of the following|none of the following)\b[^?]{0,120}\b(not|except|least|incorrect)\b"
    r"|\bexcept\b|\bleast\s+(likely|accurate)\b", re.I)
GIVEAWAY_PAT = re.compile(r"^\s*(all|none)\s+of\s+the\s+above\s*$|\bboth\s+A\s+and\s+B\s*$", re.I)


class Lint:
    def __init__(self):
        self.errors, self.warnings = [], []

    def err(self, item, code, msg):
        self.errors.append("%s: %s — %s" % (item, code, msg))

    def warn(self, item, code, msg):
        self.warnings.append("%s: %s — %s" % (item, code, msg))


def strip_html(s):
    return re.sub(r"<[^>]+>", "", s or "")


def check_task(L, label, t):
    p, a = t.get("payload") or {}, t.get("answer") or {}
    typ, prompt = t.get("type"), strip_html(t.get("prompt", ""))

    if len(prompt) < 25:
        L.warn(label, "stem_len", "stem under 25 chars")
    if NEGATIVE_PAT.search(prompt) and not t.get("negative_allowed"):
        L.err(label, "negative_stem", "negative stem without allowlist")
    for field in ("prompt", "explanation"):
        if ARTIFACT_PAT.search(t.get(field) or ""):
            L.err(label, "artifact", "artifact marker in %s" % field)

    if typ == "mcq":
        opts = p.get("options") or []
        key = a.get("value")
        if len(opts) != 4:
            L.err(label, "mcq_options", "mcq must have exactly 4 options, has %d" % len(opts))
        if not (isinstance(key, str) and len(key) == 1 and "A" <= key <= "D" and (len(opts) < 26 or ord(key) - 65 < len(opts))):
            if not (len(opts) <= 4 and key in "ABCD"[:len(opts)]):
                L.err(label, "mcq_key", "key %r not a valid option letter" % (key,))
        if len(set(opts)) != len(opts):
            L.err(label, "dup_options", "duplicate option texts")
        for i, o in enumerate(opts):
            if GIVEAWAY_PAT.match(strip_html(o)):
                L.err(label, "giveaway", "option %d is an all/none-of-the-above giveaway" % i)
        lens = [len(strip_html(o)) for o in opts]
        if lens and max(lens) > 4 * max(1, min(lens)):
            L.warn(label, "homogeneity", "option length spread too wide")

    elif typ == "multi":
        opts = p.get("options") or []
        vals = a.get("values") or []
        if len(opts) < 4:
            L.err(label, "multi_options", "multi needs >=4 options")
        if not vals or any(not isinstance(v, int) or v < 0 or v >= len(opts) for v in vals):
            L.err(label, "multi_key", "values %r out of range" % (vals,))
        if len(set(opts)) != len(opts):
            L.err(label, "dup_options", "duplicate option texts")

    elif typ == "dnd":
        items = p.get("items") or []
        zones = p.get("zones") or {}
        place = a.get("placement") or {}
        ids = [i.get("id") for i in items]
        if len(ids) != len(set(ids)) or not ids:
            L.err(label, "dnd_items", "item ids missing or duplicated")
        if len(zones) < 2:
            L.err(label, "dnd_zones", "needs >=2 zones")
        if set(place) != set(ids):
            L.err(label, "dnd_place", "placement keys != item ids")
        bad = [v for v in place.values() if v not in zones]
        if bad:
            L.err(label, "dnd_zone_ref", "placement references unknown zone %r" % (bad[0],))

    elif typ == "list":
        fields = p.get("fields") or []
        vals = a.get("values") or []
        if len(fields) != len(vals):
            L.err(label, "list_len", "%d fields vs %d answers" % (len(fields), len(vals)))
        for i, f in enumerate(fields):
            if len(f.get("options") or []) < 2:
                L.err(label, "list_opts", "field %d needs >=2 options" % i)
            if i < len(vals) and vals[i] not in (f.get("options") or []):
                L.err(label, "list_val", "answer %r not among field %d options" % (vals[i], i))

    elif typ == "num":
        val = a.get("value")
        if not isinstance(val, (int, float)):
            L.err(label, "num_value", "numeric answer missing")
        else:
            expl = t.get("explanation") or ""
            shown = ("%g" % val) if isinstance(val, float) else str(val)
            digits = expl.replace(",", "")
            if shown not in digits and str(val) not in digits:
                L.err(label, "num_expl", "keyed value %s not stated in explanation" % shown)
    else:
        L.err(label, "type", "unknown task type %r" % typ)


def run(tasks, cases=None):
    L = Lint()
    for i, t in enumerate(tasks):
        check_task(L, "task[%d] seq=%s" % (i, t.get("seq")), t)
    if cases:
        ids = set()
        for c in cases:
            if c.get("id") in ids:
                L.err("cases", "dup_id", "duplicate case id %s" % c["id"])
            ids.add(c.get("id"))
            if not c.get("narrative") or len(c["narrative"]) < 200:
                L.warn("case %s" % c.get("id", "?")[:8], "narrative_len", "short narrative")
            if not c.get("exhibits"):
                L.err("case %s" % c.get("id", "?")[:8], "exhibits", "case has no exhibits")
        for t in tasks:
            if cases is not None and t.get("case_id") and t["case_id"] not in ids:
                L.err("orphan", "case_ref", "task points at unknown case %s" % t["case_id"])
        keys = [t["answer"]["value"] for t in tasks if t.get("type") == "mcq" and isinstance(t.get("answer", {}).get("value"), str)]
        dist = {k: keys.count(k) for k in "ABCD"}
        if keys and max(dist.values()) > 0.45 * len(keys):
            L.warn("bank", "key_balance", "mcq key skewed: %s over %d items" % (dist, len(keys)))
    return L


# ----------------------------------------------------------------- selftest
def selftest():
    good = {"seq": 1, "type": "mcq", "prompt": "Which control most directly prevents duplicate payments in accounts payable?",
            "payload": {"options": ["Three-way matching before payment release", "Monthly bank reconciliation",
                                     "Segregation of custody and recording", "Pre-numbered payment vouchers"]},
            "answer": {"value": "A"}, "explanation": "Three-way matching ties the invoice to PO and receipt before cash leaves."}
    flaw_classes = {
        "mcq_wrong_option_count": {**good, "payload": {"options": ["a", "b", "c"]}},
        "mcq_bad_key": {**good, "answer": {"value": "E"}},
        "giveaway_all_above": {**good, "payload": {"options": ["x", "y", "z", "All of the above"]}},
        "giveaway_none_above": {**good, "payload": {"options": ["x", "y", "z", "None of the above"]}},
        "negative_stem": {**good, "prompt": "Which of the following is NOT a control activity?"},
        "negative_except": {**good, "prompt": "All of the following are controls except?"},
        "artifact_question_id": {**good, "prompt": good["prompt"] + " Question ID: 42"},
        "artifact_pua": {**good, "prompt": good["prompt"] + " "},
        "artifact_answer_marker": {**good, "explanation": "Correct answer: A because matching works."},
        "dup_options": {**good, "payload": {"options": ["same", "same", "other", "another"]}},
        "num_missing_value": {"seq": 2, "type": "num", "prompt": "Compute the current ratio from the exhibit figures please now",
                               "payload": {}, "answer": {}, "explanation": "1.6 from the numbers."},
        "num_expl_mismatch": {"seq": 3, "type": "num", "prompt": "Compute the quick ratio from the exhibit figures now please ok",
                               "payload": {}, "answer": {"value": 1.35}, "explanation": "It is 1.6 by inspection."},
        "multi_empty_values": {"seq": 4, "type": "multi", "prompt": "Select the two preventive controls from this list now please",
                                "payload": {"options": ["MFA", "Lockout", "Log review", "Recs"]}, "answer": {"values": []},
                                "explanation": "MFA and lockout prevent."},
        "multi_out_of_range": {"seq": 5, "type": "multi", "prompt": "Select the two preventive controls from this list now ok",
                                "payload": {"options": ["MFA", "Lockout", "Log review", "Recs"]}, "answer": {"values": [0, 7]},
                                "explanation": "MFA and lockout prevent."},
        "dnd_bad_zone_ref": {"seq": 6, "type": "dnd", "prompt": "Classify each item as relevant or irrelevant right now please",
                              "payload": {"items": [{"id": "a", "text": "t1"}], "zones": {"r": "Relevant", "i": "Irrelevant"}},
                              "answer": {"placement": {"a": "zzz"}}, "explanation": "t1 is relevant."},
        "dnd_partial_place": {"seq": 7, "type": "dnd", "prompt": "Classify each item as relevant or irrelevant right now ok",
                               "payload": {"items": [{"id": "a", "text": "t1"}, {"id": "b", "text": "t2"}],
                                            "zones": {"r": "Relevant", "i": "Irrelevant"}},
                               "answer": {"placement": {"a": "r"}}, "explanation": "a relevant, b irrelevant."},
        "list_bad_value": {"seq": 8, "type": "list", "prompt": "Match each control to its objective for the audit committee",
                            "payload": {"fields": [{"label": "Encryption", "options": ["Confidentiality", "Availability"]}]},
                            "answer": {"values": ["Speed"]}, "explanation": "Encryption gives confidentiality."},
        "list_len_mismatch": {"seq": 9, "type": "list", "prompt": "Match each control to its objective for the audit now please",
                               "payload": {"fields": [{"label": "x", "options": ["p", "q"]}, {"label": "y", "options": ["p", "q"]}]},
                               "answer": {"values": ["p"]}, "explanation": "x is p, y is q."},
        "short_stem_warning": {**good, "prompt": "Best control?"},
        "homogeneity_warning": {**good, "payload": {"options": ["Match", "Check", "See", "A particularly verbose and detailed option"]}},
    }
    # fixed expectations: which injected classes MUST raise an error (vs warning-only)
    must_error = {k for k in flaw_classes} - {"short_stem_warning", "homogeneity_warning"}
    caught, missed, false_pos = [], [], []
    base = run([good])
    for name, task in flaw_classes.items():
        L = run([task])
        hit_err = bool(L.errors)
        if name in must_error:
            (caught if hit_err else missed).append(name)
        else:
            (caught if (hit_err or L.warnings) else missed).append(name)
        if hit_err and name not in must_error:
            false_pos.append(name)
    rate = len(caught) / len(flaw_classes) * 100
    print("selftest: %d/%d flaw classes flagged (%.0f%%); missed: %s; warnings-only misflagged-as-errors: %s"
          % (len(caught), len(flaw_classes), rate, missed or "none", false_pos or "none"))
    print("baseline good item: errors=%d warnings=%d" % (len(base.errors), len(base.warnings)))
    for e in base.errors:
        print("  FP:", e)
    return 0 if not missed and not base.errors else 1


def main():
    if "--selftest" in sys.argv:
        sys.exit(selftest())
    tasks = json.load(open(sys.argv[1], encoding="utf-8"))
    cases = None
    if "--cases" in sys.argv:
        cases = json.load(open(sys.argv[sys.argv.index("--cases") + 1], encoding="utf-8"))
    L = run(tasks, cases)
    print("linted %d tasks%s: %d error(s), %d warning(s)" % (
        len(tasks), " + %d cases" % len(cases) if cases else "", len(L.errors), len(L.warnings)))
    for w in L.warnings:
        print("WARN:", w)
    for e in L.errors:
        print("ERR :", e)
    sys.exit(1 if L.errors else 0)


if __name__ == "__main__":
    main()
