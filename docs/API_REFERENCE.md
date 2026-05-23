# API Reference

Complete reference for all scripts, functions, arguments, and return values.

---

## scripts/ai_client.py

### `AIClient`
Unified LLM client with Claude primary and Gemini fallback.

#### `AIClient.generate(prompt, system_prompt="", max_tokens=4096, temperature=0.7) -> str`
Generate text using Claude, falling back to Gemini on failure.

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | `str` | User message / content |
| `system_prompt` | `str` | Optional system instructions |
| `max_tokens` | `int` | Max response tokens (default: 4096) |
| `temperature` | `float` | Sampling temperature 0.0–1.0 (default: 0.7) |

**Returns**: Generated text string  
**Raises**: `RuntimeError` if all providers fail

---

### `get_client() -> AIClient`
Returns the module-level `AIClient` singleton (creates on first call).

---

## scripts/generate_topics.py

### `load_channel_config(channel_id: str) -> Dict`
Load and parse a channel config JSON file.

| Parameter | Type | Description |
|-----------|------|-------------|
| `channel_id` | `str` | One of: `ch1`, `ch2`, `ch3`, `ch4`, `ch5` |

**Returns**: Parsed config dict with `_channel_id` injected

---

### `generate_topics_for_channel(channel_config: Dict) -> List[Dict]`
Generate 3 video topics using the AI client.

**Returns**: List of 3 topic dicts, each containing:
- `title`: Video title (str)
- `hook`: Opening hook sentence (str)
- `angle`: Unique framing description (str)
- `estimated_search_volume`: `"low"` | `"medium"` | `"high"`
- `controversy_score`: Integer 1–10
- `originality_score`: Integer 1–10

---

## scripts/write_scripts.py

### `stage_1_outline(topic, channel_config) -> Dict`
Generate a structured JSON outline with 5–8 sections.

### `stage_2_research(outline, channel_config) -> Dict`
Enrich outline with 2–4 facts per section.

### `stage_3_full_script(research, channel_config) -> str`
Write the complete narration script.

### `stage_4_line_breakdown(script, channel_config) -> List[Dict]`
Split script into timed lines (8–20 words, ~130 wpm).

Each line dict contains:
- `line_number`: int
- `text`: str
- `type`: `"narration"` | `"b_roll_note"` | `"pause"` | `"title_card"`
- `duration_seconds`: float
- `cumulative_seconds`: float

### `stage_5_visual_treatments(lines, channel_config) -> List[Dict]`
Adds to each line: `treatment`, `brand_color`, `background_color`, `font_primary`, `font_secondary`

### `stage_6_b_roll_keywords(lines, channel_config) -> List[Dict]`
Adds `b_roll_keywords: List[str]` to each line.

### `stage_7_metadata(topic, script, channel_config) -> Dict`
Returns YouTube metadata:
- `title`: str (max 70 chars)
- `description`: str (300–500 words with timestamps)
- `tags`: List[str]
- `category_id`: str
- `default_language`: str
- `thumbnail_prompt`: str

### `generate_complete_manifest(topic, channel_config) -> Dict`
Run all 7 stages and return the full production manifest.

---

## scripts/stock_footage.py

### `fetch_footage_for_line(keywords, channel_id, line_number, per_page=10) -> Optional[str]`
Search Pexels for stock footage. Tries each keyword in order.

**Returns**: HTTPS URL of best matching video file, or `None`

### `download_clip(url, output_path) -> bool`
Download a video clip to disk.

**Returns**: `True` on success

### `fetch_all_footage(manifest, output_dir="temp/b_roll") -> List[Tuple[int, Optional[str]]]`
Fetch and download b-roll for all lines in the manifest.

**Returns**: List of `(line_number, local_path_or_None)` tuples

---

## scripts/generate_voiceover.py

### `get_voice_for_channel(channel_config) -> Dict`
Returns voice settings: `{voice, rate, pitch, narrator_mode}`

### `generate_voiceover(script_text, voice, rate, pitch, output_path) -> bool`
Async function. Generate TTS audio using edge-tts.

| Parameter | Example |
|-----------|---------|
| `voice` | `"en-US-GuyNeural"` |
| `rate` | `"-8%"`, `"+0%"` |
| `pitch` | `"-2Hz"`, `"+0Hz"` |

**Returns**: `True` on success

### `generate_all_voiceovers(manifest, output_dir="temp/audio") -> List[Tuple[int, Optional[str]]]`
Generate voiceovers for all narration lines (async, max 3 concurrent).

**Returns**: List of `(line_number, audio_path_or_None)` tuples

