"""
AI Client using Google Gemini's OpenAI-compatible endpoint.
Primary model   : gemini-2.0-flash  (1,500 req/day free, 4M TPM — no daily token cap issues)
Fallback model  : gemini-1.5-flash
Fallback model 2: gemini-1.5-flash-8b
"""

import logging
import os
import time
from typing import Optional

from dotenv import load_dotenv
from openai import OpenAI, RateLimitError, APIStatusError

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

GEMINI_BASE_URL  = "https://generativelanguage.googleapis.com/v1beta/openai/"
PRIMARY_MODEL    = "gemini-2.0-flash"
FALLBACK_MODEL   = "gemini-1.5-flash"
FALLBACK_MODEL_2 = "gemini-1.5-flash-8b"

MAX_RETRIES = 3
RETRY_DELAY = 2.0


class AIClient:
    """
    LLM client backed by Google Gemini's OpenAI-compatible API.
    Tries PRIMARY_MODEL first; falls back through FALLBACK_MODEL and FALLBACK_MODEL_2.
    """

    def __init__(self):
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. "
                "Get a free key at https://aistudio.google.com/apikey and add it to GitHub Secrets."
            )
        self._client = OpenAI(api_key=api_key, base_url=GEMINI_BASE_URL)
        logger.info(
            "Gemini client ready (primary=%s, fallback=%s, fallback2=%s).",
            PRIMARY_MODEL, FALLBACK_MODEL, FALLBACK_MODEL_2,
        )

    def _call(self, model: str, prompt: str, system_prompt: str, max_tokens: int, temperature: float) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = self._client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        content = response.choices[0].message.content
        if not content or not content.strip():
            raise ValueError("LLM returned empty response — treating as retryable error")
        return content

    def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> str:
        """
        Generate text. Tries PRIMARY_MODEL with retries, then fallbacks.

        Raises:
            RuntimeError: when all attempts are exhausted.
        """
        for model in (PRIMARY_MODEL, FALLBACK_MODEL, FALLBACK_MODEL_2):
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    logger.info("Gemini [%s] attempt %d/%d — %.60s…", model, attempt, MAX_RETRIES, prompt)
                    result = self._call(model, prompt, system_prompt, max_tokens, temperature)
                    logger.info("Gemini [%s] succeeded on attempt %d.", model, attempt)
                    return result
                except RateLimitError as exc:
                    wait = RETRY_DELAY * attempt
                    logger.warning("Gemini [%s] rate limit (attempt %d) — waiting %.0fs: %s", model, attempt, wait, exc)
                    if attempt < MAX_RETRIES:
                        time.sleep(wait)
                except APIStatusError as exc:
                    logger.warning("Gemini [%s] API error on attempt %d: %s", model, attempt, exc)
                    if attempt < MAX_RETRIES:
                        time.sleep(RETRY_DELAY)
                except Exception as exc:  # pylint: disable=broad-except
                    logger.warning("Gemini [%s] unexpected error on attempt %d: %s", model, attempt, exc)
                    if attempt < MAX_RETRIES:
                        time.sleep(RETRY_DELAY)
            logger.warning("Gemini [%s] exhausted — trying fallback.", model)

        raise RuntimeError(
            f"All Gemini models ({PRIMARY_MODEL}, {FALLBACK_MODEL}, {FALLBACK_MODEL_2}) "
            "failed after retries. Check GEMINI_API_KEY at https://aistudio.google.com/apikey"
        )


_client_instance: Optional[AIClient] = None


def get_client() -> AIClient:
    """Return the module-level AIClient singleton."""
    global _client_instance  # pylint: disable=global-statement
    if _client_instance is None:
        _client_instance = AIClient()
    return _client_instance
