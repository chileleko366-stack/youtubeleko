"""
CH6 Red Space Facts — Shorts pipeline.

Generates a 60-second space-fact Short manifest in 4 steps:
  1. Topic:    one verifiable, mind-expanding space fact
  2. Script:   ~150-word punchy narration
  3. Lines:    timed breakdown for video assembly
  4. Metadata: YouTube Shorts title, description, tags

Output: temp/manifests/ch6_short.json
"""

import json
import logging
import os
import time
from datetime import date
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

CONFIGS_DIR = Path(__file__).parent.parent / "configs"
OUTPUT_DIR = Path("temp/manifests")
CHANNEL_ID = "ch6"
CHANNEL_NAME = "RED SPACE FACTS"


def _clean_json(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) >= 3 else parts[-1]
        if raw.startswith("json"):
            raw = raw[4:]
    return raw.strip()


def _call_json(label: str, call_fn, max_retries: int = 3) -> Any:
    from json_repair import repair_json

    last_err: Exception = RuntimeError("no attempts made")
    for attempt in range(1, max_retries + 1):
        if attempt > 1:
            time.sleep(attempt * 5)
        try:
            raw = call_fn()
            cleaned = _clean_json(raw)
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError:
                repaired = repair_json(cleaned, return_objects=False)
                if repaired:
                    return json.loads(repaired)
                raise json.JSONDecodeError("parse failed", cleaned, 0)
        except Exception as exc:
            last_err = exc
            logger.warning("[ch6-shorts] %s error on attempt %d: %s", label, attempt, exc)
    raise RuntimeError(f"[ch6-shorts] {label} failed after {max_retries} attempts: {last_err}")


def generate_topic(config: Dict[str, Any]) -> Dict[str, Any]:
    from ai_client import get_client

    client = get_client()
    niche = config.get("niche", "Space science")
    forbidden_topics = ", ".join(config.get("forbidden_topics", []))
    forbidden_words = ", ".join(config.get("forbidden_words", []))

    system = (
        f"You are the creative director for '{CHANNEL_NAME}', a YouTube Shorts channel "
        f"covering {niche}. You find real, verifiable cosmic facts that sound impossible "
        "but are completely true. Every fact must come from established science."
    )
    prompt = f"""Generate ONE compelling YouTube Shorts topic for a space facts channel.

FORBIDDEN topics: {forbidden_topics}
FORBIDDEN words in titles: {forbidden_words}

Requirements:
- Scientifically accurate and verifiable
- Title must sound impossible but be completely true (max 60 chars)
- Suitable for a 60-second vertical Short

Return ONLY a valid JSON object:
{{
  "title": "the Short title (max 60 chars)",
  "hook": "the opening sentence that stops the scroll",
  "fact": "the core space fact in one sentence",
  "angle": "what makes this surprising or counterintuitive",
  "source_type": "type of scientific source (e.g. NASA study, ESA data, peer-reviewed journal)"
}}

Return ONLY the JSON, no extra text."""

    return _call_json(
        "generate_topic",
        lambda: client.generate(prompt=prompt, system_prompt=system, max_tokens=600, temperature=0.85),
    )


def generate_script(topic: Dict[str, Any], config: Dict[str, Any]) -> str:
    from ai_client import get_client

    client = get_client()
    forbidden_words = ", ".join(config.get("forbidden_words", []))

    system = (
        f"You are the scriptwriter for '{CHANNEL_NAME}' YouTube Shorts. "
        "You write punchy, fast-paced 60-second scripts that keep viewers watching to the end."
    )
    prompt = f"""Write a 60-second YouTube Shorts script for this space fact:

Title: {topic['title']}
Hook: {topic['hook']}
Fact: {topic['fact']}
Angle: {topic['angle']}

Requirements:
- Exactly ~150 words (60 seconds at 150 wpm)
- Begin immediately with the hook — no intro or channel name
- Short sentences, max 15 words each
- Build tension toward the mind-expanding conclusion
- End with: "Follow for more space facts."
- FORBIDDEN words: {forbidden_words}
- Write in second person ("you") for engagement

Return ONLY the plain script text. No JSON, no headers — just the script."""

    return client.generate(prompt=prompt, system_prompt=system, max_tokens=700, temperature=0.75).strip()


