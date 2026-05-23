"""
Telegram bot notifications for pipeline status updates.
"""

import logging
import os
from datetime import date
from typing import Dict, List, Optional

import requests
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

TELEGRAM_API_BASE = "https://api.telegram.org/bot"


def send_message(text: str, parse_mode: str = "Markdown") -> bool:
    """Send a Telegram message. Returns True on success."""
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")

    if not bot_token or not chat_id:
        logger.warning("Telegram credentials not configured — skipping notification")
        return False

    url = f"{TELEGRAM_API_BASE}{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True,
    }

    try:
        resp = requests.post(url, json=payload, timeout=15)
        resp.raise_for_status()
        return True
    except Exception as exc:
        logger.error("Telegram send failed: %s", exc)
        return False


def notify_pipeline_start(pipeline: str, channel_count: int = 5):
    """Notify that a pipeline has started."""
    today = date.today().isoformat()
    send_message(
        f"🚀 *{pipeline} Pipeline Started*\n"
        f"Date: `{today}`\n"
        f"Channels: {channel_count}"
    )


def notify_script_generated(channel_id: str, channel_name: str, title: str, word_count: int):
    """Notify that a script has been generated."""
    send_message(
        f"📝 *Script Generated*\n"
        f"Channel: {channel_name} (`{channel_id}`)\n"
        f"Title: _{title}_\n"
        f"Words: {word_count:,}"
    )


def notify_success(channel_id: str, channel_name: str, title: str, video_id: Optional[str]):
    """Notify that a video was successfully uploaded."""
    url = f"https://youtu.be/{video_id}" if video_id else "N/A"
    send_message(
        f"✅ *Video Uploaded*\n"
        f"Channel: {channel_name} (`{channel_id}`)\n"
        f"Title: _{title}_\n"
        f"URL: {url}"
    )


def notify_error(channel_id: str, stage: str, error: str):
    """Notify that an error occurred in a pipeline stage."""
    truncated = error[:300] if len(error) > 300 else error
    send_message(
        f"❌ *Pipeline Error*\n"
        f"Channel: `{channel_id}`\n"
        f"Stage: {stage}\n"
        f"Error: `{truncated}`"
    )


def notify_daily_summary(results: List[Dict]):
    """Send end-of-day pipeline summary."""
    today = date.today().isoformat()
    success = [r for r in results if r.get("status") == "ok"]
    failed = [r for r in results if r.get("status") != "ok"]

    lines = [
        f"📊 *Daily Summary — {today}*",
        f"✅ Succeeded: {len(success)}/{len(results)}",
    ]

    for r in success:
        lines.append(f"  • {r.get('channel_name', r.get('channel_id'))}: _{r.get('title', 'N/A')}_")

    if failed:
        lines.append(f"\n❌ Failed: {len(failed)}")
        for r in failed:
            lines.append(f"  • {r.get('channel_id')}: {r.get('error', 'unknown error')}")

    send_message("\n".join(lines))
