#!/usr/bin/env python3
"""CoStudy: OCR the Wiley CMA section scans from the owner's shared Drive folder.
Runs on the VPS (tesseract + pdftoppm). One ~455MB PDF per section per part;
/tmp is a 3.9G tmpfs, so each file is downloaded, OCR'd in page batches, then
deleted immediately. Text lands in /root/wiley-text/<part>-<sec>.txt with page
markers, ready for a parser pass later.
"""
import re, html, os, subprocess, shutil, sys, time
import urllib.request, http.cookiejar

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
}

OUT = "/root/wiley-text"
WORK = "/tmp/wiley-ocr"
os.makedirs(OUT, exist_ok=True)
os.makedirs(WORK, exist_ok=True)

def log(msg):
    print(time.strftime("%H:%M:%S"), msg, flush=True)

def http_get(url, timeout=120, opener=None):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    if opener is not None:
        return opener.open(req, timeout=timeout).read()
    return urllib.request.urlopen(req, timeout=timeout).read()

def list_folder(folder_id, opener=None):
    raw = http_get("https://drive.google.com/embeddedfolderview?id=%s#list" % folder_id, opener=opener).decode("utf-8", "ignore")
    items = []
    for m in re.finditer(r'flip-entry" id="entry-([A-Za-z0-9_-]+)".*?flip-entry-title">([^<]+)<', raw, re.S):
        items.append({
            "id": m.group(1),
            "title": html.unescape(m.group(2)).strip(),
            "kind": "folder" if "/folders/" in m.group(0) else "file",
        })
    return items

def download_big(file_id, dest):
    """Large-file aware download via the virus-scan confirm form."""
    cj = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    page = http_get("https://drive.google.com/uc?export=download&id=%s" % file_id, opener=op).decode("utf-8", "ignore")
    m = re.search(r'name="uuid" value="([^"]+)"', page)
    if m:
        url = ("https://drive.usercontent.google.com/download?id=%s&export=download&confirm=t&uuid=%s"
               % (file_id, m.group(1)))
    else:
        url = "https://drive.google.com/uc?export=download&id=%s" % file_id
    r = op.open(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=1800)
    with open(dest, "wb") as fh:
        shutil.copyfileobj(r, fh, 1024 * 512)
    return os.path.getsize(dest)

def pdf_pages(pdf):
    out = subprocess.run(["pdfinfo", pdf], capture_output=True, text=True).stdout
    m = re.search(r"Pages:\s+(\d+)", out)
    return int(m.group(1)) if m else 0

def pdf_renderable(pdf):
    """Page count if pdfinfo opens the file AND the last page actually renders
    (truncated downloads can survive pdfinfo); 0 otherwise."""
    pages = pdf_pages(pdf)
    if pages == 0:
        return 0
    probe = os.path.join(WORK, "probe")
    r = subprocess.run(["pdftoppm", "-f", str(pages), "-l", str(pages),
                        "-r", "72", "-gray", "-png", pdf, probe],
                       capture_output=True)
    for f in os.listdir(WORK):
        if f.startswith("probe"):
            os.remove(os.path.join(WORK, f))
    return pages if r.returncode == 0 else 0

def download_big_validated(file_id, dest):
    """Download with retries; returns a PDF whose last page provably renders."""
    for attempt in range(3):
        size = download_big(file_id, dest)
        pages = pdf_renderable(dest)
        log("  download attempt %d: %d MB, last-page render check pages=%d" % (attempt + 1, size // 1048576, pages))
        if pages > 0:
            return pages
        log("  download invalid, retrying after 30s")
        time.sleep(30)
        if os.path.exists(dest):
            os.remove(dest)
    raise RuntimeError("download failed validation after 3 attempts")

def ocr_pdf(pdf, txt_out):
    pages = pdf_pages(pdf)
    batch = 40
    with open(txt_out, "w", encoding="utf-8") as out:
        for start in range(1, pages + 1, batch):
            end = min(pages, start + batch - 1)
            # clean only this batch's page images — never touch the source PDF
            for f in os.listdir(WORK):
                if f.startswith("pg-"):
                    os.remove(os.path.join(WORK, f))
            subprocess.run(["pdftoppm", "-f", str(start), "-l", str(end),
                            "-r", "150", "-gray", "-png", pdf, os.path.join(WORK, "pg")],
                           check=True)
            for png in sorted(os.listdir(WORK)):
                if not png.endswith(".png"):
                    continue
                base = png[:-4]
                subprocess.run(["tesseract", os.path.join(WORK, png), os.path.join(WORK, base),
                                "-l", "eng", "--psm", "6"],
                               capture_output=True)
                page_no = int(base.split("-")[-1])
                out.write("\n===== PAGE %d =====\n" % page_no)
                with open(os.path.join(WORK, base + ".txt"), encoding="utf-8", errors="ignore") as t:
                    out.write(t.read())
            out.flush()
            log("  pages %d-%d/%d done" % (start, end, pages))

def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None  # e.g. "2A"
    for part, secs in SECTIONS.items():
        for sec, (sec_folder, sec_name) in secs.items():
            if only and (part + sec) != only:
                continue
            wiley = next((c for c in list_folder(sec_folder)
                          if c["kind"] == "folder" and "wiley" in c["title"].lower()), None)
            if not wiley:
                log("Part %s Sec %s: no Wiley folder" % (part, sec))
                continue
            f = next((c for c in list_folder(wiley["id"]) if c["kind"] == "file"), None)
            if not f:
                log("Part %s Sec %s: Wiley folder empty" % (part, sec))
                continue
            tag = "p%s-%s" % (part, sec)
            txt_out = os.path.join(OUT, tag + ".txt")
            if os.path.exists(txt_out) and os.path.getsize(txt_out) > 100000:
                log("%s: already OCR'd (%d bytes), skipping" % (tag, os.path.getsize(txt_out)))
                continue
            pdf = os.path.join(WORK, tag + ".pdf")
            try:
                if not os.path.exists(pdf) or pdf_pages(pdf) == 0:
                    log("%s: downloading %s ..." % (tag, f["title"]))
                    download_big_validated(f["id"], pdf)
                log("%s: OCR %s (%s)..." % (tag, f["title"], sec_name))
                ocr_pdf(pdf, txt_out)
            except Exception as e:
                log("%s: FAILED: %s" % (tag, e))
            finally:
                if os.path.exists(pdf):
                    os.remove(pdf)
            if os.path.exists(txt_out):
                log("%s: done -> %s (%d bytes)" % (tag, txt_out, os.path.getsize(txt_out)))
    for f in os.listdir(WORK):
        os.remove(os.path.join(WORK, f))
    log("ALL DONE")

if __name__ == "__main__":
    main()
