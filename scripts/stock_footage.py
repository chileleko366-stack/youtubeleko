"""
Stock footage fetcher using the Pexels API.

Downloads HD/4K landscape video clips for each script line based on
the b_roll_keywords generated in stage 6 of the script pipeline.
"""

import logging
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

PEXELS_API_BASE = "https://api.pexels.com/videos/search"
PEXELS_API_KEY = os.environ.get("PEXELS_API_KEY", "")
REQUEST_TIMEOUT = 30
DOWNLOAD_CHUNK_SIZE = 1024 * 256  # 256 KB
RATE_LIMIT_SLEEP = 0.5  # seconds between API calls


def _get_headers() -> Dict[str, str]:
    if not PEXELS_API_KEY:
        raise EnvironmentError("PEXELS_API_KEY environment variable is not set.")
    return {"Authorization": PEXELS_API_KEY}


def _pick_best_video_file(video_files: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    From the list of video file variants returned by Pexels, select the best one.
    Preference order: 4K landscape → HD (1920×1080) landscape → any HD → first available.
    """
    landscape_files = [
        f for f in video_files
        if f.get("width", 0) >= f.get("height", 1)  # landscape only
    ]
    candidates = landscape_files if landscape_files else video_files

    # 4K preference
    for f in candidates:
        if f.get("width", 0) >= 3840:
            return f

    # 1080p preference
    for f in candidates:
        if f.get("height", 0) == 1080:
            return f

    # Any HD
    for f in candidates:
        if f.get("height", 0) >= 720:
            return f

    return candidates[0] if candidates else None


def fetch_footage_for_line(
    keywords: List[str],
    channel_id: str,
    line_number: int,
    per_page: int = 10,
) -> Optional[str]:
    """
    Search Pexels for stock footage matching the given keywords.

    Args:
        keywords:    List of search terms to try (tried in order until a result is found).
        channel_id:  Used for logging context.
        line_number: Used for logging context.
        per_page:    Results to request per search (max 80).

    Returns:
        The HTTPS URL of the best matching video file, or None if nothing found.
    """
    headers = _get_headers()

    for query in keywords:
        try:
            params = {
                "query": query,
                "orientation": "landscape",
                "size": "large",
                "per_page": per_page,
            }
            resp = requests.get(
                PEXELS_API_BASE,
                headers=headers,
                params=params,
                timeout=REQUEST_TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json()
            videos = data.get("videos", [])

            if not videos:
                logger.debug("[%s] line %d – no results for '%s'", channel_id, line_number, query)
                time.sleep(RATE_LIMIT_SLEEP)
                continue

            # Pick first video that has files
            for video in videos:
                files = video.get("video_files", [])
                if files:
                    best = _pick_best_video_file(files)
                    if best and best.get("link"):
                        logger.info(
                            "[%s] line %d – found clip '%s' (%dx%d) for '%s'",
                            channel_id,
                            line_number,
                            video.get("id", "?"),
                            best.get("width", 0),
                            best.get("height", 0),
                            query,
                        )
                        time.sleep(RATE_LIMIT_SLEEP)
                        return best["link"]

        except requests.HTTPError as exc:
            logger.warning("[%s] line %d – Pexels HTTP error for '%s': %s", channel_id, line_number, query, exc)
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning("[%s] line %d – Pexels error for '%s': %s", channel_id, line_number, query, exc)

        time.sleep(RATE_LIMIT_SLEEP)

    logger.warning("[%s] line %d – no footage found for any keyword: %s", channel_id, line_number, keywords)
    return None


def download_clip(url: str, output_path: str) -> bool:
    """
    Download a video clip from `url` and save it to `output_path`.

    Returns True on success, False on failure.
    """
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    try:
        logger.info("Downloading clip: %s → %s", url, output_path)
        with requests.get(url, stream=True, timeout=120) as resp:
            resp.raise_for_status()
            with open(output, "wb") as fh:
                for chunk in resp.iter_content(chunk_size=DOWNLOAD_CHUNK_SIZE):
                    fh.write(chunk)
        logger.info("Download complete: %s (%.1f MB)", output_path, output.stat().st_size / 1e6)
        return True
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Download failed for %s: %s", url, exc)
        if output.exists():
            output.unlink()
        return False


def fetch_all_footage(
    manifest: Dict[str, Any],
    output_dir: str = "temp/b_roll",
) -> List[Tuple[int, Optional[str]]]:
    """
    Iterate all lines in the manifest, fetch b-roll for each, and download clips.

    Args:
        manifest:   Production manifest containing 'lines' and 'channel_id'.
        output_dir: Local directory to save downloaded clips.

    Returns:
        List of (line_number, local_path_or_None) tuples.
    """
    channel_id = manifest.get("channel_id", "unknown")
    lines = manifest.get("lines", [])
    results: List[Tuple[int, Optional[str]]] = []

    base_dir = Path(output_dir) / channel_id
    base_dir.mkdir(parents=True, exist_ok=True)

    for line in lines:
        line_number = line.get("line_number", 0)
        keywords = line.get("b_roll_keywords", [])

        if not keywords:
            results.append((line_number, None))
            continue

        url = fetch_footage_for_line(keywords, channel_id, line_number)
        if url:
            ext = ".mp4"
            clip_path = str(base_dir / f"line_{line_number:04d}{ext}")
            success = download_clip(url, clip_path)
            results.append((line_number, clip_path if success else None))
        else:
            results.append((line_number, None))

    found = sum(1 for _, p in results if p is not None)
    logger.info(
        "[%s] Stock footage fetch complete: %d/%d lines have footage",
        channel_id,
        found,
        len(results),
    )
    return results


if __name__ == "__main__":
    import json
    import sys

    if len(sys.argv) < 2:
        print("Usage: python stock_footage.py <manifest.json>")
        sys.exit(1)

    with open(sys.argv[1], "r", encoding="utf-8") as f:
        manifest_data = json.load(f)

    fetch_all_footage(manifest_data)
