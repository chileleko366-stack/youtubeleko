"""
Back up produced video files to Google Drive using a service account.
"""

import base64
import json
import logging
import os
import time
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

load_dotenv()
logger = logging.getLogger(__name__)

DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"]
ROOT_FOLDER_NAME = "YouTube Automation Backups"


def _build_drive_client():
    """Build authenticated Google Drive client from base64-encoded service account JSON."""
    creds_b64 = os.environ["GOOGLE_DRIVE_CREDENTIALS"]
    creds_json = base64.b64decode(creds_b64).decode("utf-8")
    creds_dict = json.loads(creds_json)

    credentials = service_account.Credentials.from_service_account_info(
        creds_dict, scopes=DRIVE_SCOPES
    )
    return build("drive", "v3", credentials=credentials, cache_discovery=False)


def _get_or_create_folder(service, name: str, parent_id: Optional[str] = None) -> str:
    """Return the folder ID, creating the folder if it doesn't exist."""
    query = f"mimeType='application/vnd.google-apps.folder' and name='{name}' and trashed=false"
    if parent_id:
        query += f" and '{parent_id}' in parents"

    results = service.files().list(q=query, fields="files(id, name)").execute()
    files = results.get("files", [])
    if files:
        return files[0]["id"]

    body = {
        "name": name,
        "mimeType": "application/vnd.google-apps.folder",
    }
    if parent_id:
        body["parents"] = [parent_id]

    folder = service.files().create(body=body, fields="id").execute()
    logger.info("Created Drive folder: %s (id=%s)", name, folder["id"])
    return folder["id"]


def backup_to_drive(
    file_path: str,
    channel_id: str,
    date_str: str,
) -> Optional[str]:
    """
    Upload a file to Google Drive under:
    YouTube Automation Backups / {channel_id} / {date_str} / filename

    Returns the Drive file ID on success, None on failure.
    """
    if not os.path.exists(file_path):
        logger.error("File not found for Drive backup: %s", file_path)
        return None

    for attempt in range(1, 4):
        try:
            service = _build_drive_client()

            root_id = _get_or_create_folder(service, ROOT_FOLDER_NAME)
            channel_folder_id = _get_or_create_folder(service, channel_id.upper(), root_id)
            date_folder_id = _get_or_create_folder(service, date_str, channel_folder_id)

            file_name = Path(file_path).name
            file_metadata = {
                "name": file_name,
                "parents": [date_folder_id],
            }

            mime = "video/mp4" if file_path.endswith(".mp4") else "application/octet-stream"
            media = MediaFileUpload(file_path, mimetype=mime, resumable=True, chunksize=5 * 1024 * 1024)

            file_obj = (
                service.files()
                .create(body=file_metadata, media_body=media, fields="id, name, size")
                .execute()
            )

            logger.info(
                "[%s] Backed up to Drive: %s (id=%s, size=%s bytes)",
                channel_id,
                file_obj.get("name"),
                file_obj.get("id"),
                file_obj.get("size"),
            )
            return file_obj.get("id")

        except Exception as exc:
            logger.error(
                "[%s] Drive backup attempt %d/3 failed for %s: %s",
                channel_id, attempt, file_path, exc,
            )
            if attempt < 3:
                time.sleep(attempt * 10)
    return None


if __name__ == "__main__":
    import glob
    import sys

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    if len(sys.argv) < 2:
        print("Usage: python upload_drive.py <manifest.json>")
        sys.exit(1)

    with open(sys.argv[1], "r", encoding="utf-8") as fh:
        manifest = json.load(fh)

    ch_id = manifest.get("channel_id", "unknown")
    date_str = manifest.get("date") or __import__("datetime").date.today().isoformat()

    # Find the assembled video in temp/output/
    candidates = sorted(glob.glob(f"temp/output/{ch_id}_*.mp4"))
    if not candidates:
        logger.error("No assembled video found in temp/output/ for %s — skipping Drive upload", ch_id)
        sys.exit(0)

    video_path = candidates[-1]
    logger.info("Uploading to Drive: %s", video_path)
    file_id = backup_to_drive(video_path, ch_id, date_str)
    if file_id:
        print(f"Drive upload complete: {Path(video_path).name} (id={file_id})")
        sys.exit(0)
    else:
        print(f"ERROR: Drive upload failed for {video_path}")
        sys.exit(1)
