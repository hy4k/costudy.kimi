#!/usr/bin/env python3
"""Phase 3: section-tag the untagged active Part 1 rows in question_bank.

Emits SQL for (a) calibration against already-tagged Part 1 rows and
(b) the final UPDATE that fills section for untagged rows.

Rules are ordered: first match wins. Ground truth = the 5,024 already-tagged
active Part 1 rows (Wiley/HOCK provenance with reliable section labels).
"""
import json, re

# Ordered rules: (section, [case-insensitive regex patterns]). \m \M = word boundaries.
# First match wins. Pre-block = unambiguous budget-prep compounds that must beat C/D;
# legacy 5-syllabus E (incl. IT-security controls) runs before modern-tech F,
# matching the provenance of the already-tagged rows (see calibration).
RULES = [
    # --- pre-block: Section B budget-prep compounds (before C/D rules) ---
    ("Section B", [
        r"master budget", r"cash budget", r"sales budget", r"production budget",
        r"materials budget", r"purchases budget", r"direct labor budget",
        r"budgeted production", r"budgeted sales", r"budgeted direct labor",
        r"pro forma", r"zero-based", r"bottom-up", r"top-down", r"participatory",
        r"rolling budget", r"cash disbursement", r"cash collection",
        r"budgeted cost", r"budgeted at", r"desired ending inventory",
        r"units to be produced",
    ]),
    ("Section E", [
        r"internal control", r"internal audit", r"internal auditor", r"\mcoso\M",
        r"segregation", r"\mfraud\M", r"inherent risk", r"detection risk",
        r"control risk", r"audit risk", r"whistleblow", r"misappropriation",
        r"defalcation", r"embezzle", r"compensating control", r"preventive control",
        r"detective control", r"control environment", r"risk assessment",
        r"control activities", r"safeguard", r"petty cash", r"bank reconciliation",
        r"\mvoucher", r"lines of defense", r"sarbanes", r"material weakness",
        r"significant deficiency", r"compliance audit", r"operational audit",
        r"audit committee", r"external audit", r"\mauditing\M", r"\mauditor",
        r"management override", r"collusion", r"access control", r"custody of",
        r"separation of duties", r"independent verification", r"physical safeguard",
        r"bonding of employees", r"lapping", r"kiting", r"padding",
        r"expense account abuse", r"flowchart", r"foreign corrupt practices",
        r"\mfcpa\M", r"payroll", r"revenue cycle", r"disbursement cycle",
        r"audit evidence", r"government accounting", r"\mgasb\M", r"trojan",
        r"\mvirus", r"computer security", r"systems security",
        r"grandfather-father-son", r"systems implementation", r"cross-training",
        r"unauthorized access", r"internal accounting control", r"accounting controls",
        r"control procedures", r"batch processing", r"file retention",
        r"e-commerce security", r"physical access", r"password", r"biometric",
        r"fiduciary", r"acting in good faith", r"misappropriate",
        r"enterprise risk management", r"\merm\M", r"foreign officials",
        r"bribes to foreign", r"stock count", r"physical count", r"cycle count",
        r"type of control", r"\methic", r"hedg", r"futures", r"derivative",
        r"forward contract", r"option contract", r"fraudulent", r"overstat",
        r"proxy fight", r"solicit", r"risk response", r"risk sharing",
        r"risk acceptance", r"risk avoidance", r"risk reduction",
        r"right to buy or sell", r"improperly",
    ]),
    ("Section F", [
        r"\msaas\M", r"cloud computing", r"firewall", r"encrypt", r"cybersecurity",
        r"cyber security", r"data governance", r"data warehouse", r"data analytics",
        r"big data", r"machine learning", r"artificial intelligence", r"blockchain",
        r"robotic process", r"\mrpa\M", r"systems development", r"system development",
        r"\magile\M", r"\mwaterfall\M", r"business intelligence", r"data visualization",
        r"data mining", r"master data", r"data quality", r"phishing", r"\mmalware\M",
        r"ransomware", r"disaster recovery", r"\mbackup", r"information system",
        r"\mdatabase", r"internet of things", r"\miot\M", r"off-the-shelf",
        r"enterprise resource planning", r"customer relationship management",
        r"data integrity", r"data security", r"software development", r"\mcloud\M",
        r"data entry", r"data processing", r"\merp implementation",
        r"systems analyst", r"it department", r"\mhelp desk", r"\mintranet\M",
        r"\mextranet\M", r"\me-commerce", r"\me-business",
    ]),
    ("Section C", [
        r"variance", r"transfer pric", r"balanced scorecard", r"residual income",
        r"return on investment", r"\mroi\M", r"responsibility account",
        r"responsibility center", r"cost center", r"profit center",
        r"investment center", r"standard cost", r"flexible budget",
        r"segment margin", r"economic value added", r"\meva\M", r"performance measure",
        r"performance measurement", r"performance report", r"break-even",
        r"breakeven", r"break even", r"margin of safety", r"contribution margin",
        r"operating leverage", r"sales mix", r"key performance indicator", r"\mkpi",
        r"cost of capital", r"hurdle rate",
        r"benchmark", r"decentraliz", r"controllable", r"divisional",
        r"segment reporting", r"division manager", r"segment manager",
        r"residual earnings", r"contribution approach", r"segment profitability",
        r"responsibility reporting", r"performance evaluation",
        r"pricing strateg", r"skimming", r"penetration pricing", r"\mleverage",
        r"cost of debt", r"breake\s*v?\s*en", r"unit sales",
    ]),
    ("Section D", [
        r"activity-based", r"\mabc\M", r"process cost", r"job order", r"job costing",
        r"equivalent unit", r"joint product", r"split-off", r"by-product",
        r"byproduct", r"spoilage", r"\mrework", r"\mscrap", r"high-low",
        r"theory of constraints", r"target cost", r"kaizen", r"life-cycle",
        r"absorption costing", r"variable costing", r"direct costing",
        r"throughput cost", r"backflush", r"overhead rate", r"overhead application",
        r"predetermined overhead", r"cost driver", r"cost pool", r"cost allocation",
        r"service department", r"reciprocal method", r"step-down method",
        r"underapplied", r"overapplied", r"prime cost", r"conversion cost",
        r"cost of goods manufactured", r"cost behavior", r"relevant cost",
        r"make-or-buy", r"opportunity cost", r"sunk cost", r"avoidable",
        r"differential cost", r"special order", r"process further",
        r"normal costing", r"actual costing", r"manufacturing overhead",
        r"factory overhead", r"cost estimation",
        r"curvilinear", r"step cost", r"semivariable", r"mixed cost",
        r"departmental rate", r"plant-wide", r"machine-hour", r"labor-hour",
        r"fifo method", r"weighted-average method", r"batch-level",
        r"product-sustaining", r"unit-level", r"facility-level", r"cost hierarchy",
        r"setup cost", r"cost object", r"cost assignment",
        r"indirect material", r"cost accountant", r"cost accounting",
        r"process manufacturing", r"continuous flow", r"conversion cost per",
        r"equivalent production", r"transferred-in", r"transferred in",
        r"normal loss", r"abnormal loss", r"yield loss", r"work-in-process",
        r"joint cost", r"value chain", r"just-in-time", r"\mjit", r"outsourc",
        r"core competency", r"life cycle", r"product life", r"\mvariable cost",
        r"\mfixed cost", r"period cost", r"\mproduct cost", r"cost classification",
        r"classification and behavior", r"traditional cost system",
        r"establishing a cost system", r"cost system", r"inventoriable",
        r"not relevant to a future decision", r"incurred in the past",
        r"target price", r"target return", r"desired rate of return",
        r"selling price per", r"cost-plus", r"markup", r"direct labor hour",
        r"split - off", r"additional direct labor hour",
        r"production tooling", r"recover the costs",
    ]),
    ("Section B", [
        r"\mbudget", r"forecast", r"learning curve", r"regression",
        r"exponential smoothing", r"time series", r"moving average", r"\mdelphi\M",
        r"budgetary slack", r"sensitivity analysis", r"scenario", r"\mswot",
        r"planning horizon", r"sales forecast",
        r"capital expenditure budget", r"budget committee", r"budget director",
        r"profit plan", r"annual planning", r"operating budget", r"financial budget",
        r"vision statement", r"mission statement", r"strategic management",
        r"strategy level", r"competitive strategy", r"focus strategy",
        r"cost leadership", r"differentiation strategy", r"environmental scanning",
        r"internal capability", r"tactical goal", r"tactical objective",
        r"long-term goal", r"expected monetary value", r"expected value",
        r"probability distribution", r"decision tree", r"decision making under",
        r"conditions of uncertainty", r"payoff table", r"perfect information",
        r"external analysis", r"industry analysis", r"sustainable competitive",
        r"business process improvement", r"continuous improvement", r"\mreengineering",
        r"net present value", r"\mnpv", r"internal rate of return", r"\mirr",
        r"payback", r"discounted cash flow", r"capital budgeting",
        r"capital investment", r"capital project", r"\mannuity",
        r"market share", r"market analysis", r"yield curve", r"perfect competition",
        r"price elasticity", r"\melasticity", r"demand curve", r"supply curve",
        r"\mmarginal revenue", r"microeconom", r"\moligopol", r"monopol",
        r"economic profit", r"law of diminishing",
        r"credit terms", r"payment terms", r"cash discount", r"forgo",
        r"net 30", r"compensating balance", r"lockbox", r"speculative motive",
        r"transaction motive", r"precautionary motive", r"working capital",
        r"money market", r"commercial paper",
        r"mutually exclusive", r"investment project", r"present value of the cash",
        r"operating cycle", r"cash cycle", r"current asset",
        r"credit policy", r"credit applicant", r"average collection",
        r"collection period", r"credit standards", r"credit scoring",
        r"explicit cost", r"implicit cost", r"vertical integration",
        r"treasurer", r"spin\s*-?\s*off",
    ]),
    ("Section A", [
        r"revenue recognition", r"\mifrs\M", r"\mgaap\M", r"fair value",
        r"equity method", r"treasury stock", r"impairment", r"goodwill",
        r"dividend", r"earnings per share", r"diluted", r"\mbond",
        r"statement of cash flows", r"operating activities", r"investing activities",
        r"financing activities", r"indirect method", r"amortization",
        r"intangible", r"\mpatent", r"copyright", r"trademark", r"franchise",
        r"depletion", r"sum-of-the-years", r"double-declining", r"\mlifo",
        r"\mfifo", r"lower of cost", r"net realizable", r"allowance for doubtful",
        r"bad debt", r"held-to-maturity", r"available-for-sale", r"trading securities",
        r"debt securities", r"amortized cost", r"consolidat", r"business combination",
        r"noncontrolling", r"deferred tax", r"income tax", r"effective tax rate",
        r"current ratio", r"quick ratio", r"acid-test", r"common-size",
        r"gross margin", r"\mnet income", r"restatement", r"discontinued operation",
        r"prior period adjustment", r"\maccrue", r"accrued", r"prepaid", r"unearned",
        r"contingent", r"warranty", r"\mpension", r"research and development",
        r"capital expenditure", r"revenue expenditure", r"book value",
        r"carrying value", r"salvage value", r"residual value", r"straight-line",
        r"\mlease", r"\minventory", r"raw material",
        r"finished goods", r"cost of goods sold", r"gross profit", r"operating income",
        r"pretax income", r"interest capitalization", r"materiality",
        r"going concern", r"full disclosure", r"consistency principle",
        r"monetary unit", r"historical cost", r"matching principle",
        r"revenue principle", r"expense recognition", r"accounts payable",
        r"notes payable", r"long-term debt", r"mortgage", r"installment",
        r"percentage of completion", r"completed contract", r"consignment",
        r"bill-and-hold", r"barter", r"nonmonetary", r"exchange lacks",
        r"constructive obligation", r"probable and estimable",
        r"annual report", r"interim report", r"quarterly report", r"earnings quality",
        r"off-balance sheet", r"variable interest entity", r"special purpose entity",
        r"push-down", r"purchase method", r"pooling",
        r"integrated report", r"value creation", r"six capitals",
        r"sustainab", r"social responsibility", r"stock split", r"\mpar value",
        r"shareholders.? equity", r"statement of shareholders", r"performance obligation",
        r"cash equivalent", r"write-off", r"current liability", r"long-term liability",
        r"common stock", r"preferred stock", r"paid-in capital", r"share premium",
        r"retained earnings", r"stock dividend", r"voting interest",
        r"significant influence", r"equity securities", r"share-based",
        r"declaration date", r"record date", r"payment date",
        r"other comprehensive income", r"remeasurement",
        r"quality of earnings", r"receivable turnover", r"debt to equity",
        r"debt-to-equity", r"times interest earned", r"return on assets",
        r"return on equity", r"return on sales", r"profit margin",
        r"asset turnover", r"\mturnover",
        r"capital structure", r"debt ratio", r"exchange rate", r"foreign currency",
        r"forward rate", r"spot rate", r"forward market", r"acid\s*-\s*test",
        r"financial statement analysis", r"base-year", r"base year",
        r"marketable", r"times earnings", r"value per share",
        r"monetary system", r"commercial draft", r"\mgold\b",
        r"\maccount payable", r"dupont", r"du pont",
        r"balance in accounts receivable", r"cash ratio", r"current liabilities",
        r"will (increase|decrease)",
    ]),
]

