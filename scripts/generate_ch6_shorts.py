"""
CH6 (RED SPACE FACTS) — Shorts Generator

Generates 2 unique space-fact short-form video manifests per run.
No pre-staged topics required — topics are generated fresh each run.

Output:
  temp/manifests/ch6_short_1.json
  temp/manifests/ch6_short_2.json

Cloudinary paths:
  automation/shorts/{date}/ch6_short_1
  automation/shorts/{date}/ch6_short_2
"""

import json
import logging
import os
import sys
import time
from datetime import date
from pathlib import Path
from typing import Any, Dict, List

import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
from json_repair import repair_json

# Support both package import and direct execution
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

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT_DIR / "configs" / "ch6-red-space-facts.json"
MANIFESTS_DIR = ROOT_DIR / "temp" / "manifests"

MAX_RETRIES = 3
RETRY_DELAY = 5.0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _init_cloudinary() -> None:
    cloudinary.config(
        cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
        api_key=os.environ["CLOUDINARY_API_KEY"],
        api_secret=os.environ["CLOUDINARY_API_SECRET"],
        secure=True,
    )


def _load_config() -> Dict[str, Any]:
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _call_llm(prompt: str, system: str = "") -> str:
    """Call LLM with retries using the ai_client fallback chain."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            client = get_client()
            return client.generate(prompt, system_prompt=system, max_tokens=4096, temperature=0.85)
        except Exception as exc:
            logger.warning("LLM attempt %d/%d failed: %s", attempt, MAX_RETRIES, exc)
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY * attempt)
            else:
                raise


def _parse_json(raw: str) -> Any:
    """Extract and repair JSON from LLM output."""
    # Strip markdown fences if present
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return json.loads(repair_json(raw))


# ---------------------------------------------------------------------------
# Stage 1 — Generate 2 unique topics
# ---------------------------------------------------------------------------

def generate_topics(cfg: Dict[str, Any]) -> List[Dict[str, str]]:
    """Ask the LLM for 2 distinct short-form space fact topics."""
    topic_list = cfg["content_strategy"]["topics"]["recurring"]
    forbidden_words = cfg.get("forbidden_words", [])
    forbidden_topics = cfg.get("forbidden_topics", [])

    system = (
        "You are a science content strategist for a YouTube Shorts channel about space and astrophysics. "
        "You produce concise, accurate, visually-driven fact topics for 60-second shorts."
    )

    prompt = f"""Generate exactly 2 DISTINCT short-form video topics for a YouTube Shorts space channel.

CHANNEL: {cfg['channel_name']}
AUDIENCE: {cfg['audience']}

REQUIREMENTS FOR EACH TOPIC:
1. Must be a single verifiable scientific fact (no opinions or speculation)
2. Must be visually representable with space footage or mograph animation
3. Must be concisely explainable in 60 seconds
4. Must come from one of these topic areas: {json.dumps(topic_list)}
5. Each topic must cover a DIFFERENT topic area — no repeats
6. The fact must be genuinely surprising but scientifically accurate
7. Avoid these words in all output: {json.dumps(forbidden_words)}
8. Avoid these subjects entirely: {json.dumps(forbidden_topics)}

Return ONLY a JSON array of exactly 2 objects, each with:
{{
  "title": "Short punchy title for the Short (max 8 words)",
  "hook": "Opening sentence that grabs attention immediately (1 sentence, present tense, no forbidden words)",
  "fact": "The core scientific fact being explained (2-3 sentences, precise, citable)"
}}

