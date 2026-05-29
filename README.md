# YouTube Video To Text

A local-first Next.js app that converts YouTube videos into timestamped text transcripts and Markdown summaries.

The app runs on your machine, uses `yt-dlp` and `ffmpeg` to extract/chunk audio, sends audio chunks to OpenAI for transcription, and stores completed transcripts in your browser with IndexedDB.

## Features

- Paste a YouTube URL and start a transcription job.
- Live progress updates through server-sent events.
- Timestamped transcript view.
- AI-generated summary.
- Browser-only transcript history.
- TXT and Markdown downloads.
- Server-only OpenAI API key handling through `.env.local`.

## Requirements

- Node.js 20 or newer.
- Corepack, included with modern Node.js installs.
- `yt-dlp` installed and available on PATH.
- `ffmpeg` installed and available on PATH.
- An OpenAI API key.

## Get An OpenAI API Key

1. Go to the OpenAI API dashboard: https://platform.openai.com/api-keys
2. Sign in or create an account.
3. Create a project if you do not already have one.
4. Create a new API key for that project.
5. Copy the key once and keep it private. Do not commit it to GitHub.
6. In this project, copy `.env.example` to `.env.local`.
7. Put the key in `.env.local`:

```env
OPENAI_API_KEY=your_api_key_here
OPENAI_TRANSCRIBE_MODEL=whisper-1
OPENAI_SUMMARY_MODEL=gpt-5-mini
YTDLP_PATH=yt-dlp
FFMPEG_PATH=ffmpeg
```

OpenAI's official docs recommend storing API keys securely and loading them from server-side environment variables, not browser/client code.

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
5. Each chunk is transcribed with OpenAI.
6. Chunk timestamps are offset and merged into one transcript.
7. The transcript is summarized with OpenAI.
8. The browser saves the completed result in IndexedDB.

In-progress jobs are stored in memory. If the dev server restarts, active jobs are lost, but completed browser history remains.

## Important Notes

- Only transcribe videos you are allowed to download and process.
- This app is designed for local development, not serverless hosting.
- Long videos can take time and may use significant API credits.
- The API key is read only on the server. Never paste it into frontend code.
