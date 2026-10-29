#!/usr/bin/env python3
"""CoStudy: verify the frontend draw path after cleanup.
1. Every active row must have part in ('Part 1','Part 2') and be drill-shaped.
2. Empirically call pick_practice_mcqs like the frontend does
   (p_part + p_count only) and validate returned rows.
"""
import json, re, urllib.request, urllib.parse, collections, time, sys

KEY = None
for line in open("/root/costudy-api/.env"):
    if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
        KEY = line.split("=", 1)[1].strip().strip("\"'")
SB = "https://avtjxcdcjbwmggdimkgh.supabase.co/rest/v1"

def req(method, path, body=None):
    h = {"apikey": KEY, "Authorization": "Bearer " + KEY, "Prefer": "count=exact"}
    data = None
    if body is not None:
        h["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    r = urllib.request.Request(SB + path, data=data, method=method, headers=h)
    return urllib.request.urlopen(r, timeout=120)

# 1. active population shape
r = req("GET", '/question_bank?select=id&is_active=eq.true&part=in.("Part%201","Part%202")&limit=1')
ok_parts = int(r.headers["Content-Range"].split("/")[-1])
r0 = req("GET", "/question_bank?select=id&is_active=eq.true&limit=1")
total = int(r0.headers["Content-Range"].split("/")[-1])
print("active total:", total, "| in Part 1/2:", ok_parts)
if ok_parts != total:
    # which parts remain?
    rows = []
    off = 0
    while True:
        page = json.load(req("GET", "/question_bank?select=part&is_active=eq.true&limit=1000&offset=%d&order=id" % off))
        if not page:
            break
        rows += page
        off += len(page)
        if len(page) < 1000:
            break
    print("part distribution:", dict(collections.Counter(x["part"] for x in rows)))

# 2. empirical RPC draws (as the frontend calls it)
def draw(part, n=1):
    url = "/rpc/pick_practice_mcqs"
    body = {"p_part": part, "p_count": n}
    try:
        out = json.load(req("POST", url, body))
        return out
    except Exception as e:
        return {"error": str(e)}

for part in ("Part 1", "Part 2"):
    res = draw(part, 5)
    if isinstance(res, dict) and "error" in res:
        print(part, "RPC ERROR:", res["error"])
        continue
    print(part, "drew", len(res), "rows; sample keys:", sorted(res[0].keys()) if res else "NONE")
    bad = 0
    for q in res:
        opts = q.get("options") or {}
        if q.get("correct_answer") not in list("ABCD") or len([k for k in "ABCD" if opts.get(k)]) != 4:
            bad += 1
    print("  malformed in draw:", bad)

# distribution of draws over many calls (are all sections reachable? section is not
# passed by the frontend, so part-level reachability is what matters)
seen = collections.Counter()
for i in range(40):
    for part in ("Part 1", "Part 2"):
        res = draw(part, 10)
        if isinstance(res, list):
            for q in res:
                seen[(q.get("part"), q.get("section"))] += 1
    time.sleep(0.1)
print("distinct (part,section) seen across 800 draws:", len(seen))
