# System Architecture

## Overview

The system is a fully automated, multi-channel YouTube content factory. It runs entirely on free-tier
services and GitHub Actions. Two daily pipelines handle the complete workflow from idea generation
to published video.

---

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    NIGHTLY PIPELINE (20:00 UTC)                      │
│                                                                       │
│  configs/ch*.json ──► generate_topics.py ──► Cloudinary             │
│                           (Claude API)         topics/{date}/{ch}.json│
│                                │                                      │
│                                ▼                                      │
│                       write_scripts.py                               │
│                    7 stages × 5 channels                             │
│                           (Claude API)                               │
│                                │                                      │
│                                ▼                                      │
│                    Cloudinary manifests/{date}/{ch}.json             │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    MORNING PIPELINE (04:00 UTC)                       │
│                                                                       │
│  Cloudinary manifest ──► stock_footage.py ──► Pexels API            │
│                       ──► generate_voiceover.py ──► edge-tts        │
│                       ──► generate_thumbnail.py ──► Pollinations.ai  │
│                       ──► render_mographs.py ──► Remotion           │
│                                │                                      │
│                                ▼                                      │
│                       assemble_video.py                              │
│                           (FFmpeg)                                   │
│                                │                                      │
│                          ┌─────┴─────┐                               │
│                          ▼           ▼                               │
│                 upload_youtube.py  upload_drive.py                   │
│                  (scheduled 18:00 UTC publish)                       │
│                                │                                      │
│                                ▼                                      │
│                       telegram_notify.py                             │
│                         (daily summary)                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Topic Generation
- `configs/ch*.json` files define channel identity, constraints, and style
- `generate_topics.py` sends channel config to Claude API
- Returns 3 topic options per channel with metadata
- Stored in Cloudinary as `automation/topics/{YYYY-MM-DD}/{ch_id}.json`

### 2. Script Generation (7 stages)
Each stage builds on the previous, all stored in a unified manifest:

| Stage | Function | Output |
|-------|----------|--------|
| 1 | `stage_1_outline` | Structured section outline |
| 2 | `stage_2_research` | Fact-enriched outline with sources |
| 3 | `stage_3_full_script` | Complete narration text |
| 4 | `stage_4_line_breakdown` | Timed lines (8-20 words each) |
| 5 | `stage_5_visual_treatments` | Remotion composition per line |
| 6 | `stage_6_b_roll_keywords` | Pexels search terms per line |
| 7 | `stage_7_metadata` | YouTube title/desc/tags/thumbnail prompt |

### 3. Asset Production
- **Stock footage**: Pexels API → HD/4K landscape clips downloaded locally
- **Voiceover**: edge-tts → per-line MP3 files in `temp/audio/{channel_id}/`
- **Thumbnails**: Pollinations.ai → 1280×720 PNG in `temp/thumbnails/`
- **Motion graphics**: Remotion → per-line MP4 clips in `temp/mographs/{channel_id}/`

### 4. Video Assembly (FFmpeg)
For each line:
1. Start with Remotion motion graphic clip
2. Overlay b-roll at 40% opacity (if available)
3. Apply channel-specific film grain filter
4. Concatenate all lines into final video
5. Mix voiceover + background music (ducking: music at 25% under voice)
6. Output: 1920×1080 H.264 MP4, AAC 192kbps

### 5. Distribution
- Upload to YouTube as `private` with scheduled publish time `18:00 UTC`
- Backup MP4 + thumbnail to Google Drive
- Send Telegram notification with video URL

---

## Service Map

| Service | Purpose | Free Tier Limits |
|---------|---------|-----------------|
| Claude API (claude-sonnet-4-6) | Primary LLM | Usage-based billing |
| Google Gemini 1.5 Flash | LLM fallback | 15 RPM, 1M TPD free |
| edge-tts | Text-to-speech | Unlimited (Microsoft Edge TTS) |
| Pollinations.ai | Thumbnail images | Unlimited (no auth) |
| Pexels API | Stock footage | 200 req/hour, free |
| Cloudinary | Asset storage/CDN | 25 GB storage, 25 GB BW/mo |
| GitHub Actions | Orchestration | 2000 min/month (public repos: unlimited) |
| Google Drive | Video backup | 15 GB free |
| YouTube Data API v3 | Video upload | 10,000 units/day |
| Telegram Bot API | Notifications | Unlimited |

---

## Channel Architecture

Each channel is defined by a JSON config file that controls:
- Visual identity (brand color, fonts, film grain)
- Content constraints (forbidden topics, forbidden words)
- TTS voice settings
- Schedule (days of week)
- B-roll intensity (how much stock footage coverage)

The system never mixes channel configs — each channel's manifest carries its full config
through all pipeline stages.

---

## Remotion Compositions

13 motion graphic compositions handle all visual treatments:

| Composition | Best Used For |
|-------------|--------------|
| TextReveal | Narration lines, key statements |
| SplitScreen | Comparisons, before/after |
| Fullscreen | Dramatic reveals, hooks |
| CelebrityCard | Person introductions |
| StatsBanner | Numbers, percentages |
| Quote | Direct quotes |
| Timeline | Chronological events |
| BulletList | Lists of points |
| ImageReveal | Visual reveals |
| DataViz | Bar charts, data comparisons |
| DocumentScan | Document/evidence reveals |
| ArchiveFootage | Historical context |
| BrainDiagram | Scientific/psychological concepts |

---

## Resilience Design

- **LLM fallback**: If Claude fails after 3 retries, Gemini 1.5 Flash is tried automatically
- **Per-channel isolation**: One channel failure never affects others (`continue-on-error: true`)
- **Stage independence**: Each pipeline stage logs errors but continues where possible
- **Missing assets handled**: Black frame fallback if no mograph or b-roll is available
- **Cloudinary retention**: Manifests kept 30 days, raw media 7 days