No markdown. No explanation. Just the JSON array."""

    logger.info("Generating 2 short-form topics for CH6...")
    raw = _call_llm(prompt, system=system)
    topics = _parse_json(raw)

    # Unwrap {"topics": [...]} or {"data": [...]} envelope
    if isinstance(topics, dict):
        topics = (topics.get("topics") or topics.get("data")
                  or topics.get("items") or [topics])

    # Ensure it's a list
    if not isinstance(topics, list):
        topics = [topics]

    # Filter out items that don't look like topics (no title/hook/fact)
    topics = [t for t in topics if isinstance(t, dict) and t.get("title")]

    # If we got fewer than 2, generate a second one with a fresh call
    if len(topics) < 2:
        logger.warning("Only got %d topic(s) — requesting second topic separately", len(topics))
        extra_raw = _call_llm(prompt, system=system)
        extra = _parse_json(extra_raw)
        if isinstance(extra, dict):
            extra = (extra.get("topics") or extra.get("data") or [extra])
        if isinstance(extra, list):
            topics.extend([t for t in extra if isinstance(t, dict) and t.get("title")])

    if not topics:
        raise ValueError("Failed to generate any topics")

    logger.info("Topics generated: %s | %s",
                topics[0].get("title", "?"),
                topics[1].get("title", "?") if len(topics) > 1 else "single")
    return topics[:2]


# ---------------------------------------------------------------------------
# Stage 2 — Generate short manifest for a single topic
# ---------------------------------------------------------------------------

def generate_short_manifest(
    topic: Dict[str, str],
    cfg: Dict[str, Any],
    short_index: int,
) -> Dict[str, Any]:
    """Generate a full 60-second short manifest for one topic."""
    compositions = cfg["mograph_compositions"]
    forbidden_words = cfg.get("forbidden_words", [])

    system = (
        "You are a video producer for a cinematic YouTube Shorts channel about space science. "
        "You write tight, punchy narration scripts optimised for 60-second vertical video."
    )

    prompt = f"""Create a full production manifest for a 60-second YouTube Short.

CHANNEL: {cfg['channel_name']}
BRAND COLOR: {cfg['brand_color']}
VISUAL AESTHETIC: {cfg['visual_style']['aesthetic']}

TOPIC:
  Title: {topic['title']}
  Hook: {topic['hook']}
  Fact: {topic['fact']}

STRUCTURE (must follow exactly):
  - hook (0-3s): grabbing opening statement
  - body (3-57s): explain the fact with visual moments (~7 lines)
  - CTA (57-60s): subscribe / follow prompt

SCRIPT RULES:
  - Total narration: ~130 words (matches 60s at 130 wpm with -5% speech rate)
  - Each line: 7-8 seconds of narration at 130 wpm (~15-17 words)
  - Exactly 8 lines total (including hook line and CTA line)
  - Avoid these words: {json.dumps(forbidden_words)}
  - Present tense, active voice, second-person where appropriate
  - Scientific accuracy is mandatory

AVAILABLE MOGRAPH COMPOSITIONS (pick the most fitting for each line):
{json.dumps(compositions, indent=2)}

Return ONLY a JSON object with this exact structure:
{{
  "lines": [
    {{
      "line_number": 1,
      "text": "narration text for this line",
      "duration_seconds": 7,
      "composition": "CompositionName",
      "props": {{}}
    }}
    // ... 8 lines total
  ],
  "metadata": {{
    "title": "YouTube Shorts title (max 60 chars, no forbidden words)",
    "description": "2-3 sentence description with relevant hashtags",
    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"],
    "thumbnail_prompt": "Detailed image generation prompt for thumbnail: deep space backdrop, bold red text overlay, cinematic grade"
  }}
}}

