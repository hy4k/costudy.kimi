# Render the CoStudy asset-ledger one-pager to a clean PDF for outbound use.
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

INK = HexColor("#1a2332")
ACCENT = HexColor("#0e5fd8")
MUTED = HexColor("#5b6675")
LIGHT = HexColor("#eef2f8")

styles = {
    "h1": ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=17, leading=21, textColor=INK, spaceAfter=2),
    "sub": ParagraphStyle("sub", fontName="Helvetica", fontSize=9, leading=12, textColor=MUTED, spaceAfter=10),
    "h2": ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=ACCENT, spaceBefore=10, spaceAfter=4),
    "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9.5, leading=13.5, textColor=INK, spaceAfter=6),
    "li": ParagraphStyle("li", fontName="Helvetica", fontSize=9.5, leading=13.5, textColor=INK, leftIndent=14, bulletIndent=4, spaceAfter=4),
    "cell": ParagraphStyle("cell", fontName="Helvetica", fontSize=9, leading=12, textColor=INK),
    "cellb": ParagraphStyle("cellb", fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=INK),
    "foot": ParagraphStyle("foot", fontName="Helvetica-Oblique", fontSize=8, leading=11, textColor=MUTED, spaceBefore=12),
}

doc = SimpleDocTemplate(
    "outreach-kit/asset-ledger-onepager.pdf", pagesize=letter,
    leftMargin=0.75 * inch, rightMargin=0.75 * inch, topMargin=0.65 * inch, bottomMargin=0.6 * inch,
    title="CoStudy — CBQ Platform: Asset Ledger & Audit Proof", author="CoStudy (costudy.in)",
)

E = []
E.append(Paragraph("CoStudy — CBQ Platform: Asset Ledger &amp; Audit Proof", styles["h1"]))
E.append(Paragraph("One page · Prepared 2026-11-06 · Contact: Midhun, CoStudy (costudy.in)", styles["sub"]))
E.append(HRFlowable(width="100%", thickness=1.2, color=ACCENT))

E.append(Paragraph("Who we are", styles["h2"]))
E.append(Paragraph(
    "CoStudy is a live CMA US prep platform (production at costudy.in) built around the exam's newest format. "
    "Since the September/October 2026 window, case-based questions (CBQs) are the only written-section format on "
    "English-language CMA exams worldwide. CoStudy's CBQ layer is fully interactive — drag-and-drop, numeric entry "
    "with tolerance, multi-select, and list tasks served through a production API — not static, PDF-style case sets.", styles["body"]))

E.append(Paragraph("What we operate today (all figures verifiable live)", styles["h2"]))
rows = [
    [Paragraph("Asset", styles["cellb"]), Paragraph("Scale", styles["cellb"]), Paragraph("Quality state", styles["cellb"])],
    [Paragraph("Active MCQ bank", styles["cell"]), Paragraph("<b>9,711 questions</b> (P1: 6,156 · P2: 3,555)", styles["cell"]),
     Paragraph("0 untagged · 0 duplicates · 0 scrambled rows · 100% section-mapped to ICMA CSO 2024", styles["cell"])],
    [Paragraph("Live CBQ cases", styles["cell"]), Paragraph("<b>34 cases · 238 tasks</b>", styles["cell"]),
     Paragraph("All 12 syllabus sections covered (6+6); 7 tasks per case; 5 interactive task types", styles["cell"])],
    [Paragraph("Verification pipeline", styles["cell"]), Paragraph("Mentor intake → verify/reject → automated screening", styles["cell"]),
     Paragraph("Every active item has a named human reviewer; per-item provenance log (prompt, draft, review, edits)", styles["cell"])],
    [Paragraph("Item-quality codex", styles["cell"]), Paragraph("31-rule Haladyna taxonomy, automated", styles["cell"]),
     Paragraph("Catches 20/20 injected flaw classes in test; arithmetic validation on every numeric key", styles["cell"])],
    [Paragraph("Production audit", styles["cell"]), Paragraph("Automated zero-defect drill, every Friday", styles["cell"]),
     Paragraph("Latest run: <b>PASS — 9,711 active rows, zero failures</b> (excerpt attached)", styles["cell"])],
]
t = Table(rows, colWidths=[1.45 * inch, 2.45 * inch, 2.6 * inch])
t.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
    ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#ffffff")),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, 0), 9),
    ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#c9d4e4")),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#ffffff"), LIGHT]),
    ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
]))
# header text color via paragraph styles already dark; override with white header paragraphs
rows[0] = [Paragraph("Asset", ParagraphStyle("hh", parent=styles["cellb"], textColor=HexColor("#ffffff"))),
           Paragraph("Scale", ParagraphStyle("hh2", parent=styles["cellb"], textColor=HexColor("#ffffff"))),
           Paragraph("Quality state", ParagraphStyle("hh3", parent=styles["cellb"], textColor=HexColor("#ffffff")))]
t = Table(rows, colWidths=[1.45 * inch, 2.45 * inch, 2.6 * inch])
t.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
    ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#c9d4e4")),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#ffffff"), LIGHT]),
    ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
]))
E.append(t)

E.append(Paragraph("Why this matters to a partner", styles["h2"]))
for txt in [
    "<b>The CBQ shelf is the scarcest asset in CMA prep right now.</b> The deepest published catalog (Gleim) lists 75+ "
    "case-based questions; UWorld lists 28; Becker lists 26. CoStudy's 34 live cases already sit in that league — and grow every week.",
    "<b>Our content is legally clean by construction.</b> Original authorship against the public CSO/LOS specification, human "
    "verification on every shipped item, and a provenance ledger — no per-seat-license gray zones, no copied exam material.",
    "<b>Our quality apparatus is an API, not a promise.</b> Any co-branded content can be routed through the same codex, mentor "
    "queue, and Friday audit that keeps our own bank at zero defects.",
]:
    E.append(Paragraph(txt, styles["li"], bulletText="•"))

E.append(Paragraph("What we're exploring", styles["h2"]))
E.append(Paragraph(
    "Structured conversations with select CMA content publishers about co-branded CBQ sets and/or licensing of our interactive "
    "CBQ delivery engine. We are not seeking to purchase per-seat course content. Indicative structures, a term-sheet skeleton, and "
    "our quality/audit standards are available under NDA.", styles["body"]))

E.append(HRFlowable(width="100%", thickness=0.6, color=HexColor("#c9d4e4")))
E.append(Paragraph(
    "Figures as of 2026-11-06, generated from the live production database and the Friday audit excerpt attached to this sheet. "
    "This document is a business summary for partnership discussion; it is not an offer or a binding term.", styles["foot"]))

doc.build(E)
print("PDF written")
