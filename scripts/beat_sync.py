"""
Beat-sync utility (Phase 4).

Analyses a music/background track and returns beat onset frames so the
assembly pipeline can snap composition cuts to the rhythm.

Requirements:
  pip install librosa soundfile

Usage:
  from beat_sync import get_beat_frames, snap_to_beat

  frames = get_beat_frames("music.mp3", fps=30)
  snapped = snap_to_beat(cut_frame=145, beat_frames=frames, tolerance=5)

Configuration flag in channel configs:
  "beat_sync": true   — enable; default true when a music_path is present
  "beat_sync": false  — no-op; all cut frames returned as-is

Credit cost: zero (librosa is free, offline, no API).
"""

import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


def get_beat_frames(
    audio_path: str,
    fps: int = 30,
    start_bpm: Optional[float] = None,
) -> List[int]:
    """
    Analyse an audio file and return a sorted list of beat onset frame numbers.

    Args:
        audio_path:  Path to the music/audio file (MP3, WAV, FLAC, etc.).
        fps:         Video frame rate, default 30.
        start_bpm:   Optional tempo hint to improve accuracy on unusual tracks.

    Returns:
        Sorted list of integer frame numbers where beats fall.
        Returns [] if librosa is not installed or analysis fails (safe no-op).
    """
    try:
        import librosa  # pylint: disable=import-outside-toplevel
    except ImportError:
        logger.warning(
            "librosa not installed — beat sync disabled. "
            "Install with: pip install librosa soundfile"
        )
        return []

    try:
        y, sr = librosa.load(audio_path, mono=True)
        kwargs = {}
        if start_bpm is not None:
            kwargs["start_bpm"] = start_bpm
        _, beat_times = librosa.beat.beat_track(y=y, sr=sr, units="time", **kwargs)
        beat_frames = sorted({int(round(t * fps)) for t in beat_times})
        logger.info(
            "Beat sync: %d beats found in '%s' (fps=%d)",
            len(beat_frames), audio_path, fps,
        )
        return beat_frames
    except Exception as exc:  # pylint: disable=broad-except
        logger.warning("Beat analysis failed for '%s': %s", audio_path, exc)
        return []


def snap_to_beat(
    cut_frame: int,
    beat_frames: List[int],
    tolerance: int = 5,
) -> int:
    """
    Snap a composition cut frame to the nearest beat within tolerance.

    Args:
        cut_frame:    The originally scheduled cut frame.
        beat_frames:  Sorted list of beat frames from get_beat_frames().
        tolerance:    Max frames to shift; if nearest beat is farther,
                      return cut_frame unchanged.

    Returns:
        Adjusted frame number (may be unchanged).
    """
    if not beat_frames:
        return cut_frame

    nearest = min(beat_frames, key=lambda bf: abs(bf - cut_frame))
    delta = abs(nearest - cut_frame)

    if delta <= tolerance:
        logger.debug(
            "Beat snap: frame %d → %d (delta %d, tolerance %d)",
            cut_frame, nearest, delta, tolerance,
        )
        return nearest

    return cut_frame


def snap_all_cuts(
    cut_frames: List[int],
    beat_frames: List[int],
    tolerance: int = 5,
) -> List[int]:
    """
    Snap a list of cut frames to the nearest beats.
    Returns a new list in the same order; no-op when beat_frames is empty.
    """
    return [snap_to_beat(f, beat_frames, tolerance) for f in cut_frames]


def build_cut_frames(lines: list, fps: int = 30) -> List[int]:
    """
    Convert manifest lines to cumulative cut frames.

    Args:
        lines: List of line dicts with 'duration_seconds'.
        fps:   Frame rate.

    Returns:
        List of frame numbers at which each line starts (length == len(lines)).
    """
    frames = []
    cumulative = 0
    for line in lines:
        frames.append(cumulative)
        duration_s = line.get("duration_seconds", 3.0)
        cumulative += int(round(duration_s * fps))
    return frames


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python beat_sync.py <audio_file> [fps]")
        sys.exit(1)

    audio = sys.argv[1]
    target_fps = int(sys.argv[2]) if len(sys.argv) > 2 else 30
    beats = get_beat_frames(audio, fps=target_fps)
    print(f"Found {len(beats)} beats at fps={target_fps}:")
    print(beats)
