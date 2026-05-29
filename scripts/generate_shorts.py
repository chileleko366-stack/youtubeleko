"""
Generic Shorts Generator — works for all channels (CH1-CH5).

Usage:
  python scripts/generate_shorts.py <channel_id> <index>

  channel_id: ch1 | ch2 | ch3 | ch4 | ch5
  index:      1 or 2

Generates a single 60-second short-form video manifest for the given channel,
picking a fresh topic each run via the AI fallback chain.

Output:
  temp/manifests/{channel_id}_short_{index}.json

Cloudinary path:
  automation/shorts/{date}/{channel_id}_short_{index}
"""

import json
import logging
import os
import sys
import time
from datetime import date
from pathlib import Path
from typing import Any, Dict

import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
from json_repair import repair_json

try:
    from scripts.ai_client import get_client
except ImportError:
    from ai_client import get_client

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

CONFIGS_DIR = Path(__file__).parent.parent / "configs"

CHANNEL_CONFIG_FILES = {
    "ch1": "ch1-dopamine-loop.json",
    "ch2": "ch2-financefiction.json",
    "ch3": "ch3-redacted.json",
    "ch4": "ch4-grey-matter.json",
    "ch5": "ch5-quiet-record.json",
}

COMPOSITIONS = [
    "TextReveal", "SplitScreen", "Fullscreen", "CelebrityCard",
    "StatsBanner", "Quote", "Timeline", "BulletList",
    "ImageReveal", "DataViz", "DocumentScan", "ArchiveFootage", "BrainDiagram",
]


def _init_cloudinary() -> None:
    missing = [v for v in ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET")
               if not os.environ.get(v)]
    if missing:
        raise RuntimeError(f"Missing Cloudinary secrets: {missing}")
    cloudinary.config(
        cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
        api_key=os.environ["CLOUDINARY_API_KEY"],
        api_secret=os.environ["CLOUDINARY_API_SECRET"],
        secure=True,
    )


def _llm(prompt: str, retries: int = 3) -> str:
    client = get_client()
    for attempt in range(retries):
        try:
            return client.generate(prompt, max_tokens=2000)
        except Exception as exc:
            if attempt == retries - 1:
                raise
            wait = 2 ** attempt
            logger.warning("LLM attempt %d failed: %s — retrying in %ds", attempt + 1, exc, wait)
            time.sleep(wait)
    return ""


