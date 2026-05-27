"""
Telegram bot notifications for pipeline status updates.
"""

import logging
import os
import time
from datetime import date
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

TELEGRAM_API_BASE = "https://api.telegram.org/bot"
_MAX_RETRIES = 3
_RETRY_DELAY = 3.0


def send_message(text: str, parse_mode: str = "Markdown") -> bool:
    """Send a Telegram message with retry. Returns True on success."""
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

    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            resp = requests.post(url, json=payload, timeout=15)
            resp.raise_for_status()
            return True
        except Exception as exc:
            logger.error("Telegram send failed (attempt %d/%d): %s", attempt, _MAX_RETRIES, exc)
            if attempt < _MAX_RETRIES:
                time.sleep(_RETRY_DELAY * attempt)
    return False


def notify_pipeline_start(pipeline: str, channel_count: int = 5):
    today = date.today().isoformat()
    send_message(
        f"🚀 *{pipeline} Pipeline Started*\n"
        f"Date: `{today}`\n"
        f"Channels: {channel_count}"
    )


def notify_script_generated(channel_id: str, channel_name: str, title: str, word_count: int):
    send_message(
        f"📝 *Script Generated*\n"
        f"Channel: {channel_name} (`{channel_id}`)\n"
        f"Title: _{title}_\n"
        f"Words: {word_count:,}"
    )


def notify_success(channel_id: str, channel_name: str, title: str, video_id: Optional[str]):
    url = f"https://youtu.be/{video_id}" if video_id else "N/A"
    send_message(
        f"✅ *Video Uploaded*\n"
        f"Channel: {channel_name} (`{channel_id}`)\n"
        f"Title: _{title}_\n"
        f"URL: {url}"
    )


def notify_error(channel_id: str, stage: str, error: str):
    truncated = error[:300] if len(error) > 300 else error
    send_message(
        f"❌ *Pipeline Error*\n"
        f"Channel: `{channel_id}`\n"
        f"Stage: {stage}\n"
        f"Error: `{truncated}`"
    )


def send_nightly_summary(results: Dict[str, Any], date_str: str, providers: str) -> None:
    """
    Send nightly pipeline summary including chosen topics per channel.
    results: {ch_id: {"status": "ok"|"error", "topics": [...], "error": "..."}}
    """
    ok = [ch for ch, d in results.items() if d.get("status") == "ok"]

    lines = [
        f"🌙 *Nightly Pipeline — {date_str}*",
        f"AI: `{providers}` | ✅ {len(ok)}/{len(results)} channels\n",
    ]

    for ch_id, data in results.items():
        if data.get("status") == "ok":
            topics = data.get("topics", [])
            chosen_title = topics[0].get("title", "N/A") if topics else "N/A"
            orig = topics[0].get("originality_score", "?") if topics else "?"
            lines.append(f"*{ch_id.upper()}* ✅")
            lines.append(f"  📌 _{chosen_title}_ (orig: {orig}/10)")
            if len(topics) > 1:
                alt = topics[1].get("title", "")
                lines.append(f"  ↳ alt: _{alt}_")
        else:
            err = str(data.get("error", "unknown"))[:120]
            lines.append(f"*{ch_id.upper()}* ❌ `{err}`")

    send_message("\n".join(lines))


def send_scripts_summary(results: Dict[str, Any], date_str: str, providers: str) -> None:
    """
    Send script generation summary with chosen titles per channel.
    results: {ch_id: {"status": "ok"|"error", "title": "...", "failed_stage": "...", "error": "..."}}
    """
    ok = [ch for ch, d in results.items() if d.get("status") == "ok"]

    lines = [
        f"📝 *Scripts Ready — {date_str}*",
        f"AI: `{providers}` | ✅ {len(ok)}/{len(results)} channels\n",
    ]

    for ch_id, data in results.items():
        if data.get("status") == "ok":
            title = data.get("title", "N/A")
            lines.append(f"*{ch_id.upper()}* ✅ _{title}_")
        else:
            stage = data.get("failed_stage", "unknown stage")
            err = str(data.get("error", "unknown"))[:100]
            lines.append(f"*{ch_id.upper()}* ❌ [{stage}] `{err}`")

    send_message("\n".join(lines))


def send_morning_summary(
    results: Dict[str, Any],
    date_str: str,
    fixed: Optional[List[str]] = None,
) -> None:
    """
    Send morning pipeline summary: what worked, what failed, what was auto-fixed.
    results: {ch_id: {"status": "ok"|"error", "title": "...", "video_id": "...",
                       "failed_step": "...", "error": "..."}}
    """
    ok = [ch for ch, d in results.items() if d.get("status") == "ok"]

    lines = [
        f"☀️ *Morning Pipeline — {date_str}*",
        f"✅ {len(ok)}/{len(results)} videos produced\n",
    ]

    for ch_id, data in results.items():
        if data.get("status") == "ok":
            title = data.get("title", "N/A")
            vid = data.get("video_id")
            url_note = f" → youtu.be/{vid}" if vid else ""
            lines.append(f"*{ch_id.upper()}* ✅ _{title}_{url_note}")
        else:
            step = data.get("failed_step", "unknown")
            err = str(data.get("error", "unknown"))[:100]
            lines.append(f"*{ch_id.upper()}* ❌ [{step}] `{err}`")

    if fixed:
        lines.append("\n🔧 *Auto-fixed:*")
        for fix in fixed:
            lines.append(f"  • {fix}")

    send_message("\n".join(lines))


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
