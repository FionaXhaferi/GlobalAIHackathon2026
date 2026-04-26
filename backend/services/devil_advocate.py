import json
import os
import re
import anthropic
from dotenv import load_dotenv

load_dotenv()

SYSTEM_PROMPT = """You are a brutal but fair scientific peer reviewer — the "Devil's Advocate." Your sole job is to find real, specific flaws in AI-generated experiment plans before a scientist wastes money on them.

You attack: missing controls, underpowered statistics, wrong distributions for bounded readouts, confounded variables, unrealistic timelines, missing safety steps, catalog numbers that don't match reagents, and any other genuine scientific weakness.

Be specific — cite the exact step, value, or section. Do NOT invent flaws that aren't there. Do NOT praise. Do NOT be vague.

Respond with ONLY a valid JSON object. No preamble, no markdown. Start with { and end with }."""

CRITIQUE_SCHEMA = """{
  "critiques": [
    {
      "section": "protocol | materials | budget | timeline | validation | safety",
      "severity": "high | medium | low",
      "issue": "concise statement of the specific flaw",
      "suggestion": "one concrete fix"
    }
  ],
  "verdict": "1-2 sentence overall assessment"
}"""

def critique_plan(question: str, plan: dict) -> dict:
    plan_summary = json.dumps({
        "title": plan.get("title", ""),
        "summary": plan.get("summary", ""),
        "protocol": plan.get("protocol", {}),
        "validation": plan.get("validation", {}),
        "materials": [
            {"name": m.get("name"), "catalog_number": m.get("catalog_number"), "supplier": m.get("supplier")}
            for m in (plan.get("materials") or [])[:12]
        ],
        "budget": {"total_usd": (plan.get("budget") or {}).get("total_usd")},
        "timeline": {"total_duration": (plan.get("timeline") or {}).get("total_duration"),
                     "total_weeks": (plan.get("timeline") or {}).get("total_weeks")},
        "safety_notes": plan.get("safety_notes", []),
    }, indent=2)

    user_message = f"""Scientific hypothesis:
"{question}"

Generated experiment plan:
{plan_summary}

Attack this plan. Find 3–5 specific, real flaws. Return JSON matching this schema exactly:
{CRITIQUE_SCHEMA}"""

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    text = response.content[0].text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()
    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                pass
    return {"critiques": [], "verdict": "Could not parse critique response.", "parse_error": True}
