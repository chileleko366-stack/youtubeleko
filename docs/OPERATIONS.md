# Operations Guide

## Daily Schedule

| Time (UTC) | Event |
|------------|-------|
| 20:00 | Nightly pipeline: generate topics + scripts |
| 04:00 | Morning pipeline: produce + upload videos |
| 18:00 | Videos go live on YouTube (scheduled) |

## Monitoring

### Telegram Notifications
Your bot sends messages for:
- Pipeline start
- Script generation per channel
- Video upload success (with YouTube URL)
- Pipeline errors
- Daily summary

### GitHub Actions Logs
- Repository → **Actions** tab
- Click any workflow run to see step-by-step logs
- Failed steps are marked in red

### Cloudinary Dashboard
- https://console.cloudinary.com
- Monitor storage usage (25GB free tier)
- View uploaded manifests under `automation/`

---

## Common Issues

### "Claude API failed, using Gemini fallback"
Normal — occurs when Claude is rate-limited. Gemini output is slightly shorter but acceptable.

### Remotion render timeout
- Increase `RENDER_TIMEOUT` in `render_mographs.py`
- Or reduce the number of lines per video in `write_scripts.py`
- The GitHub Actions job has a 180-minute timeout

### YouTube upload quota exceeded
The YouTube Data API v3 has a 10,000 unit daily quota. One video upload costs ~1,600 units, so you can upload ~6 videos per day. With 5 channels posting 2-3 times per week, you should be within quota. If you exceed it, uploads will fail with a 403 error.

### Pexels API rate limit
The free tier allows 200 requests/hour. The `stock_footage.py` script adds a 0.5s delay between requests. If you see 429 errors, increase this delay.

### Edge TTS failures
Edge TTS is free and has no documented rate limits, but it can occasionally fail due to network issues. The script will skip failed lines and continue. Missing audio lines will result in silence in the final video.

---

## Manual Operations

### Run a single pipeline step
```bash
cd scripts
python generate_topics.py
python write_scripts.py
python stock_footage.py
python generate_voiceover.py
python generate_thumbnail.py
python render_mographs.py
python assemble_video.py
python upload_youtube.py
```

### Test a single channel
Set `CHANNEL_ID` in each script's `main()` to run for only one channel.

### Refresh YouTube OAuth tokens
YouTube OAuth tokens expire after 7 days of inactivity. Refresh tokens do not expire, but if you revoke access, run:
```bash
python scripts/get_youtube_token.py
```
Then update the `YOUTUBE_REFRESH_TOKEN_CH*` secrets in GitHub.

### Clean up Cloudinary manually
```bash
cd scripts
python cleanup_cloudinary.py
```

### View generated manifests
```bash
curl "https://res.cloudinary.com/$CLOUDINARY_CLOUD_NAME/raw/upload/automation/manifests/$(date +%Y-%m-%d)/ch1.json"
```

---

## Scaling Up

### Add a 6th channel
1. Create `configs/ch6-your-channel.json`
2. Add `"ch6": "ch6-your-channel.json"` to `CHANNEL_CONFIG_FILES` in each script
3. Add `YOUTUBE_REFRESH_TOKEN_CH6` to GitHub Secrets
4. Update the workflow files to include the new secret

### Change posting schedule
Edit `configs/ch*.json` → `posting_schedule.days` and `posting_schedule.time_utc`.
The `upload_youtube.py` script reads the channel config to determine the scheduled publish time.

### Adjust video length
Edit `configs/ch*.json` → `length_minutes_min`, `length_minutes_max`, and `word_count`.
The AI will generate scripts to match the new target length.
