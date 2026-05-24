"""
AI Client — tries multiple free providers in order until one succeeds.

Provider priority (use whichever key is set):
  1. Groq        — GROQ_API_KEY    (free at console.groq.com, 200K tokens/day)
  2. OpenRouter  — OPENROUTER_KEY  (free at openrouter.ai, 200 req/day free models)
  3. Pollinations — no key needed   (https://text.pollinations.ai, attempted last)

Set at least ONE key in GitHub Secrets. Groq is recommended — the pipeline
uses ~120K tokens/day total (under the 200K free limit) when run once per day.
"""

import logging
import os
import re
import time
from typing import Optional

import requests as _http
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

MAX_RETRIES = 3
RETRY_DELAY = 5.0


# ---------------------------------------------------------------------------
# Groq
# ---------------------------------------------------------------------------

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GROQ_MODELS   = ("openai/gpt-oss-120b", "llama-3.3-70b-versatile")


def _groq_generate(client, messages: list, max_tokens: int, temperature: float) -> str:
    for model in GROQ_MODELS:
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                logger.info("Groq [%s] attempt %d/%d", model, attempt, MAX_RETRIES)
                resp = client.chat.completions.create(
                    model=model, messages=messages,
                    max_tokens=max_tokens, temperature=temperature,
                )
                content = resp.choices[0].message.content
                if not content or not content.strip():
                    raise ValueError("Empty response")
                logger.info("Groq [%s] succeeded.", model)
                return content
            except Exception as exc:
                wait = _parse_groq_retry(exc) or (RETRY_DELAY * attempt)
                logger.warning("Groq [%s] attempt %d failed (%.0fs wait): %s", model, attempt, wait, exc)
                if attempt < MAX_RETRIES:
                    time.sleep(wait)
    raise RuntimeError("Groq exhausted all models and retries")


def _parse_groq_retry(exc: Exception) -> Optional[float]:
    try:
        match = re.search(r"try again in (\d+)m(\d+\.?\d*)s", str(exc))
        if match:
            return min(int(match.group(1)) * 60 + float(match.group(2)) + 2.0, 300.0)
    except Exception:  # pylint: disable=broad-except
        pass
    return None


# ---------------------------------------------------------------------------
# OpenRouter (free models)
# ---------------------------------------------------------------------------

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_MODELS   = (
    "meta-llama/llama-3.3-70b-instruct:free",
    "deepseek/deepseek-chat-v3-0324:free",
    "google/gemma-3-27b-it:free",
)


def _openrouter_generate(client, messages: list, max_tokens: int, temperature: float) -> str:
    for model in OPENROUTER_MODELS:
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                logger.info("OpenRouter [%s] attempt %d/%d", model, attempt, MAX_RETRIES)
                resp = client.chat.completions.create(
                    model=model, messages=messages,
                    max_tokens=max_tokens, temperature=temperature,
                    extra_headers={"HTTP-Referer": "https://github.com/youtubeleko"},
                )
                content = resp.choices[0].message.content
                if not content or not content.strip():
                    raise ValueError("Empty response")
                logger.info("OpenRouter [%s] succeeded.", model)
                return content
            except Exception as exc:
                logger.warning("OpenRouter [%s] attempt %d failed: %s", model, attempt, exc)
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_DELAY * attempt)
    raise RuntimeError("OpenRouter exhausted all models and retries")


# ---------------------------------------------------------------------------
# Pollinations (no key needed)
# ---------------------------------------------------------------------------

POLLINATIONS_URL = "https://text.pollinations.ai/"


def _pollinations_generate(messages: list, temperature: float) -> str:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            logger.info("Pollinations attempt %d/%d", attempt, MAX_RETRIES)
            resp = _http.post(
                POLLINATIONS_URL,
                json={
                    "messages": messages,
                    "model": "openai",
                    "private": True,
                    "seed": int(time.time()) % 99999,
                    "temperature": temperature,
                },
                headers={
                    "Content-Type": "application/json",
                    "Referer": "https://pollinations.ai",
                    "Origin": "https://pollinations.ai",
                },
                timeout=120,
            )
            resp.raise_for_status()
            content = resp.text.strip()
            if not content:
                raise ValueError("Empty response")
            logger.info("Pollinations succeeded.")
            return content
        except Exception as exc:
            logger.warning("Pollinations attempt %d failed: %s", attempt, exc)
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY * attempt)
    raise RuntimeError("Pollinations exhausted all retries")


# ---------------------------------------------------------------------------
# AIClient
# ---------------------------------------------------------------------------

class AIClient:
    """
    Multi-provider LLM client. Tries configured providers in priority order.
    Requires at least one of: GROQ_API_KEY or OPENROUTER_KEY.
    Falls back to Pollinations (no key) as last resort.
    """

    def __init__(self):
        from openai import OpenAI  # pylint: disable=import-outside-toplevel

        self._groq = None
        self._openrouter = None

        groq_key = os.environ.get("GROQ_API_KEY")
        if groq_key:
            self._groq = OpenAI(api_key=groq_key, base_url=GROQ_BASE_URL)
            logger.info("Provider: Groq enabled (primary).")

        or_key = os.environ.get("OPENROUTER_KEY")
        if or_key:
            self._openrouter = OpenAI(api_key=or_key, base_url=OPENROUTER_BASE_URL)
            logger.info("Provider: OpenRouter enabled.")

        logger.info(
            "Provider: Pollinations enabled (no key, last resort)."
        )

        if not self._groq and not self._openrouter:
            logger.warning(
                "No AI API key set. Using Pollinations only — set GROQ_API_KEY "
                "in GitHub Secrets for more reliable generation. "
                "Free key at console.groq.com (no credit card needed)."
            )

    def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        errors = []

        if self._groq:
            try:
                return _groq_generate(self._groq, messages, max_tokens, temperature)
            except Exception as exc:
                errors.append(f"Groq: {exc}")
                logger.warning("Groq failed, trying next provider: %s", exc)

        if self._openrouter:
            try:
                return _openrouter_generate(self._openrouter, messages, max_tokens, temperature)
            except Exception as exc:
                errors.append(f"OpenRouter: {exc}")
                logger.warning("OpenRouter failed, trying next provider: %s", exc)

        try:
            return _pollinations_generate(messages, temperature)
        except Exception as exc:
            errors.append(f"Pollinations: {exc}")

        raise RuntimeError(
            "All AI providers failed:\n" + "\n".join(f"  - {e}" for e in errors) + "\n"
            "Set GROQ_API_KEY in GitHub Secrets (free at console.groq.com)."
        )


_client_instance: Optional[AIClient] = None


def get_client() -> AIClient:
    """Return the module-level AIClient singleton."""
    global _client_instance  # pylint: disable=global-statement
    if _client_instance is None:
        _client_instance = AIClient()
    return _client_instance
