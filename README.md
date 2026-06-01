# YouTube Automation System

A production-grade, 5-channel YouTube automation system that generates, produces, and publishes
videos entirely on free-tier services using AI.  **v2.0 — Mograph Overhaul.**

## Channels

| Channel | Niche | Schedule | Length |
|---------|-------|----------|--------|
| DOPAMINE LOOP | Psychology / Celebrity | Tue, Fri | 8–12 min |
| FINANCEFICTION | Financial psychology | Tue, Fri, Sat | 8–12 min |
| REDACTED | Declassified operations | Mon, Thu | 12–18 min |
| THE GREY MATTER | Peer-reviewed neuroscience | Tue, Fri | 10–16 min |
| THE QUIET RECORD | Forgotten history | Wed, Sat | 12–20 min |

All videos publish at **20:00 SAST (18:00 UTC)**.

---

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> && cd youtubeleko
pip install -r requirements.txt
cd remotion && npm install && cd ..

# 2. Configure environment
cp .env.example .env
# Fill in your API keys (see docs/SETUP.md)

# 3. Get YouTube OAuth tokens
python scripts/get_youtube_token.py

# 4. Add all secrets to GitHub (Settings → Secrets → Actions)

# 5. Enable GitHub Actions workflows
# Nightly pipeline auto-runs at 20:00 UTC
# Morning pipeline auto-runs at 04:00 UTC
```

See [docs/SETUP.md](docs/SETUP.md) for detailed setup instructions.

---

## System Architecture

```
NIGHTLY (20:00 UTC):  configs → Claude API → topics → 8-stage scripts → Cloudinary

MORNING (04:00 UTC):  manifests → Pexels (b-roll) → edge-tts + prosody (voice) →
                      Pollinations.ai (thumbnails) → Remotion (motion graphics) →
                      FFmpeg + beat-sync (assembly) → YouTube (scheduled 18:00 UTC)
                      → Google Drive
