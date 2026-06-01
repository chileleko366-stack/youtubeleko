"""
Voiceover generator.

Primary: edge-tts (Microsoft Neural TTS, free, unlimited).
Optional: pluggable paid provider via channel config tts.provider (never enabled
by default).  edge-tts always remains the guaranteed free fallback.

SSML-style prosody improvements applied to edge-tts output:
- Pause markers (commas, periods, [PAUSE]) converted to SSML breaks.
- Hook lines get a slight rate lift (+3%) for energy.
- Highlight words from Stage 5.5 visualSpec get <emphasis> tags where supported.

Optional paid TTS config (OFF by default, never called unless flag is true):
  "tts": {
    "provider": "edge",           // "edge" = free default
    "voice": "en-US-GuyNeural",
    "rate": "+0%",
    "pitch": "+0Hz"
  }

Credit cost note: edge-tts = $0. Any paid provider (e.g. ElevenLabs, Play.ht)
would cost per-character — see provider docs for pricing.
"""

import asyncio
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import edge_tts
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Output directory for all audio files
AUDIO_OUTPUT_DIR = "temp/audio"

# Default voice settings per channel
CHANNEL_VOICE_SETTINGS: Dict[str, Dict[str, Any]] = {
    "ch1": {
        "voice": None,  # CH1 uses celebrity audio clips, no TTS
        "rate": "+0%",
        "pitch": "+0Hz",
        "narrator_mode": False,
    },
    "ch2": {
        "voice": "en-US-GuyNeural",
        "rate": "+0%",
        "pitch": "+0Hz",
        "narrator_mode": True,
    },
    "ch3": {
        "voice": "en-US-GuyNeural",
        "rate": "-8%",
        "pitch": "-2Hz",
        "narrator_mode": True,
    },
    "ch4": {
        "voice": "en-GB-LibbyNeural",
        "rate": "-5%",
        "pitch": "+0Hz",
        "narrator_mode": True,
    },
    "ch5": {
        "voice": "en-GB-RyanNeural",
        "rate": "-10%",
        "pitch": "-1Hz",
        "narrator_mode": True,
    },
}


def _apply_ssml_prosody(text: str, highlight_words: Optional[List[str]] = None) -> str:
    """
    Inject SSML prosody into plain text before sending to edge-tts.

    edge-tts accepts a subset of SSML.  We add:
    - <break> tags at commas, semicolons, dashes, and [PAUSE] markers.
    - <emphasis> on highlight words (where edge-tts supports it).
    - Sentences keep their natural pauses; no structural changes to meaning.

    Returns the enriched SSML string (edge-tts handles the <speak> wrapper).
    """
    # Convert [PAUSE] marker to an explicit break
    text = re.sub(r"\[PAUSE\]", '<break time="600ms"/>', text, flags=re.IGNORECASE)

    # Em-dash / en-dash → short break
    text = re.sub(r"\s*[—–]\s*", ' <break time="300ms"/> ', text)

    # Comma → very short break
    text = re.sub(r",\s*", ', <break time="100ms"/> ', text)

    # Emphasize highlight words if provided
    if highlight_words:
        for word in highlight_words:
            escaped = re.escape(word)
            text = re.sub(
                rf"\b({escaped})\b",
                r'<emphasis level="strong">\1</emphasis>',
                text,
                flags=re.IGNORECASE,
            )

    return text


def _is_hook_line(line: Dict[str, Any]) -> bool:
    """Heuristic: first few lines are likely hook lines and get a rate boost."""
    return line.get("line_number", 99) <= 2


