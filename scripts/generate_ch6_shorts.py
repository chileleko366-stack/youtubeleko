"""
Generate CH6 Red Space Facts — Daily Shorts manifest.

Short format (45–60 seconds, 4 parts):
  1. Hook       (0–5s):   one shocking sentence
  2. Core Fact  (5–35s):  explain with a key number or comparison
  3. Mind-blow  (35–50s): analogy / what-this-means
  4. CTA        (50–60s): follow + comment prompt
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

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

CONFIGS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "configs")
CHANNEL_ID = "ch6"
LOCAL_MANIFEST = "temp/manifests/ch6_short.json"


def _init_cloudinary():
    missing = [
        v for v in ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET")
        if not os.environ.get(v)
    ]
    if missing:
        raise RuntimeError(f"Missing Cloudinary secrets: {missing}")
    cloudinary.config(
        cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
        api_key=os.environ["CLOUDINARY_API_KEY"],
        api_secret=os.environ["CLOUDINARY_API_SECRET"],
        secure=True,
    )


def load_config() -> Dict[str, Any]:
    path = os.path.join(CONFIGS_DIR, "ch6-red-space-facts.json")
    with open(path, "r", encoding="utf-8") as fh:
        config = json.load(fh)
    config["_channel_id"] = CHANNEL_ID
    return config


def generate_shorts_manifest(story: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
    """Generate a Shorts production manifest from a top space news story."""
    client = get_client()
    date_str = date.today().isoformat()

    facts_to_check = [story["title"]]
    if story.get("summary"):
        facts_to_check.append(story["summary"][:300])
    verified = verify_facts(facts_to_check, context=story.get("summary", ""))
    verified_count = sum(1 for v in verified if v.get("verdict") == "verified")
    logger.info("Fact check: %d/%d claims verified", verified_count, len(verified))

    system = (
        "You are the scriptwriter for 'Red Space Facts', a YouTube Shorts channel. "
        "Write punchy, factual space scripts that stop the scroll in the first second. "
        "Every sentence must be verifiable. No speculation presented as fact."
    )

    prompt = f"""Write a YouTube Short script (45–60 seconds) about this space story:

Title: {story['title']}
Summary: {story.get('summary', 'No summary available')}
Source: {story['source']}

Script structure:
1. HOOK (5 sec): One sentence so shocking it stops the scroll
2. CORE FACT (25 sec): Explain the discovery clearly — include one key number or size comparison
3. MIND-BLOW (15 sec): What does this mean for us? Use an analogy that makes the scale hard to ignore
4. CTA (10 sec): "Follow for a space fact every day" + one question for viewers to answer in comments

Return ONLY a valid JSON object:
{{
  "title": "YouTube Short title (max 60 chars, factual, no clickbait)",
  "hook": "hook sentence",
  "core_fact": "2-3 sentence explanation",
  "mind_blow": "1-2 sentence analogy or implication",
  "cta": "call to action sentence",
  "full_script": "complete script with all 4 parts joined naturally",
  "fact_cards": [
    {{"text": "Hook card — short punchy text", "subtitle": ""}},
    {{"text": "Core fact card", "subtitle": "key number or source"}},
    {{"text": "Mind-blow card", "subtitle": "analogy"}},
    {{"text": "Follow for daily space facts 🚀", "subtitle": "#SpaceFacts"}}
  ],
  "description": "YouTube description (2-3 sentences + hashtags)",
  "hashtags": ["#SpaceFacts", "#NASA", "#Shorts"]
}}

Return ONLY the JSON, no extra text."""

    last_err: Exception = Exception("no attempts")
    for attempt in range(1, 4):
        if attempt > 1:
            time.sleep(attempt * 5)
        try:
            raw = client.generate(prompt=prompt, system_prompt=system, max_tokens=2000, temperature=0.7)
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("```", 2)[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            data = json.loads(raw.strip())
            if not isinstance(data, dict) or "full_script" not in data:
                raise ValueError(f"Unexpected structure: {list(data.keys())}")

            default_tags = config.get("default_tags", [])
            manifest = {
                "channel_id": CHANNEL_ID,
                "type": "short",
                "date": date_str,
                "source_story": story,
                "fact_verification": verified,
                "topic": {
                    "title": data["title"],
                    "source": story["source"],
                    "source_url": story.get("url", ""),
                },
                "script": data["full_script"],
                "hook": data["hook"],
                "core_fact": data["core_fact"],
                "mind_blow": data["mind_blow"],
                "cta": data["cta"],
                "fact_cards": data.get("fact_cards", []),
                "metadata": {
                    "title": data["title"],
                    "description": data.get("description", ""),
                    "tags": data.get("hashtags", []) + default_tags,
                },
                "channel_config": config,
                "voice": config.get("tts_voice", "en-US-AriaNeural"),
                "tts_rate": config.get("tts_rate", "+5%"),
                "tts_pitch": config.get("tts_pitch", "+0Hz"),
            }
            logger.info("Shorts manifest generated: %s", data["title"])
            return manifest

        except Exception as exc:
            last_err = exc
            logger.warning("Shorts generation attempt %d/3 failed: %s", attempt, exc)

    raise RuntimeError(f"Failed to generate Shorts manifest after 3 attempts: {last_err}")


def upload_manifest(manifest: Dict[str, Any], date_str: str) -> str:
    """Upload manifest JSON to Cloudinary as raw file. Returns secure URL."""
    payload = json.dumps(manifest, indent=2)
    public_id = f"automation/manifests/{date_str}/ch6_short"
    result = cloudinary.uploader.upload(
        payload.encode("utf-8"),
        resource_type="raw",
        public_id=public_id,
        overwrite=True,
        tags=["manifest", CHANNEL_ID, "short", date_str],
    )
    url = result["secure_url"]
    logger.info("Manifest uploaded → %s", url)
    return url


def _write_github_output(key: str, value: str) -> None:
    output_file = os.environ.get("GITHUB_OUTPUT")
    if output_file:
        with open(output_file, "a", encoding="utf-8") as fh:
            fh.write(f"{key}={value}\n")


def main():
    _init_cloudinary()
    date_str = date.today().isoformat()
    config = load_config()

    logger.info("Fetching recent space news...")
    stories = fetch_space_news(max_stories=10)
    if not stories:
        raise RuntimeError("No space news stories found — all RSS feeds failed")

    story = stories[0]
    logger.info("Top story: %s (score=%.2f, source=%s)", story["title"], story.get("score", 0), story["source"])

    manifest = generate_shorts_manifest(story, config)
    url = upload_manifest(manifest, date_str)

    Path("temp/manifests").mkdir(parents=True, exist_ok=True)
    with open(LOCAL_MANIFEST, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
    logger.info("Manifest written locally: %s", LOCAL_MANIFEST)

    print("\n=== CH6 SHORTS MANIFEST ===")
    print(f"Title:  {manifest['topic']['title']}")
    print(f"Source: {story['source']}")
    print(f"Cloud:  {url}")

    _write_github_output("title", manifest["topic"]["title"])
    _write_github_output("manifest_url", url)


if __name__ == "__main__":
    main()