def generate_lines(script: str) -> List[Dict[str, Any]]:
    from ai_client import get_client

    client = get_client()

    system = "You are a video timing director for a space documentary channel. Break scripts into timed segments with visual direction."
    prompt = f"""Break this 60-second space facts script into timed lines for a YouTube Short:

{script}

Rules:
- Each line: 5-15 words, one thought or breath unit
- Duration in seconds based on 150 wpm speaking pace
- Total must add up to 55-65 seconds
- Type: narration | title_card | pause
- b_roll_keywords: 3 specific Pexels search terms for space stock footage matching the line (e.g. "saturn rings space", "nebula stars galaxy", "black hole space")
- scene_type: best Remotion fallback scene if no footage found — one of: stars | planet | nebula | galaxy | solar | blackhole

Return ONLY a valid JSON array:
[
  {{
    "line_number": 1,
    "text": "line text here",
    "type": "narration",
    "duration_seconds": 4.0,
    "cumulative_seconds": 4.0,
    "b_roll_keywords": ["saturn rings space", "gas giant planet", "outer planets"],
    "scene_type": "planet"
  }}
]

Return ONLY the JSON array, no extra text."""

    result = _call_json(
        "generate_lines",
        lambda: client.generate(prompt=prompt, system_prompt=system, max_tokens=2000, temperature=0.3),
    )

    # Guard: _call_json should return a list; if a dict came back (e.g. wrapped response),
    # try to find the list inside it before failing.
    if isinstance(result, dict):
        for key in ("lines", "breakdown", "content", "data"):
            val = result.get(key)
            if isinstance(val, list):
                return val
            if isinstance(val, str):
                try:
                    parsed = json.loads(val)
                    if isinstance(parsed, list):
                        return parsed
                except json.JSONDecodeError:
                    pass
        raise ValueError(f"generate_lines: expected JSON array, got dict with keys {list(result.keys())}")

    if not isinstance(result, list):
        raise ValueError(f"generate_lines: expected JSON array, got {type(result).__name__}")

    return result


def generate_metadata(topic: Dict[str, Any], script: str) -> Dict[str, Any]:
    from ai_client import get_client

    client = get_client()

    system = f"You are the SEO specialist for '{CHANNEL_NAME}' YouTube Shorts."
    prompt = f"""Create YouTube Shorts upload metadata:

Topic title: {topic['title']}
Script excerpt: {script[:300]}

Return ONLY a valid JSON object:
{{
  "title": "YouTube title max 60 chars — append #Shorts at the end",
  "description": "50-100 word description with 5+ relevant hashtags",
  "tags": ["space", "spacefacts", "shorts", "astronomy", "...up to 15 tags"]
}}

Return ONLY the JSON, no extra text."""

    return _call_json(
        "generate_metadata",
        lambda: client.generate(prompt=prompt, system_prompt=system, max_tokens=600, temperature=0.6),
    )


def _write_github_output(key: str, value: str) -> None:
    output_file = os.environ.get("GITHUB_OUTPUT")
    if output_file:
        with open(output_file, "a", encoding="utf-8") as fh:
            fh.write(f"{key}={value}\n")


def main() -> None:
    config_path = CONFIGS_DIR / "ch6-red-space-facts.json"
    with open(config_path, "r", encoding="utf-8") as fh:
        config = json.load(fh)

    date_str = date.today().isoformat()
    logger.info("[ch6-shorts] Generating Short for %s", date_str)

    logger.info("[ch6-shorts] Step 1 — Topic")
    topic = generate_topic(config)
    logger.info("[ch6-shorts] Topic: %s", topic.get("title"))
    time.sleep(3)

    logger.info("[ch6-shorts] Step 2 — Script")
    script = generate_script(topic, config)
    logger.info("[ch6-shorts] Script: %d words", len(script.split()))
    time.sleep(3)

    logger.info("[ch6-shorts] Step 3 — Line breakdown")
    lines = generate_lines(script)
    logger.info("[ch6-shorts] %d lines", len(lines))
    time.sleep(3)

    logger.info("[ch6-shorts] Step 4 — Metadata")
    metadata = generate_metadata(topic, script)

    total_duration = sum(ln.get("duration_seconds", 0) for ln in lines)

    manifest = {
        "channel_id": CHANNEL_ID,
        "channel_name": CHANNEL_NAME,
        "content_type": "short",
        "date": date_str,
        "topic": topic,
        "script": script,
        "lines": lines,
        "metadata": metadata,
        "total_duration_seconds": round(total_duration, 1),
        "total_lines": len(lines),
        "pipeline_version": "1.0.0",
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest_path = OUTPUT_DIR / "ch6_short.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    logger.info("[ch6-shorts] Manifest saved → %s", manifest_path)

    from ai_client import get_client

    provider = get_client().last_provider or "unknown"
    _write_github_output("ai_provider", provider)

    print(f"\n[CH6 Shorts] Topic:    {topic.get('title')}")
    print(f"[CH6 Shorts] Script:   {len(script.split())} words / ~{total_duration:.0f}s")
    print(f"[CH6 Shorts] Lines:    {len(lines)}")
    print(f"[CH6 Shorts] Manifest: {manifest_path}")
    print(f"[CH6 Shorts] Provider: {provider}")


if __name__ == "__main__":
    main()
