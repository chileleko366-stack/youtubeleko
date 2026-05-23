# YouTube Automation System

A production-grade, 5-channel YouTube automation system that generates, produces, and publishes
videos entirely on free-tier services using AI.

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
NIGHTLY (20:00 UTC):  configs → Claude API → topics → 7-stage scripts → Cloudinary

MORNING (04:00 UTC):  manifests → Pexels (b-roll) → edge-tts (voice) →
                      Pollinations.ai (thumbnails) → Remotion (motion graphics) →
                      FFmpeg (assembly) → YouTube (scheduled 18:00 UTC) → Google Drive
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
| Video processing | FFmpeg |
| Orchestration | GitHub Actions |
| Backup | Google Drive API |
| Upload | YouTube Data API v3 |
| Notifications | Telegram Bot |

---

## Documentation

- [Setup Guide](docs/SETUP.md) — Getting started, API key acquisition
- [Architecture](docs/ARCHITECTURE.md) — System design, data flow, service map
- [Operations](docs/OPERATIONS.md) — Daily monitoring, troubleshooting
- [API Reference](docs/API_REFERENCE.md) — All functions and their signatures

---

## Pipeline Stages

The 7-stage script generation pipeline:

1. **Outline** — Structured section breakdown
2. **Research** — Facts and sources per section
3. **Full Script** — Complete narration text
4. **Line Breakdown** — Timed lines at ~130 wpm
5. **Visual Treatments** — Remotion composition per line
6. **B-Roll Keywords** — Pexels search terms per line
7. **Metadata** — YouTube title, description, tags, thumbnail prompt

---

## Remotion Compositions

13 motion graphic templates: TextReveal, SplitScreen, Fullscreen, CelebrityCard, StatsBanner,
Quote, Timeline, BulletList, ImageReveal, DataViz, DocumentScan, ArchiveFootage, BrainDiagram

---

## Channel Configs

Each channel is defined by a JSON config in `configs/`. Edit these to change:
- Brand colors and fonts
- Posting schedule
- TTS voice and speed
- Forbidden topics and words
- Film grain intensity
- B-roll coverage level

---

## License

MIT
