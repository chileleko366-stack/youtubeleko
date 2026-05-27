"""
Voiceover generator using edge-tts (Microsoft TTS, free, unlimited).

Generates per-line audio files from the manifest's line breakdown,
respecting each channel's voice, speed, and pitch settings.
"""

import asyncio
import logging
import os
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

    # Config-level overrides take precedence
    voice = channel_config.get("tts_voice") or defaults["voice"]
    rate = channel_config.get("tts_rate") or defaults["rate"]
    pitch = channel_config.get("tts_pitch") or defaults["pitch"]
    narrator_mode = channel_config.get("narrator_mode", defaults["narrator_mode"])

    return {
        "voice": voice,
        "rate": rate,
        "pitch": pitch,
        "narrator_mode": narrator_mode,
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

    for attempt in range(1, 4):
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
            logger.warning(
                "Voiceover attempt %d/3 failed for %s: %s",
                attempt, output_path, exc,
            )
            if attempt < 3:
                await asyncio.sleep(attempt * 2)
    logger.error("All 3 voiceover attempts failed for %s", output_path)
    return False


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
    success = await generate_voiceover(
        script_text=text,
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
