"""
CH6 (RED SPACE FACTS) — Longform Generator

Generates a single longform video manifest per run using the full 7-stage pipeline.
No pre-staged topics required — topic is generated fresh each run by randomly
selecting from CH6's recurring topic areas and asking the LLM for a fresh angle.

Pipeline stages:
  1. topic      – fresh specific angle within a random topic area
  2. outline    – structured section breakdown
  3. research   – verifiable facts and supporting evidence per section
  4. full_script – complete narration (≈1500 words, 10-16 min)
  5. line_breakdown – timed lines with durations and types
  6. visual_treatments – CH6 mograph composition per line
  7. b_roll_keywords – Pexels search terms per line
  8. metadata   – YouTube title, description, tags, thumbnail prompt

Output:
  temp/manifests/ch6.json

Cloudinary path:
  automation/manifests/{date}/ch6
"""

import json
import logging
import os
import random
import re
import sys
import time
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
from json_repair import repair_json

# Support both package import and direct execution
try:
    from scripts.ai_client import get_client
except ImportError:
    from ai_client import get_client

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths & constants
# ---------------------------------------------------------------------------
ROOT_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT_DIR / "configs" / "ch6-red-space-facts.json"
MANIFESTS_DIR = ROOT_DIR / "temp" / "manifests"

MAX_RETRIES = 3
RETRY_DELAY = 6.0
BATCH_SIZE = 20  # lines per LLM call in stages 6 and 7


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_config() -> Dict[str, Any]:
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _init_cloudinary() -> None:
    cloudinary.config(
        cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
        api_key=os.environ["CLOUDINARY_API_KEY"],
        api_secret=os.environ["CLOUDINARY_API_SECRET"],
        secure=True,
    )


def _clean_json(raw: str) -> str:
    """Strip markdown fences from LLM output."""
    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) >= 3 else parts[-1]
        if raw.startswith("json"):
            raw = raw[4:]
    return raw.strip()


def _call_json_stage(
    stage_name: str,
    call_fn,
    max_retries: int = MAX_RETRIES,
) -> Any:
    """
    Run an LLM call that must return JSON.
    Attempts json-repair on parse failure, then retries the full call.
    """
    last_err: Exception = RuntimeError("no attempts made")
    for attempt in range(1, max_retries + 1):
        if attempt > 1:
            wait = attempt * RETRY_DELAY
            logger.warning(
                "[CH6] %s parse error — retrying in %.0fs (attempt %d/%d)",
                stage_name, wait, attempt, max_retries,
            )
            time.sleep(wait)
        try:
            raw = call_fn()
            cleaned = _clean_json(raw)
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError:
                pass
            repaired = repair_json(cleaned, return_objects=False)
            if repaired:
                result = json.loads(repaired)
                logger.info("[CH6] %s: json-repair recovered output.", stage_name)
                return result
            raise json.JSONDecodeError("repair produced empty string", cleaned, 0)
        except json.JSONDecodeError as exc:
            last_err = exc
        except Exception as exc:  # pylint: disable=broad-except
            last_err = exc
            logger.warning("[CH6] %s unexpected error attempt %d: %s", stage_name, attempt, exc)
    raise RuntimeError(
        f"[CH6] {stage_name} failed after {max_retries} attempts. Last: {last_err}"
    )


def _call_text_stage(stage_name: str, call_fn, max_retries: int = MAX_RETRIES) -> str:
    """Run an LLM call that returns plain text, with retries."""
    last_err: Exception = RuntimeError("no attempts made")
    for attempt in range(1, max_retries + 1):
        if attempt > 1:
            wait = attempt * RETRY_DELAY
            logger.warning(
                "[CH6] %s error — retrying in %.0fs (attempt %d/%d)",
                stage_name, wait, attempt, max_retries,
            )
            time.sleep(wait)
        try:
            result = call_fn()
            if result and result.strip():
                return result.strip()
            raise ValueError("Empty response from LLM")
        except Exception as exc:  # pylint: disable=broad-except
            last_err = exc
            logger.warning("[CH6] %s attempt %d failed: %s", stage_name, attempt, exc)
    raise RuntimeError(
        f"[CH6] {stage_name} failed after {max_retries} attempts. Last: {last_err}"
    )


