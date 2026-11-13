# Setup

Start with [the source installation commands](../README.md#install-the-cli-from-source). Install the tools below separately: a skill ZIP does not contain them. No paid account or API is needed. Prefer official releases or your platform's package manager, review upstream license and checksum information where supplied, and do not pipe downloaded scripts into a shell.

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
ffprobe -version
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

Use `ggml-base.bin` instead for multilingual audio, and set `WHISPER_LANGUAGE=auto` or a supported code such as `tr`. `.en` models are English-only. Smaller models generally need fewer resources; larger models can improve recognition but are not guaranteed to fix a particular recording. See the [upstream model comparison](https://github.com/ggml-org/whisper.cpp/tree/master/models). Download the actual model file, not an HTML page or Git LFS pointer. Doctor can check readability but cannot prove that a model is valid.

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

Run the tool's `--version` command, then set `YTDLP_PATH` in `.env.local` to its full executable path if it is not on PATH. Use a current official standalone binary or the documented `yt-dlp[default]` install; YouTube extraction also needs the challenge solver and the Node.js runtime. VideoToText uses the running Node executable and does not enable downloading remote solver components.

### ffprobe or FFmpeg check failed

Set `FFMPEG_PATH` to the full path of `ffmpeg.exe`. Make sure `ffprobe.exe` is in the same folder.

### Model file check failed

Download a GGML model and set `WHISPER_MODEL_PATH` in `.env.local`.

### Transcription is slow

Local Whisper speed depends on your CPU/GPU and model size. Use `ggml-base.en.bin` or a smaller model for faster results. Increase `WHISPER_THREADS` if your CPU has spare cores.

### Transcript quality is weak

Use a larger model, such as `small.en` or `medium.en`. Larger models are slower and use more RAM.

### CLI is not found

From the checkout, run `node dist/cli/main.js --help`. Rebuild with `corepack pnpm run build:cli` if `dist` is missing. `npm link` is optional; if used, its bin directory must be on PATH and the checkout must remain in place. On PowerShell, use `videototext.cmd` if execution policy blocks npm's `.ps1` shim. Do not weaken execution policy for this tool.

### Video cannot be downloaded

Check that it is a single public video that plays in your region, and that the broadcast has ended. Private, removed, age-restricted, region-blocked and scheduled videos may fail. Update yt-dlp from its upstream distribution if YouTube extraction changed. VideoToText ignores global yt-dlp configs/plugins, including proxy and cookie settings; it provides no login or restriction-bypass flow. Report the redacted stderr diagnostic instead of retrying indefinitely.

### Export failed

The output parent directory must exist and be writable. A failed transcription or write preserves an earlier destination file. A successful export replaces it. In the browser, export results if history storage fails; browser storage is not a backup.

### Interrupted or long-running jobs

CLI Ctrl+C and SIGTERM stop the active process tree and attempt temporary-file cleanup. A killed process or power loss cannot run cleanup. Web jobs continue if the tab closes, and a web-server restart loses job state. PCM chunks require about 115 MB per hour plus the download; check disk space before long videos. Download socket operations and metadata checks are bounded, but there is no overall transcription deadline or resume support.
