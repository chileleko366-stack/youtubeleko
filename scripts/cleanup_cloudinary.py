"""
Clean up Cloudinary assets older than a specified number of days.

Policy:
  - Raw assets (topics, manifests): delete after 30 days
  - Video/audio temp files: delete after 7 days
  - Thumbnails: delete after 14 days
"""

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import List

import cloudinary
import cloudinary.api
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


def _init_cloudinary():
    cloudinary.config(
        cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
        api_key=os.environ["CLOUDINARY_API_KEY"],
        api_secret=os.environ["CLOUDINARY_API_SECRET"],
        secure=True,
    )


def _list_resources(resource_type: str, prefix: str, max_results: int = 500) -> List[dict]:
    """List Cloudinary resources matching a prefix."""
    resources = []
    next_cursor = None

    while True:
        params = {
            "type": "upload",
            "prefix": prefix,
            "max_results": min(max_results, 500),
            "resource_type": resource_type,
        }
        if next_cursor:
            params["next_cursor"] = next_cursor

        result = cloudinary.api.resources(**params)
        resources.extend(result.get("resources", []))
        next_cursor = result.get("next_cursor")

        if not next_cursor or len(resources) >= max_results:
            break

    return resources


def cleanup_old_assets(
    raw_retention_days: int = 30,
    video_retention_days: int = 7,
    image_retention_days: int = 14,
) -> dict:
    """
    Delete expired Cloudinary assets.

    Returns a summary dict with counts of deleted resources.
    """
    _init_cloudinary()
    now = datetime.now(tz=timezone.utc)
    deleted = {"raw": 0, "video": 0, "image": 0, "errors": 0}

    retention_map = {
        "raw": timedelta(days=raw_retention_days),
        "video": timedelta(days=video_retention_days),
        "image": timedelta(days=image_retention_days),
    }

    for resource_type, max_age in retention_map.items():
        try:
            resources = _list_resources(resource_type, "automation/")
        except Exception as exc:
            logger.error("Failed to list %s resources: %s", resource_type, exc)
            continue

        for asset in resources:
            created_at_str = asset.get("created_at", "")
            try:
                created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                continue

            age = now - created_at
            if age > max_age:
                public_id = asset.get("public_id")
                try:
                    cloudinary.api.delete_resources(
                        [public_id], resource_type=resource_type
                    )
                    deleted[resource_type] += 1
                    logger.info("Deleted %s/%s (age: %s)", resource_type, public_id, age)
                except Exception as exc:
                    logger.error("Failed to delete %s/%s: %s", resource_type, public_id, exc)
                    deleted["errors"] += 1

    logger.info(
        "Cleanup complete: raw=%d video=%d image=%d errors=%d",
        deleted["raw"],
        deleted["video"],
        deleted["image"],
        deleted["errors"],
    )
    return deleted


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    summary = cleanup_old_assets()
    print(f"Cleanup summary: {summary}")
