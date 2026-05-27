"""
CH6 Red Space Facts — Longform pipeline (Fridays only).

Generates a complete 8-15 minute space-fact video manifest using the same
7-stage pipeline as other channels. CH6 is not part of the nightly topic
pipeline, so this script generates its own topic before running the stages.

Stages (via write_scripts.generate_complete_manifest):
  1. Outline
  2. Research
  3. Full script
  4. Line breakdown
  5. Visual treatments
  6. B-roll keywords
  7. Metadata

Output: temp/manifests/ch6.json
"""

import json
import logging
import os
import time
from datetime import date
from pathlib import Path
from typing import Any, Dict

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


def generate_topic(config: Dict[str, Any]) -> Dict[str, Any]:
    from ai_client import get_client
    from write_scripts import _call_json_stage

    client = get_client()
    name = config["channel_name"]
    niche = config.get("niche", "Space science")
    audience = config.get("audience", "Science enthusiasts")
    length_min = config.get("length_minutes_min", 8)
    length_max = config.get("length_minutes_max", 15)
    word_count = config.get("word_count", 1500)
    forbidden_topics = ", ".join(config.get("forbidden_topics", []))
    forbidden_words = ", ".join(config.get("forbidden_words", []))

    system = (
        f"You are the creative director for '{name}' (niche: {niche}). "
        f"Target audience: {audience}. "
        f"Videos are {length_min}–{length_max} minutes (~{word_count} words). "
        "You create scroll-stopping, algorithm-friendly space science topics that are original and factual."
    )
    prompt = f"""Generate ONE compelling YouTube video topic for the channel '{name}'.

Niche: {niche}
Target audience: {audience}
FORBIDDEN topics: {forbidden_topics}
FORBIDDEN words in titles: {forbidden_words}

Requirements:
- Factual and verifiable from established science
- Title curiosity-driven, under 70 characters
- Unique — not a rehash of popular space YouTube videos
- Suitable for {length_min}–{length_max} minute deep-dive format

Return ONLY a valid JSON object:
{{
  "title": "video title (max 70 chars)",
  "hook": "one-sentence opening hook for the video",
  "angle": "unique perspective or framing that makes this stand out",
  "estimated_search_volume": "low | medium | high",
  "controversy_score": <integer 1-10>,
  "originality_score": <integer 1-10>
}}

Return ONLY the JSON, no extra text."""

    return _call_json_stage(
        "generate_topic",
        CHANNEL_ID,
        lambda: client.generate(prompt=prompt, system_prompt=system, max_tokens=600, temperature=0.85),
    )


def _write_github_output(key: str, value: str) -> None:
    output_file = os.environ.get("GITHUB_OUTPUT")
    if output_file:
        with open(output_file, "a", encoding="utf-8") as fh:
            fh.write(f"{key}={value}\n")


def main() -> None:
    from write_scripts import generate_complete_manifest
    from ai_client import get_client

    config_path = CONFIGS_DIR / "ch6-red-space-facts.json"
    with open(config_path, "r", encoding="utf-8") as fh:
        config = json.load(fh)
    config["_channel_id"] = CHANNEL_ID

    date_str = date.today().isoformat()
    logger.info("[ch6-longform] Starting 7-stage pipeline for %s", date_str)

    logger.info("[ch6-longform] Generating topic")
    topic = generate_topic(config)
    logger.info("[ch6-longform] Topic: %s", topic.get("title"))
    time.sleep(5)

    logger.info("[ch6-longform] Running 7-stage manifest pipeline")
    manifest = generate_complete_manifest(topic, config)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest_path = OUTPUT_DIR / "ch6.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    logger.info("[ch6-longform] Manifest saved → %s", manifest_path)

    provider = get_client().last_provider or "unknown"
    _write_github_output("ai_provider", provider)

    total_lines = manifest.get("total_lines", 0)
    total_dur = manifest.get("total_duration_seconds", 0)
    title = topic.get("title", "unknown")
    print(f"\n[CH6 Longform] Topic:    {title}")
    print(f"[CH6 Longform] Lines:    {total_lines} / ~{total_dur:.0f}s")
    print(f"[CH6 Longform] Manifest: {manifest_path}")
    print(f"[CH6 Longform] Provider: {provider}")


if __name__ == "__main__":
    main()
