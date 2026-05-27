"""
Motion graphics renderer using Remotion.

Renders each script line's visual treatment as a standalone video clip
by calling `npx remotion render` with the appropriate composition and props.
"""

import json
import logging
import os
import re
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

REMOTION_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "remotion")
REMOTION_ENTRY = os.path.join(REMOTION_DIR, "src", "Root.tsx")
RENDER_TIMEOUT = 300  # 5 minutes per clip

# Map treatment strings to Remotion composition names
TREATMENT_TO_COMPOSITION: Dict[str, str] = {
    "TextReveal": "TextReveal",
    "SplitScreen": "SplitScreen",
    "Fullscreen": "Fullscreen",
    "CelebrityCard": "CelebrityCard",
    "StatsBanner": "StatsBanner",
    "Quote": "Quote",
    "Timeline": "Timeline",
    "BulletList": "BulletList",
    "ImageReveal": "ImageReveal",
    "DataViz": "DataViz",
    "DocumentScan": "DocumentScan",
    "ArchiveFootage": "ArchiveFootage",
    "BrainDiagram": "BrainDiagram",
    # Lowercase aliases
    "text_reveal": "TextReveal",
    "split_screen": "SplitScreen",
    "fullscreen": "Fullscreen",
    "celebrity_card": "CelebrityCard",
    "stats_banner": "StatsBanner",
    "quote": "Quote",
    "timeline": "Timeline",
    "bullet_list": "BulletList",
    "image_reveal": "ImageReveal",
    "data_viz": "DataViz",
    "document_scan": "DocumentScan",
    "archive_footage": "ArchiveFootage",
    "brain_diagram": "BrainDiagram",
}

DEFAULT_COMPOSITION = "TextReveal"


def render_composition(
    composition_name: str,
    props: Dict[str, Any],
    output_path: str,
    duration_frames: int = 90,
    fps: int = 30,
) -> bool:
    """
    Render a single Remotion composition to an MP4 file.

    Args:
        composition_name: Name of the Remotion composition to render.
        props:            JSON-serialisable props to pass to the composition.
        output_path:      Path to write the output MP4 file.
        duration_frames:  Number of frames to render.
        fps:              Frames per second.

    Returns:
        True on success, False on failure.
    """
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    props_json = json.dumps(props)
    composition = TREATMENT_TO_COMPOSITION.get(composition_name, DEFAULT_COMPOSITION)

    # Guard: duration_frames must be at least 1 to produce a valid frame range
    if duration_frames < 1:
        logger.warning(
            "duration_frames=%d is invalid for '%s' — clamping to 1",
            duration_frames, composition,
        )
        duration_frames = 1

    cmd = [
        "npx",
        "remotion",
        "render",
        REMOTION_ENTRY,
        composition,
        str(output),
        f"--props={props_json}",
        f"--frames=0-{duration_frames - 1}",
        "--codec=h264",
        "--crf=18",
        "--pixel-format=yuv420p",
        "--overwrite",
        "--log=warn",
    ]

    logger.info(
        "Rendering composition '%s' -> %s (%d frames @ %dfps)",
        composition,
        output_path,
        duration_frames,
        fps,
    )

    for attempt in range(1, 3):
        try:
            result = subprocess.run(
                cmd,
                cwd=REMOTION_DIR,
                capture_output=True,
                text=True,
                timeout=RENDER_TIMEOUT,
            )

            if result.returncode != 0:
                logger.error(
                    "Remotion render failed for '%s' (attempt %d):\nSTDOUT: %s\nSTDERR: %s",
                    composition,
                    attempt,
                    result.stdout[-2000:],
                    result.stderr[-2000:],
                )
                if attempt < 2:
                    time.sleep(5)
                continue

            if output.exists() and output.stat().st_size > 0:
                logger.info(
                    "Render complete: %s (%.1f MB)",
                    output_path,
                    output.stat().st_size / 1e6,
                )
                return True
            else:
                logger.error("Render produced no output file: %s", output_path)
                if attempt < 2:
                    time.sleep(5)
                continue

        except subprocess.TimeoutExpired:
            logger.error("Remotion render timed out after %ds for '%s'", RENDER_TIMEOUT, composition)
            return False

    return False
    except FileNotFoundError:
        logger.error(
            "npx/remotion not found. Make sure Node.js is installed and "
            "'npm install' has been run in the remotion/ directory."
        )
        return False
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Unexpected render error for '%s': %s", composition, exc)
        return False


