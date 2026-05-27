"""
Gmail notifications via SMTP.

Required GitHub Secrets:
  GMAIL_USER         — your Gmail address (e.g. you@gmail.com)
  GMAIL_APP_PASSWORD — 16-char app password (NOT your login password)
                       Create one at: myaccount.google.com/apppasswords
                       (requires 2-Step Verification to be enabled)
  GMAIL_TO           — recipient address (optional, defaults to GMAIL_USER)
"""

import logging
import os
import smtplib
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

_MAX_RETRIES = 3
_RETRY_DELAY = 5.0


def send_email(subject: str, body_text: str, body_html: Optional[str] = None) -> bool:
    """Send an email via Gmail SMTP with retry. Returns True on success."""
    sender = os.environ.get("GMAIL_USER")
    password = os.environ.get("GMAIL_APP_PASSWORD")

    if not sender or not password:
        logger.warning("Gmail not configured — set GMAIL_USER + GMAIL_APP_PASSWORD in Secrets")
        return False

    recipient = os.environ.get("GMAIL_TO") or sender

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"YoutuBeLeko Pipeline <{sender}>"
    msg["To"] = recipient

    msg.attach(MIMEText(body_text, "plain"))
    if body_html:
        msg.attach(MIMEText(body_html, "html"))

    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15) as server:
                server.login(sender, password)
                server.sendmail(sender, recipient, msg.as_string())
            logger.info("Email sent to %s: %s", recipient, subject)
            return True
        except Exception as exc:
            logger.error("Email send failed (attempt %d/%d): %s", attempt, _MAX_RETRIES, exc)
            if attempt < _MAX_RETRIES:
                time.sleep(_RETRY_DELAY * attempt)
    return False


def notify_pipeline_success(pipeline: str, date_str: str, provider: str = "", details: str = "") -> bool:
    provider_note = f"\nAI provider: {provider}" if provider else ""
    body = (
        f"Pipeline: {pipeline}\n"
        f"Date: {date_str}\n"
        f"Status: SUCCESS{provider_note}"
    )
    if details:
        body += f"\n\n{details}"
    return send_email(f"[YoutuBeLeko] {pipeline} succeeded — {date_str}", body)


def notify_pipeline_failure(pipeline: str, date_str: str, error: str = "") -> bool:
    body = (
        f"Pipeline: {pipeline}\n"
        f"Date: {date_str}\n"
        f"Status: FAILED\n"
    )
    if error:
        body += f"\nError summary:\n{error[:1000]}"
    body += "\n\nCheck GitHub Actions logs for details."
    return send_email(f"[YoutuBeLeko] {pipeline} FAILED — {date_str}", body)


