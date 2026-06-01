"""
7-Stage script generation pipeline.

Downloads today's topics from Cloudinary, generates full production manifests
for each channel, and uploads them back to Cloudinary.

Stages:
  1. outline       – structured JSON outline
  2. research      – facts and supporting evidence
  3. full_script   – complete narration text
  4. line_breakdown – timed lines with durations
  5. visual_treatments – Remotion composition per line
  6. b_roll_keywords – Pexels search terms per line
  7. metadata      – YouTube title, description, tags
"""

import json
import logging
import os
import re
import time
from datetime import date
from typing import Any, Callable, Dict, List

import cloudinary
import cloudinary.uploader
import requests
from dotenv import load_dotenv
from json_repair import repair_json

from ai_client import get_client

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

CONFIGS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "configs")

CHANNEL_CONFIG_FILES = {
    "ch1": "ch1-dopamine-loop.json",
    "ch2": "ch2-financefiction.json",
    "ch3": "ch3-redacted.json",
    "ch4": "ch4-grey-matter.json",
    "ch5": "ch5-quiet-record.json",
}

BATCH_SIZE = 20  # lines per LLM call in stages 5 and 6


def _infer_treatment(text: str) -> str:
    """
    Content-aware treatment heuristic.  Used when the LLM batch fails or returns
    an unrecognised composition name so we never silently fall back to a static
    text card for data-rich or structurally significant lines.
    """
    t = text.lower()
    # Percentage or large number → stat visualisation
    if re.search(r"\b\d+\.?\d*\s*%", t):
        return "StatsBanner"
    if re.search(
        r"\b\d[\d,\.]+\s*(?:million|billion|trillion|thousand|k\b|m\b|b\b)", t
    ):
        return "StatsBanner"
    # Currency or ratio ("3 out of 10", "$40,000")
    if re.search(r"[\$€£¥]\s*\d", t) or re.search(
        r"\b\d+\s+(?:out\s+of|in|per)\s+\d+\b", t
    ):
        return "DataViz"
    # Direct quote (opens with a quotation mark)
    if re.match(r'^["""\'']', text.strip()):
        return "Quote"
    # Comparison / contrast keywords
    if re.search(
        r"\b(?:vs\.?|versus|compared\s+to|unlike|while|whereas|however|but)\b", t
    ):
        return "SplitScreen"
    # Date / year range → timeline
    years = re.findall(r"\b(?:1[5-9]|20)\d{2}\b", t)
    if len(years) >= 2 or re.search(r"\bin\s+(?:1[5-9]|20)\d{2}\b", t):
        return "Timeline"
    # List-like lines
    if text.count(",") >= 2 or ";" in text or re.search(r"\:\s*\w", text):
        return "BulletList"
    # Safe default: kinetic TextReveal (now fixed)
    return "TextReveal"

TREATMENT_OPTIONS = [
    "TextReveal",
    "SplitScreen",
    "Fullscreen",
    "CelebrityCard",
    "StatsBanner",
    "Quote",
    "Timeline",
    "BulletList",
    "ImageReveal",
    "DataViz",
    "DocumentScan",
    "ArchiveFootage",
    "BrainDiagram",
]


def _init_cloudinary():
    cloudinary.config(
        cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
        api_key=os.environ["CLOUDINARY_API_KEY"],
        api_secret=os.environ["CLOUDINARY_API_SECRET"],
        secure=True,
    )


def load_channel_config(channel_id: str) -> Dict[str, Any]:
    filename = CHANNEL_CONFIG_FILES[channel_id]
    path = os.path.join(CONFIGS_DIR, filename)
    with open(path, "r", encoding="utf-8") as fh:
        config = json.load(fh)
    config["_channel_id"] = channel_id
    return config


def _clean_json(raw: str) -> str:
    """Strip markdown fences and leading/trailing whitespace from LLM output."""
    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) >= 3 else parts[-1]
        if raw.startswith("json"):
            raw = raw[4:]
    return raw.strip()


