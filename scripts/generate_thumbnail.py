"""
Thumbnail generator using Pollinations.ai (free, no API key required).

Generates channel-branded thumbnail images for each video by constructing
a detailed prompt that incorporates the channel's visual identity.
"""

import logging
import os
import time
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import quote

import requests
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

POLLINATIONS_BASE_URL = "https://image.pollinations.ai/prompt/{prompt}"
IMAGE_WIDTH = 1280
IMAGE_HEIGHT = 720
REQUEST_TIMEOUT = 90  # Pollinations can be slow on first request
MAX_RETRIES = 3
RETRY_DELAY = 5.0

# Channel-specific visual style descriptors to enhance thumbnail quality
CHANNEL_STYLE_DESCRIPTORS: Dict[str, Dict[str, str]] = {
    "ch1": {
        "aesthetic": "VHS glitch, CRT distortion, film grain, neon on black",
        "mood": "dark, intense, psychological thriller",
        "negative": "bright cheerful, pastel, flat design",
    },
    "ch2": {
        "aesthetic": "clean minimal finance, dark navy background, gold accents",
        "mood": "sophisticated, professional, wealth psychology",
        "negative": "grunge, chaotic, fantasy elements",
    },
    "ch3": {
        "aesthetic": "declassified document red stamp, dark cinematic, redaction bars",
        "mood": "suspenseful, investigative, government secrets",
        "negative": "cartoon, bright colors, cheerful",
    },
    "ch4": {
        "aesthetic": "scientific paper texture, neural network visualization, purple glow",
        "mood": "intellectual, peer-reviewed, neuroscience laboratory",
        "negative": "pseudoscience symbols, chakras, astrology",
    },
    "ch5": {
        "aesthetic": "vintage archival, aged sepia photograph, documentary film grain",
        "mood": "historical gravitas, forgotten past, documentary weight",
        "negative": "modern digital, neon, pop art",
    },
}


def _build_thumbnail_prompt(
    title: str,
    channel_config: Dict[str, Any],
    thumbnail_prompt_hint: Optional[str] = None,
) -> str:
    """
    Build a detailed image generation prompt for the thumbnail.

    Args:
        title:                 The video title.
        channel_config:        Channel configuration dict.
        thumbnail_prompt_hint: Optional hint from metadata stage 7.

    Returns:
        Fully crafted prompt string ready for URL encoding.
    """
    channel_id = channel_config.get("_channel_id", "ch1")
    brand_color = channel_config.get("brand_color", "#ffffff")
    bg_color = channel_config.get("background_color", "#000000")
    font_primary = channel_config.get("font_primary", "bold sans-serif")
    channel_name = channel_config.get("channel_name", "YouTube Channel")

    style = CHANNEL_STYLE_DESCRIPTORS.get(channel_id, {
        "aesthetic": "cinematic dark",
        "mood": "dramatic, compelling",
        "negative": "cartoon",
    })

    brand_desc = f"accent color {brand_color}"
    bg_desc = f"background color {bg_color}"

    base_prompt = (
        f"YouTube thumbnail for '{title}', "
        f"channel '{channel_name}', "
        f"{style['aesthetic']}, "
        f"{style['mood']}, "
        f"{brand_desc}, {bg_desc}, "
        f"bold {font_primary} typography overlaid, "
        "16:9 aspect ratio, 1280x720 pixels, "
        "ultra-detailed, photorealistic where applicable, "
        "high contrast, striking visual composition, "
        "professional YouTube thumbnail design, "
        "cinematic lighting, "
        "no watermarks, no text artifacts"
    )

    if thumbnail_prompt_hint:
        base_prompt += f", {thumbnail_prompt_hint}"

    return base_prompt


