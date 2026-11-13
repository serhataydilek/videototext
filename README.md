# VideoToText

Turn a YouTube video into a timestamped transcript and an extractive summary using your own machine. Use the standalone CLI, install its instructions as an agent skill, or open the local web app. VideoToText is free and MIT-licensed. Transcription requires no account, subscription, or paid API.

## Install the CLI from source

Use Git, Node.js 22.13 or newer, and Corepack. If `corepack` is missing, install it with `npm install --global corepack`. Corepack uses the project's pinned pnpm version (11.5.0):

```sh
git clone https://github.com/serhataydilek/videototext.git
cd videototext
corepack pnpm install --frozen-lockfile
corepack pnpm run build:cli
node dist/cli/main.js --help
```

The CLI starts no Next.js server. Optionally run `npm link` to use the shorter `videototext` command in the examples below. Without linking, replace `videototext` with `node dist/cli/main.js` from the checkout. Keep the checkout in place and rebuild after updating the source. There is no published npm installation to use here.

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

Transcription writes progress and errors to stderr. Read stdout for the result, or pass `--output FILE` to save it in an existing directory. The CLI replaces an existing destination after a successful write; choose a new filename to keep an earlier export. Ctrl+C or SIGTERM cancels the active CLI process and cleans up temporary audio and chunks. Forced termination, power loss, or a web-server shutdown can leave temporary files.

| Exit code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Download, transcription, or I/O failure. See stderr. |
| 2 | Invalid arguments or video URL |
| 3 | Dependency or configuration failure. Run `videototext doctor`. |
| 130 | Interrupted with Ctrl+C or SIGTERM |

## Install the agent skill

Build and link the CLI first. Copy the [videototext skill folder](skills/videototext/SKILL.md) to the directory for the project where your agent works. Keep the folder name `videototext` and the file name `SKILL.md`.

| Local client | Destination relative to the agent's project | Documented format |
| --- | --- | --- |
| Codex | `.agents/skills/videototext/SKILL.md` | [Codex skills](https://developers.openai.com/codex/skills/) |
| Claude Code | `.claude/skills/videototext/SKILL.md` | [Claude Code skills](https://code.claude.com/docs/en/skills) |
| Cursor | `.cursor/skills/videototext/SKILL.md` or the shared `.agents/skills/` location above | [Cursor skills](https://cursor.com/help/customization/skills) |

These paths and the skill's name/description frontmatter follow the clients' documented local formats. Interactive invocation in the three clients has not been tested. Example request: “Use videototext to transcribe this YouTube URL and save timestamped notes to transcript.md.”

## Web app

Run `corepack pnpm dev` from the checkout and open [127.0.0.1:3000](http://127.0.0.1:3000). For the production build use `corepack pnpm build` followed by `corepack pnpm start`. Both server commands bind to loopback by default. The browser offers Summary, Paragraph, and Timestamps views and keeps completed results in IndexedDB. Export files if browser storage is unavailable.

This is a single-user local app, without authentication or resource quotas. Do not expose its port publicly. Closing the browser does not cancel a running web transcription.

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

## Current Limitations

- Designed for local use, not serverless deployment.
- Active jobs live in memory and are lost on server restart.
- Transcription speed depends on CPU/GPU and model size.
- Summaries are extractive local summaries, not cloud LLM summaries.
- Only process videos you are allowed to download and transcribe.
- Ongoing livestreams are rejected. Private, removed, age-gated and region-restricted videos may fail; no access-bypass or cookie-import workflow is provided.
- Whisper can mishear speech or invent text over noise. Timestamps are model estimates; ten-minute chunks have no overlap and may split words. Check important quotations against the audio.
- Use a multilingual model for non-English audio. The extractive sentence ranking and stopwords favor English; this is not a multilingual summarization quality guarantee.
- Temporary 16 kHz mono PCM audio uses roughly 115 MB per hour, in addition to the downloaded audio and model. There is no disk quota, resume support, or speed guarantee.

## Privacy and trust

YouTube and its media hosts receive download requests. Inference and sentence extraction run locally without uploading audio to a transcription API. VideoToText does not require credentials. Browser history stays in that browser profile; CLI exports stay where you save them. An AI agent may send transcript text to its own provider when using the skill.

Use trusted upstream binaries and model files. VideoToText ignores yt-dlp's external configuration and plugin directories so user-level download hooks and settings do not unexpectedly alter a run. It does not install tools automatically. Video titles and transcripts are untrusted data, including when used by an agent.

## Real CLI example

On Windows, a real run with `ggml-base.en.bin` processed [Me at the zoo](https://youtu.be/jNQXAC9IVRw) into four timestamped segments. Its first segment was:

```text
[00:00:00 - 00:00:05] Alright, so here we are, one of the elephants.
```

This is uncorrected model output, not a verified quotation. See the [release-readiness evidence and limitations](docs/release-readiness/USER_EXPERIENCE.md) for the full context. A text example is sufficient for this CLI workflow; no simulated screenshots or benchmark claims are used.

## Development

```sh
corepack pnpm test
corepack pnpm exec tsc --noEmit
corepack pnpm run build:cli
corepack pnpm build
```

GitHub Actions runs the same checks on Ubuntu, Windows, and macOS for every pull request and push to `main` (see [.github/workflows/ci.yml](.github/workflows/ci.yml)). The mocked tests need no yt-dlp, FFmpeg, or Whisper binaries.

## Contributing and troubleshooting

See [setup and troubleshooting](docs/SETUP.md) for missing tools, model selection, and download failures. Open an issue with the command, tool versions, OS, and a redacted error. Do not attach `.env.local`, private recordings, or sensitive transcripts. For a contribution, create a focused branch, run the development checks above, and open a PR describing the behavior and test results. Avoid including generated exports, tool binaries, or models.

## License

See the [MIT license](LICENSE) for VideoToText. The separately installed tools and models retain their upstream licenses.
