# VideoToText

**Status:** Demo Ready

Turn a YouTube video into a timestamped transcript and an extractive summary using your own machine. Use the standalone CLI, install its instructions as an agent skill, or open the local web app. VideoToText is free and MIT-licensed. Transcription requires no account, subscription, or paid API.

## Install the CLI from source

Use Node.js 22.13 or newer and Corepack. If `corepack` is missing, install it with `npm install --global corepack`. From the v0.2.0 checkout, run:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm run build:cli
npm link
videototext --help
```

`npm link` adds the command to your npm bin directory. Keep the checkout in place and rebuild after updating the source. You can also run `node dist/cli/main.js` from the checkout without linking. The CLI starts no Next.js server.

Install the platform tools before running doctor. [Windows, Linux and macOS setup](docs/SETUP.md)

### Configure the model

Download a whisper.cpp GGML model such as `ggml-base.en.bin` for English, or `ggml-base.bin` for multilingual audio. The CLI and web app use the same model. [Whisper model files](https://huggingface.co/ggerganov/whisper.cpp/tree/main)

Copy `.env.example` to `.env.local` in the VideoToText checkout (`Copy-Item .env.example .env.local` on PowerShell or `cp .env.example .env.local` on Linux/macOS). Edit it using the settings below, or set the variables in your shell. The CLI reads the checkout's file even when run from another directory. Shell variables take precedence.

| Variable | Value |
| --- | --- |
| `WHISPER_MODEL_PATH` | Required. Absolute path to the downloaded model file. |
| `YTDLP_PATH` | Defaults to `yt-dlp` on PATH. |
| `FFMPEG_PATH` | Defaults to `ffmpeg` on PATH. With an explicit executable path, keep ffprobe beside it. |
| `WHISPER_PATH` | Defaults to `whisper-cli` on PATH. |
| `WHISPER_LANGUAGE` | Defaults to `en`. Use a language code or `auto` with a multilingual model. |
| `WHISPER_THREADS` | Defaults to `4`. Set to a positive integer. |

Run `videototext doctor` to check the executables, model file and settings. Doctor checks that the model file is readable and nonempty. A transcription exercises the model itself.

## Transcribe a video

```sh
videototext doctor
videototext transcribe "https://youtu.be/jNQXAC9IVRw"
videototext transcribe "https://youtu.be/jNQXAC9IVRw" --format json
videototext transcribe "https://youtu.be/jNQXAC9IVRw" --format md --output transcript.md
```

Supply one YouTube watch, short link, Shorts or live-video URL. Download only videos you have permission to process. Internet access is needed for the source audio. Whisper inference and summarization run locally.

| Format | Result |
| --- | --- |
| `txt` (default) | Title, source URL, creation time, summary, and timestamped transcript lines |
| `md` | Markdown headings, summary, and timestamped bullets |
| `json` | One object with `id`, `url`, `title`, `createdAt`, `summary`, `transcript`, and `segments`. Each segment has numeric `start` and `end` in seconds and a `text` string. |

Transcription writes progress and errors to stderr. Read stdout for the result, or pass `--output FILE` to save it in an existing directory. The CLI replaces an existing destination after a successful write. Ctrl+C cancels the active process and cleans up temporary audio and chunks.

| Exit code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Download, transcription, or I/O failure. See stderr. |
| 2 | Invalid arguments or video URL |
| 3 | Dependency or configuration failure. Run `videototext doctor`. |
| 130 | Interrupted with Ctrl+C |

## Install the agent skill

Build and link the CLI first. Copy the [videototext skill folder](skills/videototext/SKILL.md) to the directory for the project where your agent works. Keep the folder name `videototext` and the file name `SKILL.md`.

| Local client | Destination relative to the agent's project | Documented format |
| --- | --- | --- |
| Codex | `.agents/skills/videototext/SKILL.md` | [Codex skills](https://developers.openai.com/codex/skills/) |
| Claude Code | `.claude/skills/videototext/SKILL.md` | [Claude Code skills](https://code.claude.com/docs/en/skills) |
| Cursor | `.cursor/skills/videototext/SKILL.md` or the shared `.agents/skills/` location above | [Cursor skills](https://cursor.com/help/customization/skills) |

These paths and the skill's name/description frontmatter follow the clients' documented local formats. Interactive invocation in the three clients has not been tested. Example request: “Use videototext to transcribe this YouTube URL and save timestamped notes to transcript.md.”

## Web app

Run `corepack pnpm dev` from the checkout and open [localhost:3000](http://localhost:3000). The browser offers Summary, Paragraph, and Timestamps views and keeps completed results in IndexedDB.

## Core Features

- Accepts YouTube video URLs
- Downloads audio with `yt-dlp`
- Normalizes and chunks audio with `ffmpeg`
- Transcribes audio locally with `whisper.cpp`
- Shows live job progress in the browser via Server-Sent Events
- Produces timestamped transcript segments
- Generates a local extractive summary
- Saves completed transcripts in browser storage
- Exports results as TXT or Markdown in the browser and TXT, Markdown or JSON in the CLI

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

The CLI enters the same transcription pipeline directly at step 4 and writes the result to stdout or a file. The web app uses the following flow.

1. The browser posts a YouTube URL to `POST /api/jobs`.
2. The server creates an in-memory job and starts processing.
3. The browser listens for progress through `GET /api/jobs/:id/events`.
4. `yt-dlp` downloads the video audio.
5. `ffmpeg` splits audio into ten-minute chunks of 16 kHz mono, 16-bit PCM WAV for Whisper.
6. `whisper.cpp` transcribes each chunk locally.
7. The app offsets chunk timestamps and merges them into one transcript.
8. The app creates a local extractive summary from the transcript.
9. The result is saved in the browser with IndexedDB.

In-progress jobs are stored only in memory. Restarting the dev server cancels active jobs, but completed browser history remains available in the same browser.

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

## Development

```sh
corepack pnpm test
corepack pnpm exec tsc --noEmit
corepack pnpm run build:cli
corepack pnpm build
```

## License

See the [MIT license](LICENSE) for VideoToText. The separately installed tools and models retain their upstream licenses.