def case_expr(col="question_text"):
    parts = []
    for section, pats in RULES:
        alt = "|".join(pats)
        parts.append(f"when {col} ~* '(?i){alt}' then '{section}'")
    return "case\n  " + "\n  ".join(parts) + "\nend"

CALIBRATION_SQL = f"""select actual, predicted, count(*) n from (
  select section actual, {case_expr()} predicted
  from public.question_bank
  where is_active and part='Part 1' and section like 'Section %'
) t group by 1,2 order by 1,2;"""

UNMATCHED_SQL = f"""select left(question_text, 110) q, coalesce(nullif(topic,''),'(blank)') topic
from public.question_bank
where is_active and part='Part 1' and section like 'Section %'
  and ({case_expr()}) is null
limit 25;"""

UNTAGGED_DIST_SQL = f"""select coalesce({case_expr()}, 'UNMATCHED') predicted, count(*) n
from public.question_bank
where is_active and part='Part 1' and (section is null or section='')
group by 1 order by 2 desc;"""

UPDATE_SQL = f"""update public.question_bank set section = {case_expr()}, updated_at = now()
where is_active and part='Part 1' and (section is null or section='');"""

UNIT_MAP_SQL = """update public.question_bank set section = case
  when topic in ('Unit 1','Unit 2','Unit 3','Unit 4') then 'Section A'
  when topic in ('Unit 5','Unit 6','Unit 7','Unit 8') then 'Section D'
  when topic in ('Unit 9','Unit 10') then 'Section B'
  when topic in ('Unit 11','Unit 12') then 'Section C'
  when topic in ('Unit 13','Unit 14','Unit 15') then 'Section E'
  when topic = 'Unit 16' then 'Section F'
end, updated_at = now()
where is_active and part='Part 1' and (section is null or section='')
  and topic like 'Unit %';"""

# Unit 9 (decision analysis under uncertainty) rows already stamped Section D by the
# first pass are re-stamped to Section B per tagged-row ground truth (EMV / probability
# distribution / expected value questions are tagged B in this bank).
UNIT9_FIX_SQL = """update public.question_bank set section = 'Section B', updated_at = now()
where is_active and part='Part 1' and topic='Unit 9' and section='Section D';"""

if __name__ == "__main__":
    out = {
        "unit_map": UNIT_MAP_SQL,
        "calibration": CALIBRATION_SQL,
        "unmatched_sample": UNMATCHED_SQL,
        "untagged_distribution": UNTAGGED_DIST_SQL,
        "update": UPDATE_SQL,
    }
    with open("phase3_sql.json", "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    # sanity: patterns compile in standard regex (skip Postgres-only \m \M escapes)
    skipped = 0
    for sec, pats in RULES:
        for p in pats:
            if "\\m" in p or "\\M" in p:
                skipped += 1
                continue
            re.compile(p)
    print("python-compiled:", sum(len(p) for _, p in RULES) - skipped, "| pg-only skipped:", skipped)
    print("ok:", sum(len(p) for _, p in RULES), "patterns")