def _call_json_stage(
    stage_name: str,
    channel_id: str,
    call_fn: Callable[[], str],
    max_retries: int = 3,
) -> Any:
    """
    Run an LLM call that must return JSON. On JSONDecodeError:
      1. Try json-repair on the raw output (fixes truncated strings/missing commas).
      2. If repair also fails, retry the full LLM call up to max_retries times.
    """
    last_err: Exception = RuntimeError("no attempts made")
    for attempt in range(1, max_retries + 1):
        if attempt > 1:
            wait = attempt * 6
            logger.warning(
                "[%s] %s parse error — retrying in %ds (attempt %d/%d)",
                channel_id, stage_name, wait, attempt, max_retries,
            )
            time.sleep(wait)
        try:
            raw = call_fn()
            cleaned = _clean_json(raw)

            # Fast path: valid JSON
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError:
                pass

            # Repair path: fix truncated / malformed JSON
            repaired = repair_json(cleaned, return_objects=False)
            if repaired:
                result = json.loads(repaired)
                logger.info("[%s] %s: json-repair recovered truncated output.", channel_id, stage_name)
                return result

            raise json.JSONDecodeError("repair produced empty string", cleaned, 0)

        except json.JSONDecodeError as exc:
            last_err = exc
        except Exception as exc:  # pylint: disable=broad-except
            last_err = exc
            logger.warning("[%s] %s unexpected error on attempt %d: %s", channel_id, stage_name, attempt, exc)

    raise RuntimeError(
        f"[{channel_id}] {stage_name} failed after {max_retries} attempts. Last error: {last_err}"
    )


# ---------------------------------------------------------------------------
# Stage 1 – Outline
# ---------------------------------------------------------------------------

def stage_1_outline(topic: Dict[str, Any], channel_config: Dict[str, Any]) -> Dict[str, Any]:
    """Generate a structured JSON outline for the video."""
    client = get_client()
    name = channel_config["channel_name"]
    niche = channel_config["niche"]
    length_min = channel_config.get("length_minutes_min", 8)
    length_max = channel_config.get("length_minutes_max", 12)
    word_count = channel_config.get("word_count", 1200)

    system = (
        f"You are the head writer for YouTube channel '{name}' (niche: {niche}). "
        "You create factual, well-researched video outlines."
    )
    prompt = f"""Create a detailed video outline for this topic:

Title: {topic['title']}
Hook: {topic['hook']}
Angle: {topic['angle']}

Channel: {name} | Niche: {niche}
Target length: {length_min}–{length_max} minutes (~{word_count} words)

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

Aim for 5–8 sections. Return ONLY the JSON, no extra text."""

    channel_id = channel_config["_channel_id"]
    return _call_json_stage("stage_1_outline", channel_id,
        lambda: client.generate(prompt=prompt, system_prompt=system, max_tokens=2500, temperature=0.7))


# ---------------------------------------------------------------------------
# Stage 2 – Research
# ---------------------------------------------------------------------------

def stage_2_research(outline: Dict[str, Any], channel_config: Dict[str, Any]) -> Dict[str, Any]:
    """Expand the outline with factual supporting evidence and statistics."""
    client = get_client()
    name = channel_config["channel_name"]
    forbidden = channel_config.get("forbidden_topics", [])

    system = (
        f"You are a research specialist for '{name}'. "
        "You find verifiable facts, statistics, and historical context to support video scripts. "
        "Never fabricate statistics or sources."
    )
    forbidden_str = ", ".join(forbidden) if forbidden else "none"
    outline_str = json.dumps(outline, indent=2)

    prompt = f"""Enrich this video outline with supporting research:

{outline_str}

Requirements:
- Add 2–4 verifiable facts or statistics per section
- Include source type (e.g. peer-reviewed study, government report, court document)
- FORBIDDEN topics: {forbidden_str}
- Do not fabricate data — use plausible real-world research directions

Return ONLY a valid JSON object — the same structure as the input outline but with an added
"research_notes" list in each section containing objects like:
{{"fact": "...", "source_type": "...", "year": "..."}}

Return ONLY the JSON, no extra text."""

    channel_id = channel_config["_channel_id"]
    return _call_json_stage("stage_2_research", channel_id,
        lambda: client.generate(prompt=prompt, system_prompt=system, max_tokens=8000, temperature=0.5))


