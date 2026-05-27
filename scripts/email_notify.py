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
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


def send_email(subject: str, body: str, body_html: str = "") -> bool:
    """Send an email via Gmail SMTP. Sends HTML if provided, plain text otherwise."""
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

    msg.attach(MIMEText(body, "plain"))
    if body_html:
        msg.attach(MIMEText(body_html, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15) as server:
            server.login(sender, password)
            server.sendmail(sender, recipient, msg.as_string())
        logger.info("Email sent to %s: %s", recipient, subject)
        return True
    except Exception as exc:
        logger.error("Email send failed: %s", exc)
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