def generate_thumbnail(
    title: str,
    channel_config: Dict[str, Any],
    output_path: str,
    thumbnail_prompt_hint: Optional[str] = None,
) -> bool:
    """
    Generate a thumbnail image using Pollinations.ai.

    Args:
        title:                 The video title.
        channel_config:        Channel configuration dict.
        output_path:           Local path to save the PNG image.
        thumbnail_prompt_hint: Optional extra prompt detail from metadata.

    Returns:
        True on success, False on failure.
    """
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    prompt = _build_thumbnail_prompt(title, channel_config, thumbnail_prompt_hint)
    encoded_prompt = quote(prompt)
    url = POLLINATIONS_BASE_URL.format(prompt=encoded_prompt)
    url += f"?width={IMAGE_WIDTH}&height={IMAGE_HEIGHT}&nologo=true&enhance=true"

    logger.info(
        "[%s] Requesting thumbnail from Pollinations.ai for: %s",
        channel_config.get("_channel_id", "?"),
        title,
    )
    logger.debug("Prompt: %s", prompt[:200])

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(url, timeout=REQUEST_TIMEOUT, stream=True)
            resp.raise_for_status()

            content_type = resp.headers.get("Content-Type", "")
            if "image" not in content_type:
                logger.warning(
                    "Unexpected content type on attempt %d: %s", attempt, content_type
                )
                time.sleep(RETRY_DELAY)
                continue

            with open(output, "wb") as fh:
                for chunk in resp.iter_content(chunk_size=65536):
                    fh.write(chunk)

            size_kb = output.stat().st_size / 1024
            logger.info(
                "Thumbnail saved: %s (%.1f KB) on attempt %d",
                output_path,
                size_kb,
                attempt,
            )
            return True

        except requests.HTTPError as exc:
            logger.warning("Pollinations HTTP error attempt %d: %s", attempt, exc)
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY * attempt)
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("Thumbnail generation error attempt %d: %s", attempt, exc)
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY)

    logger.error("Failed to generate thumbnail after %d attempts: %s", MAX_RETRIES, title)
    return False


def generate_all_thumbnails(
    manifests: Dict[str, Any],
    output_dir: str = "temp/thumbnails",
) -> Dict[str, Optional[str]]:
    """
    Generate thumbnails for multiple channel manifests.

    Args:
        manifests:  Dict mapping channel_id to manifest dict.
        output_dir: Base directory for thumbnail output.

    Returns:
        Dict mapping channel_id to local thumbnail path (or None on failure).
    """
    results: Dict[str, Optional[str]] = {}
    base_dir = Path(output_dir)
    base_dir.mkdir(parents=True, exist_ok=True)

    for channel_id, manifest in manifests.items():
        title = manifest.get("metadata", {}).get("title") or manifest.get("topic", {}).get("title", "Untitled")
        channel_config = manifest.get("channel_config", {})
        channel_config["_channel_id"] = channel_id
        thumbnail_hint = manifest.get("metadata", {}).get("thumbnail_prompt")

        output_path = str(base_dir / f"{channel_id}_thumbnail.png")
        success = generate_thumbnail(title, channel_config, output_path, thumbnail_hint)
        results[channel_id] = output_path if success else None

    return results


if __name__ == "__main__":
    import json
    import sys

    if len(sys.argv) < 2:
        print("Usage: python generate_thumbnail.py <manifest.json>")
        sys.exit(1)

    with open(sys.argv[1], "r", encoding="utf-8") as f:
        manifest_data = json.load(f)

    channel_id_arg = manifest_data.get("channel_id", "ch1")
    title_arg = manifest_data.get("metadata", {}).get("title", "Test Title")
    config_arg = manifest_data.get("channel_config", {})
    config_arg["_channel_id"] = channel_id_arg
    hint_arg = manifest_data.get("metadata", {}).get("thumbnail_prompt")

    out = f"temp/thumbnails/{channel_id_arg}_thumbnail.png"
    ok = generate_thumbnail(title_arg, config_arg, out, hint_arg)
    print(f"Thumbnail: {'OK' if ok else 'FAILED'} -> {out}")
