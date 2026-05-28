"""
CH6 Red Space Facts — Shorts assembly (space documentary style).

Pipeline:
  1. Build SSML script (natural pauses + emphasis)
  2. SSML TTS via edge-tts (en-US-GuyNeural) with word-boundary streaming
     → MP3 audio + word timestamp list
  3. Build ASS karaoke subtitle file (word-by-word, bottom of screen)
  4. Per line:
     a. Search Pexels for space stock footage using b_roll_keywords
     b. If no footage → render Remotion SpaceScene (animated space visual)
     c. Crop/scale to portrait 1080×1920
  5. Concatenate all line clips
  6. Burn ASS karaoke subtitles onto video
  7. Mux with TTS audio
  8. Output: temp/output/ch6_<date>.mp4

Usage:
  python scripts/assemble_shorts.py temp/manifests/ch6_short.json
"""

import asyncio
import json
import logging
import os
import re
import subprocess
import sys
import time
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests
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

REMOTION_DIR = str(Path(__file__).parent.parent / "remotion")
PEXELS_API_BASE = "https://api.pexels.com/videos/search"


# ─── FFmpeg helpers ────────────────────────────────────────────────────────────

def _run_ffmpeg(args: List[str], label: str = "") -> bool:
    cmd = [FFMPEG_BIN, "-y"] + args
    logger.info("FFmpeg: %s", label or " ".join(cmd[:6]))
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=FFMPEG_TIMEOUT)
        if r.returncode != 0:
            logger.error("FFmpeg failed (%s):\n%s", label, r.stderr[-2000:])
            return False
        return True
    except subprocess.TimeoutExpired:
        logger.error("FFmpeg timed out: %s", label)
        return False
    except FileNotFoundError:
        logger.error("ffmpeg not found")
        return False


def _get_duration(path: str) -> float:
    cmd = [FFPROBE_BIN, "-v", "quiet", "-print_format", "json", "-show_format", path]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return float(json.loads(r.stdout).get("format", {}).get("duration", 0))
    except Exception:
        return 0.0


# ─── SSML builder ─────────────────────────────────────────────────────────────

def _build_ssml(script: str) -> str:
    """Add natural pauses and emphasis to the script via SSML."""
    text = script.strip()
    # Pause after sentence endings
    text = re.sub(r"([.!?])\s+", r'\1<break time="420ms"/> ', text)
    # Short pause after commas
    text = re.sub(r",\s+", r',<break time="140ms"/> ', text)
    # Short pause after em-dashes
    text = re.sub(r"\s*—\s*", r'<break time="200ms"/> ', text)
    return (
        '<speak version="1.0" '
        'xmlns="http://www.w3.org/2001/10/synthesis" '
        'xml:lang="en-US">'
        + text
        + "</speak>"
    )


# ─── TTS with word timestamps ─────────────────────────────────────────────────

