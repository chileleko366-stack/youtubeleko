"""
Shorts Assembler

Assembles a vertical (9:16, 1080x1920) 60-second short video from a manifest JSON.

Usage:
    python assemble_shorts.py <path/to/manifest.json>

Pipeline per line:
  1. Generate TTS audio via edge-tts
  2. Render mograph composition via Remotion at 1080x1920 (9:16)
  3. Compose each line: scale/pad mograph to 1080x1920 (black fallback if render failed)
  4. Concatenate all line clips
  5. Mux with combined voiceover audio
  6. Trim/pad to 60s max

Output: temp/output/{channel_id}_short_{manifest_stem}.mp4
Spec:   1080x1920, 30fps, H.264, AAC 192k, max 60 seconds
"""

import asyncio
import json
import logging
import os
import subprocess
import sys
import tempfile
import time
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

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
OUTPUT_WIDTH = 1080
OUTPUT_HEIGHT = 1920
OUTPUT_FPS = 30
MAX_DURATION_SECONDS = 60
FFMPEG_BIN = os.environ.get("FFMPEG_BIN", "ffmpeg")
FFPROBE_BIN = os.environ.get("FFPROBE_BIN", "ffprobe")
REMOTION_DIR = Path(__file__).resolve().parent.parent / "remotion"
REMOTION_ENTRY = REMOTION_DIR / "src" / "Root.tsx"
RENDER_TIMEOUT = 300  # seconds per Remotion render
FFMPEG_TIMEOUT = 300  # seconds per FFmpeg call

# CH6 brand defaults (overridden by manifest values)
DEFAULT_TTS_VOICE = "en-US-GuyNeural"
DEFAULT_SPEECH_RATE = "-5%"
DEFAULT_PITCH = "-2Hz"


# ---------------------------------------------------------------------------
# FFmpeg helpers
# ---------------------------------------------------------------------------

def _run_ffmpeg(args: List[str], description: str = "") -> bool:
    """Run an FFmpeg command. Returns True on success."""
    cmd = [FFMPEG_BIN, "-y"] + args
    logger.info("FFmpeg: %s", description or " ".join(cmd[:10]))
    logger.debug("Full command: %s", " ".join(cmd))
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=FFMPEG_TIMEOUT,
        )
        if result.returncode != 0:
            logger.error("FFmpeg failed (%s):\n%s", description, result.stderr[-3000:])
            return False
        return True
    except subprocess.TimeoutExpired:
        logger.error("FFmpeg timed out after %ds (%s)", FFMPEG_TIMEOUT, description)
        return False
    except FileNotFoundError:
        logger.error("ffmpeg not found at '%s'. Install FFmpeg.", FFMPEG_BIN)
        return False


def _get_duration(path: str) -> float:
    """Return file duration in seconds via ffprobe."""
    cmd = [
        FFPROBE_BIN, "-v", "quiet", "-print_format", "json",
        "-show_format", path,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        data = json.loads(result.stdout)
        return float(data.get("format", {}).get("duration", 0))
    except Exception:  # pylint: disable=broad-except
        return 0.0


def _create_black_clip(output_path: str, duration: float) -> bool:
    """Create a black vertical video clip of the given duration."""
    args = [
        "-f", "lavfi",
        "-i", (
            f"color=black:size={OUTPUT_WIDTH}x{OUTPUT_HEIGHT}"
            f":rate={OUTPUT_FPS}:duration={duration}"
        ),
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-an",
        output_path,
    ]
    return _run_ffmpeg(args, f"Black clip {duration:.1f}s")


def _create_concat_file(clips: List[str], list_path: str) -> None:
    """Write an FFmpeg concat demuxer file."""
    with open(list_path, "w", encoding="utf-8") as fh:
        for clip in clips:
            fh.write(f"file '{Path(clip).resolve()}'\n")


# ---------------------------------------------------------------------------
# TTS — edge-tts
# ---------------------------------------------------------------------------

async def _generate_line_tts(
    text: str,
    output_path: str,
    voice: str,
    rate: str,
    pitch: str,
) -> bool:
    """Generate TTS audio for a single line. Returns True on success."""
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    # Normalise pitch format
    pitch_norm = pitch if pitch.endswith("Hz") else f"{pitch}Hz"

    try:
        communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate, pitch=pitch_norm)
        await communicate.save(str(out))
        logger.debug("TTS saved: %s", output_path)
        return True
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("TTS failed for line ('%s'): %s", text[:40], exc)
        return False