def send_nightly_summary(results: Dict[str, Any], date_str: str, providers: str) -> bool:
    """
    Send nightly pipeline summary email with topics chosen per channel.
    results: {ch_id: {"status": "ok"|"error", "topics": [...], "error": "..."}}
    """
    ok = [ch for ch, d in results.items() if d.get("status") == "ok"]
    failed = [ch for ch, d in results.items() if d.get("status") != "ok"]

    subject = f"[YoutuBeLeko] Nightly — {len(ok)}/{len(results)} channels ready — {date_str}"

    # Plain text
    lines = [
        f"Nightly Pipeline — {date_str}",
        f"AI providers: {providers}",
        f"Result: {len(ok)}/{len(results)} channels succeeded",
        "",
    ]
    for ch_id, data in results.items():
        if data.get("status") == "ok":
            topics = data.get("topics", [])
            chosen = topics[0] if topics else {}
            title = chosen.get("title", "N/A")
            orig = chosen.get("originality_score", "?")
            alt = topics[1].get("title", "") if len(topics) > 1 else ""
            lines.append(f"[{ch_id.upper()}] READY")
            lines.append(f"  Chosen topic:  {title}  (originality: {orig}/10)")
            if alt:
                lines.append(f"  Alt topic:     {alt}")
        else:
            err = str(data.get("error", "unknown"))[:200]
            lines.append(f"[{ch_id.upper()}] FAILED: {err}")
        lines.append("")

    lines.append("Videos will be produced at 04:00 UTC and published at 18:00 UTC.")
    body_text = "\n".join(lines)

    # HTML version
    rows = []
    for ch_id, data in results.items():
        if data.get("status") == "ok":
            topics = data.get("topics", [])
            chosen = topics[0] if topics else {}
            title = chosen.get("title", "N/A")
            orig = chosen.get("originality_score", "?")
            alt = topics[1].get("title", "") if len(topics) > 1 else ""
            alt_row = f"<br><small style='color:#888'>Alt: {alt}</small>" if alt else ""
            rows.append(
                f"<tr><td style='padding:8px;border-bottom:1px solid #eee'>"
                f"<b>{ch_id.upper()}</b></td>"
                f"<td style='padding:8px;border-bottom:1px solid #eee'>"
                f"✅ <b>{title}</b> <small>(orig: {orig}/10)</small>{alt_row}</td></tr>"
            )
        else:
            err = str(data.get("error", "unknown"))[:150]
            rows.append(
                f"<tr><td style='padding:8px;border-bottom:1px solid #eee'>"
                f"<b>{ch_id.upper()}</b></td>"
                f"<td style='padding:8px;border-bottom:1px solid #eee;color:#c00'>"
                f"❌ {err}</td></tr>"
            )

    body_html = f"""
<div style="font-family:sans-serif;max-width:640px;margin:0 auto">
  <h2 style="color:#1a1a2e">🌙 Nightly Pipeline — {date_str}</h2>
  <p><b>AI:</b> {providers} &nbsp;|&nbsp; <b>Result:</b> {len(ok)}/{len(results)} channels ready</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
    <tr style="background:#f5f5f5">
      <th style="padding:8px;text-align:left">Channel</th>
      <th style="padding:8px;text-align:left">Topic chosen for tomorrow</th>
    </tr>
    {"".join(rows)}
  </table>
  <p style="color:#888;font-size:12px;margin-top:24px">
    Videos produce at 04:00 UTC · publish at 18:00 UTC
  </p>
</div>
"""
    return send_email(subject, body_text, body_html)


def send_scripts_summary(results: Dict[str, Any], date_str: str, providers: str) -> bool:
    """
    Send script generation summary email with video titles per channel.
    results: {ch_id: {"status": "ok"|"error", "title": "...", "failed_stage": "...", "error": "..."}}
    """
    ok = [ch for ch, d in results.items() if d.get("status") == "ok"]

    subject = f"[YoutuBeLeko] Scripts ready — {len(ok)}/{len(results)} channels — {date_str}"

    lines = [
        f"Script Generation — {date_str}",
        f"AI providers: {providers}",
        f"Result: {len(ok)}/{len(results)} channels succeeded",
        "",
    ]
    for ch_id, data in results.items():
        if data.get("status") == "ok":
            lines.append(f"[{ch_id.upper()}] OK  — {data.get('title', 'N/A')}")
        else:
            stage = data.get("failed_stage", "unknown stage")
            err = str(data.get("error", "unknown"))[:200]
            lines.append(f"[{ch_id.upper()}] FAILED at [{stage}]: {err}")
    body_text = "\n".join(lines)

    rows = []
    for ch_id, data in results.items():
        if data.get("status") == "ok":
            title = data.get("title", "N/A")
            rows.append(
                f"<tr><td style='padding:8px;border-bottom:1px solid #eee'>"
                f"<b>{ch_id.upper()}</b></td>"
                f"<td style='padding:8px;border-bottom:1px solid #eee'>"
                f"✅ <b>{title}</b></td></tr>"
            )
        else:
            stage = data.get("failed_stage", "?")
            err = str(data.get("error", "unknown"))[:150]
            rows.append(
                f"<tr><td style='padding:8px;border-bottom:1px solid #eee'>"
                f"<b>{ch_id.upper()}</b></td>"
                f"<td style='padding:8px;border-bottom:1px solid #eee;color:#c00'>"
                f"❌ [{stage}] {err}</td></tr>"
            )

    body_html = f"""
<div style="font-family:sans-serif;max-width:640px;margin:0 auto">
  <h2 style="color:#1a1a2e">📝 Scripts Ready — {date_str}</h2>
  <p><b>AI:</b> {providers} &nbsp;|&nbsp; <b>Result:</b> {len(ok)}/{len(results)} channels</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
    <tr style="background:#f5f5f5">
      <th style="padding:8px;text-align:left">Channel</th>
      <th style="padding:8px;text-align:left">Video title</th>
    </tr>
    {"".join(rows)}
  </table>
</div>
"""
    return send_email(subject, body_text, body_html)