def _build_props_for_line(
    line: Dict[str, Any],
    channel_config: Dict[str, Any],
    fps: int = 30,
) -> Tuple[str, Dict[str, Any], int]:
    """
    Build the Remotion composition name, props dict, and frame count for a line.

    Returns:
        (composition_name, props_dict, duration_frames)
    """
    treatment = line.get("treatment", DEFAULT_COMPOSITION)
    composition = TREATMENT_TO_COMPOSITION.get(treatment, DEFAULT_COMPOSITION)

    duration_seconds = line.get("duration_seconds", 3.0)
    duration_frames = max(1, round(duration_seconds * fps))

    brand_color = line.get("brand_color") or channel_config.get("brand_color", "#ffffff")
    background_color = line.get("background_color") or channel_config.get("background_color", "#000000")
    font_primary = line.get("font_primary") or channel_config.get("font_primary", "Inter")
    font_secondary = line.get("font_secondary") or channel_config.get("font_secondary", "Inter")

    props = {
        "text": line.get("text", ""),
        "brandColor": brand_color,
        "backgroundColor": background_color,
        "fontPrimary": font_primary,
        "fontSecondary": font_secondary,
        "duration": duration_frames,
        "lineNumber": line.get("line_number", 0),
        "lineType": line.get("type", "narration"),
        "channelId": channel_config.get("_channel_id", ""),
    }

    # Composition-specific extras
    if composition in ("BulletList", "Timeline"):
        sentences = re.split(r"(?<=[.!?])\s+", props["text"])
        props["bullets"] = [s.strip() for s in sentences if s.strip()]

    if composition == "StatsBanner":
        numbers = re.findall(r"\b\d[\d,%.]*\b", props["text"])
        props["statValue"] = numbers[0] if numbers else ""

    if composition == "Quote":
        props["quoteText"] = props["text"]

    return composition, props, duration_frames


def render_all_lines(
    manifest: Dict[str, Any],
    output_dir: str = "temp/mographs",
    fps: int = 30,
) -> List[Tuple[int, Optional[str]]]:
    """
    Render motion graphic clips for all lines in the manifest.

    Args:
        manifest:   Production manifest with 'lines' and 'channel_config'.
        output_dir: Base directory for rendered clips.
        fps:        Frames per second for all renders.

    Returns:
        List of (line_number, local_clip_path_or_None) tuples.
    """
    channel_id = manifest.get("channel_id", "unknown")
    channel_config = manifest.get("channel_config", {})
    channel_config["_channel_id"] = channel_id
    lines = manifest.get("lines", [])

    base_dir = Path(output_dir) / channel_id
    base_dir.mkdir(parents=True, exist_ok=True)

    results: List[Tuple[int, Optional[str]]] = []

    for line in lines:
        line_number = line.get("line_number", 0)

        # Skip pure pause lines (no visual needed)
        if line.get("type") == "pause":
            results.append((line_number, None))
            continue

        composition, props, duration_frames = _build_props_for_line(line, channel_config, fps)
        output_path = str(base_dir / f"line_{line_number:04d}.mp4")

        success = render_composition(
            composition_name=composition,
            props=props,
            output_path=output_path,
            duration_frames=duration_frames,
            fps=fps,
        )
        results.append((line_number, output_path if success else None))

    rendered = sum(1 for _, p in results if p is not None)
    logger.info(
        "[%s] Render complete: %d/%d lines rendered",
        channel_id,
        rendered,
        len(results),
    )
    return results


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python render_mographs.py <manifest.json>")
        sys.exit(1)

    with open(sys.argv[1], "r", encoding="utf-8") as f:
        manifest_data = json.load(f)

    render_results = render_all_lines(manifest_data)
    for ln, path in render_results:
        status = path if path else "SKIPPED/FAILED"
        print(f"  Line {ln:04d}: {status}")