async def generate_all_tts(
    lines: List[Dict[str, Any]],
    audio_dir: Path,
    voice: str,
    rate: str,
    pitch: str,
) -> Dict[int, Optional[str]]:
    """
    Generate TTS for all narration lines concurrently (semaphore-limited).
    Returns {line_number: audio_path_or_None}.
    """
    semaphore = asyncio.Semaphore(3)

    async def bounded(line: Dict[str, Any]) -> Tuple[int, Optional[str]]:
        ln = line.get("line_number", 0)
        text = line.get("text", "").strip()
        line_type = line.get("type", "narration")

        if line_type in ("pause",) or not text:
            return (ln, None)

        out_path = str(audio_dir / f"tts_{ln:04d}.mp3")
        async with semaphore:
            success = await _generate_line_tts(text, out_path, voice, rate, pitch)
        return (ln, out_path if success else None)

    tasks = [bounded(ln) for ln in lines]
    results = await asyncio.gather(*tasks)
    tts_map = dict(results)
    found = sum(1 for p in tts_map.values() if p)
    logger.info("TTS complete: %d/%d lines have audio", found, len(lines))
    return tts_map


def concat_tts_lines(
    tts_map: Dict[int, Optional[str]],
    lines: List[Dict[str, Any]],
    output_path: str,
) -> bool:
    """Concatenate per-line TTS files into one combined voiceover."""
    audio_clips = []
    for line in sorted(lines, key=lambda l: l.get("line_number", 0)):
        ln = line.get("line_number", 0)
        path = tts_map.get(ln)
        if path and Path(path).exists():
            audio_clips.append(path)

    if not audio_clips:
        logger.warning("No TTS clips to concatenate")
        return False

    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as tmp:
        concat_list = tmp.name
    _create_concat_file(audio_clips, concat_list)

    args = [
        "-f", "concat",
        "-safe", "0",
        "-i", concat_list,
        "-af", "loudnorm=I=-16:LRA=11:TP=-1.5",
        "-c:a", "aac",
        "-b:a", "192k",
        "-t", str(MAX_DURATION_SECONDS),
        output_path,
    ]
    success = _run_ffmpeg(args, "Concatenate and normalise TTS audio")
    Path(concat_list).unlink(missing_ok=True)
    return success


# ---------------------------------------------------------------------------
# Remotion renderer (9:16 vertical)
# ---------------------------------------------------------------------------

def render_mograph(
    composition: str,
    props: Dict[str, Any],
    output_path: str,
    duration_seconds: float,
    fps: int = OUTPUT_FPS,
) -> bool:
    """
    Render a single Remotion composition at 1080x1920 (9:16).
    Returns True on success.
    """
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    duration_frames = max(1, round(duration_seconds * fps))
    props_json = json.dumps(props)

    cmd = [
        "npx", "remotion", "render",
        str(REMOTION_ENTRY),
        composition,
        str(out),
        f"--props={props_json}",
        f"--frames=0-{duration_frames - 1}",
        "--codec=h264",
        "--crf=18",
        "--pixel-format=yuv420p",
        f"--width={OUTPUT_WIDTH}",
        f"--height={OUTPUT_HEIGHT}",
        "--overwrite",
        "--log=warn",
    ]

    logger.info(
        "Remotion: rendering '%s' → %s (%d frames @ %dfps)",
        composition, output_path, duration_frames, fps,
    )
    try:
        result = subprocess.run(
            cmd,
            cwd=str(REMOTION_DIR),
            capture_output=True,
            text=True,
            timeout=RENDER_TIMEOUT,
        )
        if result.returncode != 0:
            logger.error(
                "Remotion failed for '%s':\nSTDOUT: %s\nSTDERR: %s",
                composition,
                result.stdout[-2000:],
                result.stderr[-2000:],
            )
            return False
        if out.exists() and out.stat().st_size > 0:
            logger.debug("Mograph rendered: %s (%.1f MB)", output_path, out.stat().st_size / 1e6)
            return True
        logger.error("Remotion produced no output file: %s", output_path)
        return False
    except subprocess.TimeoutExpired:
        logger.error("Remotion timed out after %ds for '%s'", RENDER_TIMEOUT, composition)
        return False
    except FileNotFoundError:
        logger.error(
            "npx not found. Make sure Node.js is installed and "
            "`npm install` has been run in the remotion/ directory."
        )
        return False