async def _tts_with_timestamps(
    ssml: str,
    config: Dict[str, Any],
    audio_path: str,
) -> List[Dict[str, Any]]:
    """
    Stream TTS audio + word boundary events from edge-tts.
    Returns list of {"word": str, "start": float, "end": float} (seconds).
    """
    try:
        import edge_tts
    except ImportError:
        logger.error("edge-tts not installed: pip install edge-tts")
        return []

    voice = config.get("tts_voice", "en-US-GuyNeural")
    rate = config.get("tts_rate", "-9%")
    pitch_raw = config.get("tts_pitch", config.get("pitch", "-4Hz"))
    pitch = pitch_raw if pitch_raw.endswith("Hz") else f"{pitch_raw}Hz"

    communicate = edge_tts.Communicate(text=ssml, voice=voice, rate=rate, pitch=pitch)

    words: List[Dict[str, Any]] = []
    audio_chunks: List[bytes] = []

    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_chunks.append(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            # offset and duration are in 100-nanosecond ticks
            start_s = chunk["offset"] / 10_000_000
            dur_s = chunk["duration"] / 10_000_000
            word = chunk.get("text", "").strip()
            if word:
                words.append({
                    "word": word,
                    "start": round(start_s, 4),
                    "end": round(start_s + dur_s, 4),
                })

    Path(audio_path).parent.mkdir(parents=True, exist_ok=True)
    with open(audio_path, "wb") as f:
        for chunk in audio_chunks:
            f.write(chunk)

    logger.info("TTS: %d words, voice=%s, audio → %s", len(words), voice, audio_path)
    return words


# ─── ASS karaoke subtitle builder ─────────────────────────────────────────────

def _hex_to_ass_bgr(hex_color: str, alpha: int = 0) -> str:
    """Convert #RRGGBB to ASS &HAABBGGRR format."""
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"&H{alpha:02X}{b:02X}{g:02X}{r:02X}"


def _fmt_ass_time(s: float) -> str:
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = s % 60
    return f"{h}:{m:02d}:{sec:05.2f}"


def _build_ass_subtitles(words: List[Dict[str, Any]], accent_color: str = "#ff2222") -> str:
    """
    Build an ASS subtitle file with word-by-word karaoke highlighting.

    Words appear in groups of 5 at the bottom of the frame.
    Each word sweeps from grey → white as it's spoken (\\kf tag).
    """
    primary = "&H00FFFFFF"                           # white  — spoken
    secondary = "&H99AAAAAA"                         # grey   — upcoming
    outline = _hex_to_ass_bgr(accent_color)          # brand red — outline
    back = "&H88000000"                              # semi-transparent black bg

    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        f"PlayResX: {SHORT_WIDTH}\n"
        f"PlayResY: {SHORT_HEIGHT}\n"
        "WrapStyle: 0\n"
        "\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
        "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
        "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,Arial,54,{primary},{secondary},{outline},{back},"
        "-1,0,0,0,100,100,1,0,1,5,2,2,80,80,150,1\n"
        "\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )

    # Group words into chunks of 5 — each chunk is one subtitle line
    chunk_size = 5
    lines: List[str] = []
    for i in range(0, len(words), chunk_size):
        chunk = words[i : i + chunk_size]
        if not chunk:
            continue
        start = chunk[0]["start"]
        end = chunk[-1]["end"]
        if end <= start:
            end = start + 0.1

        parts = []
        for w in chunk:
            dur_cs = max(1, round((w["end"] - w["start"]) * 100))
            clean = w["word"].strip()
            if clean:
                parts.append(f"{{\\kf{dur_cs}}}{clean}")

        if not parts:
            continue

        text = " ".join(parts)
        lines.append(
            f"Dialogue: 0,{_fmt_ass_time(start)},{_fmt_ass_time(end)},"
            f"Default,,0,0,0,,{text}"
        )

    return header + "\n".join(lines)


# ─── Pexels footage ───────────────────────────────────────────────────────────

def _fetch_pexels_clip(keywords: List[str], line_num: int, out_path: str) -> bool:
    """Search Pexels for space footage, download best landscape clip."""
    api_key = os.environ.get("PEXELS_API_KEY", "")
    if not api_key:
        logger.warning("PEXELS_API_KEY not set — skipping Pexels for line %d", line_num)
        return False

    headers = {"Authorization": api_key}

    for query in keywords:
        try:
            resp = requests.get(
                PEXELS_API_BASE,
                headers=headers,
                params={"query": query, "orientation": "landscape", "size": "large", "per_page": 10},
                timeout=20,
            )
            resp.raise_for_status()
            videos = resp.json().get("videos", [])
            time.sleep(0.4)

            for video in videos:
                files = video.get("video_files", [])
                # Prefer 1080p landscape
                best = None
                for f in files:
                    if f.get("width", 0) >= f.get("height", 1) and f.get("height", 0) >= 720:
                        if best is None or f.get("height", 0) > best.get("height", 0):
                            best = f
                if not best and files:
                    best = files[0]

                if best and best.get("link"):
                    url = best["link"]
                    logger.info("Pexels line %d: found clip for '%s' (%dx%d)",
                                line_num, query, best.get("width", 0), best.get("height", 0))
                    # Download
                    try:
                        with requests.get(url, stream=True, timeout=60) as dl:
                            dl.raise_for_status()
                            Path(out_path).parent.mkdir(parents=True, exist_ok=True)
                            with open(out_path, "wb") as fh:
                                for chunk in dl.iter_content(chunk_size=256 * 1024):
                                    fh.write(chunk)
                        return True
                    except Exception as exc:
                        logger.warning("Pexels download failed for line %d: %s", line_num, exc)
                        Path(out_path).unlink(missing_ok=True)
        except Exception as exc:
            logger.warning("Pexels search '%s' line %d: %s", query, line_num, exc)

    return False


# ─── Remotion SpaceScene renderer ─────────────────────────────────────────────

def _render_space_scene(scene_type: str, duration_s: float, out_path: str) -> bool:
    """Render a Remotion SpaceScene composition as portrait 1080×1920 MP4."""
    frames = max(1, round(duration_s * SHORT_FPS))
    props = json.dumps({
        "sceneType": scene_type,
        "accentColor": "#ff2222",
        "durationInFrames": frames,
    })

    cmd = [
        "npx", "--yes", "remotion", "render",
        "src/Root.tsx",
        "SpaceScene",
        out_path,
        "--props", props,
        "--log=error",
        "--gl=swangle",       # software GL — reliable in CI
    ]

    logger.info("Remotion SpaceScene: type=%s, %.1fs, → %s", scene_type, duration_s, out_path)
    try:
        r = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=180,
            cwd=REMOTION_DIR,
        )
        if r.returncode != 0:
            logger.error("Remotion failed:\n%s", r.stderr[-1500:])
            return False
        return Path(out_path).exists()
    except subprocess.TimeoutExpired:
        logger.error("Remotion timed out for line scene_type=%s", scene_type)
        return False
    except FileNotFoundError:
        logger.error("npx not found — Node.js required")
        return False


