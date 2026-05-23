# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    GITHUB ACTIONS                           │
│                                                             │
│  NIGHTLY (20:00 UTC)          MORNING (04:00 UTC)           │
│  ┌─────────────────┐          ┌─────────────────────────┐   │
│  │ generate_topics │          │ stock_footage           │   │
│  │ write_scripts   │          │ generate_voiceover      │   │
│  │                 │          │ generate_thumbnail      │   │
│  │ × 5 channels    │          │ render_mographs         │   │
│  └────────┬────────┘          │ assemble_video          │   │
│           │                   │ upload_youtube          │   │
│           ▼                   │ upload_drive            │   │
│      CLOUDINARY               │ cleanup_cloudinary      │   │
│    (manifests store)          └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Nightly Pipeline
1. `generate_topics.py` calls AI → produces `topics/{date}/{ch}.json` in Cloudinary
2. `write_scripts.py` downloads topics, runs 7-stage generation → produces `manifests/{date}/{ch}.json` in Cloudinary

### Morning Pipeline
1. `stock_footage.py` downloads manifest from Cloudinary, fetches B-roll per line from Pexels
2. `generate_voiceover.py` runs Edge TTS on the full script → MP3 files in `temp/audio/`
3. `generate_thumbnail.py` calls Pollinations.ai → PNG in `temp/thumbnails/`
4. `render_mographs.py` calls `npx remotion render` per line → MP4 clips in `temp/mographs/`
5. `assemble_video.py` combines everything with FFmpeg → final MP4 in `temp/output/`
6. `upload_youtube.py` uploads with OAuth, schedules publish at 18:00 UTC
7. `upload_drive.py` backs up the final MP4 to Google Drive
8. `cleanup_cloudinary.py` removes assets older than retention period

## Manifest Schema

Each production manifest stored in Cloudinary has this structure:

```json
{
  "channel_id": "ch1",
  "channel_name": "DOPAMINE LOOP",
  "topic": "...",
  "date": "2025-01-15",
  "metadata": {
    "title": "...",
    "description": "...",
    "tags": [],
    "category_id": "27"
  },
  "full_script": "...",
  "word_count": 1000,
  "lines": [
    {
      "line_number": 1,
      "text": "...",
      "estimated_duration_seconds": 8,
      "treatment": "text_reveal",
      "b_roll_keywords": ["keyword1", "keyword2"]
    }
  ],
  "total_duration_seconds": 600,
  "voice": {
    "narrator_mode": false,
    "tts_voice": null,
    "speech_rate": null,
    "pitch": null
  },
  "visual": { ... },
  "brand_color": "#e8ff47",
  "background_color": "#0a0a0a",
  "status": "queued"
}
```

## Remotion Composition System

13 compositions are registered in `remotion/src/Root.tsx`. Each receives a standard `CompositionProps` payload:

```typescript
{
  text: string;
  brandColor: string;
  backgroundColor: string;
  fontPrimary: string;
  fontSecondary: string;
  durationInFrames: number;
  bullets?: string[];
  statValue?: string;
  quoteText?: string;
}
```

The `render_mographs.py` script maps each line's `treatment` field to the correct composition ID and passes the appropriate props.

## AI Client Architecture

```
scripts/ai_client.py
  ↓ PRIMARY: Claude (claude-sonnet-4-6)
    → 3 retries with exponential backoff
    → Handles: RateLimitError, APIStatusError
  ↓ FALLBACK: Google Gemini 1.5 Flash
    → 3 retries
  ↓ RAISES RuntimeError if both fail
```

## GitHub Actions Resource Usage

| Pipeline | Estimated Duration | Actions Minutes Used |
|----------|-------------------|---------------------|
| Nightly (5 channels) | ~15 min | 15 min |
| Morning (5 channels) | ~90 min | 90 min |
| **Daily total** | ~105 min | 105 min |
| **Monthly total** | ~3,150 min | 3,150 min |

> Note: Free tier provides 2,000 minutes/month for private repos. Consider upgrading or reducing channel count if budget is exceeded.