def send_morning_summary(
    results: Dict[str, Any],
    date_str: str,
    fixed: Optional[List[str]] = None,
) -> bool:
    """
    Send morning pipeline summary email: what worked, what failed, what was auto-fixed.
    results: {ch_id: {"status": "ok"|"error", "title": "...", "video_id": "...",
                       "failed_step": "...", "error": "..."}}
    """
    ok = [ch for ch, d in results.items() if d.get("status") == "ok"]

    subject = f"[YoutuBeLeko] Morning — {len(ok)}/{len(results)} videos produced — {date_str}"

    lines = [f"Morning Pipeline — {date_str}", f"Result: {len(ok)}/{len(results)} videos produced", ""]
    for ch_id, data in results.items():
        if data.get("status") == "ok":
            title = data.get("title", "N/A")
            vid = data.get("video_id", "")
            url = f" → https://youtu.be/{vid}" if vid else ""
            lines.append(f"[{ch_id.upper()}] OK  — {title}{url}")
        else:
            step = data.get("failed_step", "unknown")
            err = str(data.get("error", "unknown"))[:200]
            lines.append(f"[{ch_id.upper()}] FAILED at [{step}]: {err}")

    if fixed:
        lines.extend(["", "Auto-fixed:"] + [f"  • {f}" for f in fixed])
    body_text = "\n".join(lines)

    rows = []
    for ch_id, data in results.items():
        if data.get("status") == "ok":
            title = data.get("title", "N/A")
            vid = data.get("video_id", "")
            link = f"<a href='https://youtu.be/{vid}'>youtu.be/{vid}</a>" if vid else "—"
            rows.append(
                f"<tr><td style='padding:8px;border-bottom:1px solid #eee'>"
                f"<b>{ch_id.upper()}</b></td>"
                f"<td style='padding:8px;border-bottom:1px solid #eee'>"
                f"✅ <b>{title}</b></td>"
                f"<td style='padding:8px;border-bottom:1px solid #eee'>{link}</td></tr>"
            )
        else:
            step = data.get("failed_step", "?")
            err = str(data.get("error", "unknown"))[:120]
            rows.append(
                f"<tr><td style='padding:8px;border-bottom:1px solid #eee'>"
                f"<b>{ch_id.upper()}</b></td>"
                f"<td style='padding:8px;border-bottom:1px solid #eee;color:#c00' colspan='2'>"
                f"❌ [{step}] {err}</td></tr>"
            )

    fixed_html = ""
    if fixed:
        items = "".join(f"<li>{f}</li>" for f in fixed)
        fixed_html = f"<p><b>🔧 Auto-fixed:</b><ul>{items}</ul></p>"

    body_html = f"""
<div style="font-family:sans-serif;max-width:640px;margin:0 auto">
  <h2 style="color:#1a1a2e">☀️ Morning Pipeline — {date_str}</h2>
  <p><b>Result:</b> {len(ok)}/{len(results)} videos produced and scheduled for 18:00 UTC</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
    <tr style="background:#f5f5f5">
      <th style="padding:8px;text-align:left">Channel</th>
      <th style="padding:8px;text-align:left">Video title</th>
      <th style="padding:8px;text-align:left">Link</th>
    </tr>
    {"".join(rows)}
  </table>
  {fixed_html}
</div>
"""
    return send_email(subject, body_text, body_html)
