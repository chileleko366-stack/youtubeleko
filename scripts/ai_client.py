"""
AI Client — tries EVERY free provider in priority order until one succeeds.

Provider priority (add keys to GitHub Secrets — all are free, no credit card):
  1. Groq         — GROQ_API_KEY                                     200K TPD  console.groq.com
  2. Cerebras     — CEREBRAS_API_KEY                                  free tier cloud.cerebras.ai
  3. SambaNova    — SAMBANOVA_API_KEY                               generous   cloud.sambanova.ai
  4. Gemini       — GEMINI_API_KEY (from aistudio.google.com ONLY!)  1M TPD    aistudio.google.com
  5. GitHub       — GITHUB_TOKEN (auto-set in Actions, no secret!)   150 RPD   models.inference.ai.azure.com
  6. OpenRouter   — OPENROUTER_KEY                                   limited   openrouter.ai
  7. Cloudflare   — CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID    10K TPD   ai.cloudflare.com
  8. Pollinations — no key needed                                  unlimited  text.pollinations.ai (last resort)

IMPORTANT for Gemini: key MUST come from aistudio.google.com, NOT Google Cloud Console.
GCP project keys have free_tier_requests=0 and will 429 on every call.

Recommended minimum: GROQ_API_KEY + CEREBRAS_API_KEY in GitHub Secrets (both free, no CC).
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
# Provider definitions — all OpenAI-compatible except Cloudflare + Pollinations
# ---------------------------------------------------------------------------

_OPENAI_COMPAT_PROVIDERS = [
    {
        "name": "Groq",
        "env_key": "GROQ_API_KEY",
        "base_url": "https://api.groq.com/openai/v1",
        "models": ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile"],
    },
    {
        # Free tier only includes 8B — 70B models return 404 without a paid plan
        "name": "Cerebras",
        "env_key": "CEREBRAS_API_KEY",
        "base_url": "https://api.cerebras.ai/v1",
        "models": ["llama3.1-8b"],
    },
    {
        "name": "SambaNova",
        "env_key": "SAMBANOVA_API_KEY",
        "base_url": "https://api.sambanova.ai/v1",
        "models": ["Meta-Llama-3.3-70B-Instruct", "Qwen2.5-72B-Instruct"],
    },
    {
        # MUST use an AI Studio key (aistudio.google.com) — GCP project keys return limit=0
        "name": "Gemini",
        "env_key": "GEMINI_API_KEY",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "models": ["gemini-2.0-flash-lite", "gemini-2.0-flash"],
    },
    {
        # GITHUB_TOKEN is automatically injected in GitHub Actions — no secret needed
        "name": "GitHub Models",
        "env_key": "GITHUB_TOKEN",
        "base_url": "https://models.inference.ai.azure.com",
        "models": ["meta-llama/Llama-3.3-70B-Instruct", "gpt-4o-mini"],
        "extra_headers": {"X-GitHub-Api-Version": "2022-11-28"},
    },
    {
        "name": "OpenRouter",
        "env_key": "OPENROUTER_KEY",
        "base_url": "https://openrouter.ai/api/v1",
        "models": [
            "meta-llama/llama-3.3-70b-instruct:free",
            "deepseek/deepseek-chat-v3-0324:free",
            "google/gemma-3-27b-it:free",
        ],
        "extra_headers": {"HTTP-Referer": "https://github.com/youtubeleko"},
    },
]

# ---------------------------------------------------------------------------
# Generic OpenAI-compatible generate (used by all providers above)
# ---------------------------------------------------------------------------

def _is_permanent_error(exc: Exception) -> bool:
    """Return True if retrying this error is pointless."""
    text = str(exc)
    return any(s in text for s in [
        "limit: 0",                # Gemini GCP key — free tier disabled at account level
        "free_tier_requests",      # same Gemini error, different message fragment
        "Credit limit exceeded",   # Together AI / paid services
        "credit_limit",
        "model_not_found",         # 404 wrong model name — skip immediately
        "does not exist or you do not have access",
    ])


def _is_connection_error(exc: Exception) -> bool:
    """Return True for network-level failures where retrying quickly won't help."""
    text = str(exc)
    return "Connection error" in text or "ConnectionError" in type(exc).__name__