def _generate(prompt: str, system: str = "", max_tokens: int = 4096, temperature: float = 0.7) -> str:
    """Call the ai_client with auto-refresh on failure."""
    client = get_client()
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    response = client.chat.completions.create(
        model=client._model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content.strip()


# ---------------------------------------------------------------------------
# Stage 1 — Generate fresh topic
# ---------------------------------------------------------------------------

def stage_1_topic(cfg: Dict[str, Any]) -> Dict[str, str]:
    """
    Pick a random topic area from the config and ask the LLM for a fresh,
    specific angle that hasn't been overdone on YouTube.
    """
    topic_areas = cfg["content_strategy"]["topics"]["recurring"]
    chosen_area = random.choice(topic_areas)
    forbidden_words = cfg.get("forbidden_words", [])
    forbidden_topics = cfg.get("forbidden_topics", [])

    system = (
        f"You are the head content strategist for '{cfg['channel_name']}', a cinematic YouTube "
        "channel covering space science and astrophysics. You find compelling, specific angles "
        "that are scientifically accurate and visually storytellable."
    )

    prompt = f"""Generate a specific, fresh video topic for a longform YouTube video.

CHANNEL: {cfg['channel_name']}
NICHE: {cfg['niche']}
AUDIENCE: {cfg['audience']}
VIDEO LENGTH: {cfg['length_minutes_min']}–{cfg['length_minutes_max']} minutes (~{cfg['word_count']} words)

TOPIC AREA: {chosen_area}

REQUIREMENTS:
1. Pick a specific angle within "{chosen_area}" that is scientifically accurate
2. The angle should be surprising, counterintuitive, or reveal something most people don't know
3. Must be visually storytellable — can be illustrated with space footage and mograph
4. Avoid these words: {json.dumps(forbidden_words)}
5. Avoid these subjects: {json.dumps(forbidden_topics)}
6. Do NOT pick an angle that is already viral/overdone (e.g. "Is time travel possible?")
7. Aim for depth over breadth — one focused concept explored thoroughly

Return ONLY a JSON object:
{{
  "title": "Punchy video title (max 70 chars, no clickbait, no forbidden words)",
  "hook": "First sentence of the video that stops the scroll (1 sentence, present tense)",
  "angle": "The specific scientific concept or phenomenon being explored (2-3 sentences)",
  "topic_area": "{chosen_area}"
}}

No markdown. No explanation. Just the JSON."""

    logger.info("[CH6] Stage 1 – generating topic from area: %s", chosen_area)
    return _call_json_stage(
        "stage_1_topic",
        lambda: _generate(prompt, system=system, max_tokens=512, temperature=0.9),
    )


# ---------------------------------------------------------------------------
# Stage 2 — Outline
# ---------------------------------------------------------------------------

def stage_2_outline(topic: Dict[str, str], cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Generate a structured JSON outline for the video."""
    system = (
        f"You are the head writer for '{cfg['channel_name']}' (niche: {cfg['niche']}). "
        "You create factual, well-researched video outlines for longform space science content."
    )
    prompt = f"""Create a detailed video outline for this topic:

Title: {topic['title']}
Hook: {topic['hook']}
Angle: {topic['angle']}

Channel: {cfg['channel_name']} | Niche: {cfg['niche']}
Target length: {cfg['length_minutes_min']}–{cfg['length_minutes_max']} minutes (~{cfg['word_count']} words)
Script structure: {cfg['content_strategy']['script_structure']}

Return ONLY a valid JSON object:
{{
  "title": "final title",
  "hook_statement": "opening line",
  "sections": [
    {{
      "section_number": 1,
      "heading": "section heading",
      "key_points": ["point 1", "point 2", "point 3"],
      "estimated_words": 200
    }}
  ],
  "conclusion": "closing message",
  "call_to_action": "subscribe / like / comment prompt"
}}

Aim for 6–8 sections. Return ONLY the JSON, no extra text."""

    logger.info("[CH6] Stage 2 – building outline for: %s", topic["title"])
    return _call_json_stage(
        "stage_2_outline",
        lambda: _generate(prompt, system=system, max_tokens=2500, temperature=0.7),
    )


# ---------------------------------------------------------------------------
# Stage 3 — Research
# ---------------------------------------------------------------------------

def stage_3_research(outline: Dict[str, Any], cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Expand the outline with verifiable facts and supporting evidence."""
    system = (
        f"You are a research specialist for '{cfg['channel_name']}'. "
        "You find verifiable facts, statistics, and scientific context to support space science scripts. "
        "Never fabricate statistics or sources."
    )
    forbidden_str = ", ".join(cfg.get("forbidden_topics", [])) or "none"
    prompt = f"""Enrich this video outline with supporting research:

{json.dumps(outline, indent=2)}

Requirements:
- Add 2–4 verifiable scientific facts or figures per section
- Include source type (e.g. peer-reviewed study, NASA mission data, ESA report, nature paper)
- FORBIDDEN topics: {forbidden_str}
- Do not fabricate data — use accurate real-world scientific knowledge

Return ONLY a valid JSON object — same structure as input but each section gains:
"research_notes": [{{"fact": "...", "source_type": "...", "year": "..."}}]

Return ONLY the JSON, no extra text."""

    logger.info("[CH6] Stage 3 – researching outline sections")
    return _call_json_stage(
        "stage_3_research",
        lambda: _generate(prompt, system=system, max_tokens=8000, temperature=0.5),
    )


# ---------------------------------------------------------------------------
# Stage 4 — Full Script
# ---------------------------------------------------------------------------

def stage_4_full_script(research: Dict[str, Any], cfg: Dict[str, Any]) -> str:
    """Write the complete narration script from the researched outline."""
    system = (
        f"You are the lead scriptwriter for '{cfg['channel_name']}' (niche: {cfg['niche']}). "
        "You write compelling, factual narration scripts for cinematic space science YouTube videos."
    )
    forbidden_words_str = ", ".join(cfg.get("forbidden_words", [])) or "none"
    forbidden_topics_str = ", ".join(cfg.get("forbidden_topics", [])) or "none"
    visual_aesthetic = cfg["visual_style"]["aesthetic"]

    prompt = f"""Write a complete video narration script based on this research outline:

{json.dumps(research, indent=2)}

Channel style: Cinematic, factual, awe-inspiring without sensationalism. Visual aesthetic: {visual_aesthetic}
Target word count: ~{cfg['word_count']} words ({cfg['length_minutes_min']}–{cfg['length_minutes_max']} minutes)
FORBIDDEN words (never use): {forbidden_words_str}
FORBIDDEN topics (never reference): {forbidden_topics_str}

Script requirements:
- Open immediately with the hook statement — no intro filler
- Use short paragraphs (2–4 sentences max)
- Include [PAUSE] markers for dramatic effect after key revelations
- Include [B-ROLL: description] markers to flag visual moments
- End with a compelling conclusion and explicit CTA (subscribe, follow)
- Write in second person ("you") and present tense for immediacy
- Cite scales and numbers precisely (e.g. "4.24 light-years", not "very far")
- Reference specific missions, telescopes, or scientists where appropriate

Return ONLY the plain script text. No JSON, no section headers — just the narration."""

    logger.info("[CH6] Stage 4 – writing full script")
    return _call_text_stage(
        "stage_4_full_script",
        lambda: _generate(prompt, system=system, max_tokens=4096, temperature=0.75),
    )


# ---------------------------------------------------------------------------
# Stage 5 — Line Breakdown
# ---------------------------------------------------------------------------

def stage_5_line_breakdown(script: str, cfg: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Split the script into individual timed lines."""
    system = f"You are the timing director for '{cfg['channel_name']}'. You break scripts into precise timed segments."
    prompt = f"""Break this script into timed lines for video production:

{script}

Rules:
- Each line should be 8–20 words (one breath / thought unit)
- Assign a duration in seconds (estimate 130 words/min speaking pace, adjusted -5% for slow speech rate)
- Mark each line as: narration | b_roll_note | pause | title_card
- narrator_mode: on (full narration, no silent lines)

Return ONLY a valid JSON array where each element is:
{{
  "line_number": 1,
  "text": "the line text",
  "type": "narration | b_roll_note | pause | title_card",
  "duration_seconds": 4.5,
  "cumulative_seconds": 4.5
}}

Return ONLY the JSON array, no extra text."""

    logger.info("[CH6] Stage 5 – breaking script into timed lines")
    return _call_json_stage(
        "stage_5_line_breakdown",
        lambda: _generate(prompt, system=system, max_tokens=8000, temperature=0.3),
    )


# ---------------------------------------------------------------------------
# Stage 6 — Visual Treatments (CH6 mograph compositions)
# ---------------------------------------------------------------------------

def stage_6_visual_treatments(
    lines: List[Dict[str, Any]], cfg: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Assign a CH6 mograph composition to each line, processed in batches."""
    compositions = cfg["mograph_compositions"]
    brand_color = cfg["brand_color"]
    bg_color = cfg["background_color"]
    font_primary = cfg["visual_style"]["font_primary"]
    font_secondary = cfg["visual_style"]["font_secondary"]

    system = (
        f"You are the motion graphics director for '{cfg['channel_name']}'. "
        "You assign cinematic space-themed mograph compositions to each script line."
    )

    # Slim payload: only line_number, text, type
    slim_lines = [
        {"line_number": ln["line_number"], "text": ln["text"], "type": ln["type"]}
        for ln in lines
    ]

    treatment_map: Dict[int, str] = {}

    for i in range(0, len(slim_lines), BATCH_SIZE):
        batch = slim_lines[i:i + BATCH_SIZE]
        if i > 0:
            time.sleep(2)
        batch_json = json.dumps(batch, indent=2)
        prompt = f"""Assign a mograph composition to each script line.

Available CH6 compositions and their best uses:
- SpaceTitle: major headings, hook reveal, section openers
- SpaceStat: statistics, measurements, numerical facts
- StarField: atmospheric transitions, awe moments, pauses
- PlanetReveal: planetary or stellar body introductions
- OrbitPath: orbital mechanics, trajectories, paths
- CosmicTimeline: chronological events, cosmic history
- SpaceQuote: scientist quotes, key phrases
- MissionBrief: mission names, spacecraft introductions
- NebulaBulletList: lists of facts, multi-point explanations
- GalaxyDataViz: large-scale structure, comparative data
- BlackHoleZoom: black holes, singularities, extreme gravity
- CosmicScale: size comparisons, distance scales
- LaunchSequence: rocket launches, mission starts
- SpaceSplitScreen: side-by-side comparisons
- AstroFact: standalone science facts, narration body

Lines to assign:
{batch_json}

Return ONLY a valid JSON array — one object per line:
{{"line_number": <int>, "composition": "<CompositionName>"}}

No extra text."""

        batch_label = f"stage_6_batch_{i // BATCH_SIZE + 1}"
        batch_results = _call_json_stage(
            batch_label,
            lambda p=prompt: _generate(p, system=system, max_tokens=800, temperature=0.4),
        )
        for item in batch_results:
            treatment_map[item["line_number"]] = item.get("composition", "AstroFact")

    # Merge back
    static_fields = {
        "brand_color": brand_color,
        "background_color": bg_color,
        "font_primary": font_primary,
        "font_secondary": font_secondary,
    }
    for line in lines:
        ln = line.get("line_number")
        line["composition"] = treatment_map.get(ln, "AstroFact")
        line["treatment"] = line["composition"]  # compatibility alias
        line.update(static_fields)
    return lines


# ---------------------------------------------------------------------------
# Stage 7 — B-Roll Keywords
# ---------------------------------------------------------------------------

def stage_7_b_roll_keywords(
    lines: List[Dict[str, Any]], cfg: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Generate Pexels search keywords for each line, in batches."""
    b_roll_intensity = cfg.get("b_roll_intensity", 60)
    system = (
        f"You are the stock footage coordinator for '{cfg['channel_name']}'. "
        "You generate precise Pexels search keywords for cinematic space footage."
    )

    slim_lines = [
        {
            "line_number": ln["line_number"],
            "text": ln["text"],
            "type": ln["type"],
            "composition": ln.get("composition", ""),
        }
        for ln in lines
    ]

    keyword_map: Dict[int, List[str]] = {}

    for i in range(0, len(slim_lines), BATCH_SIZE):
        batch = slim_lines[i:i + BATCH_SIZE]
        if i > 0:
            time.sleep(2)
        batch_json = json.dumps(batch, indent=2)
        prompt = f"""Generate Pexels stock footage search keywords for each script line.

B-roll intensity: {b_roll_intensity}/100 (higher = more coverage needed)
Lines:
{batch_json}

Rules:
- 2–4 keywords per line, specific and visually descriptive
- For b_roll_note lines: use the note's subject directly
- For pause/title_card lines: use abstract/atmospheric space terms
- Prefer space-specific terms: "nebula time lapse", "galaxy rotation", "solar flare", "asteroid field"
- Avoid copyrighted names; use descriptive visual terms
- Keywords must work as Pexels video search queries

Return ONLY a valid JSON array — one object per line:
{{"line_number": <int>, "b_roll_keywords": ["keyword1", "keyword2"]}}

No extra text."""

        batch_label = f"stage_7_broll_batch_{i // BATCH_SIZE + 1}"
        batch_results = _call_json_stage(
            batch_label,
            lambda p=prompt: _generate(p, system=system, max_tokens=800, temperature=0.4),
        )
        for item in batch_results:
            keyword_map[item["line_number"]] = item.get("b_roll_keywords", [])

    for line in lines:
        ln = line.get("line_number")
        line["b_roll_keywords"] = keyword_map.get(ln, [])
    return lines


# ---------------------------------------------------------------------------
# Stage 8 — Metadata
# ---------------------------------------------------------------------------

def stage_8_metadata(
    topic: Dict[str, str],
    script: str,
    cfg: Dict[str, Any],
) -> Dict[str, Any]:
    """Generate YouTube upload metadata."""
    system = f"You are the SEO and metadata specialist for '{cfg['channel_name']}'."
    forbidden_str = ", ".join(cfg.get("forbidden_words", [])) or "none"
    script_excerpt = script[:1500]
    thumbnail_style = cfg["visual_style"]["thumbnail_style"]

    prompt = f"""Create YouTube upload metadata for this space science video:

Channel: {cfg['channel_name']} (niche: {cfg['niche']}, audience: {cfg['audience']})
Topic title: {topic['title']}
Script excerpt (first 1500 chars):
{script_excerpt}

FORBIDDEN words in title/description: {forbidden_str}
Thumbnail style: {thumbnail_style}

Return ONLY a valid JSON object:
{{
  "title": "final optimised YouTube title (max 70 chars, no forbidden words, no ALL CAPS spam)",
  "description": "full YouTube description (300–500 words, include timestamps placeholder, relevant hashtags)",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10"],
  "category_id": "28",
  "default_language": "en",
  "thumbnail_prompt": "Detailed DALL-E/Midjourney prompt for thumbnail: {thumbnail_style}, specific visual elements"
}}

Category 28 = Science & Technology. Return ONLY the JSON, no extra text."""

    logger.info("[CH6] Stage 8 – generating metadata")
    return _call_json_stage(
        "stage_8_metadata",
        lambda: _generate(prompt, system=system, max_tokens=2000, temperature=0.6),
    )


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def generate_complete_manifest(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Run all 8 stages and return a complete CH6 production manifest."""

    # Stage 1: Topic
    topic = stage_1_topic(cfg)
    logger.info("[CH6] Topic selected: %s", topic["title"])
    time.sleep(3)

    # Stage 2: Outline
    outline = stage_2_outline(topic, cfg)
    time.sleep(3)

    # Stage 3: Research
    research = stage_3_research(outline, cfg)
    time.sleep(3)

    # Stage 4: Full script
    script = stage_4_full_script(research, cfg)
    word_count = len(script.split())
    logger.info("[CH6] Script written: %d words", word_count)
    time.sleep(3)

    # Stage 5: Line breakdown
    lines = stage_5_line_breakdown(script, cfg)
    logger.info("[CH6] Lines produced: %d", len(lines))
    time.sleep(3)

    # Stage 6: Visual treatments
    logger.info(
        "[CH6] Stage 6 – visual treatments (%d lines, %d batches)",
        len(lines),
        -(-len(lines) // BATCH_SIZE),
    )
    lines = stage_6_visual_treatments(lines, cfg)
    time.sleep(3)

    # Stage 7: B-roll keywords
    logger.info("[CH6] Stage 7 – b-roll keywords")
    lines = stage_7_b_roll_keywords(lines, cfg)
    time.sleep(3)

    # Stage 8: Metadata
    metadata = stage_8_metadata(topic, script, cfg)

    total_duration = sum(line.get("duration_seconds", 0) for line in lines)

    manifest = {
        "channel_id": cfg["channel_id"],
        "channel_name": cfg["channel_name"],
        "generated_date": date.today().isoformat(),
        "topic": topic,
        "outline": outline,
        "research": research,
        "script": script,
        "lines": lines,
        "metadata": metadata,
        "channel_config": cfg,
        "tts_voice": cfg["tts_voice"],
        "speech_rate": cfg["speech_rate"],
        "pitch": cfg["pitch"],
        "total_duration_seconds": round(total_duration, 1),
        "total_lines": len(lines),
        "word_count": word_count,
        "pipeline_version": "1.0.0",
    }

    logger.info(
        "[CH6] Manifest complete – %d lines, %.0fs (~%.1f min)",
        len(lines),
        total_duration,
        total_duration / 60,
    )
    return manifest


# ---------------------------------------------------------------------------
# Save + upload
# ---------------------------------------------------------------------------

def save_manifest(manifest: Dict[str, Any]) -> Path:
    MANIFESTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = MANIFESTS_DIR / "ch6.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    logger.info("[CH6] Manifest saved: %s", out_path)
    return out_path


def upload_to_cloudinary(manifest: Dict[str, Any]) -> str:
    """Upload manifest JSON to Cloudinary as a raw file."""
    _init_cloudinary()
    today = date.today().isoformat()
    public_id = f"automation/manifests/{today}/ch6"
    result = cloudinary.uploader.upload(
        json.dumps(manifest, indent=2, ensure_ascii=False).encode("utf-8"),
        public_id=public_id,
        resource_type="raw",
        overwrite=True,
        tags=["manifest", "ch6", today],
    )
    url = result.get("secure_url", "")
    logger.info("[CH6] Uploaded to Cloudinary: %s", url)
    return url


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    logger.info("=== CH6 Longform Generator starting ===")

    cfg = _load_config()
    logger.info("Loaded config: %s (%s)", cfg["channel_name"], cfg["channel_id"])

    manifest = generate_complete_manifest(cfg)

    local_path = save_manifest(manifest)

    try:
        url = upload_to_cloudinary(manifest)
        manifest["cloudinary_url"] = url
        # Re-save with URL
        save_manifest(manifest)
        logger.info("[CH6] Cloudinary upload complete: %s", url)
    except Exception as exc:
        logger.warning("[CH6] Cloudinary upload failed: %s", exc)

    logger.info("=== CH6 Longform Generator complete ===")
    logger.info("  Topic : %s", manifest["topic"]["title"])
    logger.info("  Words : %d", manifest.get("word_count", 0))
    logger.info("  Lines : %d", manifest["total_lines"])
    logger.info("  Duration: %.1f min", manifest["total_duration_seconds"] / 60)
    logger.info("  Output: %s", local_path)


if __name__ == "__main__":
    main()
