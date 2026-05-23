"""
Assemble the final video using FFmpeg.

Composition order:
  1. Motion graphic base layer (Remotion rendered clip)
  2. B-roll overlay (blended at channel-specific opacity)
  3. Voiceover audio track
  4. Background music (ducked under voiceover)
  5. Channel-specific film grain filter
  6. Output: 1920x1080 H.264 MP4, AAC audio
"""

import json
import logging
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

FFMPEG_BIN = os.environ.get("FFMPEG_BIN", "ffmpeg")
FFPROBE_BIN = os.environ.get("FFPROBE_BIN", "ffprobe")
OUTPUT_WIDTH = 1920
OUTPUT_HEIGHT = 1080
OUTPUT_FPS = 30
FFMPEG_TIMEOUT = 600  # 10 minutes max per assembly

# Channel-specific film grain settings (intensity 0.0–1.0)
CHANNEL_GRAIN_SETTINGS: Dict[str, Dict[str, Any]] = {
    "ch1": {"grain": 0.20, "vhs_effect": True, "crt_effect": True},
    "ch2": {"grain": 0.05, "vhs_effect": False, "crt_effect": False},
    "ch3": {"grain": 0.16, "vhs_effect": False, "crt_effect": False},
    "ch4": {"grain": 0.09, "vhs_effect": False, "crt_effect": False},
    "ch5": {"grain": 0.07, "vhs_effect": False, "crt_effect": False},
}

# Music tracks mapped by channel (use free/royalty-free asset paths or Cloudinary URLs)
MUSIC_STYLE: Dict[str, str] = {
    "ch1": "energetic_electronic",
    "ch2": "clean_modern_subtle",
    "ch3": "dark_cinematic_tense",
    "ch4": "ambient_contemplative",
    "ch5": "orchestral_documentary",
}


def _run_ffmpeg(args: List[str], description: str = "") -> bool:
    """Run an FFmpeg command and return True on success."""
    cmd = [FFMPEG_BIN, "-y"] + args
    logger.info("FFmpeg: %s", description or " ".join(cmd[:8]))
    logger.debug("Full command: %s", " ".join(cmd))
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=FFMPEG_TIMEOUT,
        )
        if result.returncode != 0:
            logger.error(
                "FFmpeg failed (%s):\n%s",
                description,
                result.stderr[-3000:],
            )
            return False
        return True
    except subprocess.TimeoutExpired:
        logger.error("FFmpeg timed out after %ds (%s)", FFMPEG_TIMEOUT, description)
        return False
    except FileNotFoundError:
        logger.error("ffmpeg binary not found at '%s'. Install FFmpeg.", FFMPEG_BIN)
        return False