def _openai_compat_generate(
    client,
    models: list,
    provider_name: str,
    messages: list,
    max_tokens: int,
    temperature: float,
) -> str:
    for model in models:
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                logger.info("%s [%s] attempt %d/%d", provider_name, model, attempt, MAX_RETRIES)
                resp = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=temperature,
                )
                content = resp.choices[0].message.content
                if not content or not content.strip():
                    raise ValueError("Empty response")
                logger.info("%s [%s] succeeded.", provider_name, model)
                return content
            except Exception as exc:
                if _is_permanent_error(exc):
                    logger.warning("%s [%s]: permanent error, skipping immediately: %s", provider_name, model, exc)
                    break  # try next model (or exhaust)
                if _is_connection_error(exc):
                    logger.warning("%s [%s]: connection error, not retrying: %s", provider_name, model, exc)
                    break  # try next model immediately
                wait = _parse_retry_after(exc) or (RETRY_DELAY * attempt)
                logger.warning(
                    "%s [%s] attempt %d failed (%.0fs wait): %s",
                    provider_name, model, attempt, wait, exc,
                )
                if attempt < MAX_RETRIES:
                    time.sleep(wait)
    raise RuntimeError(f"{provider_name}: exhausted all models and retries")


def _parse_retry_after(exc: Exception) -> Optional[float]:
    """Extract a wait time from rate-limit error messages across providers."""
    try:
        text = str(exc)
        # Groq: "try again in 1m30.5s"
        m = re.search(r"try again in (\d+)m(\d+\.?\d*)s", text)
        if m:
            return min(int(m.group(1)) * 60 + float(m.group(2)) + 2.0, 300.0)
        # Gemini / generic: "Please retry in 1.2s" or "retry after 60 seconds"
        m = re.search(r"(?:retry|wait)[^\d]*?(\d+\.?\d*)\s*s", text, re.IGNORECASE)
        if m:
            return min(float(m.group(1)) + 2.0, 300.0)
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Cloudflare Workers AI (custom HTTP — not OpenAI-compatible)
# ---------------------------------------------------------------------------

_CF_MODELS = [
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "@cf/meta/llama-3.1-8b-instruct",
]


def _cloudflare_generate(
    api_token: str,
    account_id: str,
    messages: list,
    max_tokens: int,
    temperature: float,
) -> str:
    for model in _CF_MODELS:
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                logger.info("Cloudflare [%s] attempt %d/%d", model, attempt, MAX_RETRIES)
                url = (
                    f"https://api.cloudflare.com/client/v4/accounts/"
                    f"{account_id}/ai/run/{model}"
                )
                resp = _http.post(
                    url,
                    json={
                        "messages": messages,
                        "max_tokens": max_tokens,
                        "temperature": temperature,
                    },
                    headers={
                        "Authorization": f"Bearer {api_token}",
                        "Content-Type": "application/json",
                    },
                    timeout=120,
                )
                resp.raise_for_status()
                data = resp.json()
                if not data.get("success"):
                    raise ValueError(f"API error: {data.get('errors')}")
                content = data["result"]["response"].strip()
                if not content:
                    raise ValueError("Empty response")
                logger.info("Cloudflare [%s] succeeded.", model)
                return content
            except Exception as exc:
                logger.warning("Cloudflare [%s] attempt %d failed: %s", model, attempt, exc)
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_DELAY * attempt)
    raise RuntimeError("Cloudflare: exhausted all models and retries")


# ---------------------------------------------------------------------------
# Pollinations (no key needed — always available as last resort)
# ---------------------------------------------------------------------------

_POLLINATIONS_URL = "https://text.pollinations.ai/"


