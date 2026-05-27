"""
Assemble CH6 Red Space Facts Shorts video (1080x1920 vertical).

Assembly order:
  1. Space background image from Pollinations.ai (or dark fallback)
  2. Remotion SpaceShorts overlay (1080x1920 motion graphics)
  3. Voiceover audio via edge-tts
  4. Output: 1080x1920 H.264 MP4
"""

import asyncio
import json
import logging
import os
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

FFMPEG_BIN = os.environ.get("FFMPEG_BIN", "ffmpeg")
FFPROBE_BIN = os.environ.get("FFPROBE_BIN", "ffprobe")
OUTPUT_WIDTH = 1080
OUTPUT_HEIGHT = 1920
OUTPUT_FPS = 30
FFMPEG_TIMEOUT = 300
REMOTION_TIMEOUT = 300


def _run_ffmpeg(args: List[str], description: str = "") -> bool:
    cmd = [FFMPEG_BIN, "-y"] + args
    logger.info("FFmpeg: %s", description or " ".join(cmd[:8]))
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
        if result.returncode != 0:
            logger.error("FFmpeg failed (%s): %s", description, result.stderr[-800:])
            return False
        return True
    except subprocess.TimeoutExpired:
        logger.error("FFmpeg timed out: %s", description)
        return False
    except Exception as exc:
        logger.error("FFmpeg exception (%s): %s", description, exc)
        return False


def _get_duration(path: str) -> float:
    """Return media duration in seconds via ffprobe."""
    try:
        result = subprocess.run(
            [FFPROBE_BIN, "-v", "quiet", "-print_format", "json",
             "-show_streams", "-select_streams", "a", path],
            capture_output=True, text=True, timeout=30,
        )
        data = json.loads(result.stdout)
        streams = data.get("streams", [])
        if streams:
            return float(streams[0].get("duration", 60.0))
    except Exception:
        pass
    return 60.0


def _fetch_background(topic_title: str, output_path: str) -> bool:
    """Download a vertical space background from Pollinations.ai."""
    prompt = urllib.parse.quote(
        f"cinematic space photography, {topic_title[:80]}, deep space, stars, nebula, "
        f"dark background, 4K, photorealistic, vertical portrait"
    )
    url = f"https://image.pollinations.ai/prompt/{prompt}?width=1080&height=1920&nologo=true"

    for attempt in range(1, 4):
        try:
            urllib.request.urlretrieve(url, output_path)
            if Path(output_path).stat().st_size > 5000:
                logger.info("Background image fetched: %s", output_path)
                return True
            raise ValueError("Image too small — likely an error response")
        except Exception as exc:
            logger.warning("Background fetch attempt %d/3 failed: %s", attempt, exc)
            if attempt < 3:
                time.sleep(attempt * 5)
    return False


def _render_remotion(manifest: Dict[str, Any], output_path: str) -> bool:
    """Render SpaceShorts Remotion composition to vertical video."""
    fact_cards = manifest.get("fact_cards", [])
    if not fact_cards:
        logger.warning("No fact_cards in manifest — skipping Remotion render")
        return False

    duration_frames = max(1800, len(fact_cards) * 450)

    props = {
        "factCards": fact_cards,
        "brandColor": "#ff4444",
        "backgroundColor": "#03010a",
        "fontPrimary": "Arial",
        "durationInFrames": duration_frames,
    }

    remotion_dir = Path(__file__).parent.parent / "remotion"
    cmd = [
        "npx", "remotion", "render",
        "SpaceShorts",
        output_path,
        f"--props={json.dumps(props)}",
        "--width=1080",
        "--height=1920",
        f"--frames=0-{duration_frames - 1}",
    ]

    for attempt in range(1, 3):
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True,
                timeout=REMOTION_TIMEOUT, cwd=str(remotion_dir),
            )
            if result.returncode == 0:
                logger.info("SpaceShorts rendered: %s", output_path)
                return True
            logger.warning(
                "Remotion render attempt %d/2 failed: %s",
                attempt, result.stderr[-500:],
            )
        except Exception as exc:
            logger.warning("Remotion render attempt %d/2 exception: %s", attempt, exc)
        if attempt < 2:
            time.sleep(5)
    return False


