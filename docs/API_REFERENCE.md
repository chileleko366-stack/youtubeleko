# API Reference

## scripts/ai_client.py

### `AIClient`
Unified LLM client with Claude primary and Gemini fallback.

**`AIClient.generate(prompt, system_prompt="", max_tokens=4096, temperature=0.7) → str`**
- `prompt`: User message
- `system_prompt`: Optional system instructions
- `max_tokens`: Max tokens in response
- `temperature`: Sampling temperature (0.0–1.0)
- Returns: Generated text string
- Raises: `RuntimeError` if all providers fail

**`get_client() → AIClient`**
Returns module-level singleton instance.

---

## scripts/generate_topics.py

**`load_channel_config(channel_id: str) → dict`**
Loads and parses `configs/ch{N}-*.json`.

**`generate_topics_for_channel(channel_config: dict) → List[dict]`**
Returns list of 3 topic objects, each with: `title`, `hook`, `angle`, `estimated_search_volume`, `controversy_score`, `originality_score`.

**`upload_topics_to_cloudinary(channel_id, topics, date_str) → str`**
Returns the Cloudinary secure URL.

**`main()`**
Generates topics for all 5 channels, uploads to Cloudinary.

---

## scripts/write_scripts.py

**`stage_1_outline(topic, config) → dict`**
Returns: `{hook, sections: [{title, key_points}], cta}`

**`stage_2_research(outline, topic, config) → dict`**
Returns: `{sections: [{title, facts, examples, sources_hint}]}`

**`stage_3_full_script(outline, research, topic, config) → str`**
Returns complete script text.

**`stage_4_line_breakdown(script, config) → List[dict]`**
Returns: `[{line_number, text, estimated_duration_seconds}]`

**`stage_5_visual_treatments(lines, config) → List[dict]`**
Adds `treatment` field to each line.

**`stage_6_broll_keywords(lines, config) → List[dict]`**
Adds `b_roll_keywords: List[str]` to each line.

**`stage_7_metadata(script, topic, config) → dict`**
Returns: `{title, description, tags, category_id}`

**`generate_complete_manifest(topic, config) → dict`**
Runs all 7 stages and assembles the production manifest.

---

## scripts/stock_footage.py

**`fetch_footage_for_line(keywords: List[str], output_path: str) → bool`**
Searches Pexels and downloads the best matching clip.

**`download_clip(url: str, output_path: str) → bool`**
Downloads a video clip from a direct URL.

**`fetch_all_footage(manifest: dict, output_dir: str) → Dict[int, str]`**
Returns `{line_number: clip_path}` for all successfully downloaded clips.

---

## scripts/generate_voiceover.py

**`generate_line_audio(text, voice, rate, pitch, output_path) → bool`**
Synthesizes a single text segment using Edge TTS.

**`get_voice_settings(channel_config) → Tuple[str, str, str]`**
Returns `(voice, rate, pitch)` strings.

**`generate_all_voiceovers(manifest, output_dir) → Dict[int, str]`**
Returns `{line_number: audio_path}` for all generated audio files.

**`generate_full_voiceover(manifest, output_dir, output_path) → bool`**
Generates a single MP3 for the entire script.

---

## scripts/generate_thumbnail.py

**`generate_thumbnail(title, channel_config, output_path, thumbnail_prompt_hint=None) → bool`**
Calls Pollinations.ai and saves the image.

**`generate_all_thumbnails(manifests, output_dir) → Dict[str, Optional[str]]`**
Returns `{channel_id: thumbnail_path}` for all channels.

---

## scripts/render_mographs.py

**`render_composition(composition_name, props, output_path, duration_frames) → bool`**
Renders a single Remotion composition to MP4.

**`render_all_lines(manifest, output_dir, fps=30) → List[Tuple[int, Optional[str]]]`**
Returns list of `(line_number, clip_path_or_None)` tuples.

---

## scripts/assemble_video.py

**`assemble_video(manifest, voiceover_path, mograph_clips, broll_clips, output_path, music_path=None) → bool`**
Composes the final 1920×1080 H.264 MP4 from all asset layers.

---

## scripts/upload_youtube.py

**`upload_video(video_path, thumbnail_path, manifest) → Optional[str]`**
Uploads to YouTube and returns the video ID. Schedules publish at 18:00 UTC.

---

## scripts/upload_drive.py

**`backup_to_drive(file_path, channel_id, date_str) → Optional[str]`**
Returns the Google Drive file ID on success.

---

## scripts/cleanup_cloudinary.py

**`cleanup_old_assets(raw_retention_days=30, video_retention_days=7, image_retention_days=14) → dict`**
Returns `{raw: count, video: count, image: count, errors: count}`.

---

## scripts/telegram_notify.py

**`send_message(text, parse_mode="Markdown") → bool`**

**`notify_pipeline_start(pipeline, channel_count=5)`**

**`notify_script_generated(channel_id, channel_name, title, word_count)`**

**`notify_success(channel_id, channel_name, title, video_id)`**

**`notify_error(channel_id, stage, error)`**

**`notify_daily_summary(results: List[dict])`**
Each result dict: `{channel_id, status: "ok"|"error", title?, error?}`

---

## Remotion Compositions

All compositions accept `CompositionProps`:

```typescript
{
  text: string;
  brandColor: string;          // hex color for accents
  backgroundColor: string;     // hex color for background
  fontPrimary: string;         // bold display font
  fontSecondary: string;       // body text font
  durationInFrames: number;    // total frames (fps=30)
  bullets?: string[];          // for BulletList, Timeline
  statValue?: string;          // for StatsBanner
  quoteText?: string;          // for Quote
}
```

| Composition | Best For |
|-------------|----------|
| `TextReveal` | General narration |
| `SplitScreen` | Contrast / comparison |
| `Fullscreen` | Impactful statements |
| `CelebrityCard` | CH1 celebrity content |
| `StatsBanner` | Statistics and numbers |
| `Quote` | Direct quotes |
| `Timeline` | Sequential events |
| `BulletList` | Lists and breakdowns |
| `ImageReveal` | Visual transitions |
| `DataViz` | Bar chart data |
| `DocumentScan` | CH3 classified content |
| `ArchiveFootage` | CH5 historical content |
| `BrainDiagram` | CH4 neuroscience topics |