def _pollinations_generate(messages: list, temperature: float) -> str:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            logger.info("Pollinations attempt %d/%d", attempt, MAX_RETRIES)
            # No Referer/Origin headers — those trigger "authenticated user" deprecation mode
            resp = _http.post(
                _POLLINATIONS_URL,
                json={
                    "messages": messages,
                    "model": "openai",
                    "private": True,
                    "seed": int(time.time()) % 99999,
                    "temperature": temperature,
                    "jsonMode": True,
                },
                headers={"Content-Type": "application/json"},
                timeout=120,
            )
            resp.raise_for_status()
            content = resp.text.strip()
            logger.info("Pollinations raw response (first 300 chars): %r", content[:300])
            if not content:
                raise ValueError("Empty response")
            if content.startswith("⚠️") or "being deprecated" in content:
                raise ValueError("Pollinations returned deprecation notice instead of JSON")
            logger.info("Pollinations succeeded.")
            return content
        except Exception as exc:
            logger.warning("Pollinations attempt %d failed: %s", attempt, exc)
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY * attempt)
    raise RuntimeError("Pollinations: exhausted all retries")


# ---------------------------------------------------------------------------
# AIClient — multi-provider with automatic fallback
# ---------------------------------------------------------------------------

def _make_openai_fn(client, models, name):
    """Factory to avoid lambda closure issues in loops."""
    return lambda msgs, tok, tmp: _openai_compat_generate(client, models, name, msgs, tok, tmp)


def _make_cf_fn(token, account):
    return lambda msgs, tok, tmp: _cloudflare_generate(token, account, msgs, tok, tmp)


class AIClient:
    """
    Tries every configured free AI provider in priority order.
    Exposes `last_provider` (str) after each successful generate() call.

    At minimum Pollinations works with zero configuration — but add
    GROQ_API_KEY and CEREBRAS_API_KEY to GitHub Secrets for 1.2M+ tokens/day free.
    """

    def __init__(self):
        from openai import OpenAI  # pylint: disable=import-outside-toplevel

        self._provider_fns: list = []
        self.last_provider: Optional[str] = None

        # OpenAI-compatible providers (priority 1–7)
        for cfg in _OPENAI_COMPAT_PROVIDERS:
            key = os.environ.get(cfg["env_key"])
            if not key:
                continue
            kwargs = {"api_key": key, "base_url": cfg["base_url"]}
            extra = cfg.get("extra_headers", {})
            if extra:
                kwargs["default_headers"] = extra
            client = OpenAI(**kwargs)
            name = cfg["name"]
            self._provider_fns.append((name, _make_openai_fn(client, cfg["models"], name)))
            logger.info("Provider enabled: %s", name)

        # Cloudflare (priority 8)
        cf_token = os.environ.get("CLOUDFLARE_API_TOKEN")
        cf_account = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
        if cf_token and cf_account:
            self._provider_fns.append(("Cloudflare", _make_cf_fn(cf_token, cf_account)))
            logger.info("Provider enabled: Cloudflare")

        # Pollinations — always last resort (priority 9)
        self._provider_fns.append((
            "Pollinations",
            lambda msgs, tok, tmp: _pollinations_generate(msgs, tmp),
        ))
        logger.info("Provider enabled: Pollinations (last resort, no key required)")

        named = [n for n, _ in self._provider_fns if n != "Pollinations"]
        if not named:
            logger.warning(
                "No API keys configured — using Pollinations only (unreliable). "
                "Add GROQ_API_KEY to GitHub Secrets for free at console.groq.com, "
                "or CEREBRAS_API_KEY at cloud.cerebras.ai. Both are no-credit-card free."
            )

    @property
    def active_provider_names(self) -> list:
        return [n for n, _ in self._provider_fns]

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
        for name, fn in self._provider_fns:
            try:
                result = fn(messages, max_tokens, temperature)
                self.last_provider = name
                return result
            except Exception as exc:
                errors.append(f"{name}: {exc}")
                logger.warning("Provider %s failed, trying next: %s", name, exc)

        raise RuntimeError(
            "ALL AI providers failed:\n"
            + "\n".join(f"  - {e}" for e in errors)
            + "\n\nFix: add GROQ_API_KEY + CEREBRAS_API_KEY to GitHub Secrets (both free, no CC)."
        )


_client_instance: Optional[AIClient] = None


def get_client() -> AIClient:
    """Return the module-level AIClient singleton."""
    global _client_instance  # pylint: disable=global-statement
    if _client_instance is None:
        _client_instance = AIClient()
    return _client_instance