def _generate_voiceover(manifest: Dict[str, Any], output_path: str) -> bool:
    """Generate TTS voiceover for the Shorts script."""
    script = manifest.get("script", "").strip()
    if not script:
        logger.error("No script in manifest")
        return False

    voice = manifest.get("voice", "en-US-AriaNeural")
    rate = manifest.get("tts_rate", "+5%")
    pitch = manifest.get("tts_pitch", "+0Hz")

    from generate_voiceover import generate_voiceover  # pylint: disable=import-outside-toplevel
    return asyncio.run(generate_voiceover(
        script_text=script,
        voice=voice,
        rate=rate,
        pitch=pitch,
        output_path=output_path,
    ))


def _text_overlay_fallback(
    background_path: str,
    voiceover_path: str,
    script: str,
    duration: float,
    output_path: str,
) -> bool:
    """Pure FFmpeg fallback: background + text burn-in + voiceover."""
    safe_text = script[:200].replace("'", "\\'").replace(":", "\\:").replace("\n", " ")
    return _run_ffmpeg([
        "-loop", "1", "-i", background_path,
        "-i", voiceover_path,
        "-filter_complex",
        (
            f"[0:v]scale={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}:force_original_aspect_ratio=increase,"
            f"crop={OUTPUT_WIDTH}:{OUTPUT_HEIGHT},setsar=1[bg];"
            f"[bg]drawtext=text='{safe_text}'"
            f":fontcolor=white:fontsize=44"
            f":x=(w-text_w)/2:y=(h-text_h)/2"
            f":line_spacing=18"
            f":box=1:boxcolor=black@0.55:boxborderw=20[v]"
        ),
        "-map", "[v]",
        "-map", "1:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-t", str(duration + 0.5),
        "-shortest",
        output_path,
    ], "Fallback: background + text overlay + voiceover")


def assemble_shorts(manifest_path: str) -> Optional[str]:
    """
    Assemble a Shorts video from the manifest JSON.
    Returns path to output MP4 on success, None on failure.
    """
    with open(manifest_path, "r", encoding="utf-8") as fh:
        manifest = json.load(fh)

    date_str = manifest.get("date", "unknown")
    title = manifest.get("topic", {}).get("title", "space_short")
    safe_title = "".join(c if c.isalnum() or c in "-_" else "_" for c in title)[:60]
    output_path = f"temp/output/ch6_{date_str}_{safe_title}.mp4"
    Path("temp/output").mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        background_path = str(tmp / "background.jpg")
        mograph_path = str(tmp / "mograph.mp4")
        voiceover_path = str(tmp / "voiceover.mp3")

        # Step 1: Background image
        story_title = manifest.get("source_story", {}).get("title", "deep space nebula")
        bg_ok = _fetch_background(story_title, background_path)
        if not bg_ok:
            logger.warning("Background fetch failed — using solid dark fallback")
            _run_ffmpeg([
                "-f", "lavfi",
                "-i", f"color=c=0x03010a:s={OUTPUT_WIDTH}x{OUTPUT_HEIGHT}:r=1",
                "-frames:v", "1",
                background_path,
            ], "Dark fallback background")

        # Step 2: Voiceover (required)
        vo_ok = _generate_voiceover(manifest, voiceover_path)
        if not vo_ok:
            logger.error("Voiceover generation failed — aborting Shorts assembly")
            return None

        vo_duration = _get_duration(voiceover_path)
        logger.info("Voiceover duration: %.1fs", vo_duration)

        # Step 3: Remotion mograph (optional — falls back to plain text overlay)
        mograph_ok = _render_remotion(manifest, mograph_path)

        # Step 4: Assemble
        if mograph_ok and Path(mograph_path).exists():
            # Composite: mograph video + voiceover audio
            success = _run_ffmpeg([
                "-i", mograph_path,
                "-i", voiceover_path,
                "-c:v", "libx264", "-preset", "fast", "-crf", "22",
                "-c:a", "aac", "-b:a", "128k",
                "-t", str(vo_duration + 0.5),
                "-shortest",
                output_path,
            ], "Assemble mograph + voiceover")
        else:
            logger.info("Remotion unavailable — using FFmpeg text overlay")
            success = _text_overlay_fallback(
                background_path,
                voiceover_path,
                manifest.get("script", title),
                vo_duration,
                output_path,
            )

        if not success or not Path(output_path).exists():
            logger.error("Video assembly failed for %s", title)
            return None

        size_mb = Path(output_path).stat().st_size / 1e6
        logger.info("Shorts assembled: %s (%.1f MB)", output_path, size_mb)
        return output_path


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python assemble_shorts.py <manifest.json>")
        sys.exit(1)

    result = assemble_shorts(sys.argv[1])
    if result:
        print(f"Output: {result}")
    else:
        print("ERROR: Assembly failed")
        sys.exit(1)
