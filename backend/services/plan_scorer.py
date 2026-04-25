import json
import os
import re
import anthropic
from dotenv import load_dotenv

load_dotenv()

_WEIGHTS = {
    "protocol_completeness": 0.25,
    "reagent_availability":  0.20,
    "budget_realism":        0.15,
    "statistical_power":     0.20,
    "safety_coverage":       0.10,
    "citation_density":      0.10,
}

SCORER_SYSTEM = """You are a rigorous scientific quality auditor. You evaluate AI-generated experiment plans against professional CRO standards. Your job: would a real Principal Investigator trust this plan enough to order the materials?

You will receive BOTH a programmatic pre-check report (objective, always correct) AND the full plan. The pre-check results are ground truth — do not contradict them. Use the plan text to judge qualitative aspects (cost realism, citation quality, vagueness) that code cannot check."""


# ── Programmatic pre-checks ───────────────────────────────────────────────────

def _precheck(plan: dict) -> dict:
    """
    Objective, code-level checks that don't depend on Claude's judgment.
    Returns a structured report used to anchor the Claude scoring prompt.
    """
    checks = {}

    # ── Protocol completeness ────────────────────────────────────────────────
    steps = (plan.get("protocol") or {}).get("steps") or []
    step_issues = []
    for s in steps:
        desc = (s.get("description") or "") + " " + (s.get("notes") or "")
        num = s.get("step", "?")
        if not re.search(r'\d+\s*°C', desc):
            step_issues.append(f"step {num}: no temperature (°C)")
        if not re.search(r'\d+\s*(min|hour|h\b|s\b|sec|day|week)', desc, re.IGNORECASE):
            step_issues.append(f"step {num}: no time")
        if not re.search(r'\d+\.?\d*\s*(µL|uL|mL|L\b|mg|µg|ug|ng|mM|µM|uM|nM|%)', desc, re.IGNORECASE):
            step_issues.append(f"step {num}: no concentration or volume")
    checks["protocol_step_issues"] = step_issues
    checks["protocol_steps_total"] = len(steps)
    checks["protocol_steps_complete"] = len(steps) - len(step_issues)

    # ── Reagent availability ─────────────────────────────────────────────────
    materials = plan.get("materials") or []
    missing_catalog = [m.get("name", "?") for m in materials if not m.get("catalog_number")]
    # Detect obviously fake catalog numbers (too short, all zeros, placeholder text)
    fake_catalog = []
    for m in materials:
        cat = str(m.get("catalog_number") or "")
        if cat and (len(cat) < 3 or cat.lower() in {"n/a", "na", "tbd", "xxx", "000000"}):
            fake_catalog.append(m.get("name", "?"))
    checks["missing_catalog"] = missing_catalog
    checks["fake_catalog"] = fake_catalog
    checks["materials_total"] = len(materials)

    # ── Budget realism ───────────────────────────────────────────────────────
    line_items = (plan.get("budget") or {}).get("line_items") or []
    categories = (plan.get("budget") or {}).get("categories") or {}
    labor_present = any(
        "labor" in (item.get("category") or "").lower() or
        "labor" in (item.get("item") or "").lower()
        for item in line_items
    ) or any("labor" in k.lower() for k in categories)
    checks["labor_line_present"] = labor_present
    checks["budget_total_usd"] = (plan.get("budget") or {}).get("total_usd", 0)
    checks["budget_line_items_count"] = len(line_items)

    # ── Statistical power ────────────────────────────────────────────────────
    validation = plan.get("validation") or {}
    replicates_str = str(validation.get("replicates") or "")
    stat_approach = str(validation.get("statistical_approach") or "")

    n_match = re.search(r'n\s*=\s*(\d+)', replicates_str, re.IGNORECASE)
    checks["replicates_n_stated"] = bool(n_match)
    checks["replicates_n_value"] = int(n_match.group(1)) if n_match else None

    stat_tests = ["t-test", "t test", "anova", "mann-whitney", "wilcoxon", "chi-square",
                  "kruskal", "fisher", "pearson", "spearman", "regression", "mixed model"]
    checks["named_statistical_test"] = any(t in stat_approach.lower() for t in stat_tests)
    checks["stat_test_found"] = next((t for t in stat_tests if t in stat_approach.lower()), None)

    power_keywords = ["power", "effect size", "g*power", "gpower", "α=", "alpha=", "β=", "beta="]
    checks["power_calculation_present"] = any(k in stat_approach.lower() for k in power_keywords)

    bio_tech = bool(
        re.search(r'biological\s+replicat', replicates_str, re.IGNORECASE) and
        re.search(r'technical\s+replicat', replicates_str, re.IGNORECASE)
    )
    checks["bio_tech_distinction"] = bio_tech

    # ── Safety coverage ──────────────────────────────────────────────────────
    safety_notes = plan.get("safety_notes") or []
    ghs_present = [bool(re.search(r'GHS\d{2}', note)) for note in safety_notes]
    ppe_present = [bool(re.search(r'glove|goggle|PPE|fume\s*hood|respirator|lab\s*coat', note, re.IGNORECASE))
                  for note in safety_notes]
    checks["safety_notes_count"] = len(safety_notes)
    checks["safety_ghs_count"] = sum(ghs_present)
    checks["safety_ppe_count"] = sum(ppe_present)

    # ── Citation density ─────────────────────────────────────────────────────
    refs = plan.get("protocol_references") or []
    real_urls = [r for r in refs if re.search(r'https?://', str(r))]
    doi_refs = [r for r in refs if re.search(r'doi\.org|10\.\d{4}', str(r))]
    checks["protocol_references_total"] = len(refs)
    checks["protocol_references_real_urls"] = len(real_urls)
    checks["protocol_references_dois"] = len(doi_refs)

    return checks


