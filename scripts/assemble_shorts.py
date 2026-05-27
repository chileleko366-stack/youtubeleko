"""
Assemble a YouTube Short for CH6 — Red Space Facts.

Pipeline:
  1. Generate TTS voiceover for the full script (edge-tts)
  2. Build per-line video clips: dark space background + centered text overlay
  3. Concatenate all line clips into a single silent video
  4. Mux with voiceover audio
  5. Output: temp/output/ch6_<date>.mp4  (1080×1920, H.264, ~60 seconds)

Usage:
  python scripts/assemble_shorts.py temp/manifests/ch6_short.json
"""

import asyncio
import json
import logging
import os
import subprocess
import sys
from datetime import date
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
FFMPEG_TIMEOUT = 300

SHORT_WIDTH = 1080
SHORT_HEIGHT = 1920
SHORT_FPS = 30
BG_COLOR = "0x04000f"

FONT_SIZE_NARRATION = 72
FONT_SIZE_TITLE_CARD = 58

_FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
]


def _find_font() -> Optional[str]:
    for path in _FONT_CANDIDATES:
        if Path(path).exists():
            return path
    return None


def _run_ffmpeg(args: List[str], description: str = "") -> bool:
    cmd = [FFMPEG_BIN, "-y"] + args
    logger.info("FFmpeg: %s", description or " ".join(cmd[:6]))
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
        if result.returncode != 0:
            logger.error("FFmpeg failed (%s):\n%s", description, result.stderr[-2000:])
            return False
        return True
    except subprocess.TimeoutExpired:
        logger.error("FFmpeg timed out (%s)", description)
        return False
    except FileNotFoundError:
        logger.error("ffmpeg not found at '%s'. Install FFmpeg.", FFMPEG_BIN)
        return False


def _get_duration(path: str) -> float:
    cmd = [FFPROBE_BIN, "-v", "quiet", "-print_format", "json", "-show_format", path]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        data = json.loads(result.stdout)
        return float(data.get("format", {}).get("duration", 0))
    except Exception:
        return 0.0


async def _generate_tts(script: str, config: Dict[str, Any], output_path: str) -> bool:
    try:
        import edge_tts
    except ImportError:
        logger.error("edge-tts not installed. Run: pip install edge-tts")
        return False

    voice = config.get("tts_voice") or "en-US-ChristopherNeural"
    rate = config.get("tts_rate") or config.get("speech_rate") or "-5%"
    pitch_raw = config.get("tts_pitch") or config.get("pitch") or "-2Hz"
    pitch = pitch_raw if pitch_raw.endswith("Hz") else f"{pitch_raw}Hz"

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    try:
        communicate = edge_tts.Communicate(text=script, voice=voice, rate=rate, pitch=pitch)
        await communicate.save(output_path)
        logger.info("TTS saved → %s (voice=%s rate=%s pitch=%s)", output_path, voice, rate, pitch)
        return True
    except Exception as exc:
        logger.error("TTS failed: %s", exc)
        return False


def _build_line_clip(
    line: Dict[str, Any],
    clip_path: str,
    text_file: str,
    font_path: Optional[str],
) -> bool:
    duration = max(line.get("duration_seconds", 3.0), 0.5)
    line_type = line.get("type", "narration")
    text = line.get("text", "").strip()

    if not text:
        text = " "

    Path(text_file).write_text(text, encoding="utf-8")
    Path(clip_path).parent.mkdir(parents=True, exist_ok=True)

    # title_card lines use slightly smaller font to fit longer titles
    font_size = FONT_SIZE_TITLE_CARD if line_type == "title_card" else FONT_SIZE_NARRATION
    font_color = "0xff4444" if line_type == "title_card" else "white"

    font_opt = f":fontfile={font_path}" if font_path else ""
    text_filter = (
        f"drawtext=textfile={text_file}"
        f":fontcolor={font_color}"
        f":fontsize={font_size}"
        f"{font_opt}"
        f":x=(w-text_w)/2"
        f":y=(h-text_h)/2"
        f":line_spacing=18"
        f":borderw=3"
        f":bordercolor=black@0.8"
        f":fix_bounds=true"
    )

    args = [
        "-f", "lavfi",
        "-i", (
            f"color=c={BG_COLOR}:"
            f"size={SHORT_WIDTH}x{SHORT_HEIGHT}:"
            f"rate={SHORT_FPS}:"
            f"duration={duration}"
        ),
        "-vf", text_filter,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-an",
        clip_path,
    ]
    return _run_ffmpeg(args, f"Line {line.get('line_number', 0)} clip")


