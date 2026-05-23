"""
Upload videos to YouTube using the YouTube Data API v3.

Each channel uses its own OAuth refresh token stored in GitHub Secrets.
Videos are initially uploaded as private, then scheduled for 18:00 UTC.
"""

import logging
import os
from datetime import date, datetime, timezone
from typing import Dict, Optional

import google.oauth2.credentials
import googleapiclient.discovery
import googleapiclient.http
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

YOUTUBE_API_SERVICE = "youtube"
YOUTUBE_API_VERSION = "v3"
YOUTUBE_SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]

# Map channel IDs to env var names for refresh tokens
REFRESH_TOKEN_ENV = {
    "ch1": "YOUTUBE_REFRESH_TOKEN_CH1",
    "ch2": "YOUTUBE_REFRESH_TOKEN_CH2",
    "ch3": "YOUTUBE_REFRESH_TOKEN_CH3",
    "ch4": "YOUTUBE_REFRESH_TOKEN_CH4",
    "ch5": "YOUTUBE_REFRESH_TOKEN_CH5",
}


def _build_youtube_client(channel_id: str):
    """Build authenticated YouTube API client for a specific channel."""
    client_id = os.environ["YOUTUBE_CLIENT_ID"]
    client_secret = os.environ["YOUTUBE_CLIENT_SECRET"]
    token_env = REFRESH_TOKEN_ENV[channel_id.lower()]
    refresh_token = os.environ[token_env]

    credentials = google.oauth2.credentials.Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=YOUTUBE_SCOPES,
    )

    return googleapiclient.discovery.build(
        YOUTUBE_API_SERVICE,
        YOUTUBE_API_VERSION,
        credentials=credentials,
        cache_discovery=False,
    )


def _build_publish_time() -> str:
    """Return today's 18:00 UTC as an RFC 3339 string for scheduled publishing."""
    today = date.today()
    publish_dt = datetime(today.year, today.month, today.day, 18, 0, 0, tzinfo=timezone.utc)
    return publish_dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")


def upload_video(
    video_path: str,
    thumbnail_path: Optional[str],
    manifest: Dict,
) -> Optional[str]:
    """
    Upload a video to YouTube.

    Returns the YouTube video ID on success, None on failure.
    """
    channel_id = manifest.get("channel_id", "").lower()
    metadata = manifest.get("metadata", {})

    title = metadata.get("title", "Untitled Video")
    description = metadata.get("description", "")
    tags = metadata.get("tags", [])
    category_id = metadata.get("category_id", "27")
    publish_at = _build_publish_time()

    logger.info("[%s] Uploading: %s", channel_id, title)

    youtube = _build_youtube_client(channel_id)

    body = {
        "snippet": {
            "title": title,
            "description": description,
            "tags": tags,
            "categoryId": category_id,
            "defaultLanguage": "en",
        },
        "status": {
            "privacyStatus": "private",
            "publishAt": publish_at,
            "selfDeclaredMadeForKids": False,
        },
    }

    media = googleapiclient.http.MediaFileUpload(
        video_path,
        mimetype="video/mp4",
        resumable=True,
        chunksize=10 * 1024 * 1024,  # 10 MB chunks
    )

    request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=media,
    )

    video_id = None
    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            pct = int(status.progress() * 100)
            logger.info("[%s] Upload progress: %d%%", channel_id, pct)

    video_id = response.get("id")
    logger.info("[%s] Uploaded video ID: %s (scheduled %s)", channel_id, video_id, publish_at)

    # Set custom thumbnail if provided
    if thumbnail_path and os.path.exists(thumbnail_path) and video_id:
        try:
            youtube.thumbnails().set(
                videoId=video_id,
                media_body=googleapiclient.http.MediaFileUpload(
                    thumbnail_path, mimetype="image/jpeg"
                ),
            ).execute()
            logger.info("[%s] Thumbnail uploaded for video %s", channel_id, video_id)
        except Exception as exc:
            logger.warning("[%s] Thumbnail upload failed: %s", channel_id, exc)

    return video_id