No markdown. No explanation. Just the JSON object."""

    logger.info("Generating manifest for short %d: %s", short_index, topic["title"])
    raw = _call_llm(prompt, system=system)
    manifest_core = _parse_json(raw)

    # Unwrap Pollinations envelope {"role":..., "content":...} if present
    if isinstance(manifest_core, dict) and "role" in manifest_core and "content" in manifest_core:
        inner = manifest_core["content"]
        if isinstance(inner, str):
            manifest_core = _parse_json(inner)
        elif isinstance(inner, list):
            # Content is a list of blocks — join text blocks
            text = " ".join(c.get("text", "") if isinstance(c, dict) else str(c) for c in inner)
            manifest_core = _parse_json(text)

    # Validate lines — retry once if empty
    lines = manifest_core.get("lines", [])
    if not lines:
        logger.warning("No lines in LLM response for short %d — raw (first 500): %s", short_index, raw[:500])
        logger.warning("Retrying script generation...")
        raw2 = _call_llm(prompt, system=system)
        manifest_core = _parse_json(raw2)
        if isinstance(manifest_core, dict) and "role" in manifest_core and "content" in manifest_core:
            inner = manifest_core.get("content", "")
            manifest_core = _parse_json(inner) if isinstance(inner, str) else manifest_core
        lines = manifest_core.get("lines", [])
        if not lines:
            raise ValueError(
                f"LLM returned no lines for short {short_index} after retry. "
                f"Raw response: {raw2[:500]}"
            )

    if len(lines) != 8:
        logger.warning("Expected 8 lines, got %d for short %d.", len(lines), short_index)

    # Inject line_number if LLM omitted it; strip b_roll_keywords
    for i, line in enumerate(lines, start=1):
        if not line.get("line_number"):
            line["line_number"] = i
        line.pop("b_roll_keywords", None)

    # Assemble full manifest
    manifest = {
        "channel_id": cfg["channel_id"],
        "channel_name": cfg["channel_name"],
        "short_index": short_index,
        "generated_date": date.today().isoformat(),
        "topic": topic,
        "lines": lines,
        "metadata": manifest_core.get("metadata", {}),
        "tts_voice": cfg["tts_voice"],
        "speech_rate": cfg["speech_rate"],
        "pitch": cfg["pitch"],
        "visual_style": cfg["visual_style"],
        "brand_color": cfg["brand_color"],
        "background_color": cfg["background_color"],
    }
    return manifest


# ---------------------------------------------------------------------------
# Save + upload
# ---------------------------------------------------------------------------

def save_manifest(manifest: Dict[str, Any], filename: str) -> Path:
    MANIFESTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = MANIFESTS_DIR / filename
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    logger.info("Saved manifest: %s", out_path)
    return out_path


def upload_to_cloudinary(manifest: Dict[str, Any], public_id: str) -> str:
    """Upload manifest JSON to Cloudinary as a raw file."""
    _init_cloudinary()
    today = date.today().isoformat()
    full_public_id = f"automation/shorts/{today}/{public_id}"
    result = cloudinary.uploader.upload(
        json.dumps(manifest, indent=2, ensure_ascii=False).encode("utf-8"),
        public_id=full_public_id,
        resource_type="raw",
        overwrite=True,
    )
    url = result.get("secure_url", "")
    logger.info("Uploaded to Cloudinary: %s", url)
    return url


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    import argparse  # pylint: disable=import-outside-toplevel
    parser = argparse.ArgumentParser(description="CH6 Shorts Generator")
    parser.add_argument("--index", type=int, default=None,
                        help="Which short to generate (1 or 2). Omit to generate both.")
    args = parser.parse_args()

    logger.info("=== CH6 Shorts Generator starting ===")

    cfg = _load_config()
    logger.info("Loaded config: %s", cfg["channel_name"])

    # Generate topics — always fetch 2 so they are unique from each other
    topics = generate_topics(cfg)

    # Decide which indices to produce
    if args.index is not None:
        indices = [args.index]
        # Use the topic at position (index-1), wrap if out of range
        selected_topics = {args.index: topics[(args.index - 1) % len(topics)]}
    else:
        indices = list(range(1, len(topics) + 1))
        selected_topics = {i: topics[i - 1] for i in indices}

    results = []
    for i in indices:
        topic = selected_topics[i]
        manifest = generate_short_manifest(topic, cfg, short_index=i)
        filename = f"ch6_short_{i}.json"
        local_path = save_manifest(manifest, filename)

        try:
            url = upload_to_cloudinary(manifest, f"ch6_short_{i}")
            manifest["cloudinary_url"] = url
            save_manifest(manifest, filename)
        except Exception as exc:
            logger.warning("Cloudinary upload failed for short %d: %s", i, exc)

        results.append({"index": i, "title": topic["title"], "path": str(local_path)})

    logger.info("=== CH6 Shorts Generator complete ===")
    for r in results:
        logger.info("  Short %d: %s → %s", r["index"], r["title"], r["path"])


if __name__ == "__main__":
    main()
