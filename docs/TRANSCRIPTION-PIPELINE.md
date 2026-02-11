# Flow Arts Video Transcription Pipeline

## Goal

Slurp every significant flow arts YouTube video, transcribe it, and build a searchable archive that:
- Correctly represents what people said in their own words
- Provides citable timestamps for wiki articles
- Gives proper attribution to every creator who came before
- Informs TKA domain knowledge with primary sources

---

## Tools

```bash
# yt-dlp (video/audio downloader)
pip install yt-dlp

# faster-whisper (CPU transcription, 4x faster than OpenAI Whisper, int8 quantization)
pip install faster-whisper
```

No GPU required. faster-whisper with int8 `large-v3` runs at roughly real-time on CPU (1 hour audio = ~1 hour processing). `medium` model is 2-3x faster with slightly lower accuracy.

---

## Step 1: Fast Path — YouTube Auto-Subs

Most videos already have auto-generated subtitles (~90% accurate). Grab them without downloading video:

```bash
yt-dlp --write-auto-subs --sub-langs "en" --convert-subs srt --skip-download \
  --download-archive subs-done.txt \
  -o "transcripts/%(channel)s/%(title)s.%(ext)s" \
  "CHANNEL_OR_PLAYLIST_URL"
```

This is instant. No audio processing. Gets you something searchable in minutes.

---

## Step 2: Quality Path — Whisper Re-Transcription

For videos where auto-subs are missing, bad, or you need better accuracy:

### Download audio only

```bash
yt-dlp -x --audio-format mp3 --audio-quality 3 \
  --download-archive audio-done.txt \
  --embed-metadata \
  -o "audio/%(channel)s/%(title)s.%(ext)s" \
  "CHANNEL_OR_PLAYLIST_URL"
```

### Transcribe with faster-whisper

```python
from faster_whisper import WhisperModel
import os, sys

model = WhisperModel("large-v3", device="cpu", compute_type="int8")

audio_file = sys.argv[1]
segments, info = model.transcribe(audio_file)

# Output as SRT
for i, segment in enumerate(segments, 1):
    start_h, start_m = divmod(segment.start, 3600)
    start_m, start_s = divmod(start_m, 60)
    end_h, end_m = divmod(segment.end, 3600)
    end_m, end_s = divmod(end_m, 60)
    print(i)
    print(f"{int(start_h):02d}:{int(start_m):02d}:{start_s:06.3f} --> {int(end_h):02d}:{int(end_m):02d}:{end_s:06.3f}".replace(".", ","))
    print(segment.text.strip())
    print()
```

### Batch process a directory

```bash
for f in audio/DrexFactor/*.mp3; do
  python transcribe.py "$f" > "transcripts/DrexFactor/$(basename "${f%.mp3}").srt"
done
```

---

## Step 3: Folder Structure

```
flow-arts-transcripts/
├── channels.json              # Channel URLs, metadata, priority
├── subs-done.txt              # yt-dlp archive (auto-subs downloaded)
├── audio-done.txt             # yt-dlp archive (audio downloaded)
├── transcribe.py              # Whisper batch script
├── transcripts/
│   ├── DrexFactor/
│   │   ├── tech-blog-62-mode-transitions.srt
│   │   ├── tech-blog-83-bth-vs-cap.srt
│   │   └── ...
│   ├── PlayPoi/
│   │   ├── learning-caps.srt
│   │   └── ...
│   ├── NoeIYee/
│   │   ├── vtg-explanation.srt
│   │   └── ...
│   ├── SpinMorePoi/
│   │   ├── charlie-9-square-theory-1.srt
│   │   └── ...
│   ├── SirLorq/
│   │   └── ...
│   ├── SkylarGarard/
│   │   └── ...
│   └── AlienJon/
│       └── ...
├── audio/                     # MP3s for Whisper (can delete after transcription)
│   ├── DrexFactor/
│   └── ...
└── index/                     # Future: full-text search index
```

---

## Step 4: Search

```bash
# Quick search across all transcripts
rg "quarter time" transcripts/ --glob "*.srt"
rg "9 square" transcripts/ --glob "*.srt"
rg "continuous assembly" transcripts/ --glob "*.srt"
rg "timing and direction" transcripts/ --glob "*.srt"
```

---

## Priority Channels

| Priority | Creator | Why |
|----------|---------|-----|
| 1 | **DrexFactor** (Ben Drexler) | 500+ tech blogs, primary archivist of flow arts theory |
| 1 | **Noel Yee** | VTG originator, transition theory |
| 1 | **Spin More Poi** | Charlie's 9-Square Theory (10 parts), other tech |
| 2 | **PlayPoi** (Nick Woolsey) | CAP tutorials, VTG popularization |
| 2 | **Sir Lorq / Spin Science** | Shape Matrix, Tech Tiles, 324 Patterns, Book of PHAT |
| 2 | **Alien Jon** | Early CAP promotion, Encyclo-poi-dia |
| 3 | **Skylar Garard** | TKA tutorials (~25 videos) |
| 3 | **Charlie Cushing** (charlicopter) | Direct channel if exists |

---

## channels.json Template

```json
[
  {
    "name": "DrexFactor",
    "url": "https://www.youtube.com/@DrexFactor",
    "priority": 1,
    "notes": "500+ tech blogs, CAP math, graph theory, VTG explainers"
  },
  {
    "name": "Noel Yee",
    "url": "TODO_FIND_CHANNEL",
    "priority": 1,
    "notes": "VTG originator, transition theory"
  },
  {
    "name": "Spin More Poi",
    "url": "TODO_FIND_CHANNEL",
    "priority": 1,
    "notes": "Charlie 9-Square Theory 10-part series"
  },
  {
    "name": "PlayPoi",
    "url": "https://www.youtube.com/@PlayPoi",
    "priority": 2,
    "notes": "Nick Woolsey, CAP tutorials, VTG popularization"
  },
  {
    "name": "Sir Lorq",
    "url": "TODO_FIND_CHANNEL",
    "priority": 2,
    "notes": "Shape Matrix, Tech Tiles, 324 Patterns"
  },
  {
    "name": "Alien Jon",
    "url": "TODO_FIND_CHANNEL",
    "priority": 2,
    "notes": "Early CAP promotion, Encyclo-poi-dia"
  },
  {
    "name": "Skylar Garard",
    "url": "TODO_FIND_CHANNEL",
    "priority": 3,
    "notes": "TKA tutorials"
  }
]
```

---

## What This Gets You

- Full-text searchable archive of flow arts theory as spoken by the creators
- Citable timestamps: "DrexFactor, Tech Blog #214, 3:42"
- Source material for wiki articles using people's actual words
- Evidence base for comparative claims (Charlie's method vs LOOP transformations)
- Attribution trail so every creator who contributed to this field feels recognized
- Primary sources that inform TKA domain knowledge with verified facts, not assumptions

---

## Estimated Scale

- ~500 DrexFactor videos (biggest corpus)
- ~100-200 PlayPoi videos
- ~50 Noel Yee videos
- ~10 Charlie 9-Square Theory
- ~50 Lorq / Spin Science
- ~25 Skylar TKA tutorials
- **Total: ~800-1000 videos, maybe 500-800 hours of audio**

At real-time Whisper speed on CPU: ~3-4 weeks of background processing for the full quality path.
Auto-subs fast path: done in an afternoon.

Recommendation: Start with auto-subs for everything, then Whisper the priority 1 channels.