def generate_manifest(config: Dict[str, Any], index: int) -> Dict[str, Any]:
    channel_id = config["channel_id"]
    channel_name = config["channel_name"]
    niche = config["niche"]
    audience = config["audience"]
    brand_color = config.get("brand_color", "#ffffff")
    bg_color = config.get("background_color", "#000000")
    tts_voice = config.get("tts_voice") or "en-US-GuyNeural"
    speech_rate = config.get("speech_rate") or "+0%"
    forbidden_topics = config.get("forbidden_topics", [])
    forbidden_words = config.get("forbidden_words", [])
    font_primary = config.get("visual_style", {}).get("font_primary", "Anton")
    font_secondary = config.get("visual_style", {}).get("font_secondary", "Inter")

    forbidden_str = ""
    if forbidden_topics:
        forbidden_str += f"\nForbidden topics: {', '.join(forbidden_topics)}"
    if forbidden_words:
        forbidden_str += f"\nForbidden words: {', '.join(forbidden_words)}"

    topic_prompt = f"""You are a YouTube Shorts scriptwriter for the channel "{channel_name}".
Niche: {niche}
Audience: {audience}{forbidden_str}

Generate a compelling 60-second YouTube Short topic. It must be:
- A single surprising, verifiable fact or insight from this niche
- Visually representable with stock footage or motion graphics
- Concisely explainable in 60 seconds

Return JSON only:
{{
  "title": "short hook title (under 60 chars)",
  "hook": "opening 3-second statement",
  "fact": "the core fact or insight in 1-2 sentences",
  "thumbnail_prompt": "image generation prompt for thumbnail"
}}"""

    logger.info("[%s] Generating short %d topic...", channel_id, index)
    topic_raw = _llm(topic_prompt)
    topic = json.loads(repair_json(topic_raw))
    # Pollinations sometimes wraps in a list — unwrap
    if isinstance(topic, list):
        topic = topic[0]

    script_prompt = f"""You are a YouTube Shorts scriptwriter for "{channel_name}" ({niche}).
Target audience: {audience}{forbidden_str}

Topic: {topic['title']}
Hook: {topic['hook']}
Core fact: {topic['fact']}

Write a DENSE, INFORMATIVE 60-second short script with exactly 8 lines. Each line is ~7-8 seconds of narration.
- Line 1 (line_number 1): Hook — grab attention immediately with a surprising statement or question
- Lines 2-7 (line_number 2-7): Pack in SPECIFIC facts, stats, dates, names, and insights — no filler. Each line must contain a concrete, verifiable detail relevant to the niche and audience.
- Line 8 (line_number 8): Call to action — "Follow for more {niche} facts"

Every line MUST include a "line_number" field (1 through 8).

Available motion-graphic compositions: {', '.join(COMPOSITIONS)}
Choose the most visually appropriate composition for each line's content.

Return JSON only:
{{
  "lines": [
    {{
      "line_number": 1,
      "text": "narration text with the actual fact, stat, or insight",
      "duration_seconds": 7,
      "composition": "CompositionName",
      "props": {{}}
    }}
  ],
  "metadata": {{
    "title": "YouTube title with #Shorts",
    "description": "description with hashtags",
    "tags": ["tag1", "tag2"],
    "thumbnail_prompt": "detailed image generation prompt"
  }}
}}"""

    logger.info("[%s] Generating short %d script...", channel_id, index)
    script_raw = _llm(script_prompt)
    script_data = json.loads(repair_json(script_raw))

    # Inject line_number (1-indexed) into every line if the LLM omitted it
    raw_lines = script_data.get("lines", [])
    for i, line in enumerate(raw_lines, start=1):
        if not line.get("line_number"):
            line["line_number"] = i
        # Remove any b_roll_keywords — stock footage is not used
        line.pop("b_roll_keywords", None)

    return {
        "channel_id": channel_id,
        "channel_name": channel_name,
        "short_index": index,
        "topic": topic,
        "lines": raw_lines,
        "metadata": script_data.get("metadata", {}),
        "tts_voice": tts_voice,
        "speech_rate": speech_rate,
        "brand_color": brand_color,
        "background_color": bg_color,
        "font_primary": font_primary,
        "font_secondary": font_secondary,
        "generated_at": date.today().isoformat(),
    }


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: generate_shorts.py <channel_id> <index>", file=sys.stderr)
        sys.exit(1)

    channel_id = sys.argv[1].lower()
    index = int(sys.argv[2])

    if channel_id not in CHANNEL_CONFIG_FILES:
        print(f"Unknown channel: {channel_id}. Valid: {list(CHANNEL_CONFIG_FILES)}", file=sys.stderr)
        sys.exit(1)

    config_path = CONFIGS_DIR / CHANNEL_CONFIG_FILES[channel_id]
    with open(config_path, encoding="utf-8") as fh:
        config = json.load(fh)

    manifest = generate_manifest(config, index)

    out_dir = Path("temp/manifests")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{channel_id}_short_{index}.json"
    out_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    logger.info("Manifest saved: %s", out_path)

    try:
        _init_cloudinary()
        date_str = date.today().isoformat()
        public_id = f"automation/shorts/{date_str}/{channel_id}_short_{index}"
        result = cloudinary.uploader.upload(
            str(out_path),
            public_id=public_id,
            resource_type="raw",
            overwrite=True,
        )
        logger.info("Uploaded to Cloudinary: %s", result.get("secure_url"))
    except Exception as exc:
        logger.warning("Cloudinary upload failed (non-fatal): %s", exc)


if __name__ == "__main__":
    main()
