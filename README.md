# Video To Text

**Status:** Demo Ready

Local-first web app for turning YouTube videos into readable transcripts and summaries.

This app downloads audio from a YouTube URL, splits it into manageable chunks, transcribes everything locally with `whisper.cpp`, and keeps completed transcripts in your browser. No OpenAI API key, cloud transcription service, or paid quota is required.

## Core Features

- Accepts YouTube video URLs
- Downloads audio with `yt-dlp`
- Normalizes and chunks audio with `ffmpeg`
- Transcribes audio locally with `whisper.cpp`
- Shows live job progress in the browser via Server-Sent Events
- Produces timestamped transcript segments
- Generates a local extractive summary
- Saves completed transcripts in browser storage
- Exports results as `.txt` and `.md`

## Technology Stack

- Next.js App Router
- TypeScript
- React
- Server-Sent Events for progress updates
- IndexedDB for browser-only history
- `yt-dlp` for YouTube extraction
- `ffmpeg` for audio conversion/chunking
- `whisper.cpp` for local speech-to-text

## Architecture

1. The browser posts a YouTube URL to `POST /api/jobs`.
2. The server creates an in-memory job and starts processing.
3. The browser listens for progress through `GET /api/jobs/:id/events`.
4. `yt-dlp` downloads the video audio.
5. `ffmpeg` converts and splits audio into chunks.
6. `whisper.cpp` transcribes each chunk locally.
7. The app offsets chunk timestamps and merges them into one transcript.
8. The app creates a local extractive summary from the transcript.
9. The result is saved in the browser with IndexedDB.

In-progress jobs are stored only in memory. Restarting the dev server cancels active jobs, but completed browser history remains available in the same browser.

## Setup

### Requirements

- Node.js 20 or newer
- Corepack / pnpm
- `yt-dlp`
- `ffmpeg`
- `whisper.cpp`
- A local whisper.cpp GGML model, for example `ggml-base.en.bin`

### Quick Start

```powershell
corepack enable
corepack pnpm install
Copy-Item .env.example .env.local
notepad .env.local
corepack pnpm dev
```

Open `http://localhost:3000`.

Example `.env.local`:

```env
YTDLP_PATH=C:\path\to\yt-dlp.exe
FFMPEG_PATH=C:\path\to\ffmpeg.exe
WHISPER_PATH=C:\path\to\whisper-cli.exe
WHISPER_MODEL_PATH=C:\path\to\ggml-base.en.bin
WHISPER_LANGUAGE=en
WHISPER_THREADS=4
```

Detailed tool install notes are in [docs/SETUP.md](docs/SETUP.md).

## Screenshots

No committed screenshots yet. Add real captures under `docs/screenshots/` when available.

## Current Limitations

- Designed for local use, not serverless deployment.
- Active jobs live in memory and are lost on server restart.
- Transcription speed depends on CPU/GPU and model size.
- Summaries are extractive local summaries, not cloud LLM summaries.
- Only process videos you are allowed to download and transcribe.

## Roadmap

- Portfolio screenshots
- Clearer first-run tooling guidance
- Optional non-YouTube local media input if needed later

## Scripts

```powershell
corepack pnpm dev
corepack pnpm test
corepack pnpm exec tsc --noEmit
corepack pnpm build
```

## License

No license file is published yet. Treat the repository as source-available for portfolio review unless a license is added later.