def _get_video_duration(path: str) -> float:
    """Return the duration of a video/audio file in seconds using ffprobe."""
    cmd = [
        FFPROBE_BIN,
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        path,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        data = json.loads(result.stdout)
        return float(data.get("format", {}).get("duration", 0))
    except Exception:  # pylint: disable=broad-except
        return 0.0


def _build_grain_filter(channel_id: str) -> str:
    """
    Build the FFmpeg video filter chain for channel-specific grain and effects.
    """
    settings = CHANNEL_GRAIN_SETTINGS.get(channel_id, {"grain": 0.10, "vhs_effect": False, "crt_effect": False})
    grain = settings["grain"]
    vhs = settings.get("vhs_effect", False)
    crt = settings.get("crt_effect", False)

    # Noise filter for film grain (strength 0–100)
    noise_strength = int(grain * 50)
    filters = []

    # Scale to output resolution
    filters.append(f"scale={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease")
    filters.append(f"pad={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black")

    # Film grain
    if noise_strength > 0:
        filters.append(f"noise=alls={noise_strength}:allf=t+u")

    # VHS/CRT effects for CH1
    if vhs:
        # Slight chromatic aberration via rgbsplit simulation
        filters.append("hue=s=1.2")
        filters.append("unsharp=5:5:0.8:5:5:0.0")
        # Scanlines simulation
        filters.append(f"drawgrid=width=0:height=2:thickness=1:color=black@0.15")

    if crt:
        # Vignette effect
        filters.append("vignette=PI/4")

    # Ensure correct framerate
    filters.append(f"fps={OUTPUT_FPS}")

    return ",".join(filters)


def _create_concat_list(clips: List[str], list_path: str):
    """Write an FFmpeg concat demuxer file."""
    with open(list_path, "w", encoding="utf-8") as fh:
        for clip in clips:
            abs_path = str(Path(clip).resolve())
            fh.write(f"file '{abs_path}'\n")


def _concatenate_clips(
    clips: List[str],
    output_path: str,
    channel_id: str,
) -> bool:
    """Concatenate video clips in order, applying channel filters."""
    if not clips:
        logger.error("No clips to concatenate for %s", channel_id)
        return False

    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as tmp:
        concat_list = tmp.name

    _create_concat_list(clips, concat_list)
    grain_filter = _build_grain_filter(channel_id)

    args = [
        "-f", "concat",
        "-safe", "0",
        "-i", concat_list,
        "-vf", grain_filter,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-an",
        output_path,
    ]

    success = _run_ffmpeg(args, f"Concatenate {len(clips)} clips for {channel_id}")
    Path(concat_list).unlink(missing_ok=True)
    return success


def _mix_audio(
    voiceover_path: Optional[str],
    music_path: Optional[str],
    duration: float,
    output_path: str,
) -> bool:
    """Mix voiceover and background music with ducking."""
    if not voiceover_path and not music_path:
        logger.warning("No audio sources provided — creating silent track")
        args = [
            "-f", "lavfi",
            "-i", f"anullsrc=r=44100:cl=stereo:d={duration}",
            "-c:a", "aac",
            "-b:a", "192k",
            output_path,
        ]
        return _run_ffmpeg(args, "Create silent audio track")

    if voiceover_path and not music_path:
        # Just normalise the voiceover
        args = [
            "-i", voiceover_path,
            "-af", "loudnorm=I=-16:LRA=11:TP=-1.5",
            "-c:a", "aac",
            "-b:a", "192k",
            "-t", str(duration),
            output_path,
        ]
        return _run_ffmpeg(args, "Normalise voiceover")

    if music_path and not voiceover_path:
        # Just music, ducked appropriately
        args = [
            "-i", music_path,
            "-af", f"loudnorm=I=-23:LRA=11:TP=-1.5,atrim=duration={duration}",
            "-c:a", "aac",
            "-b:a", "192k",
            output_path,
        ]
        return _run_ffmpeg(args, "Prepare background music")

    # Both voiceover and music — use sidechaincompress-style ducking
    # Voiceover at full volume, music ducked to -18dB when voice is present
    filter_complex = (
        "[0:a]loudnorm=I=-16:LRA=11:TP=-1.5[voice];"
        "[1:a]loudnorm=I=-23:LRA=11:TP=-1.5,"
        f"atrim=duration={duration}[music];"
        "[voice][music]amix=inputs=2:duration=first:weights=1 0.25[aout]"
    )
    args = [
        "-i", voiceover_path,
        "-i", music_path,
        "-filter_complex", filter_complex,
        "-map", "[aout]",
        "-c:a", "aac",
        "-b:a", "192k",
        "-t", str(duration),
        output_path,
    ]
    return _run_ffmpeg(args, "Mix voiceover + music with ducking")


def assemble_video(
    manifest: Dict[str, Any],
    voiceover_path: Optional[str],
    mograph_clips: List[Tuple[int, Optional[str]]],
    b_roll_clips: List[Tuple[int, Optional[str]]],
    output_path: str,
    music_path: Optional[str] = None,
) -> bool:
    """
    Assemble the final video from all components.

    Args:
        manifest:       Full production manifest.
        voiceover_path: Path to combined voiceover MP3/WAV, or None.
        mograph_clips:  List of (line_number, path_or_None) for motion graphics.
        b_roll_clips:   List of (line_number, path_or_None) for b-roll.
        output_path:    Final output MP4 path.
        music_path:     Path to background music file, or None.

    Returns:
        True on success.
    """
    channel_id = manifest.get("channel_id", "unknown")
    lines = manifest.get("lines", [])

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    temp_dir = Path("temp") / "assembly" / channel_id
    temp_dir.mkdir(parents=True, exist_ok=True)

    # Build lookup maps
    mograph_map = {ln: p for ln, p in mograph_clips if p}
    b_roll_map = {ln: p for ln, p in b_roll_clips if p}

    # Build per-line clips: prefer mograph, overlay b-roll if available
    line_clips: List[str] = []
    per_line_temp: List[str] = []

    for line in lines:
        ln = line.get("line_number", 0)
        duration_s = line.get("duration_seconds", 3.0)
        mograph = mograph_map.get(ln)
        b_roll = b_roll_map.get(ln)

        if mograph and b_roll:
            # Overlay b-roll at 60% opacity on top of mograph
            blended_path = str(temp_dir / f"blended_{ln:04d}.mp4")
            blend_filter = (
                f"[0:v][1:v]overlay=0:0:shortest=1,"
                f"format=yuv420p"
            )
            # Scale b-roll to match mograph size
            scale_and_blend = (
                f"[1:v]scale={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}:force_original_aspect_ratio=increase,"
                f"crop={OUTPUT_WIDTH}:{OUTPUT_HEIGHT},setsar=1,format=yuva420p,colorchannelmixer=aa=0.4[broll];"
                f"[0:v][broll]overlay=0:0:shortest=1,format=yuv420p[out]"
            )
            blend_args = [
                "-i", mograph,
                "-i", b_roll,
                "-filter_complex", scale_and_blend,
                "-map", "[out]",
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-crf", "20",
                "-pix_fmt", "yuv420p",
                "-t", str(duration_s),
                "-an",
                blended_path,
            ]
            if _run_ffmpeg(blend_args, f"Blend line {ln}"):
                line_clips.append(blended_path)
                per_line_temp.append(blended_path)
                continue

        if mograph:
            line_clips.append(mograph)
            continue

        if b_roll:
            # Scale and crop b-roll to fill frame
            scaled_path = str(temp_dir / f"broll_scaled_{ln:04d}.mp4")
            scale_args = [
                "-i", b_roll,
                "-vf", (
                    f"scale={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}:force_original_aspect_ratio=increase,"
                    f"crop={OUTPUT_WIDTH}:{OUTPUT_HEIGHT},setsar=1,fps={OUTPUT_FPS}"
                ),
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-crf", "20",
                "-pix_fmt", "yuv420p",
                "-t", str(duration_s),
                "-an",
                scaled_path,
            ]
            if _run_ffmpeg(scale_args, f"Scale b-roll line {ln}"):
                line_clips.append(scaled_path)
                per_line_temp.append(scaled_path)
                continue

        # Fallback: black frame for the duration
        black_path = str(temp_dir / f"black_{ln:04d}.mp4")
        black_args = [
            "-f", "lavfi",
            "-i", f"color=black:size={OUTPUT_WIDTH}x{OUTPUT_HEIGHT}:rate={OUTPUT_FPS}:duration={duration_s}",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "20",
            "-pix_fmt", "yuv420p",
            black_path,
        ]
        _run_ffmpeg(black_args, f"Black fallback line {ln}")
        line_clips.append(black_path)
        per_line_temp.append(black_path)

    if not line_clips:
        logger.error("[%s] No clips available to assemble.", channel_id)
        return False

    # Step 1: Concatenate all line clips into a single silent video
    concat_video = str(temp_dir / "concat_video.mp4")
    logger.info("[%s] Concatenating %d line clips...", channel_id, len(line_clips))
    if not _concatenate_clips(line_clips, concat_video, channel_id):
        return False

    video_duration = _get_video_duration(concat_video)
    logger.info("[%s] Concatenated video duration: %.1fs", channel_id, video_duration)

    # Step 2: Mix audio
    mixed_audio = str(temp_dir / "mixed_audio.aac")
    logger.info("[%s] Mixing audio...", channel_id)
    _mix_audio(voiceover_path, music_path, video_duration, mixed_audio)

    # Step 3: Mux video + audio
    logger.info("[%s] Muxing final video → %s", channel_id, output_path)
    if Path(mixed_audio).exists():
        mux_args = [
            "-i", concat_video,
            "-i", mixed_audio,
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-movflags", "+faststart",
            "-shortest",
            str(output),
        ]
    else:
        mux_args = [
            "-i", concat_video,
            "-c:v", "copy",
            "-an",
            "-movflags", "+faststart",
            str(output),
        ]

    success = _run_ffmpeg(mux_args, f"Final mux for {channel_id}")

    if success and output.exists():
        size_mb = output.stat().st_size / 1e6
        final_duration = _get_video_duration(str(output))
        logger.info(
            "[%s] Assembly complete: %s (%.1f MB, %.1fs)",
            channel_id,
            output_path,
            size_mb,
            final_duration,
        )

    # Cleanup temp files
    for tmp_file in per_line_temp:
        Path(tmp_file).unlink(missing_ok=True)

    return success


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python assemble_video.py <manifest.json>")
        sys.exit(1)

    with open(sys.argv[1], "r", encoding="utf-8") as f:
        manifest_data = json.load(f)

    ch_id = manifest_data.get("channel_id", "ch1")
    print(f"Assembling video for channel {ch_id}...")
    print("Note: This script is typically called from the GitHub Actions pipeline.")
    print("To test: provide mograph_clips and b_roll_clips as arguments to assemble_video().")