# ─── Fallback: pure FFmpeg dark space background ──────────────────────────────

def _make_dark_space_clip(duration_s: float, seed: int, out_path: str) -> bool:
    """Generate a dark space background with subtle noise (no external deps)."""
    args = [
        "-f", "lavfi",
        "-i", f"color=c=0x04000f:size={SHORT_WIDTH}x{SHORT_HEIGHT}:rate={SHORT_FPS}:duration={duration_s:.3f}",
        "-vf", f"noise=alls=6:allf=t,eq=brightness=-0.04:saturation=0.2:gamma=0.95",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "30",
        "-pix_fmt", "yuv420p",
        "-an",
        out_path,
    ]
    return _run_ffmpeg(args, f"dark-space-bg seed={seed}")


# ─── Portrait crop ─────────────────────────────────────────────────────────────

def _make_portrait_clip(src: str, duration_s: float, out_path: str) -> bool:
    """
    Crop + scale any source clip to 1080×1920.
    Trims to duration_s. If src is already portrait, just scale.
    """
    args = [
        "-i", src,
        "-t", f"{duration_s:.3f}",
        "-vf", (
            f"scale={SHORT_WIDTH}:{SHORT_HEIGHT}:force_original_aspect_ratio=increase,"
            f"crop={SHORT_WIDTH}:{SHORT_HEIGHT},"
            f"setsar=1"
        ),
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-an",
        out_path,
    ]
    return _run_ffmpeg(args, f"portrait-crop {Path(src).name[:30]}")


# ─── Main assembly ─────────────────────────────────────────────────────────────