# ---------------------------------------------------------------------------
# Stage 3 – Full Script
# ---------------------------------------------------------------------------

def stage_3_full_script(research: Dict[str, Any], channel_config: Dict[str, Any]) -> str:
    """Write the complete narration script."""
    client = get_client()
    name = channel_config["channel_name"]
    niche = channel_config["niche"]
    word_count = channel_config.get("word_count", 1200)
    forbidden_words = channel_config.get("forbidden_words", [])
    forbidden_topics = channel_config.get("forbidden_topics", [])
    narrator_mode = channel_config.get("narrator_mode", True)
    style = channel_config.get("style", {})
    style_notes = style.get("description", "") if isinstance(style, dict) else str(style)

    system = (
        f"You are the lead scriptwriter for '{name}' (niche: {niche}). "
        "You write compelling, factual narration scripts optimised for YouTube retention."
    )
    forbidden_words_str = ", ".join(forbidden_words) if forbidden_words else "none"
    forbidden_topics_str = ", ".join(forbidden_topics) if forbidden_topics else "none"
    research_str = json.dumps(research, indent=2)
    narrator_instruction = (
        "Write full narration text for every section."
        if narrator_mode
        else "Write scene directions and on-screen text only — NO spoken narration (channel uses audio clips)."
    )

    prompt = f"""Write a complete video script based on this research outline:

{research_str}

Channel style: {style_notes}
Target word count: ~{word_count} words
FORBIDDEN words (never use): {forbidden_words_str}
FORBIDDEN topics (never reference): {forbidden_topics_str}
Narrator instruction: {narrator_instruction}

Requirements:
- Open with the hook statement immediately
- Use short paragraphs (2–4 sentences max)
- Include [PAUSE] markers for dramatic effect
- Include [B-ROLL: description] markers for visual notes
- End with a compelling conclusion and CTA
- Write in second person ("you") for engagement

Return ONLY the plain script text. No JSON, no section headers — just the script."""

    script = client.generate(prompt=prompt, system_prompt=system, max_tokens=4096, temperature=0.75)
    return script.strip()


# ---------------------------------------------------------------------------
# Stage 4 – Line Breakdown
# ---------------------------------------------------------------------------