def _format_precheck(checks: dict) -> str:
    lines = ["=== PROGRAMMATIC PRE-CHECK RESULTS (objective, ground truth) ===\n"]

    # Protocol
    lines.append(f"PROTOCOL COMPLETENESS:")
    lines.append(f"  Steps: {checks['protocol_steps_complete']}/{checks['protocol_steps_total']} fully specified")
    if checks["protocol_step_issues"]:
        for issue in checks["protocol_step_issues"]:
            lines.append(f"  ✗ {issue}")
    else:
        lines.append("  ✓ All steps have temperature, time, and concentration/volume")

    # Reagents
    lines.append(f"\nREAGENT AVAILABILITY:")
    lines.append(f"  Materials: {checks['materials_total']} total")
    if checks["missing_catalog"]:
        lines.append(f"  ✗ Missing catalog numbers: {', '.join(checks['missing_catalog'])}")
    else:
        lines.append("  ✓ All materials have catalog numbers")
    if checks["fake_catalog"]:
        lines.append(f"  ✗ Suspicious/placeholder catalog numbers: {', '.join(checks['fake_catalog'])}")

    # Budget
    lines.append(f"\nBUDGET REALISM:")
    total = checks['budget_total_usd'] or 0
    lines.append(f"  Total: ${int(total):,} | Line items: {checks['budget_line_items_count']}")
    lines.append(f"  Labor line: {'✓ present' if checks['labor_line_present'] else '✗ MISSING'}")

    # Statistical power
    lines.append(f"\nSTATISTICAL POWER:")
    lines.append(f"  n= stated: {'✓ n=' + str(checks['replicates_n_value']) if checks['replicates_n_stated'] else '✗ MISSING'}")
    lines.append(f"  Named test: {'✓ ' + str(checks['stat_test_found']) if checks['named_statistical_test'] else '✗ MISSING'}")
    lines.append(f"  Power calculation: {'✓ present' if checks['power_calculation_present'] else '✗ MISSING'}")
    lines.append(f"  Bio/tech distinction: {'✓ present' if checks['bio_tech_distinction'] else '✗ MISSING'}")

    # Safety
    lines.append(f"\nSAFETY COVERAGE:")
    lines.append(f"  Notes: {checks['safety_notes_count']} total")
    lines.append(f"  GHS codes: {checks['safety_ghs_count']}/{checks['safety_notes_count']}")
    lines.append(f"  PPE mentioned: {checks['safety_ppe_count']}/{checks['safety_notes_count']}")

    # Citations
    lines.append(f"\nCITATION DENSITY:")
    lines.append(f"  References: {checks['protocol_references_total']} total, "
                 f"{checks['protocol_references_real_urls']} real URLs, "
                 f"{checks['protocol_references_dois']} DOIs")

    return "\n".join(lines)


# ── Scoring prompt ────────────────────────────────────────────────────────────