---

## scripts/generate_thumbnail.py

### `generate_thumbnail(title, channel_config, output_path, thumbnail_prompt_hint=None) -> bool`
Generate a 1280×720 PNG thumbnail via Pollinations.ai.

No API key required. Retries 3 times on failure.

**Returns**: `True` on success

### `generate_all_thumbnails(manifests, output_dir="temp/thumbnails") -> Dict[str, Optional[str]]`
Generate thumbnails for multiple channels.

**Returns**: `{channel_id: path_or_None}`

---

## scripts/render_mographs.py

### `render_composition(composition_name, props, output_path, duration_frames=90, fps=30) -> bool`
Render one Remotion composition to MP4.

**Available compositions**: TextReveal, SplitScreen, Fullscreen, CelebrityCard, StatsBanner,
Quote, Timeline, BulletList, ImageReveal, DataViz, DocumentScan, ArchiveFootage, BrainDiagram

**Returns**: `True` on success

### `render_all_lines(manifest, output_dir="temp/mographs", fps=30) -> List[Tuple[int, Optional[str]]]`
Render all lines in the manifest.

**Returns**: List of `(line_number, clip_path_or_None)` tuples

---

## scripts/assemble_video.py

### `assemble_video(manifest, voiceover_path, mograph_clips, b_roll_clips, output_path, music_path=None) -> bool`
Assemble the final 1920×1080 H.264 MP4 using FFmpeg.

| Parameter | Type | Description |
|-----------|------|-------------|
| `manifest` | `Dict` | Full production manifest |
| `voiceover_path` | `Optional[str]` | Path to combined voiceover audio |
| `mograph_clips` | `List[Tuple[int, Optional[str]]]` | From `render_all_lines()` |
| `b_roll_clips` | `List[Tuple[int, Optional[str]]]` | From `fetch_all_footage()` |
| `output_path` | `str` | Final MP4 output path |
| `music_path` | `Optional[str]` | Background music file path |

**Returns**: `True` on success

---

## scripts/upload_youtube.py

### `upload_video(video_path, thumbnail_path, manifest) -> Optional[str]`
Upload video to YouTube using OAuth2 refresh token.

Video is uploaded as `private` and scheduled to publish at `18:00 UTC` same day.

| Parameter | Type | Description |
|-----------|------|-------------|
| `video_path` | `str` | Local MP4 path |
| `thumbnail_path` | `Optional[str]` | Local thumbnail PNG/JPG path |
| `manifest` | `Dict` | Full production manifest (uses `channel_id` and `metadata`) |

**Returns**: YouTube video ID string, or `None` on failure

**Required env vars**: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN_CH{N}`

---

## scripts/upload_drive.py

### `backup_to_drive(file_path, channel_id, date_str) -> Optional[str]`
Upload a file to Google Drive under `YouTube Automation Backups/{channel_id}/{date_str}/`.

**Returns**: Drive file ID, or `None` on failure

**Required env vars**: `GOOGLE_DRIVE_CREDENTIALS` (base64-encoded service account JSON)

---

## scripts/cleanup_cloudinary.py

### `cleanup_old_assets(raw_retention_days=30, video_retention_days=7, image_retention_days=14) -> dict`
Delete expired Cloudinary assets under the `automation/` prefix.

**Returns**: Summary dict: `{raw: int, video: int, image: int, errors: int}`

---

## scripts/telegram_notify.py

### `send_message(text, parse_mode="Markdown") -> bool`
Send a Telegram message. Returns `True` on success.

### `notify_pipeline_start(pipeline, channel_count=5)`
Notify that a pipeline has started.

### `notify_script_generated(channel_id, channel_name, title, word_count)`
Notify that a script has been generated.

### `notify_success(channel_id, channel_name, title, video_id)`
Notify that a video was successfully uploaded.

### `notify_error(channel_id, stage, error)`
Notify that an error occurred. Truncates error to 300 chars.

### `notify_daily_summary(results: List[Dict])`
Send end-of-day summary. Each item in `results` should have:
- `status`: `"ok"` or error string
- `channel_id`: str
- `channel_name`: str (optional)
- `title`: str (optional)
- `error`: str (optional)

---

## scripts/get_youtube_token.py

### `get_token_for_channel(channel_id, channel_name, client_secret_path) -> str`
Run OAuth2 flow for a single channel and return the refresh token.

### `main()`
Interactive CLI that:
1. Reads `client_secret.json`
2. Runs OAuth flow for all 5 channels
3. Prints tokens formatted for GitHub Secrets
4. Saves to `youtube_tokens.json`
