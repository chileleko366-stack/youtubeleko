"""
LLM-based fact checker for space/astronomy claims.
"""

import json
import logging
import time
from typing import Any, Dict, List

from ai_client import get_client

logger = logging.getLogger(__name__)


def verify_facts(facts: List[str], context: str = "") -> List[Dict[str, Any]]:
    """
    Verify a list of factual claims using the LLM cascade.

    Returns list of dicts: {fact, verdict, confidence, note}
    verdict is one of: "verified", "unverified", "false"
    """
    if not facts:
        return []

    client = get_client()
    facts_json = json.dumps(facts, indent=2)

    system = (
        "You are a science fact-checker specialising in astronomy, astrophysics, and space exploration. "
        "Evaluate claims for scientific accuracy. Only mark as 'verified' what is well-established science. "
        "Mark speculative or unverifiable claims as 'unverified'. Mark demonstrably wrong claims as 'false'."
    )

    ctx_note = f"\nContext: {context[:400]}" if context else ""
    prompt = f"""Verify each of the following space/astronomy claims:{ctx_note}

Facts to check:
{facts_json}

Return ONLY a valid JSON array. Each object must have:
{{
  "fact": "the original claim string",
  "verdict": "verified | unverified | false",
  "confidence": <float 0.0-1.0>,
  "note": "brief explanation or correction if needed (max 100 chars)"
}}

Return ONLY the JSON array, no extra text."""

    last_err: Exception = Exception("no attempts")
    for attempt in range(1, 4):
        if attempt > 1:
            time.sleep(attempt * 4)
        try:
            raw = client.generate(prompt=prompt, system_prompt=system, max_tokens=2000, temperature=0.1)
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("```", 2)[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            results = json.loads(raw.strip())
            if isinstance(results, list):
                logger.info("Fact-checked %d claims: %s", len(results), [r.get("verdict") for r in results])
                return results
            raise ValueError(f"Expected list, got {type(results)}")
        except Exception as exc:
            last_err = exc
            logger.warning("Fact check attempt %d/3 failed: %s", attempt, exc)

    logger.error("Fact checking failed after 3 attempts: %s", last_err)
    return [
        {"fact": f, "verdict": "unverified", "confidence": 0.5, "note": "automated verification unavailable"}
        for f in facts
    ]
