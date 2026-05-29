# YouTube Video To Text

Local-first web app for turning YouTube videos into readable transcripts and summaries.

This app downloads audio from a YouTube URL, splits it into manageable chunks, transcribes everything locally with `whisper.cpp`, and keeps completed transcripts in your browser. No OpenAI API key, cloud transcription service, or paid quota is required.

## What It Does

- Accepts YouTube video URLs.
- Downloads audio with `yt-dlp`.
- Normalizes and chunks audio with `ffmpeg`.
- Transcribes audio locally with `whisper.cpp`.
- Shows live job progress in the browser.
- Produces timestamped transcript segments.
- Generates a local summary with an overview, key points, and opening context.
- Shows transcripts as timestamped segments or continuous paragraphs.
- Saves completed transcripts in browser storage.
- Exports results as `.txt` and `.md`.

## Tech Stack

- Next.js App Router
- TypeScript
- React
- Server-Sent Events for progress updates
- IndexedDB for browser-only history
- `yt-dlp` for YouTube extraction
- `ffmpeg` for audio conversion/chunking
- `whisper.cpp` for local speech-to-text

## Requirements

- Node.js 20 or newer
- Corepack
- pnpm through Corepack
- `yt-dlp`
- `ffmpeg`
- `whisper.cpp`
- A local whisper.cpp GGML model, for example `ggml-base.en.bin`

## Quick Start

Install dependencies:

```powershell
corepack enable
corepack pnpm install
```

Create your local environment file:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

Example `.env.local`:

```env
YTDLP_PATH=C:\tmp\videototext-tools\yt-dlp.exe
FFMPEG_PATH=C:\tmp\videototext-tools\ffmpeg\ffmpeg-master-latest-win64-gpl\bin\ffmpeg.exe
WHISPER_PATH=C:\tmp\videototext-tools\whisper\Release\whisper-cli.exe
WHISPER_MODEL_PATH=C:\tmp\videototext-tools\whisper\ggml-base.en.bin
WHISPER_LANGUAGE=en
WHISPER_THREADS=4
```

Run the app:

```powershell
corepack pnpm dev
```

Open:

```text
http://localhost:3000
```

## Installing Local Tools

### yt-dlp

Download `yt-dlp.exe` from:

```text
https://github.com/yt-dlp/yt-dlp/releases
```

Verify:

```powershell
yt-dlp --version
```

If it is not on PATH, set `YTDLP_PATH` in `.env.local` to the full `.exe` path.

### ffmpeg

Download a Windows ffmpeg build from:

```text
https://github.com/yt-dlp/FFmpeg-Builds/releases
```

Verify:

```powershell
ffmpeg -version
```

If it is not on PATH, set `FFMPEG_PATH` in `.env.local` to the full `ffmpeg.exe` path. The app passes that location to `yt-dlp`, so `ffprobe.exe` should be in the same folder.

### whisper.cpp

Download a Windows binary release from:

```text
https://github.com/ggml-org/whisper.cpp/releases
```

Download a GGML model from:

```text
https://huggingface.co/ggerganov/whisper.cpp/tree/main
```

Recommended first model:

```text
ggml-base.en.bin
```

Verify:

```powershell
whisper-cli.exe --help
```

Then set:

```env
WHISPER_PATH=C:\path\to\whisper-cli.exe
WHISPER_MODEL_PATH=C:\path\to\ggml-base.en.bin
```

## How It Works

1. The browser posts a YouTube URL to `POST /api/jobs`.
2. The server creates an in-memory job and starts processing.
3. The browser listens for progress through `GET /api/jobs/:id/events`.
4. `yt-dlp` downloads the video audio.
5. `ffmpeg` converts and splits audio into chunks.
6. `whisper.cpp` transcribes each chunk locally.
7. The app offsets chunk timestamps and merges them into one transcript.
8. The app creates a local extractive summary from the transcript.
9. The result is saved in the browser with IndexedDB.

Completed results can be reviewed in three browser tabs:

- `Summary`: local overview, key points, and opening context.
- `Paragraph`: the transcript as continuous readable paragraphs.
- `Timestamps`: the transcript split by time range.

In-progress jobs are stored only in memory. Restarting the dev server cancels active jobs, but completed browser history remains available in the same browser.

## Scripts

```powershell
corepack pnpm dev
corepack pnpm test
corepack pnpm exec tsc --noEmit
corepack pnpm build
```

## Troubleshooting

### `yt-dlp is required but was not found`

Set `YTDLP_PATH` in `.env.local` to the full path of `yt-dlp.exe`.

### `ffprobe and ffmpeg not found`

Set `FFMPEG_PATH` to the full path of `ffmpeg.exe`. Make sure `ffprobe.exe` is in the same folder.

### `WHISPER_MODEL_PATH is missing`

Download a GGML model and set `WHISPER_MODEL_PATH` in `.env.local`.

### Transcription is slow

Local Whisper speed depends on your CPU/GPU and model size. Use `ggml-base.en.bin` or a smaller model for faster results. Increase `WHISPER_THREADS` if your CPU has spare cores.

### Transcript quality is weak

Use a larger model, such as `small.en` or `medium.en`. Larger models are slower and use more RAM.

## Notes

- Only process videos you are allowed to download and transcribe.
- This project is designed for local use, not serverless deployment.
- No API key is required for transcription.
- Summaries are generated locally from transcript text. They are extractive summaries, not cloud AI summaries.
