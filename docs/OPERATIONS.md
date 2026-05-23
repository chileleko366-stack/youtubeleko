# Operations Guide

Day-to-day operations, monitoring, and troubleshooting for the YouTube automation system.

---

## Daily Monitoring

### Telegram Notifications
The system sends Telegram messages at key pipeline stages:
- Pipeline start (Nightly + Morning)
- Script generation complete (per channel)
- Video upload success (with YouTube URL)
- Errors (with stage name and truncated error message)
- Daily summary (end of morning pipeline)

Configure by setting `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in GitHub Secrets.

### GitHub Actions Dashboard
Monitor pipeline runs at: `https://github.com/<owner>/<repo>/actions`

Key workflows:
- **Nightly Pipeline**: Should complete in ~20-40 minutes
- **Morning Pipeline**: Should complete in ~60-120 minutes (varies by clip count)

### Cloudinary Dashboard
Monitor storage usage at: `https://cloudinary.com/console`
- Alert if approaching 25 GB free tier limit
- Check `automation/` folder for expected daily uploads

---

## Pipeline Schedule

| Time (UTC) | Event |
|-----------|-------|
| 20:00 | Nightly Pipeline starts — topic + script generation |
| ~20:40 | Scripts ready in Cloudinary |
| 04:00 | Morning Pipeline starts — production |
| ~06:00 | Videos assembled |
| ~06:30 | Videos uploaded to YouTube (scheduled private) |
| 18:00 | YouTube automatically publishes videos |

---

## Manual Operations

### Re-run a specific channel
Trigger the morning pipeline with a specific channel:
1. Go to Actions → Morning Pipeline
2. Click "Run workflow"
3. Enter channel ID (e.g., `ch3`)

### Force-regenerate topics for a channel
```bash
python -c "
import cloudinary
import cloudinary.uploader
import os
from datetime import date
from scripts.generate_topics import load_channel_config, generate_topics_for_channel

cloudinary.config(
    cloud_name=os.environ['CLOUDINARY_CLOUD_NAME'],
    api_key=os.environ['CLOUDINARY_API_KEY'],
    api_secret=os.environ['CLOUDINARY_API_SECRET'],
)

config = load_channel_config('ch3')
topics = generate_topics_for_channel(config)
date_str = date.today().isoformat()
payload = __import__('json').dumps({'channel_id': 'ch3', 'date': date_str, 'topics': topics}, indent=2)
cloudinary.uploader.upload(payload.encode(), resource_type='raw', public_id=f'automation/topics/{date_str}/ch3', overwrite=True)
print('Done')
"
```

### Skip to a specific pipeline stage
Each script can be run independently if you already have the upstream assets:
```bash
# Just fetch b-roll (manifest must exist in Cloudinary)
python scripts/stock_footage.py path/to/manifest.json

# Just generate voiceovers
python scripts/generate_voiceover.py path/to/manifest.json

# Just render motion graphics
python scripts/render_mographs.py path/to/manifest.json
```

---

## Common Issues

### Issue: Claude API rate limit
**Symptom**: `anthropic.RateLimitError` in logs  
**Fix**: The system automatically retries 3 times with exponential backoff, then falls back to Gemini.
If both fail, check your Claude quota at https://console.anthropic.com/

### Issue: YouTube upload 403 Forbidden
**Symptom**: `HttpError 403` during upload  
**Cause**: OAuth refresh token expired or YouTube API quota exceeded  
**Fix**:
1. Check daily quota: https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas
2. If quota OK, re-generate tokens: `python scripts/get_youtube_token.py`
3. Update `YOUTUBE_REFRESH_TOKEN_CH*` secrets in GitHub

### Issue: Cloudinary storage approaching limit
**Symptom**: Upload fails with storage limit error  
**Fix**:
1. Run manual cleanup: `python scripts/cleanup_cloudinary.py`
2. Reduce retention periods in `cleanup_cloudinary.py`
3. Upgrade Cloudinary plan if needed

### Issue: Remotion render fails in CI
**Symptom**: `npx remotion render` exits non-zero  
**Fix**:
1. Ensure `npm ci` ran successfully in CI
2. Check Node.js version is 20+
3. Inspect stderr output in GitHub Actions logs
4. Test locally: `cd remotion && npx remotion render src/Root.tsx TextReveal /tmp/test.mp4`

### Issue: edge-tts fails for a voice
**Symptom**: `CommunicateError` from edge-tts  
**Fix**: The Microsoft TTS service may be temporarily unavailable.
1. Check available voices: `python -c "import asyncio; import edge_tts; asyncio.run(edge_tts.list_voices())"`  
2. If a voice is unavailable, update the voice in the channel config or `generate_voiceover.py`

### Issue: Pexels returns no results
**Symptom**: `no footage found for any keyword` in logs  
**Fix**: The b-roll keywords may be too specific. The system falls back gracefully to a black frame.
The keywords are regenerated each day with the script, so this typically self-corrects.

### Issue: Pollinations.ai thumbnail timeout
**Symptom**: Request times out after 90s  
**Fix**: Pollinations.ai is a free service and may be under load.
The system retries 3 times automatically. If it consistently fails, check https://pollinations.ai/

---

## Updating Channel Configs

To change a channel's voice, fonts, colors, or schedule, edit `configs/ch*.json`.
Changes take effect on the next pipeline run.

**Common config changes:**
```json
// Change posting schedule
"posting_schedule": {
  "days": ["Monday", "Wednesday", "Friday"],
  "time_utc": "18:00"
}

// Change TTS speed
"tts_rate": "-15%"

// Adjust b-roll intensity (0-100)
"b_roll_intensity": 40
```

---

## Adding a New Channel

1. Create `configs/ch6-new-channel.json` using an existing config as template
2. Add the entry to `CHANNEL_CONFIG_FILES` in `generate_topics.py` and `write_scripts.py`
3. Add voice settings to `CHANNEL_VOICE_SETTINGS` in `generate_voiceover.py`
4. Add grain settings to `CHANNEL_GRAIN_SETTINGS` in `assemble_video.py`
5. Set up YouTube OAuth for the new channel: `python scripts/get_youtube_token.py`
6. Add `YOUTUBE_REFRESH_TOKEN_CH6` to GitHub Secrets
7. Update morning pipeline workflow to include ch6 steps

---

## Performance Tuning

### Reduce API costs
- Set `temperature` lower (0.4-0.6) for more deterministic, shorter outputs
- Reduce `word_count` in channel configs
- Use Gemini Flash more aggressively by lowering the Claude retry count

### Speed up morning pipeline
- Increase Remotion concurrency by parallelising render calls
- Use `asyncio.gather` for voiceover generation (already implemented)
- Pre-download music tracks to avoid network fetches

### Improve video quality
- Increase `--crf` value (lower = better quality, larger file)
- Use `--preset slow` for better compression
- Add colour grading filters to `_build_grain_filter()` in `assemble_video.py`
