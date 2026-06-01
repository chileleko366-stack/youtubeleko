"""
Optional AI image generation via Higgsfield (Phase 6).

ENTIRELY DISABLED BY DEFAULT.  This module is only invoked when the channel
config explicitly sets:

  "ai_images": {
    "enabled": true,
    "provider": "higgsfield",
    "model": "higgsfield/diffusion-1",
    "max_per_video": 3
  }

When ai_images.enabled is false (or the block is absent), the existing Pexels
+ Pollinations path is used with ZERO behaviour change.

Credit cost note:
  Higgsfield charges per image generation.  At typical rates (~$0.04/image)
  with max_per_video=3, a single video costs ≤$0.12 in AI image credits
  PLUS any existing Cloudinary storage.  Keep max_per_video low (2-4) on
  free-tier CI runners to avoid unexpected spend.  Set enabled=false to
  spend $0.

Per-channel guidance (ALL disabled in shipped configs — edit to enable):
  CH1 DOPAMINE LOOP   → character/expression imagery prompt style
  CH3 REDACTED        → faux-dossier/redacted-doc imagery
  CH4 THE GREY MATTER → labeled diagram / scientific figure style
  CH5 THE QUIET RECORD → historical-style still / archival aesthetic

Required env vars (add to GitHub Secrets, NOT to code):
  HIGGSFIELD_API_KEY  — Higgsfield API key (never hard-code)

Cloudinary caching: generated images are uploaded and cached so re-runs
do not re-generate (same prompt hash → same Cloudinary path).
"""

import hashlib
import logging
import os
from typing import Any, Dict, Optional

import requests
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

HIGGSFIELD_API_URL = "https://api.higgsfield.ai/v1/images/generations"
CLOUDINARY_FOLDER = "automation/ai_images"


def _is_enabled(channel_config: Dict[str, Any]) -> bool:
    ai_block = channel_config.get("ai_images", {})
    return bool(ai_block.get("enabled", False))


def _get_ai_config(channel_config: Dict[str, Any]) -> Dict[str, Any]:
    return channel_config.get("ai_images", {})


def _prompt_hash(prompt: str) -> str:
    return hashlib.md5(prompt.encode()).hexdigest()[:12]


def _check_cloudinary_cache(prompt_hash: str, channel_id: str) -> Optional[str]:
    """Return cached Cloudinary URL if this prompt was already generated."""
    try:
        import cloudinary.api  # pylint: disable=import-outside-toplevel
        public_id = f"{CLOUDINARY_FOLDER}/{channel_id}/{prompt_hash}"
        result = cloudinary.api.resource(public_id, resource_type="image")
        url = result.get("secure_url")
        if url:
            logger.info("AI image cache hit for hash %s → %s", prompt_hash, url)
        return url
    except Exception:  # pylint: disable=broad-except
        return None


def _upload_to_cloudinary(image_url: str, prompt_hash: str, channel_id: str) -> Optional[str]:
    """Download from Higgsfield and upload to Cloudinary for caching."""
    try:
        import cloudinary.uploader  # pylint: disable=import-outside-toplevel
        public_id = f"{CLOUDINARY_FOLDER}/{channel_id}/{prompt_hash}"
        result = cloudinary.uploader.upload(
            image_url,
            public_id=public_id,
            resource_type="image",
            overwrite=False,
            tags=["ai_generated", channel_id],
        )
        return result.get("secure_url")
    except Exception as exc:  # pylint: disable=broad-except
        logger.warning("Failed to cache AI image to Cloudinary: %s", exc)
        return image_url  # return the direct URL as fallback


def generate_image(
    prompt: str,
    channel_config: Dict[str, Any],
) -> Optional[str]:
    """
    Generate an AI image for the given prompt.

    Returns a Cloudinary (or direct) URL on success, None on failure or
    when ai_images is disabled.

    Args:
        prompt:         Visual description / image generation prompt.
        channel_config: Full channel config dict.

    Returns:
        Image URL string, or None if disabled/failed.
    """
    if not _is_enabled(channel_config):
        return None

    api_key = os.environ.get("HIGGSFIELD_API_KEY")
    if not api_key:
        logger.error(
            "ai_images.enabled=true but HIGGSFIELD_API_KEY is not set. "
            "Add it to your environment / GitHub Secrets."
        )
        return None

    channel_id = channel_config.get("_channel_id", "unknown")
    ai_cfg = _get_ai_config(channel_config)
    model = ai_cfg.get("model", "higgsfield/diffusion-1")

    prompt_hash = _prompt_hash(prompt)

    # Check cache first (avoid re-generating identical prompts)
    cached_url = _check_cloudinary_cache(prompt_hash, channel_id)
    if cached_url:
        return cached_url

    logger.info(
        "[%s] Generating AI image via Higgsfield (model=%s): %s",
        channel_id, model, prompt[:80],
    )

    try:
        response = requests.post(
            HIGGSFIELD_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "prompt": prompt,
                "n": 1,
                "size": "1024x1024",
            },
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        image_url = data["data"][0]["url"]
        logger.info("[%s] AI image generated: %s", channel_id, image_url[:60])

        # Cache to Cloudinary for reuse
        cached = _upload_to_cloudinary(image_url, prompt_hash, channel_id)
        return cached

    except requests.exceptions.HTTPError as exc:
        logger.error(
            "[%s] Higgsfield API error (HTTP %s): %s",
            channel_id, exc.response.status_code, exc.response.text[:300],
        )
        return None
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("[%s] AI image generation failed: %s", channel_id, exc)
        return None


def generate_images_for_manifest(
    manifest: Dict[str, Any],
    max_per_video: Optional[int] = None,
) -> Dict[int, Optional[str]]:
    """
    Generate AI images for lines in the manifest that would benefit most.

    Only lines with treatment in [ImageReveal, Fullscreen, CelebrityCard,
    ArchiveFootage] and a visualSpec.intent of "reveal" or "concept" are
    considered, and only up to max_per_video images are generated.

    Returns {line_number: image_url_or_None}.
    When ai_images.enabled=false, returns {} immediately.
    """
    channel_config = manifest.get("channel_config", {})
    if not _is_enabled(channel_config):
        return {}

    ai_cfg = _get_ai_config(channel_config)
    limit = max_per_video or ai_cfg.get("max_per_video", 3)
    lines = manifest.get("lines", [])

    ELIGIBLE_TREATMENTS = {"ImageReveal", "Fullscreen", "CelebrityCard", "ArchiveFootage"}
    ELIGIBLE_INTENTS = {"reveal", "concept", "kinetic"}

    results: Dict[int, Optional[str]] = {}
    generated = 0

    for line in lines:
        if generated >= limit:
            break

        treatment = line.get("treatment", "")
        intent = (line.get("visualSpec") or {}).get("intent", "")
        if treatment not in ELIGIBLE_TREATMENTS and intent not in ELIGIBLE_INTENTS:
            continue

        # Build a prompt from the line text + b-roll keywords
        keywords = " ".join(line.get("b_roll_keywords", []))
        text = line.get("text", "")
        prompt = f"{text}. Visual style: cinematic, high-quality, no text. {keywords}"

        url = generate_image(prompt, channel_config)
        results[line["line_number"]] = url
        if url:
            generated += 1

    return results
