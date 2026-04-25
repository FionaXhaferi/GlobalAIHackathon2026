import json
import os
import re
from typing import AsyncGenerator
import anthropic
from dotenv import load_dotenv

load_dotenv()

SYSTEM_PROMPT = """You are an expert scientific consultant with 20+ years of experience at leading Contract Research Organizations (CROs) and academic institutions. You have designed hundreds of experimental protocols across molecular biology, cell biology, biochemistry, diagnostics, materials science, and environmental science.

Your task is to generate complete, operationally realistic experiment plans. The quality bar: a real Principal Investigator must trust this plan enough to order the materials.

MANDATORY REQUIREMENTS — every single one must be present or the plan fails review:

PROTOCOL STEPS — each step description MUST include ALL of:
  • Exact concentration with units (e.g. "2 mM EDC", "10 µg/mL antibody", "0.1% Triton X-100")
  • Temperature in °C (e.g. "incubate at 37°C", "centrifuge at 4°C")
  • Exact incubation/reaction time (e.g. "for 30 min", "overnight 16 h")
  • Volume in µL or mL (e.g. "add 500 µL lysis buffer", "resuspend in 50 µL nuclease-free water")

CATALOG NUMBERS — must follow real supplier format exactly:
  • Sigma-Aldrich: letter+digits (e.g. D8418, E6383-1G, A9418-5G)
  • Thermo Fisher: alphanumeric (e.g. A10632, 15596026, AM1907)
  • Promega: letter+4digits (e.g. G7791, V3671)
  • Qiagen: 6-digit number (e.g. 74104, 28104)
  • ATCC: alphanumeric (e.g. CRL-3216, CCL-2)
  • IDT: product name format (e.g. 51-01-18-04)
  • NEVER invent catalog numbers — use only real ones you are certain exist

BUDGET — MUST include:
  • A "Labor (FTE hours)" line item with realistic hours × $35–$75/hr rate
  • All major reagent costs from materials list
  • Equipment rental/core facility fees if relevant

VALIDATION — MUST include ALL of:
  • replicates field: state exact integer n= (e.g. "n=6 biological replicates, n=3 technical replicates per condition")
  • statistical_approach: name the SPECIFIC test (e.g. "Student's two-tailed t-test", "one-way ANOVA with Tukey post-hoc", "Mann-Whitney U test") AND include power calculation (e.g. "80% power at α=0.05 with effect size d=0.8 requires n=26 per group, calculated with G*Power 3.1")
  • success_criteria: quantitative thresholds (e.g. "≥2-fold increase, p<0.05")

SAFETY NOTES — each note MUST include the GHS hazard class (e.g. "GHS06 Acute Toxicity", "GHS08 Health Hazard", "GHS02 Flammable") and required PPE.

PROTOCOL REFERENCES — MUST be 2–3 real, resolvable URLs:
  • Use formats: https://www.protocols.io/view/... or https://doi.org/10.xxxx/... or https://www.ncbi.nlm.nih.gov/pubmed/...
  • Only include URLs you are highly confident exist

STRICT LENGTH LIMITS — these are hard caps, not suggestions:
- Protocol steps: max 8 steps total. Each description: max 2 sentences. Notes: max 1 sentence.
- Materials: max 12 items total. Notes field: max 8 words.
- Budget line items: max 15 items total. Notes: omit or max 5 words.
- Timeline phases: max 5 phases.
- Statistical approach: max 3 sentences (to accommodate power calculation).
- Replicates: 1 sentence.
- Each criteria/endpoint list: max 3 items, 1 sentence each.
- Safety notes: max 3 items, 1 sentence each.

CRITICAL: Respond with ONLY a valid JSON object. No preamble, no explanation, no markdown code fences. Start your response with { and end with }."""


def _build_feedback_context(feedback: list[dict]) -> str:
    if not feedback:
        return ""
    lines = ["Prior expert feedback from similar experiments (incorporate these corrections into your plan):"]
    for i, fb in enumerate(feedback, 1):
        annotation = fb.get("annotations", "").strip()
        annotation_str = f"\n   Scientist note: {annotation}" if annotation else ""
        lines.append(
            f"\n[Feedback {i} — {fb['section']} section, rating {fb['rating']}/5]\n"
            f"   Original: {fb['original_content']}\n"
            f"   Expert correction: {fb['corrected_content']}{annotation_str}"
        )
    return "\n".join(lines)


def _build_literature_context(lit: dict) -> str:
    if not lit:
        return ""
    signal = lit.get("novelty_signal", "")
    summary = lit.get("summary", "")
    refs = lit.get("references", [])
    lines = [f"Literature context (novelty signal: {signal}): {summary}"]
    for r in refs[:3]:
        lines.append(f"- Relevant prior work: {r.get('title', '')} ({r.get('year', '')})")
    return "\n".join(lines)


