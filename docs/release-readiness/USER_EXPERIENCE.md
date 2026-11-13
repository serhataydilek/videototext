# First-use and execution evidence

Test date: **2026-11-14 (Europe/Istanbul)**. Local host: Windows, Node 24.14.0, pinned pnpm 11.5.0. These observations do not establish installation on a pristine OS or real inference on Linux/macOS.

## Installation rehearsal

A fresh source-only directory was populated from tracked files, using the edited source and lockfile. It contained no `node_modules`, `dist`, `.next`, `.env.local`, executable tools or model. The package store could reuse previously downloaded packages: this was not an empty machine or cold-network performance measurement.

| Step | Actual result |
| --- | --- |
| `corepack pnpm install --frozen-lockfile` | Success with pinned pnpm; installed 356 packages, using the lockfile and declared build-script allowlist |
| `corepack pnpm run build:cli` | Success |
| `node dist/cli/main.js --help` | Exit 0; doctor/transcribe usage displayed |
| `node dist/cli/main.js doctor`, no local config | Exit 3, correctly reported missing yt-dlp, whisper-cli and model; FFmpeg/ffprobe already on host PATH |
| Doctor with existing trusted tool configuration supplied through child environment | Exit 0; no local configuration file copied into the clean source tree |
| Existing linked CLI `--help` / doctor in agent test | Exit 0 / 0; the optional global link already existed, so a new global installation was not claimed |

Corepack initially could not download pinned pnpm inside the network sandbox. The normal approved network retry succeeded. This was an environment restriction, not evidence that the README's registry URL was wrong. No remote script was piped into a shell. The source rehearsal used the same host's trusted tools, rather than repeating all third-party downloads.

## Manual work a new user still needs

There are roughly seven distinct tasks (not an installation-time claim): obtain Git/Node/Corepack; clone; install locked JS dependencies; build; install three external tool distributions including ffprobe; download/configure a model; run doctor. Exposing the CLI with `npm link` and installing a local client skill are optional additional tasks. Exact clicks/commands depend on OS and preinstalled tools.

This is meaningful setup friction. The most useful improvement is a clear direct-Node path and actionable diagnostics, not an unreviewed bootstrap script. The README now includes clone/cd, optional linking, explicit separate tool/model installation, per-platform links, multilingual model selection, output replacement semantics, privacy and resource limitations. Existing architecture and web layout are retained.

## Genuine CLI transcription

Command:

```sh
node dist/cli/main.js transcribe "https://youtu.be/jNQXAC9IVRw" --format json --output release-artifacts/sample.json
```

Actual exit: **0**. Real yt-dlp extraction, FFmpeg normalization, whisper.cpp with `ggml-base.en.bin`, and local summary generation ran. JSON parsed into four segments ending at 18.4 seconds. stdout/stderr remained separate. The saved output and demonstration retain recognition errors; this is not a claim of transcript accuracy.

The full real result is embedded in [AGENSI_LISTING.md](AGENSI_LISTING.md). It includes “long fums” and “all I used to say,” which should not be silently corrected and presented as model output. The summary repeats these errors and rounds this short recording up to “about 1 minute(s).” Human review of quotations remains necessary.

## Real agent-directed run

A separate agent was given the skill file, the public test URL and a restricted output destination, without permission to install or modify code. It checked CLI help and doctor, then ran real JSON and Markdown export commands. Both exited 0. Its initial sandboxed network attempt failed at metadata with a DNS error; approved escalation allowed the real pipeline to finish.

The JSON had four intervals: 0–5.28, 5.28–13.42, 13.42–17.08 and 17.08–18.4 seconds. Markdown preserved all segment text and four timestamp rows, displaying whole seconds. The test did not invent or repair missing speech. Files remain ignored under `release-artifacts/agent-test.json` and `agent-test.md`.

This is **real agent-directed CLI execution**, not proof that Codex, Claude Code or Cursor automatically discovers the installed skill, and not an Agensi MCP integration test. No new agent subscription/API key was used or configured for the product.

## Production web flow

Story: a local user submits a video URL → `POST /api/jobs` starts the shared pipeline → SSE delivers progress/result → browser can display/export it.

| Boundary | Actual evidence |
| --- | --- |
| Production server starts | Next 15.5.29 ready on loopback |
| Page HTTP response | GET `/` returned 200 |
| Request validation | Route tests reject foreign Origin, non-JSON input and non-loopback Host; the production test exposed a localhost/127.0.0.1 mismatch, fixed with a Host-aware check |
| API → actual tools | Valid POST created a job; installed tools and English model executed |
| Result → HTTP stream | SSE included `event: done`, with no `event: failed`; full local event evidence saved under ignored artifacts |
| Browser interaction and rendering | **Not verified.** In-app browser could not reach localhost. Windows Computer Use stopped because it could not establish the browser URL confidently enough to enforce policy. No screenshot or UI acceptance claim |

The SSE test is real HTTP/server/inference validation. It is not a substitute for a browser test. IndexedDB-failure messaging and immediate result display were type/build checked only. No GIF was created: the real terminal example is useful without fabricated visual evidence.

## Targeted reliability checks

All **53 tests in 7 files passed**, up from 32 baseline tests. They include real child-process timeout/abort/argument/stdout-cap checks and filesystem-backed pipeline tests with mocked external executables. New tests cover measured offset accumulation, malformed model output, live-stream rejection, cross-origin requests, Host reconstruction, untrusted metadata URLs and disconnected SSE listener cleanup. Existing tests cover output preservation, failure cleanup, formats and CLI/web shared results.

Standalone TypeScript, CLI compilation and optimized web build passed. `git diff --check` is part of final preparation. Tests do not establish multi-hour resource behavior, speaker recognition, multilingual accuracy, forced termination cleanup or real Linux/macOS inference. No standalone lint success is claimed: the repository's legacy lint command lacks configuration.

## Onboarding verdict

A developer now has a complete source-install route and can diagnose missing prerequisites before attempting transcription. Doctor validates executable invocation, configuration syntax and a nonempty readable model file, not model authenticity, hardware support or future YouTube availability. Agensi is useful as an instruction-discovery channel **after** setup; the listing must disclose this prominently. Remaining manual setup and the licensing/delivery question are recorded in [AGENSI_RESEARCH.md](AGENSI_RESEARCH.md).
