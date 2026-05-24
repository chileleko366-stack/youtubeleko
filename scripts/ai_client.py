"""
AI Client — Pollinations.ai text API (completely free, no API key required).
Falls back to Groq if GROQ_API_KEY env var is set.

Pollinations: https://text.pollinations.ai/ — no account, no key, no limits.
"""

import logging
import os
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

POLLINATIONS_URL = "https://text.pollinations.ai/"

# Groq fallback — only used if GROQ_API_KEY is set in environment
GROQ_BASE_URL  = "https://api.groq.com/openai/v1"
GROQ_MODELS    = ("openai/gpt-oss-120b", "llama-3.3-70b-versatile")

MAX_RETRIES  = 4
RETRY_DELAY  = 8.0


class AIClient:
    """
    Primary: Pollinations.ai — no API key, free, unlimited.
    Fallback: Groq — used only when GROQ_API_KEY is present.
    """

    def __init__(self):
        self._groq = None
        groq_key = os.environ.get("GROQ_API_KEY")
        if groq_key:
            try:
                from openai import OpenAI as _OpenAI
                self._groq = _OpenAI(api_key=groq_key, base_url=GROQ_BASE_URL)
                logger.info("Groq fallback ready (%s).", GROQ_MODELS[0])
            except Exception as exc:  # pylint: disable=broad-except
                logger.warning("Could not init Groq fallback: %s", exc)
        logger.info("AIClient ready — primary=pollinations, groq_fallback=%s", bool(self._groq))

    # ------------------------------------------------------------------
    # Pollinations
    # ------------------------------------------------------------------

    def _call_pollinations(self, messages: list, temperature: float) -> str:
        payload = {
            "messages": messages,
            "model": "openai",
            "private": True,
            "seed": int(time.time()) % 99999,
            "temperature": temperature,
        }
        resp = _http.post(POLLINATIONS_URL, json=payload, timeout=120)
        resp.raise_for_status()
        content = resp.text.strip()
        if not content:
            raise ValueError("Pollinations returned empty response")
        return content

    # ------------------------------------------------------------------
    # Groq fallback
    # ------------------------------------------------------------------

    def _call_groq(self, model: str, messages: list, max_tokens: int, temperature: float) -> str:
        from openai import RateLimitError, APIStatusError  # pylint: disable=import-outside-toplevel
        response = self._groq.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        content = response.choices[0].message.content
        if not content or not content.strip():
            raise ValueError("Groq returned empty response")
        return content

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> str:
        """
        Generate text. Tries Pollinations first (no key), then Groq if configured.
        Raises RuntimeError when all providers are exhausted.
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        last_err: Exception = RuntimeError("no attempts made")

        # ── Pollinations (primary, keyless) ───────────────────────────
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                logger.info("Pollinations attempt %d/%d — %.60s…", attempt, MAX_RETRIES, prompt)
                result = self._call_pollinations(messages, temperature)
                logger.info("Pollinations succeeded on attempt %d.", attempt)
                return result
            except Exception as exc:  # pylint: disable=broad-except
                last_err = exc
                wait = RETRY_DELAY * attempt
                logger.warning("Pollinations attempt %d failed (%s) — retrying in %.0fs", attempt, exc, wait)
                if attempt < MAX_RETRIES:
                    time.sleep(wait)

        logger.warning("Pollinations exhausted after %d attempts.", MAX_RETRIES)

        # ── Groq fallback (optional) ───────────────────────────────────
        if self._groq:
            for model in GROQ_MODELS:
                for attempt in range(1, 3):
                    try:
                        logger.info("Groq [%s] fallback attempt %d — %.60s…", model, attempt, prompt)
                        result = self._call_groq(model, messages, max_tokens, temperature)
                        logger.info("Groq [%s] fallback succeeded.", model)
                        return result
                    except Exception as exc:  # pylint: disable=broad-except
                        last_err = exc
                        logger.warning("Groq [%s] fallback attempt %d failed: %s", model, attempt, exc)
                        if attempt < 2:
                            time.sleep(RETRY_DELAY)

        raise RuntimeError(
            f"All AI providers failed. Last error: {last_err}\n"
            "Pollinations.ai is the primary (no key needed). "
            "Optionally set GROQ_API_KEY for a Groq fallback."
        )


_client_instance: Optional[AIClient] = None


def get_client() -> AIClient:
    """Return the module-level AIClient singleton."""
    global _client_instance  # pylint: disable=global-statement
    if _client_instance is None:
        _client_instance = AIClient()
    return _client_instance
