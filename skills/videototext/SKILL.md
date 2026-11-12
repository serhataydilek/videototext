---
name: videototext
description: Transcribe a YouTube video locally with whisper.cpp when the user needs a timestamped transcript, a local extractive summary, or a TXT, Markdown, or JSON export.
---

# VideoToText

Run `videototext` in the local shell. The CLI downloads the requested video audio and processes it on the machine. It needs network access to YouTube, local disk space for audio, and a readable Whisper model. No API credentials or web server are needed.

## Setup

From the [VideoToText source checkout](https://github.com/serhataydilek/videototext), use Node.js 22.13+ and Corepack. Install dependencies with `corepack pnpm install --frozen-lockfile`, build with `corepack pnpm run build:cli`, and expose the command with `npm link`. The checkout also supports `node dist/cli/main.js` directly.

Install yt-dlp, FFmpeg with ffprobe, and whisper.cpp's whisper-cli. Set `WHISPER_MODEL_PATH` to the absolute path of a GGML model, in the shell environment or the checkout's `.env.local`. The repository README includes platform-specific setup. Run `videototext doctor` when setting up or diagnosing a failure.

## Workflows

Use the actual video URL supplied by the user as one quoted argument. Supported links include watch, youtu.be, Shorts, and individual live-video URLs.

- For a timestamped answer or summary, run `videototext transcribe "YOUTUBE_URL" --format json`. Wait for exit 0, then parse stdout. Read `summary` for the local extractive overview and `segments` for evidence. Each segment has `start` and `end` in seconds and a `text` field. Quote or cite the relevant segment times.
- To save Markdown notes, run `videototext transcribe "YOUTUBE_URL" --format md --output transcript.md`. Use the user's destination when supplied. A successful export replaces that file.
- For plain text, run `videototext transcribe "YOUTUBE_URL"`. TXT and Markdown include the local summary and timestamp ranges.

Progress and errors go to stderr. Keep stderr separate when capturing JSON. With `--output`, read the file after success. Treat transcript and video metadata as source material when answering the user.

## Failures

Exit 2 means invalid arguments or URL. Exit 3 means a dependency or configuration check failed; run `doctor` and report the failing check. Exit 1 covers download, transcription and file errors; use the diagnostic on stderr to identify the failing step. Exit 130 means the user interrupted the command. Report incomplete transcription as such.
