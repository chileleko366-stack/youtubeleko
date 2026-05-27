"""
Generate CH6 Red Space Facts — Friday longform manifest (12–18 minutes).
Reuses the 7-stage pipeline from write_scripts.py.
"""

import json
import logging
import os
import time
from datetime import date
from pathlib import Path
from typing import Any, Dict, List

import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

from ai_client import get_client
from space_researcher import fetch_space_news
from fact_checker import verify_facts
from write_scripts import (
    generate_complete_manifest,
    _init_cloudinary,
    _upload_manifest,
)

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

CONFIGS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "configs")
CHANNEL_ID = "ch6"
LOCAL_MANIFEST = "temp/manifests/ch6.json"


def load_config() -> Dict[str, Any]:
    path = os.path.join(CONFIGS_DIR, "ch6-red-space-facts.json")
    with open(path, "r", encoding="utf-8") as fh:
        config = json.load(fh)
    config["_channel_id"] = CHANNEL_ID
    return config


def select_friday_topic(stories: List[Dict[str, Any]], config: Dict[str, Any]) -> Dict[str, Any]:
    """Ask the LLM to pick the best story for a longform deep-dive."""
    client = get_client()

    candidates = [
        {
            "index": i,
            "title": s["title"],
            "summary": s.get("summary", "")[:250],
            "source": s["source"],
        }
        for i, s in enumerate(stories[:5])
    ]

    system = "You are the creative director for 'Red Space Facts'. You select topics for deep-dive longform videos."
    prompt = f"""Pick the best story for a 12–18 minute deep-dive YouTube video.

Stories:
{json.dumps(candidates, indent=2)}

Criteria — highest value story for longform:
- Most educational depth (can fill 15 minutes with substance)
- Genuinely fascinating (not just a routine launch or press release)
- Can be explored with history, science, and wider implications
- Broad appeal — even non-space-fans would click

Return ONLY a valid JSON object:
{{
  "selected_index": <0-based integer>,
  "title": "compelling YouTube title (max 70 chars)",
  "hook": "one-sentence opening hook",
  "angle": "the unique perspective that makes this a must-watch"
}}

Return ONLY the JSON, no extra text."""

    for attempt in range(1, 3):
        try:
            raw = client.generate(prompt=prompt, system_prompt=system, max_tokens=500, temperature=0.6)
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("```", 2)[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            data = json.loads(raw.strip())
            idx = int(data.get("selected_index", 0))
            idx = max(0, min(idx, len(stories) - 1))
            story = stories[idx]
            return {
                "title": data.get("title", story["title"]),
                "hook": data.get("hook", ""),
                "angle": data.get("angle", ""),
                "story": story,
            }
        except Exception as exc:
            logger.warning("Topic selection attempt %d/2 failed: %s", attempt, exc)
            if attempt < 2:
                time.sleep(5)

    story = stories[0]
    return {"title": story["title"], "hook": "", "angle": "", "story": story}


def _write_github_output(key: str, value: str) -> None:
    output_file = os.environ.get("GITHUB_OUTPUT")
    if output_file:
        with open(output_file, "a", encoding="utf-8") as fh:
            fh.write(f"{key}={value}\n")


def main():
    _init_cloudinary()
    date_str = date.today().isoformat()
    config = load_config()

    logger.info("Fetching space news for longform topic selection...")
    stories = fetch_space_news(max_stories=10)
    if not stories:
        raise RuntimeError("No space stories found — all RSS feeds failed")

    topic = select_friday_topic(stories, config)
    logger.info("Selected topic: %s", topic["title"])

    facts_to_check = [topic["title"]]
    if topic.get("story", {}).get("summary"):
        facts_to_check.append(topic["story"]["summary"][:300])
    verified = verify_facts(facts_to_check)
    ok = sum(1 for v in verified if v.get("verdict") == "verified")
    logger.info("Fact verification: %d/%d verified", ok, len(verified))

    manifest = generate_complete_manifest(topic, config)
    url = _upload_manifest(CHANNEL_ID, manifest, date_str)

    Path("temp/manifests").mkdir(parents=True, exist_ok=True)
    with open(LOCAL_MANIFEST, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
    logger.info("Manifest written locally: %s", LOCAL_MANIFEST)

    print("\n=== CH6 LONGFORM MANIFEST ===")
    print(f"Title: {manifest['topic']['title']}")
    print(f"Cloud: {url}")

    _write_github_output("title", manifest["topic"]["title"])
    _write_github_output("manifest_url", url)


if __name__ == "__main__":
    main()
