"""
Generate video topics for all 5 channels and upload the results to Cloudinary.

Each channel receives 3 ranked topic suggestions. Output is stored as
cloudinary://topics/{date}/{channel_id}.json
"""

import json
import logging
import os
import time
from datetime import date
from typing import Any, Dict, List

import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

from ai_client import get_client

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

CONFIGS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "configs")

CHANNEL_CONFIG_FILES = {
    "ch1": "ch1-dopamine-loop.json",
    "ch2": "ch2-financefiction.json",
    "ch3": "ch3-redacted.json",
    "ch4": "ch4-grey-matter.json",
    "ch5": "ch5-quiet-record.json",
}


def _init_cloudinary():
    missing = [
        v for v in ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET")
        if not os.environ.get(v)
    ]
    if missing:
        raise RuntimeError(
            f"Missing Cloudinary secrets: {missing}. "
            "Add them to GitHub Secrets: Settings → Secrets → Actions."
        )
    cloudinary.config(
        cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
        api_key=os.environ["CLOUDINARY_API_KEY"],
        api_secret=os.environ["CLOUDINARY_API_SECRET"],
        secure=True,
    )


def load_channel_config(channel_id: str) -> Dict[str, Any]:
    """Load and parse a channel config JSON file."""
    filename = CHANNEL_CONFIG_FILES[channel_id]
    path = os.path.join(CONFIGS_DIR, filename)
    with open(path, "r", encoding="utf-8") as fh:
        config = json.load(fh)
    config["_channel_id"] = channel_id
    return config


def generate_topics_for_channel(channel_config: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Ask the LLM to generate 3 compelling video topics for a channel.

    Returns a list of 3 dicts, each with:
        title, hook, angle, estimated_search_volume (low/medium/high),
        controversy_score (1-10), originality_score (1-10)
    """
    channel_id = channel_config["_channel_id"]
    name = channel_config["channel_name"]
    niche = channel_config["niche"]
    audience = channel_config["audience"]
    forbidden_topics = channel_config.get("forbidden_topics", [])
    forbidden_words = channel_config.get("forbidden_words", [])
    word_count = channel_config.get("word_count", 1200)
    length_min = channel_config.get("length_minutes_min", 8)
    length_max = channel_config.get("length_minutes_max", 12)

    system_prompt = (
        f"You are the creative director for the YouTube channel '{name}'. "
        f"Niche: {niche}. Target audience: {audience}. "
        f"Videos are {length_min}–{length_max} minutes long (~{word_count} words of script). "
        "You create scroll-stopping, algorithm-friendly topics that are original and factual."
    )

    forbidden_topics_str = ", ".join(forbidden_topics) if forbidden_topics else "none"
    forbidden_words_str = ", ".join(forbidden_words) if forbidden_words else "none"

    prompt = f"""Generate exactly 3 compelling YouTube video topics for the channel '{name}'.

Channel niche: {niche}
Target audience: {audience}
FORBIDDEN topics (never suggest): {forbidden_topics_str}
FORBIDDEN words (never use in titles): {forbidden_words_str}

Requirements:
- Each topic must be factual and verifiable
- Titles must be curiosity-driven and under 70 characters
- Must be unique and not a rehash of top 10 YouTube results
- Must suit a {length_min}–{length_max} minute format

Return ONLY a valid JSON array with exactly 3 objects. Each object must have:
{{
  "title": "video title string",
  "hook": "one-sentence opening hook for the video",
  "angle": "what unique perspective or framing makes this stand out",
  "estimated_search_volume": "low | medium | high",
  "controversy_score": <integer 1-10>,
  "originality_score": <integer 1-10>
}}

Return ONLY the JSON array, no markdown fences, no extra text."""

    client = get_client()

    last_err = None
    for attempt in range(1, 4):
        if attempt > 1:
            time.sleep(attempt * 3)
        try:
            raw = client.generate(prompt=prompt, system_prompt=system_prompt, max_tokens=1500, temperature=0.85)

            # Strip markdown fences if LLM wrapped the output
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("```", 2)[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            raw = raw.strip()

            if not raw:
                raise ValueError("LLM returned empty content")

            topics = json.loads(raw)
            if not isinstance(topics, list) or len(topics) == 0:
                raise ValueError(f"Expected JSON list, got: {type(topics)}")

            # Trim to 3 if model returned more; pad only on last attempt
            topics = topics[:3]
            if len(topics) < 3 and attempt == 3:
                logger.warning("Only %d topics returned for %s — proceeding anyway", len(topics), channel_id)

            logger.info("Generated %d topics for %s (%s) on attempt %d", len(topics), channel_id, name, attempt)
            return topics

        except (json.JSONDecodeError, ValueError) as exc:
            last_err = exc
            logger.warning("Topics parse error for %s (attempt %d/3): %s", channel_id, attempt, exc)

    raise ValueError(f"Failed to get valid topics for {channel_id} after 3 attempts: {last_err}")


def upload_topics_to_cloudinary(channel_id: str, topics: List[Dict], date_str: str) -> str:
    """Upload topics JSON to Cloudinary as a raw file. Returns the secure URL."""
    payload = json.dumps({"channel_id": channel_id, "date": date_str, "topics": topics}, indent=2)

    public_id = f"automation/topics/{date_str}/{channel_id}.json"
    result = cloudinary.uploader.upload(
        payload.encode("utf-8"),
        resource_type="raw",
        public_id=public_id,
        overwrite=True,
        tags=["topics", channel_id, date_str],
    )
    url = result["secure_url"]
    logger.info("Uploaded topics for %s → %s", channel_id, url)
    return url


def _write_github_output(key: str, value: str) -> None:
    output_file = os.environ.get("GITHUB_OUTPUT")
    if output_file:
        with open(output_file, "a", encoding="utf-8") as fh:
            fh.write(f"{key}={value}\n")


def main():
    """Generate topics for all 5 channels and upload to Cloudinary."""
    _init_cloudinary()
    date_str = date.today().isoformat()
    results = {}
    providers_used: set = set()

    channel_ids = list(CHANNEL_CONFIG_FILES.keys())
    for i, channel_id in enumerate(channel_ids):
        if i > 0:
            time.sleep(6)  # pace requests to stay within free-tier RPM limits
        try:
            logger.info("Processing channel: %s", channel_id)
            config = load_channel_config(channel_id)
            topics = generate_topics_for_channel(config)
            url = upload_topics_to_cloudinary(channel_id, topics, date_str)
            results[channel_id] = {"status": "ok", "url": url, "topics": topics}
            if get_client().last_provider:
                providers_used.add(get_client().last_provider)
        except Exception as exc:  # pylint: disable=broad-except
            logger.error("Failed to generate topics for %s: %s", channel_id, exc, exc_info=True)
            results[channel_id] = {"status": "error", "error": str(exc)}

    provider_str = ", ".join(sorted(providers_used)) if providers_used else "unknown"

    # Print summary
    print("\n=== TOPIC GENERATION SUMMARY ===")
    for ch_id, data in results.items():
        status = data["status"]
        if status == "ok":
            titles = [t["title"] for t in data["topics"]]
            print(f"[{ch_id}] OK → {titles}")
        else:
            print(f"[{ch_id}] ERROR: {data['error']}")
    print(f"\nAI provider(s) used: {provider_str}")

    # Expose for GitHub Actions Telegram notification step
    _write_github_output("ai_provider", provider_str)

    failed = [k for k, v in results.items() if v["status"] == "error"]
    if failed:
        raise SystemExit(f"Topic generation failed for channels: {failed}")


if __name__ == "__main__":
    main()