JSON_SCHEMA = """{
  "title": "concise experiment title",
  "summary": "2-3 sentence executive summary of the experiment",
  "experiment_tags": ["tag1", "tag2"],
  "protocol": {
    "overview": "1-2 paragraph overview of the methodology and scientific rationale",
    "steps": [
      {
        "step": 1,
        "title": "step title",
        "description": "detailed, actionable description of exactly what to do",
        "duration": "e.g. 2 hours",
        "notes": "critical notes, safety warnings, technical tips, common pitfalls"
      }
    ]
  },
  "materials": [
    {
      "name": "exact reagent/material/equipment name",
      "catalog_number": "real catalog number e.g. Sigma-Aldrich D8418",
      "supplier": "Sigma-Aldrich / Thermo Fisher / Promega / ATCC / etc.",
      "quantity": "amount needed for full experiment",
      "unit_cost": 45.00,
      "total_cost": 45.00,
      "category": "Reagents / Equipment / Consumables / Cell Lines / Antibodies / etc.",
      "notes": "storage temp, handling, hazard class"
    }
  ],
  "budget": {
    "total_usd": 12500,
    "currency": "USD",
    "categories": {
      "Reagents": 5000,
      "Equipment Rental": 2000,
      "Consumables": 1500,
      "Labor (FTE hours)": 3000,
      "Other": 1000
    },
    "line_items": [
      {
        "category": "Reagents",
        "item": "item name",
        "quantity": "amount",
        "unit_cost": 50.00,
        "total_cost": 250.00,
        "notes": "optional note"
      }
    ]
  },
  "timeline": {
    "total_duration": "X weeks",
    "total_weeks": 10,
    "phases": [
      {
        "phase": 1,
        "name": "phase name",
        "duration": "X weeks",
        "start_week": 1,
        "end_week": 2,
        "tasks": ["specific task 1", "specific task 2"],
        "dependencies": ["none" or "Phase N name"],
        "deliverables": ["concrete deliverable 1"]
      }
    ]
  },
  "validation": {
    "primary_endpoints": ["primary measurable endpoint"],
    "secondary_endpoints": ["secondary measurable endpoint"],
    "success_criteria": ["specific, quantitative success criterion"],
    "failure_criteria": ["specific, quantitative failure criterion"],
    "statistical_approach": "detailed statistical methods, sample size justification, software",
    "controls": ["positive control description", "negative control description"],
    "replicates": "n=X biological replicates, n=X technical replicates per condition"
  },
  "safety_notes": ["specific safety consideration with required PPE or handling precaution"],
  "protocol_references": ["protocols.io URL or DOI of grounding protocol"]
}"""


async def generate_plan_stream(
    question: str,
    literature_context: dict,
    feedback: list[dict],
) -> AsyncGenerator[dict, None]:

    feedback_ctx = _build_feedback_context(feedback)
    lit_ctx = _build_literature_context(literature_context)

    user_message = f"""Generate a complete experiment plan for this scientific hypothesis:

{question}

{lit_ctx}

{feedback_ctx}

Return a JSON object matching EXACTLY this structure (fill in all fields with real, accurate, specific values):
{JSON_SCHEMA}"""

    # Tell the frontend which corrections are being applied
    if feedback:
        yield {
            "type": "feedback_used",
            "count": len(feedback),
            "corrections": [
                {
                    "section": fb["section"],
                    "rating": fb["rating"],
                    "annotation": fb.get("annotations", "")[:120],
                }
                for fb in feedback
            ],
        }

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    full_text = ""

    try:
        stream_ctx = client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=32000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
    except Exception as exc:
        msg = str(exc)
        if "credit balance is too low" in msg or "billing" in msg.lower():
            yield {"type": "error", "message": "Anthropic API account has no credits. Add credits at console.anthropic.com/settings/billing."}
            return
        yield {"type": "error", "message": str(exc)}
        return

    try:
        with stream_ctx as stream:
            for text in stream.text_stream:
                full_text += text
                yield {"type": "chunk", "text": text}
    except Exception as exc:
        msg = str(exc)
        if "credit balance is too low" in msg or "billing" in msg.lower():
            yield {"type": "error", "message": "Anthropic API account has no credits. Add credits at console.anthropic.com/settings/billing."}
            return
        yield {"type": "error", "message": str(exc)}
        return

    plan = _parse_plan(full_text)
    if "error" in plan:
        print(f"[planner] JSON parse failed. Last 300 chars of response:\n{full_text[-300:]}")
    yield {"type": "done", "plan": plan}


def _parse_plan(text: str) -> dict:
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
    return {"error": "Could not parse plan", "raw": text[:2000]}
