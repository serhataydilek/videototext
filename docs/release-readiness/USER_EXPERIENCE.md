# First-use and execution evidence

**Final update:** the earlier browser obstacle below is historical. Final v0.2.1 acceptance succeeded with authorized local Playwright/Chromium; see the final-validation section at the end.

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

## Final v0.2.1 browser acceptance — 2026-11-14

Baseline verified: PR #2 merged as `032f25ebbf250b8903247f8bcbeab78a2c5fd8fe`, with successful Ubuntu/Windows/macOS [merge CI](https://github.com/serhataydilek/videototext/actions/runs/43517518635). The new `release/v0.2.1-final` branch starts there. There were no unrelated dirty files.

The owner explicitly requested Playwright/local browser testing. A new isolated Chromium process accessed the actual loopback production server on port 3100, without bypassing an interstitial, changing URL checks, exposing a public port, or touching the user's existing browser profile. Playwright is a development-only dependency; it provides maintained browser regression coverage for the storage/status fixes. This supersedes the prior Computer Use limitation, rather than treating HTTP as visual acceptance.

### Observed browser behavior

| Area | Evidence / result |
| --- | --- |
| Home and real submission | Real Chromium page rendered; submitted `https://youtu.be/jNQXAC9IVRw` through the form |
| Actual backend | Real yt-dlp → FFmpeg → whisper.cpp with the existing English GGML model; no API/SSE fixture interception in the real test |
| Progress and completion | Rendered stages observed: queued, checking, metadata, downloading, chunking, transcribing, summarizing, completed; four segments displayed |
| Views | Summary, paragraph and timestamp views switched correctly |
| Downloads | Real TXT/Markdown browser downloads contained the title, supplied URL, timestamp ranges and recognized text; isolated tests additionally checked exact fixture summary and segment content |
| History | Saved after completion; refresh restored the transcript. A separate two-result fixture test reopened the earlier transcript |
| Failure UX | Real invalid-URL response displayed visibly. Isolated malformed-response, disconnected-stream, pending-submit and history-clear failure cases now pass |
| Storage | Isolated native IndexedDB blocked-open, quota-on-write and delayed-read fault cases keep completed transcripts visible; exports work without stored history |
| Keyboard/semantics | Arrow/Home/End tab navigation, selected state and panel association passed in Chromium. Progress is a progressbar; messages expose status/alert roles |
| Responsive layout | Desktop 1280×900 and mobile 390×844 genuine captures inspected. Fixture test checks tab-strip fit and page overflow at 390 and 320px |
| JavaScript errors | No page errors in the real run |

Commands: `corepack pnpm build`, `corepack pnpm run test:browser` (**10 passed**), and `corepack pnpm run test:browser:real` (**1 passed**). Nine of the ten isolated cases use synthetic server/fault fixtures; one uses the actual invalid-URL endpoint without starting transcription. The real test uses actual tools and a fresh browser context.

### Confirmed bugs fixed

The first browser fault pass had 2 passing and 6 failing cases. It exposed: stale history reads overwriting the new result; malformed successful responses throwing without a usable message; stream loss leaving the form permanently disabled; duplicate pending submissions; invisible history-clear failures; and a tablist without operable tab roles. These now pass, with IndexedDB connections also closed on failures and the event subscription closed on unmount/replacement. A subsequent screenshot showed mobile tabs escaping their padded area; a small mobile-only padding/tab rule fixes it. A later ambiguous `alert` locator matched Next's own route announcer as well as our error; that was corrected in the test, not misreported as a product bug.

Genuine images: [desktop](../screenshots/v0.2.1-desktop.png), [mobile](../screenshots/v0.2.1-mobile.png). They show uncorrected model output and a real local timestamp, without credentials or local filesystem paths. No UI mockup, generated image or edited transcript was used. Raw exports, browser JSON evidence, failure traces and registry audit snapshots remain ignored under `release-artifacts/`.

Chromium version: **158.0.8127.18**, Playwright **1.65.0**, Windows host, Node **24.14.0**, pnpm **11.5.0**. The screenshots validate these rendered states, not all browser engines or physical mobile devices. Keyboard checks are not a full WCAG or screen-reader certification. Automatic agent skill discovery, Agensi MCP delivery, multi-hour jobs and real Linux/macOS inference remain untested. Closing a tab does not cancel the backend transcription; the UI says processing may continue after a stream disconnect.

### Final clean Git checkout

Cloned the local `release/v0.2.1-final` source commit `fda2b7fccee1baed5cbc89d8f3d89a9c18c7b3e4` with `git clone --no-local --single-branch` into a new temporary checkout outside the project. No `.env.local`, node_modules, dist, build output, tool binaries or model was copied. On that clone, frozen installation, CLI build, CLI help and the production web build all passed; the manifest reported 0.2.1 and Git status was clean. Doctor correctly returned 3 with missing yt-dlp/whisper-cli/model diagnostics; FFmpeg/ffprobe were already on this host's PATH. This is an actual clean Git checkout test with the host package cache, not a pristine OS or a claim that external tools install themselves.