def build_mograph_props(
    line: Dict[str, Any],
    manifest: Dict[str, Any],
) -> Tuple[str, Dict[str, Any]]:
    """Build Remotion composition name and props for a line."""
    composition = line.get("composition") or line.get("treatment", "TextReveal")
    brand_color = manifest.get("brand_color", "#ff4444")
    bg_color = manifest.get("background_color", "#000008")
    # font_primary / font_secondary live at the manifest top level
    font_primary = manifest.get("font_primary") or manifest.get("visual_style", {}).get("font_primary", "Bebas Neue")
    font_secondary = manifest.get("font_secondary") or manifest.get("visual_style", {}).get("font_secondary", "Space Grotesk")

    duration_seconds = line.get("duration_seconds", 7)
    duration_in_frames = max(1, round(duration_seconds * OUTPUT_FPS))

    # Derive title from manifest topic or metadata
    title = (
        manifest.get("topic", {}).get("title")
        or manifest.get("metadata", {}).get("title")
        or ""
    )

    # Start with any extra props the LLM put in line["props"]
    extra_props = line.get("props") or {}

    props = {
        **extra_props,
        "text": line.get("text", ""),
        "title": title,
        "brandColor": brand_color,
        "backgroundColor": bg_color,
        "fontPrimary": font_primary,
        "fontSecondary": font_secondary,
        "durationInFrames": duration_in_frames,
        "lineNumber": line.get("line_number", 0),
        "lineType": line.get("type", "narration"),
        "channelId": manifest.get("channel_id", ""),
        "aspectRatio": "9:16",
    }

    # Pass Stage 5.5 visual spec when present (compositions degrade gracefully when absent)
    visual_spec = line.get("visualSpec")
    if visual_spec:
        props["visualSpec"] = visual_spec

    # Pass highlight/kinetic words from visual spec to compositions
    highlight_words = (visual_spec or {}).get("highlightWords", [])
    kinetic_words = (visual_spec or {}).get("kineticWords", [])
    if highlight_words or kinetic_words:
        props["highlightWords"] = highlight_words + kinetic_words
    return composition, props


def render_all_mographs(
    manifest: Dict[str, Any],
    mograph_dir: Path,
) -> Dict[int, Optional[str]]:
    """Render mograph clips for all lines. Returns {line_number: path_or_None}."""
    lines = manifest.get("lines", [])
    mograph_map: Dict[int, Optional[str]] = {}

    for line in lines:
        ln = line.get("line_number", 0)
        if line.get("type") == "pause":
            mograph_map[ln] = None
            continue

        composition, props = build_mograph_props(line, manifest)
        duration_s = line.get("duration_seconds", 7)
        out_path = str(mograph_dir / f"mograph_{ln:04d}.mp4")

        success = render_mograph(composition, props, out_path, duration_s)
        mograph_map[ln] = out_path if success else None

    rendered = sum(1 for p in mograph_map.values() if p)
    logger.info("Mograph renders complete: %d/%d lines", rendered, len(lines))
    return mograph_map


# ---------------------------------------------------------------------------
# Per-line composition: mograph only (black fallback)
# ---------------------------------------------------------------------------

