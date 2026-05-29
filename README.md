# YouTube Video To Text

A local-first Next.js app that converts YouTube videos into timestamped text transcripts and Markdown summaries.

The app runs on your machine, uses `yt-dlp` and `ffmpeg` to extract/chunk audio, transcribes chunks locally with `whisper.cpp`, and stores completed transcripts in your browser with IndexedDB.

## Features

- Paste a YouTube URL and start a transcription job.
- Live progress updates through server-sent events.
- Timestamped transcript view.
- Local transcript overview.
- Browser-only transcript history.
- TXT and Markdown downloads.
- No paid API key required for transcription.

## Requirements

- Node.js 20 or newer.
- Corepack, included with modern Node.js installs.
- `yt-dlp` installed and available on PATH.
- `ffmpeg` installed and available on PATH.
- `whisper.cpp` installed locally.
- A local whisper.cpp GGML model file.

## Local Configuration

Copy `.env.example` to `.env.local` and set your local tool paths:

```env
YTDLP_PATH=yt-dlp
FFMPEG_PATH=ffmpeg
WHISPER_PATH=whisper-cli
WHISPER_MODEL_PATH=C:\path\to\ggml-base.en.bin
WHISPER_LANGUAGE=en
WHISPER_THREADS=4
```

## Install Local Audio Tools

### Windows

With Winget:

```powershell
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg
```

Then open a new terminal and verify:

```powershell
yt-dlp --version
ffmpeg -version
```

If either command is not found, set `YTDLP_PATH` or `FFMPEG_PATH` in `.env.local` to the full executable path.

Install `whisper.cpp` from its releases page and download a GGML model such as `ggml-base.en.bin`:

```text
https://github.com/ggml-org/whisper.cpp/releases
https://huggingface.co/ggerganov/whisper.cpp/tree/main
```

For this local setup, the paths can look like:

```env
WHISPER_PATH=C:\tmp\videototext-tools\whisper\Release\whisper-cli.exe
WHISPER_MODEL_PATH=C:\tmp\videototext-tools\whisper\ggml-base.en.bin
```

## Install Dependencies

```powershell
corepack enable
corepack pnpm install
```

If pnpm asks to approve dependency build scripts, approve `esbuild`, `sharp`, and `unrs-resolver`.

## Run The App

```powershell
corepack pnpm dev
```

Open:

```text
http://localhost:3000
```

## Test And Build

```powershell
corepack pnpm test
corepack pnpm exec tsc --noEmit
corepack pnpm build
```

## How It Works

1. The browser sends a YouTube URL to `POST /api/jobs`.
2. The server validates the URL and creates an in-memory job.
3. The server uses `yt-dlp` to download audio.
4. The server uses `ffmpeg` to normalize and split the audio into chunks.
5. Each chunk is transcribed locally with `whisper.cpp`.
6. Chunk timestamps are offset and merged into one transcript.
7. A simple local overview is generated from the transcript.
8. The browser saves the completed result in IndexedDB.

In-progress jobs are stored in memory. If the dev server restarts, active jobs are lost, but completed browser history remains.

## Important Notes

- Only transcribe videos you are allowed to download and process.
- This app is designed for local development, not serverless hosting.
- Long videos can take time because transcription runs on your CPU/GPU.
- Larger Whisper models are more accurate but slower and use more disk/RAM.