def assemble_short(manifest_path: str) -> bool:
    with open(manifest_path, "r", encoding="utf-8") as fh:
        manifest = json.load(fh)

    channel_id = manifest.get("channel_id", "ch6")
    date_str = manifest.get("date", date.today().isoformat())
    script = manifest.get("script", "")
    lines = manifest.get("lines", [])

    if not lines:
        logger.error("Manifest has no lines — cannot assemble Short.")
        return False

    # Load ch6 config for voice settings
    config_path = Path(__file__).parent.parent / "configs" / "ch6-red-space-facts.json"
    config: Dict[str, Any] = {}
    if config_path.exists():
        with open(config_path, "r", encoding="utf-8") as fh:
            config = json.load(fh)

    temp_dir = Path("temp") / "assembly" / f"{channel_id}_short"
    temp_dir.mkdir(parents=True, exist_ok=True)
    output_dir = Path("temp") / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    font_path = _find_font()
    if font_path:
        logger.info("Font: %s", font_path)
    else:
        logger.warning("No system font found — using FFmpeg default bitmap font")

    # Step 1: TTS voiceover
    tts_path = str(temp_dir / "voiceover.mp3")
    logger.info("[ch6-short] Generating TTS voiceover...")
    tts_ok = asyncio.run(_generate_tts(script, config, tts_path))
    if not tts_ok:
        logger.warning("[ch6-short] TTS failed — assembling without audio")
        tts_path_final: Optional[str] = None
    else:
        tts_path_final = tts_path

    # Step 2: Per-line clips
    logger.info("[ch6-short] Building %d line clips...", len(lines))
    line_clips: List[str] = []
    temp_files: List[str] = []

    for line in lines:
        ln = line.get("line_number", 0)
        clip_path = str((temp_dir / f"line_{ln:04d}.mp4").absolute())
        text_file = str((temp_dir / f"text_{ln:04d}.txt").absolute())
        temp_files.extend([clip_path, text_file])

        success = _build_line_clip(line, clip_path, text_file, font_path)
        if success:
            line_clips.append(clip_path)
        else:
            logger.warning("[ch6-short] Line %d clip failed — skipping", ln)

    if not line_clips:
        logger.error("[ch6-short] No line clips produced — aborting.")
        return False

    # Step 3: Concatenate
    concat_list = str(temp_dir / "concat.txt")
    concat_video = str(temp_dir / "concat_video.mp4")

    with open(concat_list, "w", encoding="utf-8") as fh:
        for clip in line_clips:
            fh.write(f"file '{clip}'\n")

    logger.info("[ch6-short] Concatenating %d clips...", len(line_clips))
    concat_ok = _run_ffmpeg([
        "-f", "concat",
        "-safe", "0",
        "-i", concat_list,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-an",
        concat_video,
    ], "Concatenate line clips")

    if not concat_ok:
        logger.error("[ch6-short] Concatenation failed — aborting.")
        return False

    # Step 4: Mux video + audio
    output_path = str(output_dir / f"ch6_{date_str}.mp4")
    logger.info("[ch6-short] Muxing → %s", output_path)

    if tts_path_final and Path(tts_path_final).exists():
        mux_args = [
            "-i", concat_video,
            "-i", tts_path_final,
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "128k",
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-movflags", "+faststart",
            "-shortest",
            output_path,
        ]
    else:
        mux_args = [
            "-i", concat_video,
            "-c:v", "copy",
            "-an",
            "-movflags", "+faststart",
            output_path,
        ]

    success = _run_ffmpeg(mux_args, "Final mux")

    if success and Path(output_path).exists():
        size_mb = Path(output_path).stat().st_size / 1e6
        duration = _get_duration(output_path)
        logger.info(
            "[ch6-short] Assembly complete: %s (%.1f MB, %.1fs)",
            output_path, size_mb, duration,
        )
        print(f"\n[CH6 Short] Output:   {output_path}")
        print(f"[CH6 Short] Size:     {size_mb:.1f} MB")
        print(f"[CH6 Short] Duration: {duration:.0f}s")

    # Cleanup temp clips and text files
    for tmp in temp_files + [concat_video, concat_list]:
        Path(tmp).unlink(missing_ok=True)

    return success


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python assemble_shorts.py <manifest.json>")
        sys.exit(1)

    ok = assemble_short(sys.argv[1])
    sys.exit(0 if ok else 1)
