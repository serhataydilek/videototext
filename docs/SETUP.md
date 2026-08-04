# Setup

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