```

Full architecture diagram in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Service Stack (All Free)

| Purpose | Service |
|---------|---------|
| Primary LLM | Claude API (claude-sonnet-4-6) |
| Fallback LLM | Google Gemini 1.5 Flash |
| Text-to-speech | edge-tts (Microsoft, unlimited) |
| AI thumbnails | Pollinations.ai (no auth needed) |
| Stock footage | Pexels API (200 req/hr free) |
| Asset storage | Cloudinary (25 GB free) |
| Motion graphics | Remotion (React/TypeScript) |
| Beat detection | librosa (offline, free) |
| Video processing | FFmpeg |
| Orchestration | GitHub Actions |
| Backup | Google Drive API |
| Upload | YouTube Data API v3 |
| Notifications | Telegram Bot |

Optional paid services (all **OFF** by default):

| Purpose | Service | Cost |
|---------|---------|------|
| AI imagery | Higgsfield | ~$0.04/image |
| Premium TTS | Pluggable (ElevenLabs, Play.ht, etc.) | Provider rates |

---

## Pipeline Stages (v2.0)

The 8-stage script generation pipeline (`scripts/write_scripts.py`):

1. **Outline** — Structured section breakdown
2. **Research** — Facts and sources per section
3. **Full Script** — Complete narration text
4. **Line Breakdown** — Timed lines at ~130 wpm
5. **Visual Treatments** — Remotion composition per line (with content-aware fallback heuristic)
6. **5.5 – Visual Spec** *(new)* — Structured intent JSON per line (intent, data, kineticWords, highlightWords, sfxCueFrame)
7. **B-Roll Keywords** — Pexels search terms per line
8. **Metadata** — YouTube title, description, tags, thumbnail prompt

### Stage 5 Heuristic

When the LLM returns an unknown composition or the batch fails, the pipeline no longer silently
defaults to a static text card. It runs a content-aware heuristic:

| Line content | Fallback treatment |
|---|---|
| Digits / % / currency | `StatsBanner` or `DataViz` |
| Starts with quotation mark | `Quote` |
| Contains "vs", "compared to", "unlike" | `SplitScreen` |
| Two or more year references | `Timeline` |
| Comma-separated list / colon | `BulletList` |
| Everything else | `TextReveal` (kinetic, ≤3 words) |

### Stage 5.5 Visual Spec

Each line receives a structured `visualSpec` field passed through to Remotion:

```json
{
  "intent": "stat|proportion|quote|concept|comparison|timeline|list|reveal|kinetic",
  "data": { "value": 60, "unit": "%", "total": 100, "iconCount": 10, "highlightCount": 6 },
  "kineticWords": ["poorer", "think"],
  "highlightWords": ["60%"],
  "sfxCueFrame": 18
}
```

Existing manifests without `visualSpec` render normally (backward compatible).

---

## Remotion Compositions (v2.0)

### Motion library

| File | What it does |
|------|-------------|
| `lib/camera.tsx` | `<CameraRig driftPct>` — continuous slow zoom/drift; optional accent push-in |
| `lib/parallax.tsx` | `<ParallaxLayer depth>` — Z-space separation; bg/mid/fg move at different rates |
| `lib/glassCard.tsx` | `<GlassCard>` — frosted blur card with translucent border + soft shadow |
| `lib/glitch.tsx` | `<ChromaticAberration>` + `<Glitch triggerFrames>` — RGB-split + slice jitter |

### Composition templates

13 general templates (TextReveal, SplitScreen, Fullscreen, CelebrityCard, StatsBanner,
Quote, Timeline, BulletList, ImageReveal, DataViz, DocumentScan, ArchiveFootage, BrainDiagram)
+ 14 CH6 Space compositions.

**TextReveal v2** — the pipeline's most-used template is now kinetic:

- Splits text into groups of ≤3 words (configurable `maxWordsOnScreen`)
- Each group enters with **easeOutExpo**, scale-pops **1.1→1.0** via **easeOutElastic**
- Words stagger 3 frames apart within the group
- Groups time-slice across the full `durationInFrames` (no more crawling sentence)
- `highlightWords` prop renders accent words in `accentWarn` color at heavier weight
- **Camera drift**: scale 1.0→1.02 + subtle X/Y over the clip (never fully static)
- **Motion blur**: CSS `filter: blur()` keyed to per-word entrance velocity
- Fully responsive to 9:16 and 16:9 via `useVideoConfig()`

All other compositions upgraded with CameraRig + easeOutExpo/easeOutElastic entrances.

---

## Channel Configs

Each channel is defined by a JSON config in `configs/`. Edit to change brand, schedule, TTS, etc.

### New `motion` block

Controls the channel's distinct visual feel:

```json
{
  "motion": {
    "cameraDriftPct": 2,
    "maxWordsOnScreen": 3,
    "accentWarn": "#ff6b35",
    "glitchOnConcepts": false,
    "glassCards": true,
    "kenBurns": false
  }
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `cameraDriftPct` | `2` | Camera zoom drift % over the clip |
| `maxWordsOnScreen` | `3` | Max words shown simultaneously in TextReveal |
| `accentWarn` | `"#ff6b35"` | Highlight / danger accent color |
| `glitchOnConcepts` | `false` | Apply ChromaticAberration on "concept" beats |
| `glassCards` | `false` | Use GlassCard wrapper on stat/data overlays |
| `kenBurns` | `false` | Ken-Burns slow zoom on still images (CH5) |

Per-channel tuning:

| Channel | cameraDriftPct | accentWarn | glitchOnConcepts | glassCards | kenBurns |
|---------|-----------|---------|---------|---------|---------|
| CH1 DOPAMINE LOOP | 2 | `#ff3300` | ✓ | — | — |
| CH2 FINANCEFICTION | 2 | `#ff6b35` | ✓ | ✓ | — |
| CH3 REDACTED | 1.5 | `#ff3333` | ✓ | — | — |
| CH4 THE GREY MATTER | 1.5 | `#a78bfa` | — | ✓ | — |
| CH5 THE QUIET RECORD | 3 | `#e8b84b` | — | — | ✓ |
| CH6 RED SPACE FACTS | 2 | `#ff6b35` | — | — | — |

### Beat sync

```json
{ "beat_sync": true }
```

When `beat_sync: true` (default), a music track is present, and `librosa` is installed,
composition cut frames snap to the nearest beat within 5 frames.  No-ops silently if any
condition is missing — never breaks the free-tier path.

### Optional TTS provider

```json
{
  "tts": {
    "provider": "edge",
    "voice": "en-US-GuyNeural",
    "rate": "+0%",
    "pitch": "+0Hz"
  }
}
```

`provider: "edge"` is the guaranteed free default.  Swap `"provider"` to wire in a paid
neural voice later without changing any other pipeline code.

### Optional AI imagery (Higgsfield)

```json
{
  "ai_images": {
    "enabled": false,
    "provider": "higgsfield",
    "model": "higgsfield/diffusion-1",
    "max_per_video": 3
  }
}
```

**All channels ship with `enabled: false`.** Set `enabled: true` and add `HIGGSFIELD_API_KEY`
to GitHub Secrets only if you want paid AI imagery.

**Credit cost**: ~$0.04/image × `max_per_video` per video.  Keep `max_per_video ≤ 4` to
control spend.  Generated images are cached in Cloudinary (same prompt → no re-generation).

---

## Before/After: Visual Quality Delta

### TextReveal (most common treatment)

| Aspect | v1 | v2 |
|--------|----|----|
| Split on | Characters (1.5 frame/char) | Word groups ≤3 |
| Easing | Plain spring | easeOutExpo entrance + easeOutElastic pop |
| Camera | Static | 2% drift + subtle pan |
| Overflow | Text clips mid-word at `flexWrap` | Auto-font-size, no clip |
| Highlight words | None | `accentWarn` color, heavy weight |
| Motion blur | None | CSS blur keyed to entrance velocity |

### Stage 5 fallback

| v1 | v2 |
|----|----|
| Any parse failure → silent `TextReveal` | Content heuristic → appropriate treatment |
| Unknown LLM treatment → `TextReveal` | Heuristic re-routes (stat/quote/split/timeline/list) |

### Sample lines (CH2 — "You're poorer than you think…")

- **Before**: Full sentence crawls character by character over ~3 seconds, clips at right edge.
- **After**: "YOU'RE" flashes (kinetic, 1 frame delay), "POORER THAN" pops with easeOutElastic
  overshoot, "YOU THINK" snaps in with a 2% camera drift pushing slowly inward.
  All ≤3 words per moment. Nothing clips. Camera never stops moving.

---

## Documentation

- [Setup Guide](docs/SETUP.md) — Getting started, API key acquisition
- [Architecture](docs/ARCHITECTURE.md) — System design, data flow, service map
- [Operations](docs/OPERATIONS.md) — Daily monitoring, troubleshooting
- [API Reference](docs/API_REFERENCE.md) — All functions and their signatures

---

## License

MIT
