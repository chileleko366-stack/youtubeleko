# YouTube Automation System

Fully autonomous 5-channel YouTube content factory. Generates, renders, and uploads videos daily using only free-tier services.

## Channels

| ID | Name | Niche | Schedule |
|----|------|-------|----------|
| CH1 | DOPAMINE LOOP | Psychology / Celebrity | Tue, Fri |
| CH2 | FINANCEFICTION | Financial Psychology | Tue, Fri, Sat |
| CH3 | REDACTED | Declassified Operations | Mon, Thu |
| CH4 | THE GREY MATTER | Neuroscience / Science | Tue, Fri |
| CH5 | THE QUIET RECORD | Forgotten History | Wed, Sat |

## Pipeline

```
NIGHTLY (20:00 UTC)
  ├── Generate topics × 5 channels      [Claude API → Gemini fallback]
  └── Write scripts (7-stage)           [Claude API → Gemini fallback]
         1. Outline
         2. Research
         3. Full script
         4. Line breakdown
         5. Visual treatments
         6. B-roll keywords
         7. YouTube metadata

MORNING (04:00 UTC)
  ├── Fetch HD stock footage            [Pexels API]
  ├── Generate voiceovers               [Edge TTS — free, unlimited]
  ├── Generate thumbnails               [Pollinations.ai — no key needed]
  ├── Render motion graphics            [Remotion + GitHub Actions]
  ├── Assemble final videos             [FFmpeg]
  ├── Upload to YouTube                 [scheduled 18:00 UTC = 20:00 SAST]
  ├── Backup to Google Drive
  └── Send summary notification         [Telegram]
```

## Free Service Stack

| Component | Service | Cost |
|-----------|---------|------|
| Primary LLM | Claude API | Your plan |
| Fallback LLM | Google Gemini 1.5 Flash | Free tier |
| Text-to-Speech | Microsoft Edge TTS | Free, unlimited |
| AI Thumbnails | Pollinations.ai | Free, no key |
| Stock Footage | Pexels API | Free tier (200 req/hr) |
| Asset Storage | Cloudinary | Free tier (25GB) |
| Video Rendering | Remotion | Open source |
| Video Processing | FFmpeg | Open source |
| Orchestration | GitHub Actions | Free tier (2000 min/mo) |
| Backup | Google Drive | 15GB free |
| Upload | YouTube Data API v3 | Free (10k units/day) |
| Notifications | Telegram Bot | Free |

## Quick Start

See [docs/SETUP.md](docs/SETUP.md) for step-by-step setup instructions.

## Directory Structure

```
├── .github/workflows/      GitHub Actions pipelines
├── scripts/                Python automation scripts
├── remotion/               React motion graphics (Remotion)
├── configs/                Channel configuration JSON files
└── docs/                   Setup and operations documentation
```

## Motion Graphics Compositions

13 Remotion compositions for varied visual treatments:
`TextReveal` · `SplitScreen` · `Fullscreen` · `CelebrityCard` · `StatsBanner` · `Quote` · `Timeline` · `BulletList` · `ImageReveal` · `DataViz` · `DocumentScan` · `ArchiveFootage` · `BrainDiagram`
