# Setup

## Windows

Extract the Windows release archives before configuring paths. Keep the Whisper DLLs beside `whisper-cli.exe`.

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

## Linux (Debian/Ubuntu)

Install FFmpeg and the Whisper build tools. Install yt-dlp with its YouTube challenge solver and build whisper-cli in a separate tools directory:

```sh
sudo apt install ffmpeg cmake build-essential git pipx
pipx install 'yt-dlp[default]'
pipx ensurepath
git clone https://github.com/ggml-org/whisper.cpp.git
cmake -S whisper.cpp -B whisper.cpp/build
cmake --build whisper.cpp/build --config Release -j
```

Open a new shell for the pipx PATH and set `WHISPER_PATH` to the absolute path of `whisper.cpp/build/bin/whisper-cli`. Other distributions can use the corresponding packages or upstream binaries. [whisper.cpp build instructions](https://github.com/ggml-org/whisper.cpp#quick-start) · [yt-dlp runtime setup](https://github.com/yt-dlp/yt-dlp/wiki/EJS)

## macOS

With Homebrew installed, run:

```sh
brew install ffmpeg whisper.cpp pipx
pipx install 'yt-dlp[default]'
pipx ensurepath
```

Open a new shell for the pipx PATH. The Homebrew formula supplies `whisper-cli`. [Homebrew whisper.cpp](https://formulae.brew.sh/formula/whisper.cpp)

For every platform, download the model, configure the checkout, then run `videototext doctor`. [Model configuration](../README.md#configure-the-model)

## Troubleshooting

### yt-dlp check failed

Set `YTDLP_PATH` in `.env.local` to the full path of `yt-dlp.exe`.

### ffprobe or FFmpeg check failed

Set `FFMPEG_PATH` to the full path of `ffmpeg.exe`. Make sure `ffprobe.exe` is in the same folder.

### Model file check failed

Download a GGML model and set `WHISPER_MODEL_PATH` in `.env.local`.

### Transcription is slow

Local Whisper speed depends on your CPU/GPU and model size. Use `ggml-base.en.bin` or a smaller model for faster results. Increase `WHISPER_THREADS` if your CPU has spare cores.

### Transcript quality is weak

Use a larger model, such as `small.en` or `medium.en`. Larger models are slower and use more RAM.