def compose_line_clip(
    line: Dict[str, Any],
    mograph_path: Optional[str],
    output_path: str,
    temp_dir: Path,
) -> bool:
    """
    Compose a single line clip using the mograph render.
    Scales/pads mograph to 1080x1920. Falls back to a black clip if unavailable.
    Output: 1080x1920, OUTPUT_FPS, H.264
    """
    ln = line.get("line_number", 0)
    duration = line.get("duration_seconds", 7.0)

    # Mograph: scale and pad to 1080x1920
    if mograph_path and Path(mograph_path).exists():
        args = [
            "-i", mograph_path,
            "-vf", (
                f"scale={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease,"
                f"pad={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black,"
                f"setsar=1,fps={OUTPUT_FPS}"
            ),
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "20",
            "-pix_fmt", "yuv420p",
            "-t", str(duration),
            "-an",
            output_path,
        ]
        if _run_ffmpeg(args, f"Scale mograph line {ln}"):
            return True
        logger.warning("Line %d mograph scale failed, using black fallback", ln)

    # Black fallback
    logger.warning("Line %d: using black fallback clip", ln)
    return _create_black_clip(output_path, duration)


# ---------------------------------------------------------------------------
# Final assembly
# ---------------------------------------------------------------------------

def assemble_final_video(
    line_clips: List[str],
    voiceover_path: Optional[str],
    output_path: str,
    temp_dir: Path,
) -> bool:
    """
    Concatenate line clips and mux with voiceover.
    Trims final video to MAX_DURATION_SECONDS.
    """
    if not line_clips:
        logger.error("No line clips available for final assembly")
        return False

    # Step 1: Concatenate silent video clips
    concat_video = str(temp_dir / "concat_silent.mp4")
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, dir=str(temp_dir)) as tmp:
        concat_list = tmp.name
    _create_concat_file(line_clips, concat_list)

    concat_args = [
        "-f", "concat",
        "-safe", "0",
        "-i", concat_list,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-an",
        concat_video,
    ]
    if not _run_ffmpeg(concat_args, "Concatenate line clips"):
        Path(concat_list).unlink(missing_ok=True)
        return False
    Path(concat_list).unlink(missing_ok=True)

    video_duration = _get_duration(concat_video)
    logger.info("Concatenated video duration: %.1fs", video_duration)

    # Step 2: Mux video + audio
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    trim = str(min(video_duration, MAX_DURATION_SECONDS))

    if voiceover_path and Path(voiceover_path).exists():
        mux_args = [
            "-i", concat_video,
            "-i", voiceover_path,
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-t", trim,
            "-movflags", "+faststart",
            "-shortest",
            str(out),
        ]
        success = _run_ffmpeg(mux_args, "Mux video + voiceover")
    else:
        logger.warning("No voiceover — assembling video-only output")
        mux_args = [
            "-i", concat_video,
            "-c:v", "copy",
            "-an",
            "-t", trim,
            "-movflags", "+faststart",
            str(out),
        ]
        success = _run_ffmpeg(mux_args, "Copy video (no audio)")

    if success and out.exists():
        final_duration = _get_duration(str(out))
        size_mb = out.stat().st_size / 1e6
        logger.info(
            "Final video: %s (%.1f MB, %.1fs)",
            output_path, size_mb, final_duration,
        )
    return success


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def assemble_short(manifest_path: str) -> str:
    """
    Full assembly pipeline for one CH6 short manifest.
    Returns the path to the output video.
    """
    manifest_p = Path(manifest_path)
    if not manifest_p.exists():
        raise FileNotFoundError(f"Manifest not found: {manifest_path}")

    with open(manifest_p, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    manifest_stem = manifest_p.stem
    channel_id = manifest.get("channel_id", "CH6")
    lines = manifest.get("lines", [])

    if not lines:
        raise ValueError(f"Manifest has no lines: {manifest_path}")

    # Determine TTS settings from manifest
    tts_voice = manifest.get("tts_voice", DEFAULT_TTS_VOICE)
    speech_rate = manifest.get("speech_rate", DEFAULT_SPEECH_RATE)
    pitch = manifest.get("pitch", DEFAULT_PITCH)

    # Output paths
    root_dir = Path(__file__).resolve().parent.parent
    temp_dir = root_dir / "temp" / "assembly_shorts" / manifest_stem
    audio_dir = temp_dir / "audio"
    mograph_dir = temp_dir / "mographs"
    line_clips_dir = temp_dir / "line_clips"
    output_dir = root_dir / "temp" / "output"
    output_path = str(output_dir / f"{channel_id}_short_{manifest_stem}.mp4")

    for d in [temp_dir, audio_dir, mograph_dir, line_clips_dir, output_dir]:
        d.mkdir(parents=True, exist_ok=True)

    logger.info("=== Assembling short: %s ===", manifest_stem)
    logger.info("Lines: %d | Voice: %s | Rate: %s | Pitch: %s", len(lines), tts_voice, speech_rate, pitch)

    # Step 1: Generate TTS for all lines
    logger.info("Step 1/4: Generating TTS audio...")
    tts_map = asyncio.run(generate_all_tts(lines, audio_dir, tts_voice, speech_rate, pitch))

    # Step 2: Concatenate TTS into single voiceover
    logger.info("Step 2/4: Concatenating voiceover...")
    voiceover_path = str(temp_dir / "voiceover.aac")
    vo_success = concat_tts_lines(tts_map, lines, voiceover_path)
    if not vo_success:
        voiceover_path = None
        logger.warning("Voiceover concatenation failed — assembling without audio")

    # Step 3: Render mograph compositions
    logger.info("Step 3/4: Rendering mograph compositions...")
    mograph_map = render_all_mographs(manifest, mograph_dir)

    # Step 4: Compose per-line clips and assemble
    logger.info("Step 4/4: Composing line clips and assembling final video...")
    line_clips: List[str] = []
    for line in sorted(lines, key=lambda l: l.get("line_number", 0)):
        ln = line.get("line_number", 0)
        clip_path = str(line_clips_dir / f"line_{ln:04d}.mp4")

        success = compose_line_clip(
            line=line,
            mograph_path=mograph_map.get(ln),
            output_path=clip_path,
            temp_dir=temp_dir,
        )
        if success:
            line_clips.append(clip_path)
        else:
            # Emergency fallback: black clip
            logger.error("Line %d composition failed entirely — inserting black clip", ln)
            black_path = str(line_clips_dir / f"black_{ln:04d}.mp4")
            _create_black_clip(black_path, line.get("duration_seconds", 7.0))
            line_clips.append(black_path)

    if not assemble_final_video(line_clips, voiceover_path, output_path, temp_dir):
        raise RuntimeError(f"Final assembly failed for {manifest_stem}")

    logger.info("=== Assembly complete: %s ===", output_path)

    # Upload to Cloudinary
    try:
        import cloudinary  # pylint: disable=import-outside-toplevel
        import cloudinary.uploader  # pylint: disable=import-outside-toplevel
        from datetime import date  # pylint: disable=import-outside-toplevel
        missing = [v for v in ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET")
                   if not os.environ.get(v)]
        if missing:
            logger.warning("Cloudinary secrets missing (%s) — skipping upload", missing)
        else:
            cloudinary.config(
                cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
                api_key=os.environ["CLOUDINARY_API_KEY"],
                api_secret=os.environ["CLOUDINARY_API_SECRET"],
                secure=True,
            )
            date_str = date.today().isoformat()
            public_id = f"automation/shorts/{date_str}/{channel_id}_{manifest_stem}"
            result = cloudinary.uploader.upload_large(
                output_path,
                public_id=public_id,
                resource_type="video",
                overwrite=True,
                chunk_size=6_000_000,
            )
            cld_url = result.get("secure_url", "")
            logger.info("Uploaded to Cloudinary: %s", cld_url)
    except Exception as exc:  # pylint: disable=broad-except
        logger.warning("Cloudinary upload failed (non-fatal): %s", exc)

    return output_path


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python assemble_shorts.py <path/to/manifest.json>")
        print("")
        print("Example:")
        print("  python assemble_shorts.py temp/manifests/ch6_short_1.json")
        sys.exit(1)

    manifest_path = sys.argv[1]

    try:
        output = assemble_short(manifest_path)
        print(f"\nOutput video: {output}")
    except FileNotFoundError as exc:
        logger.error("File not found: %s", exc)
        sys.exit(1)
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Assembly failed: %s", exc, exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
