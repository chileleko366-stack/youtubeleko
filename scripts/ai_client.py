"""
AI Client with Claude primary and Gemini fallback.
Provides a unified interface for LLM text generation.
"""

import os
import logging
import time
from typing import Optional

import anthropic
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

CLAUDE_MODEL = "claude-sonnet-4-6"
GEMINI_MODEL = "gemini-1.5-flash"

MAX_RETRIES = 3
RETRY_DELAY = 2.0


class AIClient:
    """
    Unified AI client that uses Claude as primary LLM with Gemini as fallback.
    Handles retries, error logging, and provider switching transparently.
    """

    def __init__(self):
        self._anthropic_client: Optional[anthropic.Anthropic] = None
        self._gemini_configured = False
        self._init_clients()

    def _init_clients(self):
        """Initialize API clients from environment variables."""
        anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
        if anthropic_key:
            self._anthropic_client = anthropic.Anthropic(api_key=anthropic_key)
            logger.info("Anthropic/Claude client initialized.")
        else:
            logger.warning("ANTHROPIC_API_KEY not set; Claude will be unavailable.")

        gemini_key = os.environ.get("GEMINI_API_KEY")
        if gemini_key:
            genai.configure(api_key=gemini_key)
            self._gemini_configured = True
            logger.info("Google Gemini client initialized.")
        else:
            logger.warning("GEMINI_API_KEY not set; Gemini fallback will be unavailable.")

    def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 4096,
        temperature: float = 0.7,
    ) -> str:
        """
        Generate text using Claude, falling back to Gemini on failure.

        Args:
            prompt: User prompt / content to send.
            system_prompt: Optional system-level instructions.
            max_tokens: Maximum tokens in the response.
            temperature: Sampling temperature (0.0 – 1.0).

        Returns:
            Generated text string.

        Raises:
            RuntimeError: When all providers and retries are exhausted.
        """
        # Try Claude first
        if self._anthropic_client:
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    logger.info(
                        "Claude attempt %d/%d for prompt (%.60s…)",
                        attempt,
                        MAX_RETRIES,
                        prompt,
                    )
                    messages = [{"role": "user", "content": prompt}]
                    kwargs = {
                        "model": CLAUDE_MODEL,
                        "max_tokens": max_tokens,
                        "temperature": temperature,
                        "messages": messages,
                    }
                    if system_prompt:
                        kwargs["system"] = system_prompt

                    response = self._anthropic_client.messages.create(**kwargs)
                    result = response.content[0].text
                    logger.info("Claude succeeded on attempt %d.", attempt)
                    return result
                except anthropic.RateLimitError as exc:
                    logger.warning("Claude rate limit on attempt %d: %s", attempt, exc)
                    if attempt < MAX_RETRIES:
                        time.sleep(RETRY_DELAY * attempt)
                except anthropic.APIStatusError as exc:
                    logger.warning("Claude API error on attempt %d: %s", attempt, exc)
                    if attempt < MAX_RETRIES:
                        time.sleep(RETRY_DELAY)
                except Exception as exc:  # pylint: disable=broad-except
                    logger.warning("Claude unexpected error on attempt %d: %s", attempt, exc)
                    if attempt < MAX_RETRIES:
                        time.sleep(RETRY_DELAY)

        # Fallback to Gemini
        if self._gemini_configured:
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    logger.info(
                        "Gemini fallback attempt %d/%d for prompt (%.60s…)",
                        attempt,
                        MAX_RETRIES,
                        prompt,
                    )
                    model = genai.GenerativeModel(
                        model_name=GEMINI_MODEL,
                        system_instruction=system_prompt if system_prompt else None,
                        generation_config=genai.GenerationConfig(
                            max_output_tokens=max_tokens,
                            temperature=temperature,
                        ),
                    )
                    response = model.generate_content(prompt)
                    result = response.text
                    logger.info("Gemini succeeded on attempt %d.", attempt)
                    return result
                except Exception as exc:  # pylint: disable=broad-except
                    logger.warning("Gemini error on attempt %d: %s", attempt, exc)
                    if attempt < MAX_RETRIES:
                        time.sleep(RETRY_DELAY)

        raise RuntimeError(
            "All LLM providers (Claude + Gemini) failed after retries. "
            "Check API keys and quota."
        )


# Module-level singleton
_client_instance: Optional[AIClient] = None


def get_client() -> AIClient:
    """Return the module-level AIClient singleton, creating it on first call."""
    global _client_instance  # pylint: disable=global-statement
    if _client_instance is None:
        _client_instance = AIClient()
    return _client_instance