def get_voice_for_channel(channel_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract voice settings from channel config, falling back to defaults.

    Returns a dict with keys: voice, rate, pitch, narrator_mode.
    """
    channel_id = channel_config.get("_channel_id", "")
    defaults = CHANNEL_VOICE_SETTINGS.get(channel_id, {
        "voice": "en-US-GuyNeural",
        "rate": "+0%",
        "pitch": "+0Hz",
        "narrator_mode": True,
    })

    # Config-level overrides take precedence (new "tts" block > legacy flat keys)
    tts_block = channel_config.get("tts", {})
    provider = tts_block.get("provider", "edge")  # always default to free edge-tts

    voice = tts_block.get("voice") or channel_config.get("tts_voice") or defaults["voice"]
    rate = tts_block.get("rate") or channel_config.get("tts_rate") or defaults["rate"]
    pitch = tts_block.get("pitch") or channel_config.get("tts_pitch") or defaults["pitch"]
    narrator_mode = channel_config.get("narrator_mode", defaults["narrator_mode"])

    return {
        "voice": voice,
        "rate": rate,
        "pitch": pitch,
        "narrator_mode": narrator_mode,
        "provider": provider,
    }


async def generate_voiceover(
    script_text: str,
    voice: str,
    rate: str,
    pitch: str,
    output_path: str,
) -> bool:
    """
    Generate a TTS audio file from script_text using edge-tts.

    Args:
        script_text:  The text to synthesise.
        voice:        edge-tts voice name (e.g. 'en-US-GuyNeural').
        rate:         Speed adjustment (e.g. '-5%', '+0%').
        pitch:        Pitch adjustment (e.g. '-2Hz', '+0Hz').
        output_path:  Path to write the MP3 output file.

    Returns:
        True on success, False on failure.
    """
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    # edge-tts pitch format is like '+0Hz'  but the library accepts '+0Hz'
    # Normalise: ensure the value ends with 'Hz' if numeric
    pitch_norm = pitch if pitch.endswith("Hz") else f"{pitch}Hz"

    try:
        communicate = edge_tts.Communicate(
            text=script_text,
            voice=voice,
            rate=rate,
            pitch=pitch_norm,
        )
        await communicate.save(str(output))
        logger.info(
            "Voiceover saved: %s (voice=%s rate=%s pitch=%s)",
            output_path,
            voice,
            rate,
            pitch,
        )
        return True
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Failed to generate voiceover for %s: %s", output_path, exc)
        return False


async def generate_voiceover_with_prosody(
    line: Dict[str, Any],
    voice: str,
    rate: str,
    pitch: str,
    output_path: str,
) -> bool:
    """
    Generate TTS with SSML prosody improvements applied.

    Applies:
    - [PAUSE] → <break> tags
    - Comma / dash → short breaks
    - Hook lines (line_number <= 2) get +3% rate boost for energy
    - Highlight words from visualSpec get <emphasis> where supported
    """
    text = line.get("text", "").strip()
    if not text:
        return False

    visual_spec = line.get("visualSpec") or {}
    highlight_words = visual_spec.get("highlightWords", []) + visual_spec.get("kineticWords", [])
    enriched = _apply_ssml_prosody(text, highlight_words or None)

    # Hook line rate boost
    final_rate = rate
    if _is_hook_line(line):
        # Parse "+0%" or "-5%" and add 3%
        rate_match = re.match(r"([+-]?)(\d+)%", rate)
        if rate_match:
            sign = rate_match.group(1) or "+"
            val = int(rate_match.group(2))
            boosted = val + (3 if sign == "+" else -3 + 3)
            final_rate = f"+{boosted}%" if boosted >= 0 else f"{boosted}%"

    return await generate_voiceover(
        script_text=enriched,
        voice=voice,
        rate=final_rate,
        pitch=pitch,
        output_path=output_path,
    )


async def _generate_line_voiceover(
    line: Dict[str, Any],
    voice_settings: Dict[str, Any],
    base_dir: Path,
    channel_id: str,
) -> Tuple[int, Optional[str]]:
    """Generate voiceover for a single line. Returns (line_number, path_or_None)."""
    line_number = line.get("line_number", 0)
    line_type = line.get("type", "narration")
    text = line.get("text", "").strip()

    # Skip non-narration lines
    if line_type in ("b_roll_note", "pause") or not text:
        return (line_number, None)

    output_path = str(base_dir / f"line_{line_number:04d}.mp3")
    # Use SSML prosody-enhanced version for more human-sounding output
    success = await generate_voiceover_with_prosody(
        line=line,
        voice=voice_settings["voice"],
        rate=voice_settings["rate"],
        pitch=voice_settings["pitch"],
        output_path=output_path,
    )
    return (line_number, output_path if success else None)


async def generate_all_voiceovers(
    manifest: Dict[str, Any],
    output_dir: str = AUDIO_OUTPUT_DIR,
) -> List[Tuple[int, Optional[str]]]:
    """
    Generate voiceover audio files for all narration lines in the manifest.

    Args:
        manifest:   Production manifest with 'lines', 'channel_id', 'channel_config'.
        output_dir: Base directory to store audio files.

    Returns:
        List of (line_number, local_audio_path_or_None) tuples.
    """
    channel_id = manifest.get("channel_id", "unknown")
    channel_config = manifest.get("channel_config", {})
    channel_config["_channel_id"] = channel_id
    lines = manifest.get("lines", [])

    voice_settings = get_voice_for_channel(channel_config)

    if not voice_settings["narrator_mode"] or not voice_settings["voice"]:
        logger.info(
            "[%s] narrator_mode=off or no voice configured — skipping TTS generation.",
            channel_id,
        )
        return [(line.get("line_number", i), None) for i, line in enumerate(lines)]

    base_dir = Path(output_dir) / channel_id
    base_dir.mkdir(parents=True, exist_ok=True)

    logger.info(
        "[%s] Generating voiceovers for %d lines (voice=%s, rate=%s, pitch=%s)",
        channel_id,
        len(lines),
        voice_settings["voice"],
        voice_settings["rate"],
        voice_settings["pitch"],
    )

    # Process lines concurrently (but limit concurrency to avoid rate limits)
    semaphore = asyncio.Semaphore(3)

    async def bounded(line):
        async with semaphore:
            return await _generate_line_voiceover(line, voice_settings, base_dir, channel_id)

    tasks = [bounded(line) for line in lines]
    results = await asyncio.gather(*tasks)

    found = sum(1 for _, p in results if p is not None)
    logger.info(
        "[%s] Voiceover generation complete: %d/%d lines have audio",
        channel_id,
        found,
        len(results),
    )
    return list(results)


def generate_full_script_voiceover(
    manifest: Dict[str, Any],
    output_path: str,
) -> bool:
    """
    Generate a single combined voiceover for the entire script.
    Useful for channels that need one continuous audio track.

    Returns True on success.
    """
    channel_id = manifest.get("channel_id", "unknown")
    channel_config = manifest.get("channel_config", {})
    channel_config["_channel_id"] = channel_id
    script = manifest.get("script", "")

    voice_settings = get_voice_for_channel(channel_config)

    if not voice_settings["narrator_mode"] or not voice_settings["voice"]:
        logger.info("[%s] Narrator mode off — skipping full script voiceover.", channel_id)
        return False

    logger.info("[%s] Generating full script voiceover → %s", channel_id, output_path)
    return asyncio.run(
        generate_voiceover(
            script_text=script,
            voice=voice_settings["voice"],
            rate=voice_settings["rate"],
            pitch=voice_settings["pitch"],
            output_path=output_path,
        )
    )


if __name__ == "__main__":
    import json
    import sys

    if len(sys.argv) < 2:
        print("Usage: python generate_voiceover.py <manifest.json>")
        sys.exit(1)

    with open(sys.argv[1], "r", encoding="utf-8") as f:
        manifest_data = json.load(f)

    results_data = asyncio.run(generate_all_voiceovers(manifest_data))
    for ln, path in results_data:
        status = path if path else "SKIPPED"
        print(f"  Line {ln:04d}: {status}")
