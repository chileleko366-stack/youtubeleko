# Setup Guide

Complete instructions for configuring and running the 5-channel YouTube automation system.

---

## Prerequisites

- Python 3.11+
- Node.js 20+
- FFmpeg (for video assembly)
- Git

---

## 1. Clone & Install

```bash
git clone <your-repo-url>
cd youtubeleko

# Python dependencies
pip install -r requirements.txt

# Remotion (Node) dependencies
cd remotion && npm install && cd ..
```

---

## 2. API Keys & Accounts

### Anthropic (Claude API)
1. Go to https://console.anthropic.com/
2. Create an API key
3. Set `ANTHROPIC_API_KEY=<key>`

### Google Gemini (fallback LLM)
1. Go to https://aistudio.google.com/
2. Create an API key
3. Set `GEMINI_API_KEY=<key>`

### Pexels API (stock footage)
1. Go to https://www.pexels.com/api/
2. Sign up for a free account
3. Create an API key (free tier: 200 req/hour)
4. Set `PEXELS_API_KEY=<key>`

### Cloudinary (asset storage)
1. Go to https://cloudinary.com/ — free tier: 25 GB storage, 25 GB bandwidth/month
2. Get Cloud Name, API Key, API Secret from Dashboard
3. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

### YouTube Data API v3
1. Go to https://console.cloud.google.com/
2. Create a new project (or use existing)
3. Enable "YouTube Data API v3"
4. Create OAuth 2.0 credentials (Desktop App type)
5. Download `client_secret.json`
6. Set `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET`
7. Run the token helper to get refresh tokens:
   ```bash
   python scripts/get_youtube_token.py
   ```
8. Set `YOUTUBE_REFRESH_TOKEN_CH1` through `YOUTUBE_REFRESH_TOKEN_CH5`

### Telegram Bot (notifications)
1. Open Telegram, message @BotFather
2. Send `/newbot` and follow prompts
3. Copy the bot token → `TELEGRAM_BOT_TOKEN`
4. Start a conversation with your bot OR add it to a group
5. Get chat ID from https://api.telegram.org/bot<TOKEN>/getUpdates
6. Set `TELEGRAM_CHAT_ID`

### Google Drive (backup)
1. Go to https://console.cloud.google.com/
2. Enable "Google Drive API"
3. Create a Service Account
4. Download the JSON key file
5. Share your Drive folder with the service account email
6. Base64-encode the JSON: `base64 -w0 service_account.json`
7. Set `GOOGLE_DRIVE_CREDENTIALS=<base64-string>`

---

## 3. Configure Environment

Copy the example and fill in your values:

```bash
cp .env.example .env
# Edit .env with your API keys
```

**Never commit `.env` to git.** It's already in `.gitignore`.

---

## 4. GitHub Secrets

For GitHub Actions (CI/CD), add all env vars as repository secrets:

1. Go to your repo → Settings → Secrets and variables → Actions
2. Click "New repository secret" for each:
   - `ANTHROPIC_API_KEY`
   - `GEMINI_API_KEY`
   - `PEXELS_API_KEY`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `YOUTUBE_CLIENT_ID`
   - `YOUTUBE_CLIENT_SECRET`
   - `YOUTUBE_REFRESH_TOKEN_CH1` through `YOUTUBE_REFRESH_TOKEN_CH5`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `GOOGLE_DRIVE_CREDENTIALS`

---

## 5. First Run Test

Test each component individually before running the full pipeline:

```bash
# Test LLM connection
python -c "from scripts.ai_client import get_client; print(get_client().generate('Say hello in 5 words'))"

# Test topic generation (one channel)
python -c "
import json
from scripts.generate_topics import load_channel_config, generate_topics_for_channel
config = load_channel_config('ch2')
topics = generate_topics_for_channel(config)
print(json.dumps(topics, indent=2))
"

# Test voiceover (CH2)
python -c "
import asyncio
from scripts.generate_voiceover import generate_voiceover
asyncio.run(generate_voiceover('This is a test of the voice system.', 'en-US-GuyNeural', '+0%', '+0Hz', '/tmp/test_voice.mp3'))
print('Done — check /tmp/test_voice.mp3')
"

# Test thumbnail generation
python -c "
from scripts.generate_thumbnail import generate_thumbnail
config = {'_channel_id': 'ch2', 'brand_color': '#00d4aa', 'background_color': '#0d1117', 'font_primary': 'Inter', 'channel_name': 'FINANCEFICTION'}
generate_thumbnail('The Hidden Psychology of Billionaires', config, '/tmp/test_thumb.png')
print('Done — check /tmp/test_thumb.png')
"
```

---

## 6. Run Full Pipeline Manually

```bash
# Nightly: generate topics + scripts
python scripts/generate_topics.py
python scripts/write_scripts.py

# Morning: produce + upload (requires assembled assets)
# (Best run via GitHub Actions due to resource requirements)
```

---

## 7. Enable Automated Schedules

The GitHub Actions workflows run automatically:
- **Nightly Pipeline**: 20:00 UTC every day (topic + script generation)
- **Morning Pipeline**: 04:00 UTC every day (production + upload)

You can also trigger them manually from the Actions tab in GitHub.

---

## Troubleshooting

### "ANTHROPIC_API_KEY not set"
- Ensure `.env` is in the project root and `python-dotenv` is installed

### Cloudinary upload fails
- Check `CLOUDINARY_CLOUD_NAME` matches exactly (case-sensitive)
- Verify API key has upload permissions

### YouTube 403 error
- Refresh token may have expired — re-run `get_youtube_token.py`
- Ensure YouTube Data API v3 is enabled in your Google Cloud project
- Check OAuth consent screen is configured correctly

### Remotion render fails
- Run `cd remotion && npm install` first
- Ensure Node.js 20+ is installed
- Check `npx remotion studio` works locally