def stage_4_line_breakdown(script: str, channel_config: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Split the script into individual timed lines."""
    client = get_client()
    name = channel_config["channel_name"]
    narrator_mode = channel_config.get("narrator_mode", True)

    system = f"You are the timing director for '{name}'. You break scripts into precise timed segments."

    prompt = f"""Break this script into timed lines for video production:

{script}

Rules:
- Each line should be 8–20 words (one breath / thought unit)
- Assign a duration in seconds (estimate 130 words/min speaking pace)
- Mark each line as: narration | b_roll_note | pause | title_card
- narrator_mode: {"on" if narrator_mode else "off (no spoken narration, visual/audio only)"}

Return ONLY a valid JSON array where each element is:
{{
  "line_number": 1,
  "text": "the line text",
  "type": "narration | b_roll_note | pause | title_card",
  "duration_seconds": 4.5,
  "cumulative_seconds": 4.5
}}

Return ONLY the JSON array, no extra text."""

    channel_id = channel_config["_channel_id"]
    return _call_json_stage("stage_4_line_breakdown", channel_id,
        lambda: client.generate(prompt=prompt, system_prompt=system, max_tokens=8000, temperature=0.3))


# ---------------------------------------------------------------------------
# Stage 5 – Visual Treatments
# ---------------------------------------------------------------------------

def stage_5_visual_treatments(
    lines: List[Dict[str, Any]], channel_config: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Assign a Remotion composition treatment to each line, processed in batches."""
    client = get_client()
    name = channel_config["channel_name"]
    brand_color = channel_config.get("brand_color", "#ffffff")
    bg_color = channel_config.get("background_color", "#000000")
    font_primary = channel_config.get("font_primary", "Inter")
    font_secondary = channel_config.get("font_secondary", "Inter")
    channel_id = channel_config["_channel_id"]
    available = ", ".join(TREATMENT_OPTIONS)

    system = f"You are the motion graphics director for '{name}'. Assign visual composition treatments."

    # Send only line_number + text + type — strips all other fields to stay within TPM limits
    slim_lines = [
        {"line_number": ln["line_number"], "text": ln["text"], "type": ln["type"]}
        for ln in lines
    ]

    treatment_map: Dict[int, str] = {}
    for i in range(0, len(slim_lines), BATCH_SIZE):
        batch = slim_lines[i:i + BATCH_SIZE]
        if i > 0:
            time.sleep(2)  # avoid TPM bursting between batches
        batch_json = json.dumps(batch, indent=2)
        prompt = f"""Assign a visual treatment composition to each script line.

Available compositions: {available}
Lines:
{batch_json}

Selection guide:
- TextReveal: narration lines with single key message
- SplitScreen: comparison or contrast moments
- Fullscreen: dramatic reveals, hooks, conclusions
- CelebrityCard: person introductions or quotes
- StatsBanner: statistics and numbers
- Quote: direct quotes from subjects
- Timeline: chronological events
- BulletList: lists of points
- ImageReveal: visual reveals
- DataViz: charts and data
- DocumentScan: document/evidence reveals
- ArchiveFootage: historical context
- BrainDiagram: psychological/scientific concepts

Return ONLY a valid JSON array — one object per line:
{{"line_number": <int>, "treatment": "<CompositionName>"}}

No extra text."""

        batch_label = f"stage_5_batch_{i // BATCH_SIZE + 1}"
        batch_results = _call_json_stage(
            batch_label,
            channel_id,
            lambda p=prompt: client.generate(prompt=p, system_prompt=system, max_tokens=600, temperature=0.4),
        )
        for item in batch_results:
            raw_treatment = item.get("treatment", "")
            # Validate: only accept known compositions; run heuristic otherwise
            if raw_treatment in TREATMENT_OPTIONS:
                treatment_map[item["line_number"]] = raw_treatment
            else:
                # Find the line text so the heuristic can inspect it
                line_text = next(
                    (sl["text"] for sl in slim_lines if sl["line_number"] == item["line_number"]),
                    "",
                )
                treatment_map[item["line_number"]] = _infer_treatment(line_text)

    # Merge treatment + static brand fields back into the full line objects
    static_fields = {
        "brand_color": brand_color,
        "background_color": bg_color,
        "font_primary": font_primary,
        "font_secondary": font_secondary,
    }
    for line in lines:
        ln = line.get("line_number")
        # Use heuristic when LLM had no result for this line
        assigned = treatment_map.get(ln)
        line["treatment"] = assigned if assigned else _infer_treatment(line.get("text", ""))
        line.update(static_fields)
    return lines


# ---------------------------------------------------------------------------
# Stage 6 – B-Roll Keywords
# ---------------------------------------------------------------------------

def stage_6_b_roll_keywords(
    lines: List[Dict[str, Any]], channel_config: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Generate Pexels search keywords for each line, processed in batches."""
    client = get_client()
    name = channel_config["channel_name"]
    b_roll_intensity = channel_config.get("b_roll_intensity", 50)
    channel_id = channel_config["_channel_id"]

    system = f"You are the stock footage coordinator for '{name}'. Generate Pexels search keywords for stock video."

    # Send only the fields the LLM needs — omit brand/duration/cumulative fields
    slim_lines = [
        {
            "line_number": ln["line_number"],
            "text": ln["text"],
            "type": ln["type"],
            "treatment": ln.get("treatment", ""),
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

B-roll intensity: {b_roll_intensity}/100 (higher = more b-roll coverage needed)
Lines:
{batch_json}

Rules:
- 2–4 keywords per line, specific and visual
- For b_roll_note lines: use the note's subject directly
- For pause/title_card lines: use abstract/atmospheric terms
- Avoid copyrighted names; use descriptive visual terms
- Keywords must work as Pexels search queries

Return ONLY a valid JSON array — one object per line:
{{"line_number": <int>, "b_roll_keywords": ["keyword1", "keyword2"]}}

No extra text."""

        batch_label = f"stage_6_batch_{i // BATCH_SIZE + 1}"
        batch_results = _call_json_stage(
            batch_label,
            channel_id,
            lambda p=prompt: client.generate(prompt=p, system_prompt=system, max_tokens=600, temperature=0.4),
        )
        for item in batch_results:
            keyword_map[item["line_number"]] = item.get("b_roll_keywords", [])

    for line in lines:
        ln = line.get("line_number")
        line["b_roll_keywords"] = keyword_map.get(ln, [])
    return lines


# ---------------------------------------------------------------------------
# Stage 7 – Metadata
# ---------------------------------------------------------------------------

def stage_7_metadata(
    topic: Dict[str, Any],
    script: str,
    channel_config: Dict[str, Any],
) -> Dict[str, Any]:
    """Generate YouTube upload metadata."""
    client = get_client()
    name = channel_config["channel_name"]
    niche = channel_config["niche"]
    audience = channel_config["audience"]
    forbidden_words = channel_config.get("forbidden_words", [])

    forbidden_str = ", ".join(forbidden_words) if forbidden_words else "none"
    script_excerpt = script[:1500]

    system = f"You are the SEO and metadata specialist for '{name}'."

    prompt = f"""Create YouTube upload metadata for this video:

Channel: {name} (niche: {niche}, audience: {audience})
Topic title: {topic['title']}
Script excerpt (first 1500 chars):
{script_excerpt}

FORBIDDEN words in title/description: {forbidden_str}

Return ONLY a valid JSON object:
{{
  "title": "final optimised YouTube title (max 70 chars)",
  "description": "full YouTube description (300–500 words, include timestamps at bottom)",
  "tags": ["tag1", "tag2", ...],
  "category_id": "22",
  "default_language": "en",
  "thumbnail_prompt": "detailed image generation prompt for thumbnail (describe visually)"
}}

Category IDs: 22=People & Blogs, 25=News & Politics, 27=Education, 28=Science & Technology
Pick the most appropriate. Return ONLY the JSON, no extra text."""

    channel_id = channel_config["_channel_id"]
    return _call_json_stage("stage_7_metadata", channel_id,
        lambda: client.generate(prompt=prompt, system_prompt=system, max_tokens=2000, temperature=0.6))


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def generate_complete_manifest(
    topic: Dict[str, Any], channel_config: Dict[str, Any]
) -> Dict[str, Any]:
    """Run all 7 stages and return a complete production manifest."""
    channel_id = channel_config["_channel_id"]
    title = topic["title"]
    logger.info("[%s] Stage 1 – Outline for: %s", channel_id, title)
    outline = stage_1_outline(topic, channel_config)
    time.sleep(3)

    logger.info("[%s] Stage 2 – Research", channel_id)
    research = stage_2_research(outline, channel_config)
    time.sleep(3)

    logger.info("[%s] Stage 3 – Full script", channel_id)
    script = stage_3_full_script(research, channel_config)
    time.sleep(3)

    logger.info("[%s] Stage 4 – Line breakdown", channel_id)
    lines = stage_4_line_breakdown(script, channel_config)
    time.sleep(3)

    logger.info("[%s] Stage 5 – Visual treatments (%d lines, %d batches)", channel_id, len(lines), -(-len(lines) // BATCH_SIZE))
    lines = stage_5_visual_treatments(lines, channel_config)
    time.sleep(3)

    logger.info("[%s] Stage 6 – B-roll keywords", channel_id)
    lines = stage_6_b_roll_keywords(lines, channel_config)
    time.sleep(3)

    logger.info("[%s] Stage 7 – Metadata", channel_id)
    metadata = stage_7_metadata(topic, script, channel_config)

    total_duration = sum(line.get("duration_seconds", 0) for line in lines)

    manifest = {
        "channel_id": channel_id,
        "channel_name": channel_config["channel_name"],
        "topic": topic,
        "outline": outline,
        "research": research,
        "script": script,
        "lines": lines,
        "metadata": metadata,
        "channel_config": channel_config,
        "total_duration_seconds": round(total_duration, 1),
        "total_lines": len(lines),
        "pipeline_version": "1.0.0",
    }
    logger.info(
        "[%s] Manifest complete – %d lines, %.0fs total",
        channel_id,
        len(lines),
        total_duration,
    )
    return manifest


# ---------------------------------------------------------------------------
# Cloudinary helpers
# ---------------------------------------------------------------------------

def _download_topics(channel_id: str, date_str: str) -> List[Dict[str, Any]]:
    """Fetch today's topics JSON from Cloudinary."""
    cloud_name = os.environ["CLOUDINARY_CLOUD_NAME"]
    public_id = f"automation/topics/{date_str}/{channel_id}"
    url = f"https://res.cloudinary.com/{cloud_name}/raw/upload/{public_id}.json"
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return data["topics"]


def _upload_manifest(channel_id: str, manifest: Dict[str, Any], date_str: str) -> str:
    payload = json.dumps(manifest, indent=2)
    public_id = f"automation/manifests/{date_str}/{channel_id}.json"
    result = cloudinary.uploader.upload(
        payload.encode("utf-8"),
        resource_type="raw",
        public_id=public_id,
        overwrite=True,
        tags=["manifest", channel_id, date_str],
    )
    url = result["secure_url"]
    logger.info("Manifest uploaded for %s → %s", channel_id, url)
    return url


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def _write_github_output(key: str, value: str) -> None:
    output_file = os.environ.get("GITHUB_OUTPUT")
    if output_file:
        with open(output_file, "a", encoding="utf-8") as fh:
            fh.write(f"{key}={value}\n")


def main():
    _init_cloudinary()
    date_str = date.today().isoformat()
    results = {}
    providers_used: set = set()

    for channel_id, config_file in CHANNEL_CONFIG_FILES.items():
        try:
            config_path = os.path.join(CONFIGS_DIR, config_file)
            with open(config_path, "r", encoding="utf-8") as fh:
                channel_config = json.load(fh)
            channel_config["_channel_id"] = channel_id

            topics = _download_topics(channel_id, date_str)
            topic = topics[0]
            logger.info("[%s] Using topic: %s", channel_id, topic["title"])

            manifest = generate_complete_manifest(topic, channel_config)
            url = _upload_manifest(channel_id, manifest, date_str)
            results[channel_id] = {"status": "ok", "url": url, "title": topic["title"]}
            if get_client().last_provider:
                providers_used.add(get_client().last_provider)

        except Exception as exc:  # pylint: disable=broad-except
            logger.error("Script generation failed for %s: %s", channel_id, exc, exc_info=True)
            results[channel_id] = {"status": "error", "error": str(exc)}

    provider_str = ", ".join(sorted(providers_used)) if providers_used else "unknown"

    print("\n=== SCRIPT GENERATION SUMMARY ===")
    for ch_id, data in results.items():
        if data["status"] == "ok":
            print(f"[{ch_id}] OK – '{data['title']}' → {data['url']}")
        else:
            print(f"[{ch_id}] ERROR: {data['error']}")
    print(f"\nAI provider(s) used: {provider_str}")

    _write_github_output("ai_provider", provider_str)

    failed = [k for k, v in results.items() if v["status"] == "error"]
    if failed:
        raise SystemExit(f"Script generation failed for: {failed}")


if __name__ == "__main__":
    main()