def _build_prompt(question: str, plan: dict, precheck: dict) -> str:
    precheck_str = _format_precheck(precheck)

    # Send full plan but extract only the sections relevant to qualitative scoring
    # (skip large arrays that don't add scoring signal once pre-checked)
    scoring_plan = {
        "title": plan.get("title"),
        "protocol": {
            "overview": (plan.get("protocol") or {}).get("overview"),
            "steps": (plan.get("protocol") or {}).get("steps"),
        },
        "materials": plan.get("materials"),
        "budget": plan.get("budget"),
        "validation": plan.get("validation"),
        "safety_notes": plan.get("safety_notes"),
        "protocol_references": plan.get("protocol_references"),
    }
    plan_str = json.dumps(scoring_plan, indent=2)

    return f"""Score this experiment plan. The pre-check below contains OBJECTIVE FACTS — do not contradict them.

HYPOTHESIS:
{question}

{precheck_str}

FULL PLAN (for qualitative judgment — cost realism, citation quality, instruction clarity):
{plan_str}

─── SCORING RUBRIC ────────────────────────────────────────────────────────────

1. PROTOCOL_COMPLETENESS (weight 25%)
   Start from the pre-check: deduct 10 pts per step with missing temp/time/concentration.
   Additional deductions: vague instructions ("mix well", "wash") −8 pts, missing controls −10 pts.

2. REAGENT_AVAILABILITY (weight 20%)
   Start from the pre-check: deduct 10 pts per missing catalog number, 15 pts per fake/placeholder.
   Also judge: are suppliers real major ones? Are catalog number formats plausible?

3. BUDGET_REALISM (weight 15%)
   Pre-check tells you if labor is missing (−10 pts if so).
   Also judge: do costs match 2024–2025 market prices? Flag gross underestimates.

4. STATISTICAL_POWER (weight 20%)
   Pre-check tells you exactly what's present/missing. Apply these deductions:
   no n= stated −40 pts, no named test −20 pts, no power calculation −20 pts, no bio/tech distinction −10 pts.

5. SAFETY_COVERAGE (weight 10%)
   Pre-check gives GHS and PPE counts. Deduct 25 pts per hazardous reagent with no safety note,
   15 pts if PPE absent, 10 pts if no disposal guidance.

6. CITATION_DENSITY (weight 10%)
   Pre-check gives reference counts. 0 real URLs = max 15 pts; each real URL +15 pts (cap 100).

─── OUTPUT FORMAT ─────────────────────────────────────────────────────────────

Return ONLY valid JSON (no preamble, no fences):
{{
  "overall": <integer 0-100>,
  "sub_scores": {{
    "protocol_completeness": {{ "score": <0-100>, "label": "Protocol Completeness", "icon": "🔬", "feedback": "cite specific steps or issues from pre-check" }},
    "reagent_availability":  {{ "score": <0-100>, "label": "Reagent Availability",  "icon": "🧪", "feedback": "..." }},
    "budget_realism":        {{ "score": <0-100>, "label": "Budget Realism",        "icon": "💰", "feedback": "..." }},
    "statistical_power":     {{ "score": <0-100>, "label": "Statistical Power",     "icon": "📊", "feedback": "..." }},
    "safety_coverage":       {{ "score": <0-100>, "label": "Safety Coverage",       "icon": "🛡️", "feedback": "..." }},
    "citation_density":      {{ "score": <0-100>, "label": "Citation Density",      "icon": "📚", "feedback": "..." }}
  }},
  "verdict": "one sentence: would a PI trust this plan enough to order materials?",
  "top_issues": ["most critical gap 1 — be specific, quote the missing value", "most critical gap 2"]
}}"""


# ── JSON extraction ───────────────────────────────────────────────────────────

def _extract_json(text: str) -> dict:
    text = text.strip()
    try:
        return json.loads(text)
    except Exception:
        pass
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    raise ValueError("Could not parse scoring response as JSON")


# ── Main entry point ──────────────────────────────────────────────────────────

def score_plan(question: str, plan: dict) -> dict:
    precheck = _precheck(plan)
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    prompt = _build_prompt(question, plan, precheck)

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=SCORER_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text
    result = _extract_json(raw)

    # Recompute overall from sub-scores — never trust Claude's self-reported overall
    if "sub_scores" in result:
        computed = 0.0
        for key, weight in _WEIGHTS.items():
            s = result["sub_scores"].get(key, {}).get("score", 0)
            computed += s * weight
        result["overall"] = round(computed)

    # Attach pre-check for debugging / future use
    result["_precheck"] = precheck

    return result
