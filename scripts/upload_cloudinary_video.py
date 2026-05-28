"""
Upload a video file to Cloudinary and return its secure download URL.

Usage:
    python scripts/upload_cloudinary_video.py <video_path> <public_id_prefix>

Prints the secure URL to stdout and writes CLOUDINARY_VIDEO_URL to GITHUB_OUTPUT.
"""

import logging
import os
import sys
from pathlib import Path

import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def upload_video(file_path: str, public_id: str) -> str:
    cloudinary.config(
        cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
        api_key=os.environ["CLOUDINARY_API_KEY"],
        api_secret=os.environ["CLOUDINARY_API_SECRET"],
        secure=True,
    )

    logger.info("Uploading %s to Cloudinary as %s …", file_path, public_id)
    result = cloudinary.uploader.upload(
        file_path,
        resource_type="video",
        public_id=public_id,
        overwrite=True,
        use_filename=False,
    )
    url = result["secure_url"]
    logger.info("Uploaded → %s", url)
    return url


def _write_github_output(key: str, value: str) -> None:
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as f:
            f.write(f"{key}={value}\n")


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: upload_cloudinary_video.py <video_path> <public_id_prefix>")
        sys.exit(1)

    video_path = sys.argv[1]
    prefix = sys.argv[2]

    if not Path(video_path).exists():
        logger.error("File not found: %s", video_path)
        sys.exit(1)

    public_id = f"youtubeleko/{prefix}/{Path(video_path).stem}"
    url = upload_video(video_path, public_id)

    print(url)
    _write_github_output("CLOUDINARY_VIDEO_URL", url)


if __name__ == "__main__":
    main()
