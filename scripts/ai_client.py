"""
AI Client backed by Groq (free tier — no credit card required).
Primary model: llama-3.3-70b-versatile
Fallback model: llama-3.1-8b-instant (faster, lower rate-limit cost)

Get a free API key at https://console.groq.com
"""

import logging
import os
import time
from typing import Optional

from dotenv import load_dotenv
from groq import Groq, RateLimitError, APIStatusError

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

PRIMARY_MODEL = "llama-3.3-70b-versatile"
FALLBACK_MODEL = "llama-3.1-8b-instant"

MAX_RETRIES = 3
RETRY_DELAY = 2.0


class AIClient:
    """
    Groq-backed LLM client.
    Tries PRIMARY_MODEL first; falls back to FALLBACK_MODEL on rate-limit or error.
    Both models are available on Groq's free tier.
    """

    def __init__(self):
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY is not set. "
                "Get a free key at https://console.groq.com and add it to your .env / GitHub Secrets."
            )
        self._client = Groq(api_key=api_key)
        logger.info("Groq client initialized (primary=%s, fallback=%s).", PRIMARY_MODEL, FALLBACK_MODEL)

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
        return response.choices[0].message.content

    def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> str:
        """
        Generate text using Groq. Tries PRIMARY_MODEL with retries, then FALLBACK_MODEL.

        Returns:
            Generated text string.

        Raises:
            RuntimeError: When all attempts are exhausted.
        """
        for model in (PRIMARY_MODEL, FALLBACK_MODEL):
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    logger.info("Groq [%s] attempt %d/%d — %.60s…", model, attempt, MAX_RETRIES, prompt)
                    result = self._call(model, prompt, system_prompt, max_tokens, temperature)
                    logger.info("Groq [%s] succeeded on attempt %d.", model, attempt)
                    return result
                except RateLimitError as exc:
                    wait = RETRY_DELAY * attempt
                    logger.warning("Groq [%s] rate limit on attempt %d — waiting %.0fs: %s", model, attempt, wait, exc)
                    if attempt < MAX_RETRIES:
                        time.sleep(wait)
                except APIStatusError as exc:
                    logger.warning("Groq [%s] API error on attempt %d: %s", model, attempt, exc)
                    if attempt < MAX_RETRIES:
                        time.sleep(RETRY_DELAY)
                except Exception as exc:  # pylint: disable=broad-except
                    logger.warning("Groq [%s] unexpected error on attempt %d: %s", model, attempt, exc)
                    if attempt < MAX_RETRIES:
                        time.sleep(RETRY_DELAY)
            logger.warning("Groq [%s] exhausted all %d attempts — trying next model.", model, MAX_RETRIES)

        raise RuntimeError(
            f"All Groq models ({PRIMARY_MODEL}, {FALLBACK_MODEL}) failed after retries. "
            "Check your GROQ_API_KEY and https://console.groq.com for quota status."
        )


# Module-level singleton
_client_instance: Optional[AIClient] = None


def get_client() -> AIClient:
    """Return the module-level AIClient singleton, creating it on first call."""
    global _client_instance  # pylint: disable=global-statement
    if _client_instance is None:
        _client_instance = AIClient()
    return _client_instance