def assemble_short(manifest_path: str) -> bool:
    with open(manifest_path, "r", encoding="utf-8") as fh:
        manifest = json.load(fh)

    channel_id = manifest.get("channel_id", "ch6")
    date_str = manifest.get("date", date.today().isoformat())
    script = manifest.get("script", "")
    lines = manifest.get("lines", [])

    if not lines:
        logger.error("Manifest has no lines.")
        return False

    config_path = Path(__file__).parent.parent / "configs" / "ch6-red-space-facts.json"
    config: Dict[str, Any] = {}
    if config_path.exists():
        with open(config_path) as fh:
            config = json.load(fh)

    temp_dir = Path("temp") / "assembly" / f"{channel_id}_short_{date_str}"
    temp_dir.mkdir(parents=True, exist_ok=True)
    output_dir = Path("temp") / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    # ── Step 1: TTS + word timestamps ─────────────────────────────────────────
    logger.info("[ch6-short] Step 1 — SSML TTS + word timestamps")
    ssml = _build_ssml(script)
    tts_path = str(temp_dir / "voiceover.mp3")
    words = asyncio.run(_tts_with_timestamps(ssml, config, tts_path))

    if not words:
        logger.warning("[ch6-short] No word timestamps — captions will be absent")

    # Adjust line durations to match actual TTS audio
    tts_duration = _get_duration(tts_path) if Path(tts_path).exists() else 0.0
    manifest_total = sum(ln.get("duration_seconds", 3.0) for ln in lines)
    duration_scale = (tts_duration / manifest_total) if (tts_duration > 0 and manifest_total > 0) else 1.0
    if abs(duration_scale - 1.0) > 0.05:
        logger.info("[ch6-short] Scaling line durations by %.3f to match TTS (%.1fs)", duration_scale, tts_duration)

    # ── Step 2: ASS karaoke subtitles ─────────────────────────────────────────
    logger.info("[ch6-short] Step 2 — Building karaoke subtitle file")
    ass_content = _build_ass_subtitles(words, accent_color="#ff2222")
    ass_path = str((temp_dir / "karaoke.ass").absolute())
    Path(ass_path).write_text(ass_content, encoding="utf-8")

    # ── Step 3: Per-line visual clips ─────────────────────────────────────────
    logger.info("[ch6-short] Step 3 — Building %d line clips", len(lines))
    portrait_clips: List[str] = []
    temp_files: List[str] = []

    for line in lines:
        ln = line.get("line_number", 0)
        raw_dur = float(line.get("duration_seconds", 3.0)) * duration_scale
        dur = max(0.5, raw_dur)
        keywords: List[str] = line.get("b_roll_keywords", [])
        scene_type: str = line.get("scene_type", "stars")

        pexels_raw = str(temp_dir / f"pexels_{ln:04d}.mp4")
        remotion_raw = str(temp_dir / f"remotion_{ln:04d}.mp4")
        fallback_raw = str(temp_dir / f"fallback_{ln:04d}.mp4")
        portrait_out = str(temp_dir / f"portrait_{ln:04d}.mp4")
        temp_files.extend([pexels_raw, remotion_raw, fallback_raw])

        source_clip: Optional[str] = None

        # a. Pexels
        if keywords and _fetch_pexels_clip(keywords, ln, pexels_raw):
            source_clip = pexels_raw
            logger.info("[ch6-short] Line %d: Pexels footage", ln)
        else:
            # b. Remotion SpaceScene
            if _render_space_scene(scene_type, dur, remotion_raw):
                source_clip = remotion_raw
                logger.info("[ch6-short] Line %d: Remotion %s scene", ln, scene_type)
            else:
                # c. Pure FFmpeg fallback (always works)
                if _make_dark_space_clip(dur, ln, fallback_raw):
                    source_clip = fallback_raw
                    logger.info("[ch6-short] Line %d: dark-space fallback", ln)

        if source_clip and Path(source_clip).exists():
            if _make_portrait_clip(source_clip, dur, portrait_out):
                portrait_clips.append(portrait_out)
            else:
                logger.warning("[ch6-short] Line %d: portrait crop failed — skipping", ln)
        else:
            logger.warning("[ch6-short] Line %d: no source clip produced", ln)

    if not portrait_clips:
        logger.error("[ch6-short] No portrait clips — aborting.")
        return False

    # ── Step 4: Concatenate clips ──────────────────────────────────────────────
    logger.info("[ch6-short] Step 4 — Concatenating %d clips", len(portrait_clips))
    concat_list = str(temp_dir / "concat.txt")
    concat_silent = str(temp_dir / "concat_silent.mp4")

    with open(concat_list, "w") as fh:
        for clip in portrait_clips:
            fh.write(f"file '{clip}'\n")

    concat_ok = _run_ffmpeg([
        "-f", "concat", "-safe", "0", "-i", concat_list,
        "-c:v", "libx264", "-preset", "fast", "-crf", "19",
        "-pix_fmt", "yuv420p", "-an",
        concat_silent,
    ], "Concatenate portrait clips")

    if not concat_ok:
        logger.error("[ch6-short] Concatenation failed.")
        return False

    # ── Step 5: Burn karaoke subtitles ────────────────────────────────────────
    logger.info("[ch6-short] Step 5 — Burning karaoke captions")
    captioned = str(temp_dir / "captioned.mp4")
    # Use escaped path for ass filter (spaces → \\ )
    ass_escaped = ass_path.replace("\\", "\\\\").replace(":", "\\:")
    caption_ok = _run_ffmpeg([
        "-i", concat_silent,
        "-vf", f"ass={ass_escaped}",
        "-c:v", "libx264", "-preset", "fast", "-crf", "19",
        "-pix_fmt", "yuv420p", "-an",
        captioned,
    ], "Burn ASS karaoke")

    video_for_mux = captioned if caption_ok and Path(captioned).exists() else concat_silent
    if not caption_ok:
        logger.warning("[ch6-short] Caption burn failed — using uncaptioned video")

    # ── Step 6: Mux with audio ────────────────────────────────────────────────
    logger.info("[ch6-short] Step 6 — Muxing video + TTS audio")
    output_path = str(output_dir / f"ch6_{date_str}.mp4")

    if Path(tts_path).exists():
        mux_args = [
            "-i", video_for_mux,
            "-i", tts_path,
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "160k",
            "-map", "0:v:0", "-map", "1:a:0",
            "-movflags", "+faststart",
            "-shortest",
            output_path,
        ]
    else:
        mux_args = [
            "-i", video_for_mux,
            "-c:v", "copy", "-an",
            "-movflags", "+faststart",
            output_path,
        ]

    ok = _run_ffmpeg(mux_args, "Final mux")

    if ok and Path(output_path).exists():
        size_mb = Path(output_path).stat().st_size / 1e6
        duration = _get_duration(output_path)
        logger.info("[ch6-short] Done: %s (%.1f MB, %.0fs)", output_path, size_mb, duration)
        print(f"\n[CH6 Short] Output:   {output_path}")
        print(f"[CH6 Short] Size:     {size_mb:.1f} MB")
        print(f"[CH6 Short] Duration: {duration:.0f}s")
        print(f"[CH6 Short] Clips:    {len(portrait_clips)}/{len(lines)} lines")

    # Cleanup temp files
    for tmp in temp_files + [concat_silent, captioned, concat_list, ass_path]:
        Path(tmp).unlink(missing_ok=True)
    for clip in portrait_clips:
        Path(clip).unlink(missing_ok=True)

    return ok


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python assemble_shorts.py <manifest.json>")
        sys.exit(1)
    ok = assemble_short(sys.argv[1])
    sys.exit(0 if ok else 1)
